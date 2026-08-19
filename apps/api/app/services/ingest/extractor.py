"""Extraction of food nutrition facts from page text, using a local Ollama model.

The model's only job is to find what a page *says* and report it verbatim. It is explicitly
not asked to convert units or compute anything — benchmarked on llama3.2, it extracts
already-per-100g labels accurately but produces confidently wrong numbers when arithmetic is
involved. `app.services.ingest.normalizer` does the maths afterwards, deterministically.

The response schema enforces that division: every nutrient field is typed as a *string*, so
the model has to copy what it read rather than calculate a replacement.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

import httpx
from bs4 import BeautifulSoup

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_NUTRIENT_FIELDS = (
    "calories",
    "protein",
    "fat",
    "saturated_fat",
    "carbs",
    "fiber",
    "sugar",
    "sodium",
)

# Every value is a string. Typing these as numbers invites the model to convert units,
# which is exactly the failure mode this design avoids.
EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "foods": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "basis": {"type": "string", "enum": ["per_100g", "per_serving"]},
                    "serving_grams": {"type": ["string", "null"]},
                    **{field: {"type": ["string", "null"]} for field in _NUTRIENT_FIELDS},
                },
                "required": ["name", "basis", "serving_grams", *_NUTRIENT_FIELDS],
                "additionalProperties": False,
            },
        }
    },
    "required": ["foods"],
    "additionalProperties": False,
}

# Deliberately contains no example values. A small model treats concrete numbers in the
# prompt as answers: with sample figures here, llama3.2 copied them onto every product it
# was shown, reporting the same calorie count for chocolate spread, cola and pasta.
SYSTEM_PROMPT = """You read nutrition information off web pages.

Return every distinct food product on the page, with its nutrition facts.

For each nutrient, copy the number and unit EXACTLY as they appear in the page text you
were given, as a string. Preserve the digits and the unit exactly as printed.

Rules:
- Copy only values that appear literally in the text above. Never invent a value.
- Never convert between units. Never do arithmetic. Never round.
- Where a page shows the same nutrient more than once, take the column for the product
  itself, not a comparison, average or reference column.
Deciding "basis" — read the heading directly above the nutrition table:
- Use "per_100g" ONLY if that heading explicitly says per 100g or per 100ml.
- Otherwise the figures describe one serving: use "per_serving". A heading naming an
  amount ("For one ounce of X", "Per slice", "Per cup") means per_serving, not per_100g.
- When the heading gives a weight in parentheses, put that weight in "serving_grams".
  Copy it as written. This is what lets the values be converted correctly later, so do
  not leave it null when the page states it.
- If a page shows both a serving table and a separate per-100g figure, prefer the table
  and record its serving weight.
- Use null for any nutrient the page does not state. Never guess.
- "name" is the product name as written.

Labels vary between pages. Map them onto the fields:
- calories: "Energy", "Calories", "Energy value"
- protein: "Protein", "Proteins"
- carbs: "Carbohydrate", "Carbohydrates", "Total carbohydrate", "Carbs"
- fat: "Fat", "Total fat", "Fats"
- saturated_fat: "Saturated fat", "Saturates", "of which saturates"
- sugar: "Sugars", "of which sugars", "Total sugars"
- fiber: "Fibre", "Fiber", "Dietary fibre"
- sodium: "Sodium" (use the sodium row, not the salt row)

Reply with JSON only."""


class ExtractionError(RuntimeError):
    """The model could not be reached, or returned something unusable."""


@dataclass(frozen=True)
class ExtractionResult:
    """Raw, unnormalized foods exactly as the model reported them."""

    foods: list[dict]
    model: str


# Words that mark a region as carrying a nutrition panel. Sites split roughly into two
# vocabularies — European labels say "energy / kJ / carbohydrate", American ones say
# "calories / carbs / fats" — and a list covering only one silently fails on the other.
_NUTRITION_MARKERS = (
    "kcal",
    "kilojoule",
    "kj",
    "energy",
    "calorie",
    "protein",
    "carbohydrate",
    "carbs",
    "fat",
    "sugar",
    "sodium",
    "fiber",
    "fibre",
)

# A region needs several of them; one stray "energy" in marketing copy is not a panel.
_MIN_MARKERS = 3


def _looks_nutritional(text: str) -> bool:
    lowered = text.lower()
    return sum(marker in lowered for marker in _NUTRITION_MARKERS) >= _MIN_MARKERS


def _collapse(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text.strip()


# The heading a nutrition table sits under. Everything before it on a product page tends
# to be marketing copy and — the expensive part — interactive amount pickers.
_PANEL_HEADING_RE = re.compile(
    r"^\s*(nutrition\s+facts|nutrition\s+information|nutritional\s+(?:value|information)"
    r"|typical\s+values)\b",
    re.IGNORECASE | re.MULTILINE,
)


# Signals that a chunk of text says what its numbers are *per*: a panel caption, an
# explicit per-100 statement, or a serving weight in parentheses.
_BASIS_CUE_RE = re.compile(
    r"nutrition\s+facts|nutrition\s+information|nutritional\s+(?:value|information)"
    r"|typical\s+values|per\s*100\s*(?:g|ml)|serving\s+size|\(\s*\d+(?:\.\d+)?\s*(?:g|ml)\s*\)",
    re.IGNORECASE,
)


def _states_a_basis(text: str) -> bool:
    return bool(_BASIS_CUE_RE.search(text))


def _trim_to_panel_heading(panel: str) -> str:
    """Drop everything before the nutrition table's own heading.

    Product pages often precede the table with a serving-size picker listing every unit
    the site supports — grams, ounces, cups, and a ladder of amounts. Those numbers sit
    inches from the real table and the model conflates them with it: on one page it
    reported a 50g serving weight lifted straight from the picker, against a table that
    was actually per tablespoon, and stored the food at a fifth of its true energy.

    The table's heading also carries the basis and the serving weight, which is exactly
    what the extractor needs, so anchoring here keeps the signal and drops the noise.
    """
    match = _PANEL_HEADING_RE.search(panel)
    if match is None:
        return panel

    trimmed = panel[match.start() :].strip()
    # Only worth it if a table plausibly follows; otherwise we matched a stray mention.
    return trimmed if _looks_nutritional(trimmed) else panel


def html_to_text(html: str, *, max_chars: int = 12_000) -> str:
    """Reduce a page to the text worth showing the model.

    Whole-page text is actively harmful, not merely wasteful. A product page repeats energy
    in comparison columns, per-serving columns and scoring widgets; given all of it, the
    model blends the variants into a figure that appears nowhere on the page. Feeding it the
    nutrition panel alone is both more accurate and far cheaper — a table is a few hundred
    characters against twelve thousand, and the local model is output-bound at ~50 tokens/s.

    Falls back to whole-page text when no panel is recognisable.
    """
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "noscript", "svg", "nav", "footer", "header"]):
        tag.decompose()

    # The product's identity lives in the heading, not the panel.
    heading = ""
    for selector in ("h1", "title"):
        found = soup.find(selector)
        if found and found.get_text(strip=True):
            heading = found.get_text(strip=True)
            break

    panels = [
        _collapse(element.get_text(separator="\n"))
        for element in soup.find_all(["table", "section", "div"])
        if _looks_nutritional(element.get_text(" ", strip=True))
    ]

    if panels:
        # Smaller is better — outer containers wrap the panel in page noise — but not at
        # the cost of the basis. The innermost element is often the bare nutrient grid,
        # stripped of the "Nutrition Facts / For 1 tbsp (14g)" caption that states what
        # the numbers are per. Without it the model has to guess, and it guesses per-100g.
        with_basis = [p for p in panels if _states_a_basis(p)]
        panel = min(with_basis or panels, key=len)
        return _collapse(f"{heading}\n{_trim_to_panel_heading(panel)}")[:max_chars]

    return _collapse(soup.get_text(separator="\n"))[:max_chars]


class OllamaExtractor:
    """Extracts foods from page text via a local Ollama model."""

    def __init__(
        self,
        *,
        model: str | None = None,
        host: str | None = None,
        timeout: float | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        settings = get_settings()
        self._model = model or settings.ollama_model
        self._host = (host or settings.ollama_host).rstrip("/")
        self._timeout = timeout if timeout is not None else settings.ollama_timeout_seconds
        self._client = client

    def extract(self, page_text: str) -> ExtractionResult:
        """Return the foods the model finds in `page_text`, unnormalized."""
        payload = {
            "model": self._model,
            "stream": False,
            "format": EXTRACTION_SCHEMA,
            # Deterministic: this is extraction, not composition. Also makes reruns of a
            # failed job reproducible.
            "options": {"temperature": 0},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": page_text},
            ],
        }

        try:
            if self._client is not None:
                response = self._client.post(
                    f"{self._host}/api/chat", json=payload, timeout=self._timeout
                )
            else:
                with httpx.Client(timeout=self._timeout) as client:
                    response = client.post(f"{self._host}/api/chat", json=payload)
        except httpx.RequestError as exc:
            raise ExtractionError(f"could not reach Ollama at {self._host}") from exc

        if response.status_code != 200:
            raise ExtractionError(f"Ollama returned status {response.status_code}")

        try:
            content = response.json()["message"]["content"]
        except (KeyError, ValueError) as exc:
            raise ExtractionError("Ollama response was not in the expected shape") from exc

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            # The schema should prevent this; if it happens the model or runtime changed.
            raise ExtractionError("model did not return valid JSON") from exc

        foods = parsed.get("foods")
        if not isinstance(foods, list):
            raise ExtractionError("model output had no 'foods' list")

        return ExtractionResult(
            foods=[food for food in foods if isinstance(food, dict)],
            model=self._model,
        )

    def extract_from_html(self, html: str) -> ExtractionResult:
        """Convenience wrapper: strip the markup, then extract."""
        return self.extract(html_to_text(html))
