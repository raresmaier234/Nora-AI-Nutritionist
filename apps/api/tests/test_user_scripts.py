"""Tests for the admin scripts: scripts/claim_shared_log.py and scripts/set_plan.py.

They run against `db_session`, so whatever they change is rolled back. The local database
may hold a real shared log, so counts are taken relative to what is already there.
"""

import importlib.util
import sys
import uuid
from contextlib import nullcontext
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.db.models.food_log_entry import FoodLogEntry
from app.db.models.user import User
from app.services.users import UserLookupError, claim_unowned_entries, find_by_email

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
OWNER = "qzvwx-owner@example.com"
NOBODY = "qzvwx-nobody@example.com"


def load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_script(name: str, args: list[str], db, monkeypatch) -> int:
    """Run a script's main() with these arguments, on `db`."""
    script = load_script(name)
    monkeypatch.setattr(script, "SessionLocal", lambda: nullcontext(db))
    monkeypatch.setattr(sys, "argv", [f"{name}.py", *args])
    return script.main()


def make_user(db, email: str | None) -> User:
    user = User(id=uuid.uuid4(), email=email)
    db.add(user)
    db.flush()
    return user


def make_entry(db, user: User | None) -> FoodLogEntry:
    entry = FoodLogEntry(
        user_id=user.id if user else None,
        logged_on=date(1999, 1, 2),
        meal="lunch",
        source="custom",
        name="Qzvwx soup",
        kcal_per_100g=Decimal("50"),
        protein_per_100g=Decimal("2"),
        carbs_per_100g=Decimal("6"),
        fat_per_100g=Decimal("2"),
        amount=Decimal("1"),
        unit="bowl",
        grams=Decimal("300"),
    )
    db.add(entry)
    db.flush()
    return entry


def unowned_count(db) -> int:
    return db.scalar(
        select(func.count()).select_from(FoodLogEntry).where(FoodLogEntry.user_id.is_(None))
    )


def test_claim_assigns_only_entries_without_a_user(db_session) -> None:
    owner = make_user(db_session, "qzvwx-owner@example.com")
    someone = make_user(db_session, "qzvwx-someone@example.com")
    shared = [make_entry(db_session, None), make_entry(db_session, None)]
    theirs = make_entry(db_session, someone)
    already_unowned = unowned_count(db_session)

    assigned = claim_unowned_entries(db_session, owner)

    assert assigned == already_unowned >= 2
    assert unowned_count(db_session) == 0
    for entry in shared:
        db_session.refresh(entry)
        assert entry.user_id == owner.id
    db_session.refresh(theirs)
    assert theirs.user_id == someone.id


def test_users_are_found_by_email_ignoring_case(db_session) -> None:
    user = make_user(db_session, "Qzvwx-Owner@Example.com")

    assert find_by_email(db_session, " qzvwx-owner@example.COM ") is user


def test_an_unknown_or_shared_email_is_refused(db_session) -> None:
    make_user(db_session, "qzvwx-twice@example.com")
    make_user(db_session, "QZVWX-TWICE@example.com")

    with pytest.raises(UserLookupError, match="no user"):
        find_by_email(db_session, "qzvwx-nobody@example.com")
    with pytest.raises(UserLookupError, match="2 users"):
        find_by_email(db_session, "qzvwx-twice@example.com")


def test_the_claim_script(db_session, monkeypatch, capsys) -> None:
    owner = make_user(db_session, "qzvwx-owner@example.com")
    entry = make_entry(db_session, None)
    already_unowned = unowned_count(db_session)

    assert run_script("claim_shared_log", ["qzvwx-owner@example.com"], db_session, monkeypatch) == 0

    assert f"Assigned {already_unowned} entries" in capsys.readouterr().out
    db_session.refresh(entry)
    assert entry.user_id == owner.id


def test_the_claim_script_refuses_an_unknown_email(db_session, monkeypatch, capsys) -> None:
    entry = make_entry(db_session, None)

    exit_code = run_script(
        "claim_shared_log", ["qzvwx-nobody@example.com"], db_session, monkeypatch
    )

    assert exit_code == 1
    assert "Nothing assigned: no user has the email" in capsys.readouterr().out
    db_session.refresh(entry)
    assert entry.user_id is None


def test_the_set_plan_script(db_session, monkeypatch, capsys) -> None:
    user = make_user(db_session, "qzvwx-owner@example.com")
    user.plan_expires_at = datetime.now(UTC) - timedelta(days=1)
    db_session.flush()

    assert run_script("set_plan", [OWNER, "premium"], db_session, monkeypatch) == 0

    assert "is now on the premium plan" in capsys.readouterr().out
    db_session.refresh(user)
    assert (user.plan, user.plan_expires_at) == ("premium", None)

    assert run_script("set_plan", [OWNER, "basic"], db_session, monkeypatch) == 0
    db_session.refresh(user)
    assert user.plan == "basic"


def test_the_set_plan_script_refuses_bad_input(db_session, monkeypatch) -> None:
    assert run_script("set_plan", [NOBODY, "premium"], db_session, monkeypatch) == 1
    make_user(db_session, OWNER)
    with pytest.raises(SystemExit):
        run_script("set_plan", [OWNER, "gold"], db_session, monkeypatch)
