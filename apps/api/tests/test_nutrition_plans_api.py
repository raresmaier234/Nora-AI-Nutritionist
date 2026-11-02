"""Tests for the premium nutrition plan endpoints: previews, goals and plans.

/api/v1/users/me/{nutrition-plans/preview, goals, nutrition-plans, nutrition-plans/active,
nutrition-plans/{id}/activate}, and what they do to GET /api/v1/users/me.
"""

import re
import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.db.models.nutrition_goal import NutritionGoal
from app.db.models.nutrition_plan import NutritionPlan
from app.db.models.user import User
from app.services.nutrition_plan.person import age_on

ME = "/api/v1/users/me"
PREVIEW = f"{ME}/nutrition-plans/preview"
GOALS = f"{ME}/goals"
PLANS = f"{ME}/nutrition-plans"
ACTIVE = f"{PLANS}/active"
PREMIUM_ONLY = "Personal nutrition plans are a premium feature."
DEFAULT_TARGETS = {
    "kcal": 2000.0, "protein_g": 150.0, "carbs_g": 220.0, "fat_g": 70.0, "fiber_g": 28.0
}
TODAY = date.today()


def birth(age: int) -> dict[str, int]:
    """A birth month and year whose youngest possible age today is `age`."""
    year = TODAY.year - age
    while age_on(year, 1, TODAY) < age:
        year -= 1
    return {"birth_year": year, "birth_month": 1}


def answers(**changes) -> dict:
    """The spec's worked example: male, 35, 180 cm, 80 kg, some walking, 3 strength days,
    who wants to reach 70 kg."""
    base = {
        "goal": "lose_fat",
        **birth(35),
        "sex": "male",
        "height_cm": 180,
        "weight_kg": 80,
        "health": ["none"],
        "activity": "some_walking",
        "strength_days": 3,
        "cardio_days": 0,
        "lifting_experience": "1_3y",
        "target_weight_kg": 70,
        "pace": "steady",
    }
    if "age" in changes:
        base |= birth(changes.pop("age"))
    return {key: value for key, value in (base | changes).items() if value is not ...}


def goal_body(language: str = "en", **changes) -> dict:
    return {
        "questionnaire_version": 2,
        "consent": True,
        "consent_version": "2026-10-30",
        "language": language,
        "answers": answers(**changes),
    }


def in_weeks(weeks: int) -> str:
    return (TODAY + timedelta(weeks=weeks)).isoformat()


@pytest.fixture()
def premium(client, user_id, db_session):
    """`client`, on the premium plan."""
    client.get(ME)
    db_session.get(User, user_id).plan = "premium"
    db_session.flush()
    return client


def save_goal(client, **changes) -> dict:
    response = client.post(GOALS, json=goal_body(**changes))
    assert response.status_code == 201, response.json()
    return response.json()


def build_plan(client, **changes) -> dict:
    goal = save_goal(client, **changes)
    response = client.post(PLANS, json={"goal_id": goal["id"]})
    assert response.status_code == 201, response.json()
    return response.json()


def count(db, model, user_id) -> int:
    return db.scalar(select(func.count()).select_from(model).where(model.user_id == user_id))


# --- Premium only ----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("POST", PREVIEW, {"answers": {}}),
        ("POST", GOALS, goal_body()),
        ("GET", GOALS, None),
        ("POST", PLANS, {"goal_id": 1}),
        ("GET", ACTIVE, None),
        ("POST", f"{PLANS}/1/activate", None),
    ],
)
def test_basic_users_get_403(client, method, path, body) -> None:
    response = client.request(method, path, json=body)

    assert response.status_code == 403
    assert response.json()["detail"] == PREMIUM_ONLY


# --- Preview ---------------------------------------------------------------------------------


def test_preview_with_partial_answers(premium) -> None:
    response = premium.post(PREVIEW, json={"answers": {"goal": "lose_fat"}})

    assert response.status_code == 200
    assert response.json() == {
        "gate": {
            "result": "ok",
            "allowed_goals": ["lose_fat", "recomp", "build_muscle", "maintain"],
            "reasons": [],
            "stop": None,
        },
        "pace_options": [],
        "custom_date_range": None,
        "max_rate_kg_week": None,
        "notices": [],
    }
    empty = premium.post(PREVIEW, json={"answers": {}}).json()
    assert (empty["custom_date_range"], empty["pace_options"]) == (None, [])


def test_preview_pace_options_for_the_worked_example(premium) -> None:
    body = {"answers": answers(pace="custom", target_date=in_weeks(12))}

    preview = premium.post(PREVIEW, json=body).json()

    options = {option["pace"]: option for option in preview["pace_options"]}
    assert list(options) == ["gentle", "steady", "faster"]
    assert set(options["gentle"]) == {
        "pace", "rate_kg_week", "effective_rate_kg_week", "weeks", "goal_date", "kcal", "available"
    }
    assert options["gentle"] == {
        "pace": "gentle", "rate_kg_week": 0.25, "effective_rate_kg_week": 0.25, "weeks": 42,
        "goal_date": in_weeks(42), "kcal": 2280, "available": True,
    }
    assert options["steady"]["effective_rate_kg_week"] == 0.4
    assert options["faster"] == {
        "pace": "faster", "rate_kg_week": 0.6, "effective_rate_kg_week": 0.6, "weeks": 18,
        "goal_date": in_weeks(18), "kcal": 1910, "available": True,
    }
    assert preview["max_rate_kg_week"] == 0.6
    assert preview["custom_date_range"] == {"min": in_weeks(4), "max": in_weeks(104)}
    [notice] = preview["notices"]
    assert notice["code"] == "pace_clamped"
    assert notice["message"].startswith("12 weeks is faster than we recommend.")


def test_preview_hides_faster_when_it_isnt_faster(premium) -> None:
    body = {"answers": answers(age=70, weight_kg=90, target_weight_kg=80)}
    preview = premium.post(PREVIEW, json=body).json()

    assert [option["available"] for option in preview["pace_options"]] == [True, True, False]
    assert preview["max_rate_kg_week"] == 0.45  # 0.5% of 90 kg
    assert [reason["code"] for reason in preview["gate"]["reasons"]] == ["age_65"]


def test_preview_hides_faster_when_the_limits_make_it_steady(premium) -> None:
    """120 kg at 175 cm, sitting: Steady and Faster both hit the 30% deficit cap."""
    body = {"answers": answers(age=45, height_cm=175, weight_kg=120, activity="mostly_sitting",
                               strength_days=0, lifting_experience=None, target_weight_kg=95)}
    options = premium.post(PREVIEW, json=body).json()["pace_options"]

    assert options[1]["effective_rate_kg_week"] == options[2]["effective_rate_kg_week"]
    assert [option["available"] for option in options] == [True, True, False]
    faster = {**goal_body(), "answers": {**body["answers"], "pace": "faster"}}
    assert premium.post(GOALS, json=faster).json()["detail"]["code"] == "pace_not_available"


def test_preview_lose_fat_and_build_muscle(premium) -> None:
    body = {"answers": answers(goal="recomp", target_weight_kg=None)}
    preview = premium.post(PREVIEW, json=body).json()

    assert [option["available"] for option in preview["pace_options"]] == [True, True, False]
    assert all(option["weeks"] == 16 for option in preview["pace_options"])
    assert preview["custom_date_range"] is None  # a date needs a target
    assert [notice["code"] for notice in preview["notices"]] == ["recomp_block"]


def test_from_65_weight_loss_needs_bmi_25(premium) -> None:
    gate = premium.post(PREVIEW, json={"answers": answers(age=70)}).json()["gate"]

    assert gate["allowed_goals"] == ["build_muscle", "maintain"]
    assert [reason["code"] for reason in gate["reasons"]] == ["age_65", "age_65_loss"]


def test_preview_build_muscle_needs_no_target(premium) -> None:
    body = {"answers": answers(goal="build_muscle", target_weight_kg=None)}

    preview = premium.post(PREVIEW, json=body).json()

    assert [option["weeks"] for option in preview["pace_options"]] == [16, 16, 16]
    assert preview["custom_date_range"] is None  # a date needs a target
    assert [notice["code"] for notice in preview["notices"]] == ["gain_block"]


def test_any_custom_date_can_be_picked_and_a_too_soon_one_gets_the_safe_date(premium) -> None:
    """The reported case: 94 → 85 kg, Lose fat and build muscle. Any date 8–104 weeks away can
    be picked; a 12-week one needs more than Steady (the fastest this goal goes), so it gets
    Steady's date and a notice saying so. A date the pace allows is planned exactly."""
    body = {"answers": answers(goal="recomp", weight_kg=94, target_weight_kg=85)}
    preview = premium.post(PREVIEW, json=body).json()
    steady = preview["pace_options"][1]
    assert preview["custom_date_range"] == {"min": in_weeks(8), "max": in_weeks(104)}

    soon = build_plan(premium, **(body["answers"] | {"pace": "custom", "target_date": in_weeks(12)}))
    assert (soon["goal_date"], soon["rate"]["clamped"]) == (steady["goal_date"], True)
    assert [notice["code"] for notice in soon["notices"]] == ["pace_clamped"]

    later = build_plan(premium, **(body["answers"] | {"pace": "custom", "target_date": in_weeks(30)}))
    assert (later["goal_date"], later["rate"]["clamped"], later["notices"]) == (in_weeks(30), False, [])


def test_preview_tiny_deficit(premium) -> None:
    small = answers(sex="female", age=62, height_cm=155, weight_kg=55, activity="mostly_sitting",
                    strength_days=0, lifting_experience=None, target_weight_kg=53, pace="gentle")

    preview = premium.post(PREVIEW, json={"answers": small}).json()

    codes = [notice["code"] for notice in preview["notices"]]
    assert "tiny_deficit" in codes


def test_preview_a_stop(premium) -> None:
    body = {"answers": answers(sex="female", health=["pregnant"])}

    preview = premium.post(PREVIEW, json=body).json()

    gate = preview["gate"]
    assert (gate["result"], gate["allowed_goals"], gate["reasons"]) == ("stop", [], [])
    assert gate["stop"]["code"] == "pregnancy"
    assert gate["stop"]["title"] and gate["stop"]["body"]
    assert not re.search(r"\d", gate["stop"]["title"] + gate["stop"]["body"])
    assert preview["pace_options"] == []


def test_preview_maintain_only(premium) -> None:
    preview = premium.post(PREVIEW, json={"answers": answers(age=17)}).json()

    assert preview["gate"]["result"] == "maintain_only"
    assert preview["gate"]["allowed_goals"] == ["maintain"]
    assert preview["gate"]["reasons"][0]["code"] == "age_16_17"
    assert preview["pace_options"] == []


@pytest.mark.parametrize(
    "changes",
    [
        {"strength_days": 8},
        {"cardio_days": -1},
        {"sex": "other"},
        {"goal": "bulk"},
        {"height_cm": 119},
        {"weight_kg": 301},
        {"birth_month": 13},
        {"health": []},
        {"health": ["none", "glp1"]},
        {"health": ["prefer_not", "diabetes"]},
        {"health": ["pregnant"]},  # with sex male
        {"health": ["breastfeeding"]},
        {"allergies": ["kiwi"]},
        {"meals_per_day": 7},
        {"pace": "fastest"},
        {"target_date": "next spring"},
        {"strenght_days": 3},
    ],
)
def test_preview_rejects_invalid_values(premium, changes) -> None:
    assert premium.post(PREVIEW, json={"answers": answers(**changes)}).status_code == 422


@pytest.mark.parametrize(
    ("changes", "code"),
    [
        ({"target_weight_kg": 79.5}, "target_not_below"),
        ({"target_weight_kg": 59}, "target_too_low"),
        ({"goal": "build_muscle", "target_weight_kg": 80.5}, "target_not_above"),
        ({"pace": "custom", "target_date": in_weeks(3)}, "target_date_out_of_range"),
        ({"pace": "custom", "target_date": in_weeks(105)}, "target_date_out_of_range"),
        ({"birth_year": TODAY.year + 1}, "invalid_birth"),
        ({"birth_year": TODAY.year - 102}, "invalid_birth"),
    ],
)
def test_preview_rejects_impossible_choices_with_a_code(premium, changes, code) -> None:
    response = premium.post(PREVIEW, json={"answers": answers(**changes)})

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == code
    assert response.json()["detail"]["message"]


def test_a_too_low_target_names_the_lowest(premium) -> None:
    detail = premium.post(PREVIEW, json={"answers": answers(target_weight_kg=59)}).json()["detail"]

    assert detail["min_target_weight_kg"] == 64.8  # 20 × 1.8²
    assert detail["message"] == "The lowest target we can set for you is 64.8 kg."


# --- Goals -----------------------------------------------------------------------------------


def test_save_and_read_my_goal(premium) -> None:
    response = premium.post(GOALS, json=goal_body())

    assert response.status_code == 201
    goal = response.json()
    assert set(goal) == {
        "id", "questionnaire_version", "language", "answers", "consented_at", "created_at", "gate"
    }
    assert isinstance(goal["id"], int)
    assert (goal["questionnaire_version"], goal["language"]) == (2, "en")
    assert goal["answers"] == {
        **answers(),
        "diabetes_hypo_risk": None, "diabetes_team_ack": False, "ed_status": None,
        "targets_wanted": None, "will_train": None, "target_date": None, "eating_style": None,
        "religious_fasting": False, "allergies": [], "meals_per_day": 3, "units": "metric",
    }
    assert goal["gate"]["result"] == "ok"
    assert goal["consented_at"] and goal["created_at"]
    assert premium.get(GOALS).json() == goal


def test_the_latest_goal_is_returned(premium) -> None:
    save_goal(premium)
    latest = save_goal(premium, goal="maintain")

    assert premium.get(GOALS).json()["id"] == latest["id"]


def test_no_goal_yet_is_404(premium) -> None:
    assert premium.get(GOALS).status_code == 404


def test_under_16_nothing_is_stored(premium, user_id, db_session) -> None:
    response = premium.post(GOALS, json=goal_body(age=15))

    assert response.status_code == 200
    body = response.json()
    assert body["id"] is None
    assert body["answers"] is None
    assert body["gate"]["result"] == "stop"
    assert body["gate"]["stop"]["code"] == "under_16"
    assert count(db_session, NutritionGoal, user_id) == 0
    me = premium.get(ME).json()
    assert (me["targets_mode"], me["targets"]) == ("none", None)


@pytest.mark.parametrize(
    ("changes", "code"),
    [
        ({"health": ["kidney"]}, "kidney"),
        ({"health": ["bariatric"]}, "bariatric"),
        ({"health": ["eating_disorder"], "ed_status": "current"}, "ed_current"),
        ({"sex": "female", "health": ["pregnant"]}, "pregnancy"),
        ({"weight_kg": 55}, "bmi_low"),
    ],
)
def test_a_stop_is_stored_and_turns_targets_off(
    premium, user_id, db_session, changes, code
) -> None:
    goal = save_goal(premium, **changes)

    assert goal["gate"]["result"] == "stop"
    assert goal["gate"]["stop"]["code"] == code
    assert count(db_session, NutritionGoal, user_id) == 1
    me = premium.get(ME).json()
    assert (me["targets_mode"], me["targets"]) == ("none", None)

    refused = premium.post(PLANS, json={"goal_id": goal["id"]})
    assert refused.status_code == 409
    assert refused.json()["detail"]["code"] == "gate_stop"


def test_a_stop_needs_no_more_answers_than_led_to_it(premium) -> None:
    """Stopped at the health screen: activity, exercise, target and pace never asked."""
    body = goal_body(health=["kidney"], activity=..., strength_days=..., cardio_days=...,
                     lifting_experience=..., target_weight_kg=..., pace=...)

    assert premium.post(GOALS, json=body).status_code == 201


def test_a_goal_the_gates_dont_allow_is_422_with_the_gate(premium, user_id, db_session) -> None:
    response = premium.post(GOALS, json=goal_body(age=17))

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "goal_not_allowed"
    assert detail["gate"]["result"] == "maintain_only"
    assert detail["gate"]["allowed_goals"] == ["maintain"]
    assert detail["gate"]["reasons"][0]["code"] == "age_16_17"
    assert count(db_session, NutritionGoal, user_id) == 0

    # The app shows the gate screen, then re-submits with an allowed goal.
    assert premium.post(GOALS, json=goal_body(age=17, goal="maintain")).status_code == 201


def test_build_muscle_with_no_strength_days_needs_the_intent_to_train(premium) -> None:
    no_training = {"goal": "build_muscle", "strength_days": 0, "target_weight_kg": None}

    refused = premium.post(GOALS, json=goal_body(**no_training))
    assert refused.status_code == 422
    reasons = refused.json()["detail"]["gate"]["reasons"]
    assert [reason["code"] for reason in reasons] == ["no_strength_training"]

    assert premium.post(GOALS, json=goal_body(**no_training, will_train=False)).status_code == 422
    assert premium.post(GOALS, json=goal_body(**no_training, will_train=True)).status_code == 201


def test_diabetes_with_hypo_risk_needs_the_team_check_to_lose_fat(premium) -> None:
    diabetic = {"health": ["diabetes"], "diabetes_hypo_risk": "yes", "pace": "gentle"}

    refused = premium.post(GOALS, json=goal_body(**diabetic))
    assert refused.json()["detail"]["code"] == "goal_not_allowed"

    goal = save_goal(premium, **diabetic, diabetes_team_ack=True)
    plan = premium.post(PLANS, json={"goal_id": goal["id"]}).json()
    assert plan["targets"]["carbs_g"] >= 130


@pytest.mark.parametrize(
    "body",
    [
        goal_body() | {"consent": False},
        goal_body() | {"consent": None},
        {k: v for k, v in goal_body().items() if k != "consent"},
        goal_body() | {"questionnaire_version": 1},
        goal_body() | {"consent_version": ""},
        goal_body() | {"language": "fr"},
        goal_body() | {"extra": 1},
    ],
)
def test_consent_and_version_are_required(premium, body) -> None:
    assert premium.post(GOALS, json=body).status_code == 422


@pytest.mark.parametrize(
    ("changes", "missing"),
    [
        ({"birth_year": ...}, ["birth_year"]),
        ({"activity": ...}, ["activity"]),
        ({"health": ...}, ["health"]),
        ({"target_weight_kg": ...}, ["target_weight_kg"]),
        ({"pace": ...}, ["pace"]),
        ({"pace": "custom"}, ["target_date"]),
        ({"health": ["diabetes"], "diabetes_team_ack": True}, ["diabetes_hypo_risk"]),
        ({"lifting_experience": ...}, ["lifting_experience"]),
    ],
)
def test_missing_answers_are_422(premium, changes, missing) -> None:
    response = premium.post(GOALS, json=goal_body(**changes))

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "missing_answers"
    assert response.json()["detail"]["fields"] == missing


def test_faster_isnt_accepted_when_not_offered(premium) -> None:
    response = premium.post(GOALS, json=goal_body(health=["glp1"], pace="faster"))

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "pace_not_available"


def test_an_invalid_target_is_422(premium) -> None:
    response = premium.post(GOALS, json=goal_body(target_weight_kg=59))
    assert response.json()["detail"]["code"] == "target_too_low"


# --- Plans -----------------------------------------------------------------------------------


def test_build_a_draft_plan(premium) -> None:
    goal = save_goal(premium, pace="custom", target_date=in_weeks(12))

    response = premium.post(PLANS, json={"goal_id": goal["id"]})

    assert response.status_code == 201
    plan = response.json()
    assert set(plan) == {
        "id", "goal_id", "status", "reason", "language", "goal", "pace", "targets", "rate",
        "start_weight_kg", "target_weight_kg", "goal_date", "weeks", "notices", "texts",
        "pattern_key", "created_at", "activated_at",
    }
    assert plan["goal_id"] == goal["id"]
    assert (plan["status"], plan["reason"], plan["language"]) == ("draft", "initial", "en")
    assert (plan["goal"], plan["pace"]) == ("lose_fat", "custom")
    assert plan["targets"] == {
        "kcal": 1910, "protein_g": 165, "carbs_g": 190, "fat_g": 55, "fiber_g": 25
    }
    assert plan["rate"] == {"requested_kg_week": 0.85, "effective_kg_week": 0.6, "clamped": True}
    assert (plan["start_weight_kg"], plan["target_weight_kg"]) == (80, 70)
    assert (plan["weeks"], plan["goal_date"]) == (18, in_weeks(18))
    [notice] = plan["notices"]
    assert notice["code"] == "pace_clamped"
    assert "~18 weeks" in notice["message"]
    texts = plan["texts"]
    assert texts["summary"].startswith("A faster fat-loss plan: ~1,910 kcal a day")
    assert texts["why"] and texts["guidance"]
    assert texts["cautions"][-1] == "General guidance, not medical advice."
    assert not any("{" in line for line in [texts["summary"], *texts["why"], *texts["guidance"]])
    assert plan["pattern_key"] == "lose_fat.faster.trained.start"
    assert plan["activated_at"] is None
    # A draft changes nothing yet.
    assert premium.get(ME).json()["targets_mode"] == "default"
    assert premium.get(ACTIVE).status_code == 404


def test_a_maintain_plan(premium) -> None:
    plan = build_plan(premium, goal="maintain", target_weight_kg=None, pace=None)

    assert plan["pace"] is None
    assert plan["rate"] == {"requested_kg_week": 0, "effective_kg_week": 0, "clamped": False}
    assert (plan["goal_date"], plan["weeks"], plan["target_weight_kg"]) == (None, None, None)
    assert plan["targets"]["kcal"] == 2540  # TDEE 2,545
    assert plan["pattern_key"] == "maintain.steady.trained.start"


def test_a_plan_in_romanian_falls_back_to_english_texts(premium) -> None:
    goal = premium.post(GOALS, json=goal_body(language="ro")).json()
    plan = premium.post(PLANS, json={"goal_id": goal["id"]}).json()

    assert plan["language"] == "ro"
    assert plan["texts"]["cautions"][-1] == "General guidance, not medical advice."


def test_a_lose_fat_and_build_muscle_plan(premium) -> None:
    plan = build_plan(premium, goal="recomp", target_weight_kg=None, pace="gentle")

    assert (plan["goal"], plan["pace"], plan["target_weight_kg"]) == ("recomp", "gentle", None)
    assert plan["pattern_key"] == "recomp.gentle.trained.start"
    assert plan["weeks"] == 16
    assert plan["targets"]["kcal"] < 2545  # a deficit
    assert plan["texts"]["summary"].startswith("A gentle plan to lose fat and build muscle")


def test_an_eating_disorder_in_the_past_logs_without_targets_by_default(premium) -> None:
    past = {"health": ["eating_disorder"], "ed_status": "past", "goal": "maintain",
            "target_weight_kg": None, "pace": None}

    goal = premium.post(GOALS, json=goal_body(**past)).json()
    assert goal["gate"]["stop"]["code"] == "targets_declined"
    me = premium.get(ME).json()
    assert (me["targets_mode"], me["targets"]) == ("none", None)

    # Asking for a plan with targets: Maintain only.
    goal = premium.post(GOALS, json=goal_body(**past, targets_wanted=True)).json()
    assert goal["gate"]["result"] == "maintain_only"
    assert premium.get(ME).json()["targets_mode"] == "default"
    assert premium.post(PLANS, json={"goal_id": goal["id"]}).status_code == 201


def test_safety_add_ons_are_in_the_texts(premium) -> None:
    plan = build_plan(premium, age=70, weight_kg=90, target_weight_kg=80, health=["glp1"],
                      eating_style="vegan", allergies=["soy"])

    cautions = " ".join(plan["texts"]["cautions"])
    guidance = " ".join(plan["texts"]["guidance"])
    assert "upper limit" in cautions  # GLP-1
    assert "As we get older" in cautions  # 65+
    assert "tempeh" in guidance
    assert "avoid soy" in guidance


def test_a_plan_from_an_unknown_or_someone_elses_goal_is_404(premium, db_session) -> None:
    stranger = User(id=uuid.uuid4(), email="stranger@example.com", plan="premium")
    db_session.add(stranger)
    db_session.flush()
    theirs = NutritionGoal(
        user_id=stranger.id, questionnaire_version=2, answers=goal_body()["answers"],
        language="en", consent_version="2026-10-30", consented_at=datetime.now(UTC),
    )
    db_session.add(theirs)
    db_session.flush()

    assert premium.post(PLANS, json={"goal_id": theirs.id}).status_code == 404
    assert premium.post(PLANS, json={"goal_id": 2_000_000_000}).status_code == 404


def test_activate_a_plan(premium) -> None:
    draft = build_plan(premium)

    response = premium.post(f"{PLANS}/{draft['id']}/activate")

    assert response.status_code == 200
    plan = response.json()
    assert plan["status"] == "active"
    assert plan["activated_at"]
    assert premium.get(ACTIVE).json() == plan
    me = premium.get(ME).json()
    assert me["targets_mode"] == "plan"
    assert me["targets"] == {key: float(value) for key, value in plan["targets"].items()}
    assert me["check_in_due"] is False


def test_change_plan_archives_the_old_one(premium, db_session) -> None:
    first = build_plan(premium)
    premium.post(f"{PLANS}/{first['id']}/activate")

    second = build_plan(premium, goal="maintain", target_weight_kg=None, pace=None)
    assert second["reason"] == "change"
    activated = premium.post(f"{PLANS}/{second['id']}/activate").json()

    assert activated["status"] == "active"
    assert premium.get(ACTIVE).json()["id"] == second["id"]
    assert db_session.get(NutritionPlan, first["id"]).status == "archived"
    assert db_session.get(NutritionPlan, second["id"]).previous_plan_id == first["id"]
    assert premium.get(ME).json()["targets"]["kcal"] == activated["targets"]["kcal"]

    again = premium.post(f"{PLANS}/{second['id']}/activate")
    assert again.status_code == 409
    assert again.json()["detail"]["code"] == "not_a_draft"
    assert premium.post(f"{PLANS}/{first['id']}/activate").status_code == 409
    assert premium.post(f"{PLANS}/2000000000/activate").status_code == 404


def test_someone_elses_plan_cant_be_activated(premium, other_client, db_session) -> None:
    draft = build_plan(premium)
    other_client.get(ME)
    other = db_session.scalar(select(User).where(User.email == "someone-else@example.com"))
    other.plan = "premium"
    db_session.flush()

    assert other_client.post(f"{PLANS}/{draft['id']}/activate").status_code == 404


def test_a_stop_after_a_plan_turns_it_off(premium) -> None:
    old_goal = save_goal(premium)
    draft = premium.post(PLANS, json={"goal_id": old_goal["id"]}).json()
    other_draft = premium.post(PLANS, json={"goal_id": old_goal["id"]}).json()
    premium.post(f"{PLANS}/{draft['id']}/activate")

    save_goal(premium, health=["kidney"])

    assert premium.get(ACTIVE).status_code == 404
    me = premium.get(ME).json()
    assert (me["targets_mode"], me["targets"]) == ("none", None)
    # Nothing built from earlier answers can bring targets back.
    built = premium.post(PLANS, json={"goal_id": old_goal["id"]})
    assert (built.status_code, built.json()["detail"]["code"]) == (409, "targets_off")
    activated = premium.post(f"{PLANS}/{other_draft['id']}/activate")
    assert (activated.status_code, activated.json()["detail"]["code"]) == (409, "targets_off")

    # A re-screen that no longer stops: the default targets, until a plan is used.
    save_goal(premium)
    me = premium.get(ME).json()
    assert (me["targets_mode"], me["targets"]) == ("default", DEFAULT_TARGETS)


def test_going_back_to_basic_shows_the_defaults_and_keeps_the_plan(
    premium, user_id, db_session
) -> None:
    draft = build_plan(premium)
    plan = premium.post(f"{PLANS}/{draft['id']}/activate").json()
    user = db_session.get(User, user_id)

    user.plan = "basic"
    db_session.flush()
    me = premium.get(ME).json()
    assert (me["targets_mode"], me["targets"]) == ("default", DEFAULT_TARGETS)
    assert premium.get(ACTIVE).status_code == 403

    user.plan = "premium"
    db_session.flush()
    me = premium.get(ME).json()
    assert me["targets_mode"] == "plan"
    assert me["targets"]["kcal"] == plan["targets"]["kcal"]
    assert premium.get(ACTIVE).json()["id"] == plan["id"]


def test_deleting_the_user_deletes_their_goals_and_plans(premium, user_id, db_session) -> None:
    draft = build_plan(premium)
    premium.post(f"{PLANS}/{draft['id']}/activate")
    db_session.expunge_all()

    db_session.delete(db_session.get(User, user_id))
    db_session.flush()

    assert count(db_session, NutritionGoal, user_id) == 0
    assert count(db_session, NutritionPlan, user_id) == 0
