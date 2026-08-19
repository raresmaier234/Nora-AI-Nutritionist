"""Extraction of Schema.org JSON-LD objects from an HTML document.

Pure functions — no network access — so every shape below is testable from a string.
"""

import json
from typing import Any, Iterator

from bs4 import BeautifulSoup

LD_JSON_MIME = "application/ld+json"


def _is_ld_json(value: str | None) -> bool:
    """Match the JSON-LD mime type, tolerating a charset suffix."""
    return bool(value) and value.split(";")[0].strip().lower() == LD_JSON_MIME


def iter_json_ld_nodes(node: Any) -> Iterator[dict]:
    """Yield every JSON-LD object reachable from `node`.

    Real pages use three interchangeable shapes — a bare object, a top-level array, or
    an `@graph` wrapper — and nest them freely. Walking recursively flattens all of them
    into one stream of dicts so callers don't have to care which was used.
    """
    if isinstance(node, list):
        for item in node:
            yield from iter_json_ld_nodes(item)
    elif isinstance(node, dict):
        yield node
        if (graph := node.get("@graph")) is not None:
            yield from iter_json_ld_nodes(graph)


def _types(obj: dict) -> set[str]:
    """Return an object's `@type` values. `@type` may be a string or a list of strings."""
    declared = obj.get("@type", [])
    if isinstance(declared, str):
        return {declared}
    if isinstance(declared, list):
        return {t for t in declared if isinstance(t, str)}
    return set()


def extract_json_ld(html: str) -> list[dict]:
    """Return every JSON-LD object embedded in `html`.

    Script tags holding invalid JSON are skipped rather than failing the whole page — a
    single malformed block is common and shouldn't discard the valid ones alongside it.
    """
    soup = BeautifulSoup(html, "html.parser")

    nodes: list[dict] = []
    for script in soup.find_all("script", attrs={"type": _is_ld_json}):
        raw = script.get_text()
        if not raw or not raw.strip():
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        nodes.extend(iter_json_ld_nodes(payload))

    return nodes


def find_by_type(nodes: list[dict], type_name: str) -> list[dict]:
    """Return the nodes declaring `type_name` among their `@type` values."""
    return [node for node in nodes if type_name in _types(node)]
