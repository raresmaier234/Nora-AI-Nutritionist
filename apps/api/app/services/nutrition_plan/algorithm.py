"""The algorithm: energy, paces, calories, macros and rounding. Pure functions.

Normative: "The algorithm" in docs/plans/ai-nutrition-plan.md (reasons in review §4–§5). The
order matters and is the spec's:

1. Energy: BMR (Mifflin–St Jeor), TDEE from daily activity plus exercise days.
2. The requested rate, from the pace or a custom date; clamped only on the unsafe side.
3. Calories from that rate, within the deficit cap and the calorie floors (or the surplus band).
4. The effective rate, from the calories actually set. **The goal date comes from it.**
5. Macros, in the order protein → fat → carbs, then fibre; then display rounding.

Rates are kg a week; "fractions" are of body weight a week (0.005 = 0.5%).
"""

import math
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.services.nutrition_plan import gates
from app.services.nutrition_plan.gates import LOSS_GOALS, MUSCLE_GOALS
from app.services.nutrition_plan.person import Person

# ≈ 7,700 kcal per kg of body weight change [C]; the weekly reviews correct for it.
KCAL_PER_KG = 7700.0

# --- Energy ----------------------------------------------------------------------------------

SEX_CONSTANT = {"male": 5.0, "female": -161.0, "unspecified": -78.0}
# Daily movement outside workouts (review §4); exercise days are added on top.
ACTIVITY_BASE = {"mostly_sitting": 1.2, "some_walking": 1.375, "on_feet": 1.5, "physical_work": 1.7}
PER_STRENGTH_DAY = 0.025
PER_CARDIO_DAY = 0.035
MAX_MULTIPLIER = 2.0
BREASTFEEDING_KCAL = 400.0

# --- Paces -----------------------------------------------------------------------------------

GENTLE_LOSS = 0.003
STEADY_LOSS = 0.005
STEADY_LOSS_HIGH_BMI = 0.0075  # BMI ≥ 30
# The fastest loss a person is planned at (review issue 13).
MAX_LOSS = 0.0075  # BMI < 25
MAX_LOSS_HIGHER_BMI = 0.01  # BMI ≥ 25
MAX_LOSS_CAUTIOUS = 0.005  # age ≥ 65, diabetes with hypo risk, health "prefer not"
HIGHER_MAX_BMI = 25.0
HIGH_BMI = 30.0
# Build muscle: (gentle, steady, faster) by training experience. Women get the lower half.
GAIN_BANDS = {
    "beginner": (0.0025, 0.00375, 0.005),
    "intermediate": (0.0015, 0.002, 0.0025),
    "advanced": (0.001, 0.00125, 0.0015),
}
# Health answers after which only Gentle and Steady are offered.
NO_FASTER_HEALTH = ("glp1", "other_diet_condition", "prefer_not")

# "I have a date in mind": how far away the date may be, in weeks.
CUSTOM_WEEKS = {"lose_fat": (4, 104), "recomp": (8, 104), "build_muscle": (8, 52)}
# Build muscle, or Lose fat and build muscle, with no target: a block of this many weeks,
# then "what next?".
BLOCK_WEEKS = 16
# Faster is offered only when, after the limits, it is at least this much faster than Steady.
FASTER_MIN_GAIN_KG_WEEK = 0.05

# --- Calories --------------------------------------------------------------------------------

DEFICIT_CAP = 0.25
DEFICIT_CAP_HIGH_BMI = 0.30  # BMI ≥ 30
KCAL_FLOOR = {"female": 1200.0, "male": 1500.0, "unspecified": 1350.0}
BREASTFEEDING_KCAL_FLOOR = 1800.0
SURPLUS_MIN = 0.05
SURPLUS_MAX = 0.15
# Below this daily deficit, say honestly that food alone can't do much (review issue 12).
TINY_DEFICIT_KCAL = 150.0

# --- Macros ----------------------------------------------------------------------------------

PROTEIN_CAP = 2.4  # g per kg of protein weight
PROTEIN_MIN_OLDER = 1.2  # age ≥ 65, every goal
PROTEIN_MIN_BREASTFEEDING = 1.3
# Protein never takes more than this share of the calories (the top of the 10–35% range),
# but this never takes it below PROTEIN_MIN_OLDER.
PROTEIN_MAX_SHARE = 0.35
# The carb floor never takes protein below these: with strength training (or a muscle goal),
# and without.
PROTEIN_KEPT_FOR_CARBS = 1.6
PROTEIN_KEPT_FOR_CARBS_NO_TRAINING = 1.2
HIGH_DEFICIT = 0.20
FAT_SHARE = {"lose_fat": 0.25, "recomp": 0.25, "build_muscle": 0.25, "maintain": 0.30}
FAT_MIN_PER_KG = 0.6
FAT_MIN_SHARE = 0.20
CARB_FLOOR = 100.0
CARB_FLOOR_HYPO_RISK = 130.0
FIBER_PER_1000_KCAL = 14.0
FIBER_MIN = 25.0
FIBER_MAX = 45.0
ENERGY_TOLERANCE = 0.03

# --- Display rounding ------------------------------------------------------------------------

KCAL_STEP = 10
GRAMS_STEP = 5
RATE_STEP = 0.05


def round_to(value: float, step: float) -> float:
    """To the nearest multiple of `step`, halves up. In decimal, so 0.825 is a half (in binary
    floating point it's just under, and Python's round() would also go to even)."""
    step_ = Decimal(repr(step))
    steps = (Decimal(repr(value)) / step_).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    return float(steps * step_)


def display_rate(rate_kg_week: float) -> float:
    return round_to(rate_kg_week, RATE_STEP)


# --- 1. Energy -------------------------------------------------------------------------------


def bmr(weight_kg: float, height_cm: float, age: int, sex: str) -> float:
    """Mifflin–St Jeor: 10·kg + 6.25·cm − 5·age + s, with s = +5 male, −161 female and −78
    unspecified."""
    return 10 * weight_kg + 6.25 * height_cm - 5 * age + SEX_CONSTANT[sex]


def activity_multiplier(activity: str, strength_days: int, cardio_days: int) -> float:
    multiplier = (
        ACTIVITY_BASE[activity] + PER_STRENGTH_DAY * strength_days + PER_CARDIO_DAY * cardio_days
    )
    return min(multiplier, MAX_MULTIPLIER)


def tdee(person: Person) -> float:
    """Energy out a day: BMR × activity multiplier, plus 400 kcal when breastfeeding."""
    value = bmr(person.weight_kg, person.height_cm, person.age, person.sex) * activity_multiplier(
        person.activity, person.strength_days, person.cardio_days
    )
    if person.has("breastfeeding"):
        value += BREASTFEEDING_KCAL
    return value


# --- 2. Paces --------------------------------------------------------------------------------


def max_loss_fraction(person: Person) -> float:
    """The fastest loss this person is planned at, as a fraction of body weight a week."""
    bmi = person.bmi
    if person.older or person.hypo_risk or person.has("prefer_not"):
        return MAX_LOSS_CAUTIOUS
    if bmi >= HIGHER_MAX_BMI:
        return MAX_LOSS_HIGHER_BMI
    return MAX_LOSS


def faster_ruled_out(person: Person) -> bool:
    """GLP-1, diabetes with hypo risk, another diet-managed condition, or health unsaid."""
    return person.hypo_risk or any(person.has(item) for item in NO_FASTER_HEALTH)


@dataclass(frozen=True)
class Paces:
    # gentle, steady, faster → fraction of body weight a week (Faster = the cap when it
    # isn't available).
    fractions: dict[str, float]
    faster_available: bool
    # The fastest any request may go: a faster custom date is clamped to it.
    max_fraction: float


def loss_paces(person: Person, goal: str) -> Paces:
    """Gentle 0.3%, Steady 0.5% (0.75% from BMI 30), Faster = the personal max, offered only
    when it is above Steady and no health answer rules it out; never for Lose fat and build
    muscle, as a bigger deficit makes building muscle much harder. Without Faster, nothing
    goes faster than Steady."""
    steady = STEADY_LOSS_HIGH_BMI if person.bmi >= HIGH_BMI else STEADY_LOSS
    personal_max = max_loss_fraction(person)
    faster_available = (
        goal == "lose_fat" and not faster_ruled_out(person) and personal_max > steady
    )
    cap = personal_max if faster_available else min(personal_max, steady)
    fractions = {"gentle": min(GENTLE_LOSS, cap), "steady": min(steady, cap), "faster": cap}
    return Paces(fractions=fractions, faster_available=faster_available, max_fraction=cap)


def gain_level(person: Person) -> str:
    """beginner (not yet, < 1 year, or 0 strength days with the intent to train),
    intermediate (1–3 years), advanced (3+ years)."""
    if not person.strength_days:
        return "beginner"
    return {"1_3y": "intermediate", "gt_3y": "advanced"}.get(person.lifting_experience, "beginner")


def gain_paces(person: Person) -> Paces:
    """The band's bottom, middle and top; for women, the lower half of the band."""
    low, middle, top = GAIN_BANDS[gain_level(person)]
    if person.sex == "female":
        low, middle, top = low, (low + middle) / 2, middle
    faster_available = not faster_ruled_out(person)
    cap = top if faster_available else middle
    fractions = {"gentle": low, "steady": middle, "faster": cap}
    return Paces(fractions=fractions, faster_available=faster_available, max_fraction=cap)


def paces(person: Person, goal: str) -> Paces:
    return loss_paces(person, goal) if goal in LOSS_GOALS else gain_paces(person)


def custom_date_range(goal: str, today: date) -> tuple[date, date] | None:
    """The dates "I have a date in mind" accepts: 4–104 weeks for Lose fat, 8–104 for Lose
    fat and build muscle, 8–52 for Build muscle."""
    if goal not in CUSTOM_WEEKS:
        return None
    shortest, longest = CUSTOM_WEEKS[goal]
    return today + timedelta(weeks=shortest), today + timedelta(weeks=longest)


# --- 3–4. Calories and the effective rate ----------------------------------------------------


def kcal_floor(person: Person) -> float:
    if person.has("breastfeeding"):
        return BREASTFEEDING_KCAL_FLOOR
    return KCAL_FLOOR[person.sex]


def protein_kept_for_carbs(person: Person, goal: str) -> float:
    """The g/kg PW the carb floor never takes protein below."""
    if person.trains or goal in MUSCLE_GOALS:
        return PROTEIN_KEPT_FOR_CARBS
    return PROTEIN_KEPT_FOR_CARBS_NO_TRAINING


def carb_floor_kcal(person: Person, goal: str) -> float:
    """With diabetes and a hypo risk, the fewest calories that still fit 130 g of carbs once
    fat is at its minimum and protein at the lowest the carb floor allows (review of the
    implementation, M2); 0 for everyone else. Fat's minimum is max(0.6 g/kg PW, 20% of
    kcal), so this is the larger of the two calorie levels those give."""
    if not person.hypo_risk:
        return 0.0
    pw = person.protein_weight_kg
    lean = 4 * protein_kept_for_carbs(person, goal) * pw + 4 * CARB_FLOOR_HYPO_RISK
    return max(lean + 9 * FAT_MIN_PER_KG * pw, lean / (1 - FAT_MIN_SHARE))


@dataclass(frozen=True)
class Energy:
    kcal: float
    # The deficit (or surplus) × 7 / 7700: the pace the calories really give (0 for Maintain,
    # and for a loss goal whose calories can't go below what the body uses).
    effective_rate_kg_week: float
    # Which limits changed the calories: deficit_cap, calorie_floor, surplus_min, surplus_max,
    # carb_floor_calories.
    limits: tuple[str, ...]


def energy(goal: str, tdee_kcal: float, rate_kg_week: float, person: Person) -> Energy:
    """Calories for a weekly rate, within the limits.

    Lose fat (and Lose fat and build muscle): TDEE − rate × 7700/7, the deficit capped at 25%
    of TDEE (30% from BMI 30), and never below the floor (1,200 / 1,500 / 1,350 kcal; 1,800
    breastfeeding; with a hypo risk, what fits 130 g of carbs). There is no BMR floor. A floor
    at or above TDEE means no deficit at all: calories stay at TDEE.
    Build muscle: TDEE + rate × 7700/7, the surplus kept within 5–15% of TDEE.
    Maintain: TDEE (at least 1,800 when breastfeeding).
    With a hypo risk, every goal's calories fit 130 g of carbs, even if that's a little above
    TDEE.
    """
    limits: list[str] = []
    change = rate_kg_week * KCAL_PER_KG / 7
    carb_kcal = carb_floor_kcal(person, goal)
    if goal in LOSS_GOALS:
        cap = tdee_kcal * (DEFICIT_CAP_HIGH_BMI if person.bmi >= HIGH_BMI else DEFICIT_CAP)
        if change > cap:
            change = cap
            limits.append("deficit_cap")
        kcal = tdee_kcal - change
        floor = max(kcal_floor(person), carb_kcal)
        if kcal < floor:
            kcal = min(floor, tdee_kcal)
            limits.append("calorie_floor")
            if carb_kcal > kcal_floor(person):
                limits.append("carb_floor_calories")
        if kcal < carb_kcal:
            # Even TDEE doesn't fit 130 g of carbs: no deficit at all.
            kcal = carb_kcal
            limits.append("carb_floor_calories")
        effective = max(0.0, tdee_kcal - kcal) * 7 / KCAL_PER_KG
        return Energy(kcal=kcal, effective_rate_kg_week=effective, limits=tuple(limits))
    if goal == "build_muscle":
        low, high = SURPLUS_MIN * tdee_kcal, SURPLUS_MAX * tdee_kcal
        if change < low:
            change = low
            limits.append("surplus_min")
        elif change > high:
            change = high
            limits.append("surplus_max")
        kcal = max(tdee_kcal + change, carb_kcal)
        effective = (kcal - tdee_kcal) * 7 / KCAL_PER_KG
        return Energy(kcal=kcal, effective_rate_kg_week=effective, limits=tuple(limits))
    kcal = tdee_kcal
    if person.has("breastfeeding") and kcal < BREASTFEEDING_KCAL_FLOOR:
        kcal = BREASTFEEDING_KCAL_FLOOR
        limits.append("calorie_floor")
    if kcal < carb_kcal:
        kcal = carb_kcal
        limits.append("carb_floor_calories")
    return Energy(kcal=kcal, effective_rate_kg_week=0.0, limits=tuple(limits))


def weeks_to(change_kg: float, rate_kg_week: float) -> int | None:
    """Whole weeks to change by `change_kg` at this rate, rounded up; None when the rate
    shows as 0 (no date can be promised)."""
    if display_rate(rate_kg_week) == 0:
        return None
    return math.ceil(change_kg / rate_kg_week - 1e-9)


# --- 5. Macros -------------------------------------------------------------------------------


def protein_per_kg(goal: str, person: Person, deficit_share: float) -> float:
    """Grams of protein per kg of protein weight (the spec's table), capped at 2.4; at least
    1.2 from age 65 and 1.3 when breastfeeding. 16–17-year-olds are on Maintain: 1.6 if
    training, else 1.2."""
    high_deficit = deficit_share >= HIGH_DEFICIT
    if goal == "lose_fat":
        if person.trains:
            grams = 2.2 if (person.bmi < HIGHER_MAX_BMI or high_deficit) else 2.0
        else:
            grams = 1.6
    elif goal == "recomp":
        grams = 2.2
    elif goal == "build_muscle":
        grams = 1.8
    else:
        grams = 1.6 if person.trains else 1.2
    if person.older:
        grams = max(grams, PROTEIN_MIN_OLDER)
    if person.has("breastfeeding"):
        grams = max(grams, PROTEIN_MIN_BREASTFEEDING)
    return min(grams, PROTEIN_CAP)


@dataclass(frozen=True)
class Macros:
    protein_g: float
    fat_g: float
    carbs_g: float
    fiber_g: float
    # As the table set it, before the carb floor took anything back.
    protein_g_per_kg: float
    fat_min_g: float
    carb_floor_g: float
    # protein_share_cap, carb_floor_fat_lowered, carb_floor_protein_lowered, carb_floor_not_met
    rules: tuple[str, ...]


def macros(goal: str, kcal: float, tdee_kcal: float, person: Person) -> Macros:
    """Protein → fat → carbs, then fibre.

    Protein: the table, but at most 35% of kcal (never below 1.2 g/kg PW for that).
    Fat: 25% of kcal (cut and bulk), 30% (maintain), never below max(0.6 g/kg PW, 20% of kcal).
    Carbs: the rest. Below 100 g (130 with hypo-risk diabetes): lower fat toward its minimum
    first, then protein toward 1.6 g/kg PW (1.2 without strength training), then accept. With
    a hypo risk the calories already fit 130 g (`carb_floor_kcal`), so it is always met.
    Fibre: 14 g per 1,000 kcal, between 25 and 45 g.
    """
    pw = person.protein_weight_kg
    deficit_share = max(0.0, (tdee_kcal - kcal) / tdee_kcal) if goal in LOSS_GOALS else 0.0
    grams_per_kg = protein_per_kg(goal, person, deficit_share)
    protein = grams_per_kg * pw
    rules: list[str] = []
    share_cap = max(PROTEIN_MAX_SHARE * kcal / 4, PROTEIN_MIN_OLDER * pw)
    if protein > share_cap:
        protein = share_cap
        rules.append("protein_share_cap")
    fat_min = max(FAT_MIN_PER_KG * pw, FAT_MIN_SHARE * kcal / 9)
    fat = max(FAT_SHARE[goal] * kcal / 9, fat_min)
    carbs = (kcal - 4 * protein - 9 * fat) / 4
    carb_floor = CARB_FLOOR_HYPO_RISK if person.hypo_risk else CARB_FLOOR

    if carbs < carb_floor and fat > fat_min:
        cut = min(fat - fat_min, (carb_floor - carbs) * 4 / 9)
        fat -= cut
        carbs += cut * 9 / 4
        rules.append("carb_floor_fat_lowered")
    protein_kept = protein_kept_for_carbs(person, goal) * pw
    if carbs < carb_floor and protein > protein_kept:
        cut = min(protein - protein_kept, carb_floor - carbs)
        protein -= cut
        carbs += cut
        rules.append("carb_floor_protein_lowered")
    if carbs < carb_floor:
        rules.append("carb_floor_not_met")
    if carbs < 0:
        # Protein and fat alone over the calories: not reachable within the calorie floors,
        # but the calories are the number that must hold, so protein gives way.
        protein = max(0.0, protein + carbs)
        carbs = 0.0
        rules.append("protein_lowered_to_fit")

    fiber = min(max(FIBER_PER_1000_KCAL * kcal / 1000, FIBER_MIN), FIBER_MAX)
    return Macros(
        protein_g=protein,
        fat_g=fat,
        carbs_g=carbs,
        fiber_g=fiber,
        protein_g_per_kg=grams_per_kg,
        fat_min_g=fat_min,
        carb_floor_g=carb_floor,
        rules=tuple(rules),
    )


def energy_matches(kcal: float, protein_g: float, carbs_g: float, fat_g: float) -> bool:
    """protein × 4 + carbs × 4 + fat × 9 within ±3% of the calories."""
    return abs(4 * protein_g + 4 * carbs_g + 9 * fat_g - kcal) <= ENERGY_TOLERANCE * kcal


def display_targets(kcal: float, m: Macros) -> dict[str, int]:
    """kcal to 10, grams to 5. Fat never shows below its minimum (it rounds up then). Carbs
    are worked out last from the rounded numbers, so they absorb the rounding and the energy
    check holds. A carb floor met before rounding stays met after it: if the rounding took
    carbs under it, protein gives way by up to two steps (10 g) to keep the energy check."""
    kcal_r = int(round_to(kcal, KCAL_STEP))
    protein_r = int(round_to(m.protein_g, GRAMS_STEP))
    fat_r = int(round_to(m.fat_g, GRAMS_STEP))
    if fat_r < m.fat_min_g - 1e-9:
        fat_r = int(math.ceil(m.fat_min_g / GRAMS_STEP - 1e-9) * GRAMS_STEP)
    carbs_r = max(0, int(round_to((kcal_r - 4 * protein_r - 9 * fat_r) / 4, GRAMS_STEP)))
    floor_r = int(math.ceil(m.carb_floor_g / GRAMS_STEP - 1e-9) * GRAMS_STEP)
    if m.carbs_g >= m.carb_floor_g - 1e-6 and carbs_r < floor_r:
        carbs_r = floor_r
        lowest_protein = protein_r - 2 * GRAMS_STEP
        while not energy_matches(kcal_r, protein_r, carbs_r, fat_r) and protein_r > lowest_protein:
            protein_r -= GRAMS_STEP
    return {
        "kcal": kcal_r,
        "protein_g": protein_r,
        "carbs_g": carbs_r,
        "fat_g": fat_r,
        "fiber_g": int(round_to(m.fiber_g, GRAMS_STEP)),
    }


# --- The whole plan --------------------------------------------------------------------------


def training_band(person: Person, goal: str) -> str:
    """For the pattern key: none (under 2 strength days), beginner, or trained (1+ years).
    The muscle goals are only allowed with training or the intent to train, so they are never
    none: with 0 days, a beginner."""
    if goal in MUSCLE_GOALS:
        if not person.strength_days:
            return "beginner"
    elif not person.trains:
        return "none"
    return "trained" if person.lifting_experience in ("1_3y", "gt_3y") else "beginner"


def nearest_pace(p: Paces, weight_kg: float, rate_kg_week: float) -> str:
    """The pace option closest to a rate (a custom date maps to it for the texts)."""
    options = ["gentle", "steady"] + (["faster"] if p.faster_available else [])
    return min(options, key=lambda pace: abs(p.fractions[pace] * weight_kg - rate_kg_week))


@dataclass(frozen=True)
class Plan:
    goal: str
    pace: str | None  # as asked: gentle, steady, faster or custom; None for Maintain
    pace_band: str  # gentle, steady or faster (custom mapped to the nearest; steady for Maintain)
    training: str
    pattern_key: str
    bmr: float
    tdee: float
    multiplier: float
    requested_rate_kg_week: float
    max_rate_kg_week: float | None
    effective_rate_kg_week: float
    clamped: bool
    kcal: float
    macros: Macros
    targets: dict[str, int]
    start_weight_kg: float
    target_weight_kg: float | None
    weeks: int | None
    goal_date: date | None
    rules: tuple[str, ...]
    # [{"code", "template", "params"}]: rendered by texts.py.
    notices: tuple[dict[str, Any], ...]


def build_plan(
    person: Person,
    goal: str,
    pace: str | None,
    target_weight_kg: float | None,
    target_date: date | None,
    today: date,
) -> Plan:
    """The plan for a complete person (`person.complete`) and an allowed goal.

    Lose fat needs a target; Build muscle, and Lose fat and build muscle, may have none (a
    16-week block). `pace` defaults to Steady; `custom` needs `target_date` and a target.
    """
    weight = person.weight_kg
    tdee_kcal = tdee(person)
    rules: list[str] = []
    if person.has("breastfeeding"):
        rules.append("breastfeeding_allowance")

    if goal == "maintain":
        pace = None
        band = "steady"
        requested = 0.0
        max_rate = None
        result = energy(goal, tdee_kcal, 0.0, person)
        clamped = False
        target_weight_kg = None
        weeks, goal_date = None, None
    else:
        pace = pace or "steady"
        p = paces(person, goal)
        max_rate = p.max_fraction * weight
        if pace == "custom":
            days = max((target_date - today).days, 1)
            requested = abs(target_weight_kg - weight) / (days / 7)
        else:
            requested = p.fractions[pace] * weight
        rate = requested
        if rate > max_rate + 1e-9:
            rate = max_rate
            rules.append("max_rate")
        result = energy(goal, tdee_kcal, rate, person)
        effective = result.effective_rate_kg_week
        limited = rate < requested or bool(result.limits)
        # Slower than asked because of a limit, by enough to show (rates show to 0.05 kg).
        clamped = display_rate(requested) - display_rate(effective) >= RATE_STEP - 1e-9
        if goal in MUSCLE_GOALS and target_weight_kg is None:
            weeks = BLOCK_WEEKS
            goal_date = today + timedelta(weeks=weeks)
        elif pace == "custom" and not limited:
            # Exactly the pace asked for: the date asked for.
            goal_date = target_date
            weeks = math.ceil((target_date - today).days / 7)
        else:
            weeks = weeks_to(abs(target_weight_kg - weight), effective)
            goal_date = None if weeks is None else today + timedelta(weeks=weeks)
        if pace == "custom":
            band = nearest_pace(p, weight, effective)
        elif pace == "faster" and not p.faster_available:
            # Faster isn't offered (any more: the user turned 65 since answering, say), so it
            # was planned at the cap, which is Steady or slower.
            band = "steady"
        else:
            band = pace

    rules.extend(result.limits)
    m = macros(goal, result.kcal, tdee_kcal, person)
    rules.extend(m.rules)
    targets = display_targets(result.kcal, m)
    training = training_band(person, goal)
    effective_rate = result.effective_rate_kg_week

    notices: list[dict[str, Any]] = []
    if clamped and goal_date is not None:
        params = {
            "rate_kg_week": display_rate(effective_rate),
            "goal_date": goal_date.isoformat(),
            "weeks": weeks,
            "target_weight_kg": target_weight_kg,
        }
        if pace == "custom":
            params["requested_weeks"] = max(1, round((target_date - today).days / 7))
            template = "pace_clamped_custom"
        elif target_weight_kg is None:
            template = "pace_clamped_no_target" if goal == "build_muscle" else "pace_clamped_block"
        else:
            template = "pace_clamped"
        notices.append({"code": "pace_clamped", "template": template, "params": params})
    if goal in LOSS_GOALS and "calorie_floor" in result.limits:
        notices.append(
            {
                "code": "calorie_floor",
                "template": "calorie_floor",
                "params": {"kcal": targets["kcal"]},
            }
        )
    if goal in LOSS_GOALS and tdee_kcal - result.kcal < TINY_DEFICIT_KCAL:
        notices.append({"code": "tiny_deficit", "template": "tiny_deficit", "params": {}})
    if goal in MUSCLE_GOALS and target_weight_kg is None:
        code = "gain_block" if goal == "build_muscle" else "recomp_block"
        notices.append(
            {
                "code": code,
                "template": code,
                "params": {"weeks": weeks, "goal_date": goal_date.isoformat()},
            }
        )
    if goal == "build_muscle" and target_weight_kg is not None:
        if gates.bulk_target_is_high(person, target_weight_kg):
            notices.append(
                {"code": "gain_target_high", "template": "gain_target_high", "params": {}}
            )

    return Plan(
        goal=goal,
        pace=pace,
        pace_band=band,
        training=training,
        pattern_key=f"{goal}.{band}.{training}.start",
        bmr=bmr(weight, person.height_cm, person.age, person.sex),
        tdee=tdee_kcal,
        multiplier=activity_multiplier(person.activity, person.strength_days, person.cardio_days),
        requested_rate_kg_week=requested,
        max_rate_kg_week=max_rate,
        effective_rate_kg_week=effective_rate,
        clamped=clamped,
        kcal=result.kcal,
        macros=m,
        targets=targets,
        start_weight_kg=weight,
        target_weight_kg=target_weight_kg,
        weeks=weeks,
        goal_date=goal_date,
        rules=tuple(rules),
        notices=tuple(notices),
    )


@dataclass(frozen=True)
class PaceChoice:
    pace: str
    rate_kg_week: float
    effective_rate_kg_week: float
    weeks: int | None
    goal_date: date | None
    kcal: int
    available: bool


def pace_options(
    person: Person, goal: str, target_weight_kg: float | None, today: date
) -> list[PaceChoice]:
    """Gentle, Steady and Faster, each with the rate, calories and date it really gives.
    Faster is available only when it is, after the limits, at least 0.05 kg a week faster
    than Steady (as shown): otherwise it would be Steady under another name."""
    p = paces(person, goal)
    plans = {
        pace: build_plan(person, goal, pace, target_weight_kg, None, today)
        for pace in ("gentle", "steady", "faster")
    }
    faster_gain = display_rate(plans["faster"].effective_rate_kg_week) - display_rate(
        plans["steady"].effective_rate_kg_week
    )
    faster_offered = p.faster_available and faster_gain >= FASTER_MIN_GAIN_KG_WEEK - 1e-9
    return [
        PaceChoice(
            pace=pace,
            rate_kg_week=plan.requested_rate_kg_week,
            effective_rate_kg_week=plan.effective_rate_kg_week,
            weeks=plan.weeks,
            goal_date=plan.goal_date,
            kcal=plan.targets["kcal"],
            available=pace != "faster" or faster_offered,
        )
        for pace, plan in plans.items()
    ]


def baseline(plan: Plan, person: Person) -> dict[str, Any]:
    """The unrounded working, stored with the plan for the weekly reviews."""

    def r(value: float | None) -> float | None:
        return None if value is None else round(value, 3)

    m = plan.macros
    return {
        "age": person.age,
        "bmi": r(person.bmi),
        "bmr": r(plan.bmr),
        "activity_multiplier": r(plan.multiplier),
        "tdee": r(plan.tdee),
        "protein_weight_kg": r(person.protein_weight_kg),
        "requested_rate_kg_week": r(plan.requested_rate_kg_week),
        "max_rate_kg_week": r(plan.max_rate_kg_week),
        "effective_rate_kg_week": r(plan.effective_rate_kg_week),
        "kcal": r(plan.kcal),
        "protein_g": r(m.protein_g),
        "protein_g_per_kg": r(m.protein_g_per_kg),
        "fat_g": r(m.fat_g),
        "fat_min_g": r(m.fat_min_g),
        "carbs_g": r(m.carbs_g),
        "carb_floor_g": r(m.carb_floor_g),
        "fiber_g": r(m.fiber_g),
        "pace_band": plan.pace_band,
        "training": plan.training,
        "rules": list(plan.rules),
    }
