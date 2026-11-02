"""Canonical name folding, shared by the ORM and the ingestion pipeline."""

import re
import unicodedata


# Look-alikes typed for Romanian letters. ș and ț take a comma below; the cedilla forms (ş, ţ)
# are a legacy stand-in that still turns up. ă gets typed as ā or ǎ ("Brânzā", "Lapte
# bǎtut"), letters none of the app's languages use otherwise.
_ROMANIAN_LETTERS = str.maketrans(
    {"ş": "ș", "Ş": "Ș", "ţ": "ț", "Ţ": "Ț", "ā": "ă", "Ā": "Ă", "ǎ": "ă", "Ǎ": "Ă"}
)


def clean_display_name(name: str) -> str:
    """Repair a name for display: "babuÈ™cÄƒ" -> "Babușcă".

    Some sites store UTF-8 text that was once decoded as Windows-1252 and encoded again, so
    their pages carry "Ã®" for "î" and "È›" for "ț". Re-encoding as Windows-1252 recovers
    the original bytes. A name only counts as mangled if those bytes then decode as UTF-8,
    which ordinary accented text ("Crème", "Øgo") does not, so it is left alone.
    """
    try:
        # Windows-1252 leaves 0x81, 0x8D, 0x8F, 0x90 and 0x9D unmapped; a decoder passes
        # those through as the latin-1 control characters, so map them back the same way.
        raw = bytes(
            ord(ch) if 0x80 <= ord(ch) <= 0x9F else ch.encode("cp1252")[0] for ch in name
        )
        repaired = raw.decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        repaired = name
    cleaned = unicodedata.normalize("NFC", repaired).translate(_ROMANIAN_LETTERS)
    # Sites disagree on case ("babușcă", "Kiwi"); every stored name starts with a capital.
    # Only the first letter changes, so later capitals ("Lapte UHT Zuzu") are kept.
    return cleaned[:1].upper() + cleaned[1:]


def normalize_name(name: str) -> str:
    """Fold a display name into a dedup key.

    Case, accents, punctuation and spacing all vary between sites for the same food, and
    none of them distinguish one food from another: "Crème Fraîche", "Creme fraiche" and
    "CREME  FRAICHE" are one ingredient.
    """
    decomposed = unicodedata.normalize("NFKD", name)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    collapsed = re.sub(r"[^a-z0-9]+", " ", stripped.casefold())
    return collapsed.strip()


def food_key(name: str, brand: str | None = None, store: str | None = None) -> str:
    """The dedup key for a food: its name, brand and store folded together.

    Brand and store belong in the key: "Afine congelate" from Hortex and from Ecofruct are
    two products, and keying on the name alone would merge them.
    """
    return normalize_name(" ".join(part for part in (name, brand, store) if part))
