"""The measures that make sense for a food, beyond grams: kitchen measures, slices, egg sizes.

What makes sense depends on the kind of food. You pour milk (ml, cup), spoon honey (tbsp,
tsp), scoop flour (cup, tbsp, tsp), and slice Emmentaler — nobody measures a block of cheese in
teaspoons. So each kind gets its own measures, and foods of no such kind (meat, fish, biscuits,
chocolate, snacks, ready meals) get none: grams, ounces, the package and their own pieces say
it better.

A cup is a volume; what it weighs depends on the food (flour ~125 g, honey ~340 g). The density
comes from

- the food's own volume unit: USDA lists "1 cup = 249 g" for whole milk, so a tbsp is a
  sixteenth of that;
- or, for products, a pantry category with a density from USDA's own portion weights (flour
  0.53 g/ml, sugar 0.8, olive oil 0.91, butter 0.96, jam 1.35, salt 1.22, milk 1.05, …);
- or a serving size in ml, which makes it a drink (~1 g/ml).

Where none of those is known but the kind is (grated cheese, nuts, cereal, sauce…), a typical
density for that kind is used, and the measures are flagged `estimated` — the app marks them
"≈". Slices of cheese, bread and deli meat are estimated the same way.

US measures, as in USDA's data: 1 cup = 16 tbsp = 48 tsp = 236.6 ml.
"""

from __future__ import annotations

import re

ML_PER_UNIT = {"cup": 236.588, "tbsp": 14.787, "tsp": 4.929, "fl oz": 29.574, "ml": 1.0}
_LABELS = {"cup": "1 cup (237 ml)", "tbsp": "1 tbsp (15 ml)", "tsp": "1 tsp (5 ml)", "ml": "1 ml"}

# The measures each kind of food is taken in.
POURED = ("ml", "cup", "tbsp", "tsp")  # milk, juice, oil, soup
SCOOPED = ("cup", "tbsp", "tsp")  # flour, sugar, rice, seeds, yogurt
SPOONED = ("tbsp", "tsp")  # honey, jam, butter, ketchup, spices
CUPPED = ("cup",)  # cereal flakes, pasta, chopped vegetables
GRATED = ("cup", "tbsp")  # grated cheese, nuts

# Open Food Facts categories with a measured density (g/ml), most specific first.
_CATEGORY_DENSITY: list[tuple[str, float, tuple[str, ...]]] = [
    ("en:honeys", 1.42, SPOONED),
    ("en:syrups", 1.33, POURED),
    ("en:jams", 1.35, SPOONED),
    ("en:salts", 1.22, SPOONED),
    ("en:soy-sauces", 1.08, POURED),
    ("en:ketchup", 1.15, SPOONED),
    ("en:mustards", 1.05, SPOONED),
    ("en:mayonnaises", 0.93, SPOONED),
    ("en:peanut-butters", 1.08, SPOONED),
    ("en:nut-butters", 1.08, SPOONED),
    ("en:butters", 0.96, SPOONED),
    ("en:margarines", 0.96, SPOONED),
    ("en:olive-oils", 0.91, POURED),
    ("en:vegetable-oils", 0.92, POURED),
    ("en:vinegars", 1.01, POURED),
    ("en:flours", 0.53, SCOOPED),
    ("en:sugars", 0.80, SCOOPED),
    ("en:rices", 0.78, SCOOPED),
    ("en:rolled-oats", 0.34, SCOOPED),
    ("en:oat-flakes", 0.34, SCOOPED),
    ("en:cocoa-powders", 0.36, SCOOPED),
    ("en:sour-creams", 0.97, SCOOPED),
    ("en:creams", 1.01, POURED),
    ("en:yogurts", 1.04, SCOOPED),
    ("en:kefirs", 1.04, POURED),
    ("en:plant-based-milk-alternatives", 1.03, POURED),
    ("en:milks", 1.05, POURED),
    ("en:fruit-juices", 1.05, POURED),
    ("en:juices-and-nectars", 1.05, POURED),
    ("en:sodas", 1.04, POURED),
    ("en:soft-drinks", 1.04, POURED),
    ("en:waters", 1.00, POURED),
    ("en:beverages", 1.00, POURED),
]
# Many products carry no category; their name says what they are, in its first word or two.
# Matched at the start only, so "Ciocolată cu lapte" (milk chocolate) is not milk.
_NAME_KINDS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(p, re.IGNORECASE), tag)
    for p, tag in [
        (r"^(miere|honey|miel\b|miele|honig)", "en:honeys"),
        (r"^(gem|dulceaț|dulceat|jam|marmela|confiture|mermelada|marmellata)", "en:jams"),
        (r"^(lapte|milk|leche|latte|milch)\b", "en:milks"),
        (r"^(chefir|kefir)", "en:kefirs"),
        (r"^(iaurt|yogh?urt|yogur|joghurt)", "en:yogurts"),
        (r"^(smântân|smantan|sour cream|crema agria|panna acida|saure sahne)", "en:sour-creams"),
        (r"^(frișcă|frisca|smântână pentru frișcă|cream|nata|panna|sahne)\b", "en:creams"),
        (r"^(ulei de măsline|ulei de masline|olive oil|aceite de oliva|olio d'oliva|olivenöl)", "en:olive-oils"),
        (r"^(ulei|oil\b|aceite|olio|öl\b)", "en:vegetable-oils"),
        (r"^(oțet|otet|vinegar|vinagre|aceto|essig)", "en:vinegars"),
        (r"^(făină|faina|flour|harina|farina|mehl)", "en:flours"),
        (r"^(zahăr|zahar|sugar|azúcar|azucar|zucchero|zucker)", "en:sugars"),
        (r"^(orez|rice|arroz|riso|reis)\b", "en:rices"),
        (r"^(fulgi de ovăz|fulgi de ovaz|ovăz|ovaz|oats|rolled oats|avena|haferflocken)", "en:oat-flakes"),
        (r"^(sare|salt|sal|sale|salz)\b", "en:salts"),
        (r"^(unt|butter|mantequilla|burro)\b", "en:butters"),
        (r"^(margarin)", "en:margarines"),
        (r"^(unt de arahide|peanut butter|crema de cacahuete|burro di arachidi|erdnussbutter)", "en:peanut-butters"),
        (r"^(ketchup)", "en:ketchup"),
        (r"^(muștar|mustar|mustard|mostaza|senape|senf)", "en:mustards"),
        (r"^(maionez|mayonnaise|mayonesa|maionese)", "en:mayonnaises"),
        (r"^(sos de soia|soy sauce|salsa de soja|salsa di soia|sojasauce)", "en:soy-sauces"),
        (r"^(sirop|syrup|jarabe|sciroppo|sirup)", "en:syrups"),
        (r"^(cacao|cocoa|kakao)", "en:cocoa-powders"),
        (r"^(suc|juice|zumo|jugo|succo|saft)\b", "en:juices-and-nectars"),
        (r"^(apă|apa|water|agua|acqua|wasser)\b", "en:waters"),
        (r"^(cașcaval|cascaval|brânz|branz|telemea|emmental|gouda|edam|mozzarella|cheddar|parmesan|parmigiano|cheese|queso|formaggio|käse|kase)", "en:cheeses"),
        (r"^(pâine|paine|bread|brot|pan\b|pane\b|toast)", "en:breads"),
        (r"^(șunc|sunc|salam|ham\b|jamón|jamon|prosciutto|schinken|parizer|pastram|kaiser)", "en:prepared-meats"),
    ]
]
# Dry mixes sit in the drink and milk categories too; a cup of powder weighs nothing like a cup
# of milk.
_NOT_POURED = ("powder", "preparation", "instant", "dried", "condensed", "praf", "pulbere", "condensat", "polvo", "polvere", "pulver")

# Kinds of food with no measured density but a typical one (from USDA's cup weights of
# representative foods). Estimates: "≈" in the app. Cheese is here only grated (see below).
_ESTIMATED_CATEGORY: list[tuple[str, float, tuple[str, ...]]] = [
    ("en:spices", 0.5, SPOONED),
    ("en:herbs", 0.5, SPOONED),
    ("en:breakfast-cereals", 0.2, CUPPED),
    ("en:seeds", 0.6, SCOOPED),
    ("en:nuts-and-their-products", 0.6, GRATED),
    ("en:legumes-and-their-products", 0.8, CUPPED),
    ("en:pastas", 0.45, CUPPED),
    ("en:soups", 1.0, POURED),
    ("en:sauces", 1.05, SCOOPED),
    ("en:condiments", 1.05, SPOONED),
    ("en:spreads", 1.0, SPOONED),
    ("en:dairy-desserts", 1.05, SCOOPED),
    ("en:ice-creams-and-sorbets", 0.55, CUPPED),
    ("en:frozen-vegetables", 0.55, CUPPED),
]
_CHEESE_TAG = "en:cheeses"
_GRATED_WORDS = ("grated", "shredded", "ras", "răzuit", "razuit", "gerieben", "rallado", "grattugiato", "parmesan", "parmigiano", "grana padano")
_GRATED_CHEESE_DENSITY = 0.4
# Soft and fresh cheeses are spooned, not sliced (cottage cheese: a cup weighs ~226 g).
_SOFT_CHEESE_TAGS = {"en:cottage-cheeses", "en:cream-cheeses", "en:fresh-cheeses", "en:ricotta", "en:mascarpone", "en:quark"}
_SOFT_CHEESE_WORDS = ("de vaci", "cottage", "ricotta", "mascarpone", "cream cheese", "cremă de brânză", "crema de branza", "quark", "frischkäse", "philadelphia", "urdă", "urda", "requesón", "requeson")
_SOFT_CHEESE_DENSITY = 0.96

# The same for USDA's food categories (its foods usually list their own measures already).
_ESTIMATED_USDA: dict[str, tuple[float, tuple[str, ...]]] = {
    "beverages": (1.0, POURED),
    "fats and oils": (0.92, SPOONED),
    "soups, sauces, and gravies": (1.0, POURED),
    "spices and herbs": (0.5, SPOONED),
    "breakfast cereals": (0.2, CUPPED),
    "cereal grains and pasta": (0.6, CUPPED),
    "legumes and legume products": (0.8, CUPPED),
    "nut and seed products": (0.6, GRATED),
    "baby foods": (1.0, SPOONED),
}

# Foods eaten by the slice, with a typical slice: cheese (unless grated), bread, deli meat.
_SLICED: list[tuple[set[str], float]] = [
    ({"en:cheeses"}, 20.0),
    ({"en:breads", "en:sliced-breads", "en:toasts"}, 30.0),
    ({"en:hams", "en:salamis", "en:prepared-meats", "en:cold-cuts", "en:sliced-meats"}, 15.0),
]

# Whole eggs by size, edible part, as USDA weighs them.
EGG_SIZES = [("small", 38.0), ("medium", 44.0), ("large", 50.0), ("extra large", 56.0), ("jumbo", 63.0)]
_EGG_TAGS = {"en:eggs", "en:chicken-eggs", "en:fresh-eggs", "en:free-range-chicken-eggs", "en:organic-eggs", "ro:ouă"}
# Named as eggs in any of the app's languages, for products without an egg category:
# "Ouă proaspete", "30 Ouă", "Eggs", "Uova Kaufland".
_EGG_NAME_RE = re.compile(r"^\s*(?:\d+\s+)?(?:ou[aă]?|ouă|eggs?|uova|eier|huevos?)\b", re.IGNORECASE)
_NOT_WHOLE_EGG = ("white", "yolk", "powder", "dried", "liquid", "chocolate", "pasta", "noodle", "protein", "albus", "albuș")
# Quail eggs are a tenth the size: one "egg" unit, not small to jumbo.
_QUAIL = ("prepelit", "prepeliț", "quail", "wachtel", "quaglia", "codorniz")
_QUAIL_EGG_GRAMS = 9.0


def _tags(categories: str, name: str = "") -> set[str]:
    """The product's category tags, plus the kind its name says, for products without one."""
    tags = {tag.strip() for tag in categories.split(",") if tag.strip()}
    return tags | {tag for pattern, tag in _NAME_KINDS if pattern.match(name.strip())}


def _is_soft_cheese(tags: set[str], name: str) -> bool:
    return bool(tags & _SOFT_CHEESE_TAGS) or any(word in name.lower() for word in _SOFT_CHEESE_WORDS)


def _is_grated(name: str) -> bool:
    return any(re.search(rf"\b{re.escape(word)}\b", name.lower()) for word in _GRATED_WORDS)


def measured_kind(categories: str, serving_size: str = "", name: str = "") -> tuple[float, tuple[str, ...]] | None:
    """(g per ml, measures) for a product of a pantry kind with a measured density — from its
    category, or for a product without one, its name."""
    tags = _tags(categories, name)
    if any(word in tag for tag in tags for word in _NOT_POURED) or any(word in name.lower() for word in _NOT_POURED):
        return None
    for tag, density, units in _CATEGORY_DENSITY:
        if tag in tags:
            return density, units
    if "ml" in serving_size.lower():
        return 1.0, POURED
    return None


def estimated_kind(categories: str, name: str) -> tuple[float, tuple[str, ...]] | None:
    """(typical g per ml, measures) for a product whose kind takes kitchen measures, else None."""
    tags = _tags(categories, name)
    if _is_soft_cheese(tags, name):
        return _SOFT_CHEESE_DENSITY, SCOOPED
    if _CHEESE_TAG in tags:
        return (_GRATED_CHEESE_DENSITY, GRATED) if _is_grated(name) else None
    return next(((density, units) for tag, density, units in _ESTIMATED_CATEGORY if tag in tags), None)


def estimated_usda_kind(category: str) -> tuple[float, tuple[str, ...]] | None:
    return _ESTIMATED_USDA.get(category.strip().lower())


def typical_slices(categories: str, name: str) -> list[dict]:
    """A typical slice, for cheese (not grated), bread and deli meat; flagged estimated."""
    tags = _tags(categories, name)
    for kinds, grams in _SLICED:
        if tags & kinds and not (_CHEESE_TAG in kinds and (_is_grated(name) or _is_soft_cheese(tags, name))):
            return [{"unit": "slice", "label": f"1 slice (≈{grams:g} g)", "grams": grams, "estimated": True}]
    return []


def is_whole_egg(categories: str, name: str) -> bool:
    """An egg product sold as whole eggs: not whites, powder, or a chocolate egg."""
    text = f"{categories} {name}".lower()
    egg = bool(_tags(categories) & _EGG_TAGS) or bool(_EGG_NAME_RE.match(name))
    return egg and not any(word in text for word in _NOT_WHOLE_EGG)


def with_egg_sizes(servings: list[dict], name: str = "") -> list[dict]:
    """`servings` plus the egg sizes it doesn't have yet — or one quail egg, for quail eggs."""
    have = {serving["unit"] for serving in servings}
    sizes = [("egg", _QUAIL_EGG_GRAMS)] if any(word in name.lower() for word in _QUAIL) else EGG_SIZES
    return [
        *servings,
        *(
            {"unit": size, "label": f"1 egg ({grams:g} g)" if size == "egg" else f"1 {size} egg ({grams:g} g)", "grams": grams}
            for size, grams in sizes
            if size not in have
        ),
    ]


def with_kitchen_measures(
    servings: list[dict],
    measured: tuple[float, tuple[str, ...]] | None = None,
    *,
    poured: bool = False,
    estimate: tuple[float, tuple[str, ...]] | None = None,
) -> list[dict]:
    """`servings` plus the kitchen measures the food takes, where its density is known.

    A plain volume unit already in `servings` ("cup", "tbsp", "fl oz") gives the density and
    wins: it was weighed for this very food, which is measured by volume — cup, tbsp and tsp,
    and ml when `poured` or the unit is fl oz. Else `measured` (a pantry category's density and
    measures), else `estimate` (a typical one), flagged `estimated`. Units the food has are kept
    as they are; only missing measures are added, after them.
    """
    density, units, estimated = None, (), False
    for serving in servings:
        ml = ML_PER_UNIT.get(serving["unit"])
        if ml:
            liquid = poured or serving["unit"] in ("fl oz", "ml")
            density, units = serving["grams"] / ml, POURED if liquid else SCOOPED
            break
    else:
        if measured:
            density, units = measured
        elif estimate:
            (density, units), estimated = estimate, True
    if not density:
        return servings
    have = {serving["unit"] for serving in servings}
    added = [
        {"unit": unit, "label": _LABELS[unit], "grams": round(density * ML_PER_UNIT[unit], 2)}
        | ({"estimated": True} if estimated else {})
        for unit in units
        if unit not in have
    ]
    return [*servings, *added]
