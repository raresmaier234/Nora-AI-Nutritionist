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
import unicodedata
from dataclasses import dataclass
from decimal import Decimal

import httpx
from bs4 import BeautifulSoup

from app.core.config import get_settings
from app.services.ingest.measures import numbers_in, parse_measurement

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

The page may be in any language. Read it in that language; do not translate.

Rules:
- Copy only values that appear literally in the text above. Never invent a value.
- Never convert between units. Never do arithmetic. Never round.
- Keep a decimal comma as printed; do not change it to a point.
- Where a page shows the same nutrient more than once, take the column for the product
  itself, not a comparison, average or reference column.
Deciding "basis" — read the heading directly above the nutrition table:
- Use "per_100g" ONLY if that heading explicitly says per 100g or per 100ml, in whatever
  language the page uses (for example "pro", "la", "pour", "je" before the amount).
- Otherwise the figures describe one serving: use "per_serving". A heading naming an
  amount (an ounce, a slice, a cup, a piece) means per_serving, not per_100g.
- When the heading gives a weight in parentheses, put that weight in "serving_grams".
  Copy it as written. This is what lets the values be converted correctly later, so do
  not leave it null when the page states it.
- If a page shows both a serving table and a separate per-100g figure, prefer the table
  and record its serving weight.
- Use null for any nutrient the page does not state. Never guess.
- "name" is the product name as written, in the page's own language.

Labels vary between pages and languages. Map them onto the fields by meaning; these are
examples, not a complete list:
- calories: "Energy", "Calories", "Energy value", "Energie", "Valoare energetică",
  "Brennwert", "Énergie", "Energia", "kcal"
- protein: "Protein", "Proteins", "Proteine", "Eiweiß", "Protéines", "Białko"
- carbs: "Carbohydrate", "Carbohydrates", "Total carbohydrate", "Carbs", "Carbohidrați",
  "Glucide", "Kohlenhydrate", "Glucides", "Carboidrati", "Hidratos de carbono"
- fat: "Fat", "Total fat", "Fats", "Grăsimi", "Lipide", "Fett", "Lipides", "Grassi", "Grasas"
- saturated_fat: "Saturated fat", "Saturates", "of which saturates", "Acizi grași
  saturați", "davon gesättigte Fettsäuren", "dont acides gras saturés"
- sugar: "Sugars", "of which sugars", "Total sugars", "Zaharuri", "Zucker", "Sucres"
- fiber: "Fibre", "Fiber", "Dietary fibre", "Fibre alimentare", "Ballaststoffe"
- sodium: "Sodium", "Sodiu", "Natrium" (use the sodium row, not the salt row)

Reply with JSON only."""


class ExtractionError(RuntimeError):
    """The model could not be reached, or returned something unusable."""


@dataclass(frozen=True)
class ExtractionResult:
    """Raw, unnormalized foods exactly as the model reported them."""

    foods: list[dict]
    model: str


# Words that mark a region as carrying a nutrition panel, matched against lowercased text
# with accents removed (see `_fold`). Sites split into two English vocabularies — European
# labels say "energy / kJ / carbohydrate", American ones "calories / carbs / fats" — and
# then into every other language. A list covering only English silently fails elsewhere:
# a Romanian panel ("Carbohidrați", "Proteine", "Grăsimi") matched only "kcal" and
# "protein", fell short of the minimum, and the model was handed the whole page instead.
#
# Stems are chosen so no marker contains another ("protein" already covers "proteine",
# "proteines", "proteinas"); an overlap would count one word twice.
_NUTRITION_MARKERS = (
    # English
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
    # Energy in other languages
    "energie",  # ro, de, fr, nl
    "energia",  # it, es, pt, pl, hu
    "brennwert",  # de
    # Carbohydrates
    "carbohidrat",  # ro, es
    "carboidrat",  # it
    "glucide",  # ro, fr
    "kohlenhydrat",  # de
    "koolhydrat",  # nl
    "weglowodan",  # pl
    "ugljikohidrat",  # hr
    # Fat
    "grasimi",  # ro
    "grassi",  # it
    "grasas",  # es
    "lipid",  # fr, it
    "fett",  # de
    "vetten",  # nl
    "tłuszcz",  # pl
    "masti",  # hr
    # Protein, where it is not a form of "protein"
    "eiwei",  # de
    "eiwit",  # nl
    "białk",  # pl
    "bjelancevin",  # hr
    # Sugar and fibre
    "zahar",  # ro
    "zucker",  # de
    "zuccher",  # it
    "sucre",  # fr
    "azucar",  # es
    "ballaststoff",  # de
    "fibra",  # it, es
    # Cyrillic (bg, ru)
    "белтъчин",
    "въглехидрат",
    "мазнин",
    "белк",
    "углевод",
    "жир",
)

# A region needs several of them; one stray "energy" in marketing copy is not a panel.
_MIN_MARKERS = 3


_COMBINING_MARK_RE = re.compile(r"[\u0300-\u036f]")


def _fold(text: str) -> str:
    """Strip accents so "Grăsimi" matches "grasimi" and "Nährwerte" matches "nahrwerte".

    Keeps one character per input character, so an index found in the folded text is
    valid in the original.
    """
    return "".join(
        _COMBINING_MARK_RE.sub("", unicodedata.normalize("NFKD", ch))[:1] or ch for ch in text
    )


def _looks_nutritional(text: str) -> bool:
    folded = _fold(text).lower()
    return sum(marker in folded for marker in _NUTRITION_MARKERS) >= _MIN_MARKERS


def _collapse(text: str) -> str:
    # Every whitespace run but newlines, including the non-breaking spaces sites put
    # between a label and its value.
    text = re.sub(r"[^\S\n]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    # Keep "Label:" and its value on one line. Markup like <strong>Proteine:</strong> 11,85 g
    # otherwise splits them, and llama3.2 then misses the pairing: it returned protein as
    # null on every page of a site laid out that way.
    text = re.sub(r": ?\n ?(?=\S)", ": ", text)
    return text.strip()


# The heading a nutrition table sits under. Everything before it on a product page tends
# to be marketing copy and — the expensive part — interactive amount pickers.
# Matched against accent-folded text, so the patterns are written without accents.
_PANEL_HEADINGS = (
    r"nutrition\s+facts|nutrition\s+information|nutritional\s+(?:value|information)"
    r"|typical\s+values"
    r"|valo(?:are|ri)\s+nutriti(?:va|onale)|informatii\s+nutritionale"  # ro
    r"|n(?:a|ae)hrwert(?:e|angaben|tabelle)?"  # de
    r"|valeurs?\s+nutritionnelles?|informations?\s+nutritionnelles?"  # fr
    r"|valori\s+nutrizionali|informazioni\s+nutrizionali"  # it
    r"|informacion\s+nutricional|valor(?:es)?\s+nutricional(?:es)?"  # es
    r"|voedingswaarde"  # nl
    r"|wartosc\s+odzywcza|wartosci\s+odzywcze"  # pl
    r"|(?:nutritivna|hranjiva|prehrambena)\s+vrijednost"  # hr
    r"|хранителна\s+стоиност|пищевая\s+ценность"  # bg, ru
)

_PANEL_HEADING_RE = re.compile(
    rf"^\s*({_PANEL_HEADINGS})\b",
    re.IGNORECASE | re.MULTILINE,
)


# Signals that a chunk of text says what its numbers are *per*: a panel caption, an
# explicit per-100 statement, or a serving weight in parentheses.
_BASIS_CUE_RE = re.compile(
    rf"{_PANEL_HEADINGS}"
    r"|(?:per|pro|la|pour|je|por|na|za|на|для)\s*100\s*(?:g|ml|гр?)"
    r"|serving\s+size|\(\s*\d+(?:[.,]\d+)?\s*(?:g|ml)\s*\)",
    re.IGNORECASE,
)


def _states_a_basis(text: str) -> bool:
    return bool(_BASIS_CUE_RE.search(_fold(text)))


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
    # Searched in folded text; _fold keeps positions, so the index applies to `panel`.
    match = _PANEL_HEADING_RE.search(_fold(panel))
    if match is None:
        return panel

    trimmed = panel[match.start() :].strip()
    # Only worth it if a table plausibly follows; otherwise we matched a stray mention.
    return trimmed if _looks_nutritional(trimmed) else panel


def nutrition_panel(html: str, *, max_chars: int = 12_000) -> str | None:
    """The page's nutrition panel as text, with its heading — or None if it has none.

    Whole-page text is actively harmful, not merely wasteful. A product page repeats energy
    in comparison columns, per-serving columns and scoring widgets; given all of it, the
    model blends the variants into a figure that appears nowhere on the page. Feeding it the
    nutrition panel alone is both more accurate and far cheaper — a table is a few hundred
    characters against twelve thousand, and the local model is output-bound at ~50 tokens/s.

    A page with no panel should not reach the model at all. Given a category page that only
    listed thirteen fruit names, llama3.2 invented nutrition values for all thirteen —
    mutually consistent, so they passed every check — including 45 kcal for coconut.
    """
    soup = _strip_page_furniture(html)

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

    return None


def html_to_text(html: str, *, max_chars: int = 12_000) -> str:
    """The nutrition panel if the page has one, otherwise the whole page's text.

    The whole-page fallback is for callers that want *some* text. The crawler does not use
    it: see `nutrition_panel` for why a page without a panel is skipped instead.
    """
    panel = nutrition_panel(html, max_chars=max_chars)
    if panel is not None:
        return panel
    return _collapse(_strip_page_furniture(html).get_text(separator="\n"))[:max_chars]


def _strip_page_furniture(html: str) -> BeautifulSoup:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "nav", "footer", "header"]):
        tag.decompose()
    return soup


# A weight as a page prints it: "28g", "(28 g)", "14,5 g", "250 ml".
_PRINTED_WEIGHT_RE = re.compile(
    r"(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(?:g|gr|grams?|ml)\b", re.IGNORECASE
)


# Words that introduce a serving, in the languages the markers cover. Matched against
# accent-folded text.
_SERVING_CUE_RE = re.compile(
    r"\b(?:serving|portion|portie|porcja|porcion|porzione|per|pro|for|pour|je|la|size|slice"
    r"|cup|tbsp|tsp|oz|piece|bucata|stuck)\b",
    re.IGNORECASE,
)


def _printed_serving_weights(page_text: str) -> set[Decimal]:
    """Weights the page prints *as a serving*: in parentheses, or on a line naming one.

    A bare "Carbohydrate: 50 g" row is a nutrient, not a serving; accepting it would let a
    serving weight the model invented pass as long as some nutrient shared its number.
    """
    weights: set[Decimal] = set()
    for line in _fold(page_text).splitlines():
        in_parentheses = re.findall(r"\(([^()]*)\)", line)
        candidates = in_parentheses + ([line] if _SERVING_CUE_RE.search(line) else [])
        for chunk in candidates:
            for number in _PRINTED_WEIGHT_RE.findall(chunk):
                parsed = parse_measurement(f"{number} g")
                if parsed is not None:
                    weights.add(parsed.value)
    return weights


def drop_unprinted_serving_weights(foods: list[dict], page_text: str) -> list[dict]:
    """Discard any serving weight the page does not actually print as a serving.

    The serving weight is the most dangerous value the model reports: every nutrient is
    divided by it, so a wrong one rescales the whole row, and the Atwater check cannot see
    a uniform rescale. On a page reading "kcal: 50 kcal" llama3.2 reported a 50g serving
    that appears nowhere, and the food was stored at twice its real energy. A weight the
    page does not print as a serving is dropped; the normalizer then rejects the food rather
    than guessing. This narrows the model's room to invent a weight; it cannot remove it.
    """
    printed = _printed_serving_weights(page_text)
    grounded = []
    for food in foods:
        serving = food.get("serving_grams")
        if serving is not None and _first_number(serving) not in printed:
            logger.info("dropping serving weight %r: not printed on the page", serving)
            food = {**food, "serving_grams": None}
        grounded.append(food)
    return grounded


def _first_number(value: object) -> Decimal | None:
    # The same parser the normalizer uses, so the two never disagree about "1,125 g".
    parsed = parse_measurement(value)
    return parsed.value if parsed is not None else None


_NUTRIENT_VALUE_FIELDS = (
    "calories",
    "protein",
    "fat",
    "saturated_fat",
    "carbs",
    "fiber",
    "sugar",
    "sodium",
)


def drop_unprinted_values(foods: list[dict], page_text: str) -> list[dict]:
    """Discard any nutrient value whose number does not appear in the page text.

    The prompt tells the model to copy values, and the schema makes it return strings, but
    a small model still fills gaps with plausible numbers. Checking each number against the
    text it was given is the one test that catches an invented value that happens to be
    consistent with the others. A food left with no values is then rejected downstream.
    """
    printed = numbers_in(page_text)
    grounded = []
    for food in foods:
        dropped = {
            field: None
            for field in _NUTRIENT_VALUE_FIELDS
            if food.get(field) is not None and _first_number(food[field]) not in printed
        }
        if dropped:
            logger.info(
                "dropping values not on the page for %r: %s", food.get("name"), sorted(dropped)
            )
            food = {**food, **dropped}
        grounded.append(food)
    return grounded


# How each field's row is labelled, in the languages the markers cover. Matched at the
# start of a line in accent-folded text, so "Grăsimi" is written "grasimi" here. Longer
# labels come first so "total fat" is not cut short at "fat".
_FIELD_LABELS = {
    "calories": (
        r"valoare energetica|energy|energie|energia|brennwert|calories|calorii|kcal"
    ),
    "protein": r"proteins?|proteine|proteines|proteinas|eiweiss|eiweiß|eiwit|białko|bjelancevine"
    r"|белтъчини|белки",
    "fat": r"total fat|fats?|grasimi|fett|lipide|lipides|lipidi|grassi|grasas|tłuszcz|masti|vetten"
    r"|мазнини|жиры",
    "carbs": r"total carbohydrates?|carbohydrates?|carbs|carbohidrati|glucide|glucides"
    r"|kohlenhydrate|carboidrati|hidratos de carbono|weglowodany|ugljikohidrati|koolhydraten"
    r"|въглехидрати|углеводы",
    "fiber": r"dietary fib(?:re|er)|fib(?:re|er)|fibre alimentare|ballaststoffe|fibra",
    "sugar": r"total sugars|(?:of which )?sugars?|zaharuri|zucker|sucres|zuccheri|azucares",
    "sodium": r"sodium|sodiu|natrium|sodio",
}

# One printed value: a number with an optional unit, ending its line.
_LABELLED_VALUE = r"(\d[\d.,  ]*\s*(?:kcal|kj|mg|mcg|µg|g)?)[ \t]*$"


def field_for_label(label: str) -> str | None:
    """The field a nutrition row's label names ("Grăsimi (grame)" -> "fat"), if any."""
    folded = _fold(label).strip()
    for field, labels in _FIELD_LABELS.items():
        if re.match(rf"(?:{labels})\b", folded, re.IGNORECASE):
            return field
    return None


def fill_from_labels(foods: list[dict], page_text: str) -> list[dict]:
    """Fill values the model left null from rows that plainly read "Label: value".

    llama3.2 reliably skips some rows it was shown: on a page listing kcal, carbohydrates,
    protein and fat in that order, it returned protein as null every time. A row whose
    label is unambiguous and whose value is the only one on its line needs no model, so
    Python reads it directly.

    Only done for a single-food page, and only for a label followed by exactly one value.
    A second number (a per-serving column next to a per-100g one) makes the row ambiguous,
    and it is left alone rather than risk pairing a value with the wrong basis.
    """
    if len(foods) != 1:
        return foods

    folded = _fold(page_text)
    food = foods[0]
    filled = {}
    for field, labels in _FIELD_LABELS.items():
        if food.get(field) is not None:
            continue
        pattern = rf"^[ \t]*(?:{labels})[ \t]*:?[ \t]*\n?[ \t]*{_LABELLED_VALUE}"
        matches = list(re.finditer(pattern, folded, re.IGNORECASE | re.MULTILINE))
        if len(matches) != 1:
            continue
        value = page_text[matches[0].start(1) : matches[0].end(1)].strip()
        # A second column would start the next line with a number.
        following = page_text[matches[0].end() :].lstrip("\n ").split("\n", 1)[0]
        if following[:1].isdigit():
            continue
        filled[field] = value

    if filled:
        logger.info("read %s from labelled rows for %r", sorted(filled), food.get("name"))
        return [{**food, **filled}]
    return foods


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
            foods=fill_from_labels(
                drop_unprinted_values(
                    drop_unprinted_serving_weights(
                        [food for food in foods if isinstance(food, dict)], page_text
                    ),
                    page_text,
                ),
                page_text,
            ),
            model=self._model,
        )

    def extract_from_html(self, html: str) -> ExtractionResult:
        """Convenience wrapper: strip the markup, then extract."""
        return self.extract(html_to_text(html))
