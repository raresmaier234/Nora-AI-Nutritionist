"""Tests for the signed-in user's profile, plan and account deletion (/api/v1/users/me)."""

import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.models.food_log_entry import FoodLogEntry
from app.db.models.user import User
from app.services.auth import require_plan
from app.services.supabase_admin import SupabaseAdmin, get_supabase_admin
from tests.auth_tokens import DEFAULT_AVATAR, auth_headers

ME = "/api/v1/users/me"
ENTRIES = "/api/v1/meals/entries"
DEFAULT_TARGETS = {
    "kcal": 2000.0, "protein_g": 150.0, "carbs_g": 220.0, "fat_g": 70.0, "fiber_g": 28.0
}


def test_a_new_user_is_basic_with_default_targets_and_their_google_profile(client, user_id) -> None:
    response = client.get(ME)

    assert response.status_code == 200
    assert response.json() == {
        "id": str(user_id),
        "email": "tester@example.com",
        "display_name": "Test User",
        "avatar_url": DEFAULT_AVATAR,
        "plan": "basic",
        "plan_expires_at": None,
        "targets": DEFAULT_TARGETS,
    }
    assert all(isinstance(value, float) for value in response.json()["targets"].values())


def test_name_and_avatar_fall_back_to_name_and_picture(api, user_id) -> None:
    """Providers differ in which of these they fill in."""
    headers = auth_headers(
        user_id,
        user_metadata={"name": "Ana Pop", "picture": "https://example.com/ana.png"},
    )

    me = TestClient(api, headers=headers).get(ME).json()

    assert (me["display_name"], me["avatar_url"]) == ("Ana Pop", "https://example.com/ana.png")


def test_a_token_without_email_or_name_still_signs_in(api, user_id) -> None:
    headers = auth_headers(user_id, email=None, user_metadata=None)

    me = TestClient(api, headers=headers).get(ME).json()

    assert (me["email"], me["display_name"], me["avatar_url"]) == (None, None, None)


def test_change_name_and_some_targets(client) -> None:
    response = client.patch(
        ME, json={"display_name": "  Rares  ", "targets": {"kcal": 2400, "protein_g": 180.5}}
    )

    assert response.status_code == 200
    me = response.json()
    assert me["display_name"] == "Rares"
    assert me["targets"] == {**DEFAULT_TARGETS, "kcal": 2400.0, "protein_g": 180.5}
    assert client.get(ME).json() == me  # stored


def test_omitted_fields_are_kept(client) -> None:
    client.patch(ME, json={"targets": {"fiber_g": 35}})

    me = client.patch(ME, json={"display_name": "Rares"}).json()

    assert me["targets"]["fiber_g"] == 35.0
    assert client.patch(ME, json={}).json() == me


@pytest.mark.parametrize(
    "body",
    [
        {"targets": {"kcal": 499}},
        {"targets": {"kcal": 10_001}},
        {"targets": {"protein_g": -1}},
        {"targets": {"protein_g": 1001}},
        {"targets": {"carbs_g": 1000.5}},
        {"targets": {"fat_g": -0.1}},
        {"targets": {"fiber_g": 201}},
        {"targets": {"kcal": "lots"}},
        {"targets": {"kcals": 2000}},
        {"display_name": ""},
        {"display_name": "   "},
        {"display_name": "x" * 101},
        {"plan": "premium"},
    ],
)
def test_invalid_changes_are_rejected(client, body) -> None:
    assert client.patch(ME, json=body).status_code == 422
    assert client.get(ME).json()["targets"] == DEFAULT_TARGETS


def test_the_limits_themselves_are_allowed(client) -> None:
    low = {"kcal": 500, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0}
    high = {"kcal": 10_000, "protein_g": 1000, "carbs_g": 1000, "fat_g": 1000, "fiber_g": 200}

    assert client.patch(ME, json={"targets": low}).status_code == 200
    assert client.patch(ME, json={"targets": high}).status_code == 200


# --- Plans -----------------------------------------------------------------------------------


def make_user(db, **values) -> User:
    user = User(id=uuid.uuid4(), email="planner@example.com", **values)
    db.add(user)
    db.flush()
    return user


def test_require_plan_refuses_basic_and_lets_premium_through(db_session) -> None:
    premium_only = require_plan("premium")
    basic = make_user(db_session)
    premium = make_user(db_session, plan="premium")

    with pytest.raises(HTTPException) as refused:
        premium_only(basic)
    assert refused.value.status_code == 403
    assert refused.value.detail == "This needs the premium plan; you are on the basic plan."
    assert premium_only(premium) is premium
    assert require_plan("basic")(basic) is basic


def test_an_expired_premium_plan_counts_as_basic(client, user_id, db_session) -> None:
    client.get(ME)
    user = db_session.get(User, user_id)
    user.plan = "premium"
    user.plan_expires_at = datetime.now(UTC) - timedelta(days=1)
    db_session.flush()

    assert client.get(ME).json()["plan"] == "basic"
    with pytest.raises(HTTPException):
        require_plan("premium")(user)

    user.plan_expires_at = datetime.now(UTC) + timedelta(days=30)
    db_session.flush()
    assert client.get(ME).json()["plan"] == "premium"


def test_require_plan_on_a_route(api, client, user_id, db_session) -> None:
    probe = FastAPI()

    @probe.get("/premium-only", dependencies=[Depends(require_plan("premium"))])
    def premium_only() -> dict[str, bool]:
        return {"ok": True}

    probe.dependency_overrides = api.dependency_overrides
    probe_client = TestClient(probe, headers=client.headers)

    refused = probe_client.get("/premium-only")
    assert refused.status_code == 403
    assert "premium plan" in refused.json()["detail"]

    db_session.get(User, user_id).plan = "premium"
    db_session.flush()
    assert probe_client.get("/premium-only").json() == {"ok": True}


def test_an_unknown_plan_is_a_programming_error() -> None:
    with pytest.raises(ValueError):
        require_plan("gold")


# --- Account deletion ------------------------------------------------------------------------


class FakeSupabase:
    """Supabase's admin API, answering `status` (or failing to connect) and noting requests."""

    def __init__(self) -> None:
        self.status = 200
        self.unreachable = False
        self.requests: list[httpx.Request] = []

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.unreachable:
            raise httpx.ConnectError("connection refused", request=request)
        return httpx.Response(self.status, json={})


@pytest.fixture()
def supabase(api, monkeypatch) -> FakeSupabase:
    fake = FakeSupabase()
    admin = SupabaseAdmin(
        url="https://nora-test.supabase.co",
        secret_key="sb_secret_test",
        transport=httpx.MockTransport(fake.handle),
    )
    monkeypatch.setitem(api.dependency_overrides, get_supabase_admin, lambda: admin)
    return fake


def log_something(client) -> None:
    entry = {
        "date": "1999-01-02", "meal": "lunch", "source": "custom", "name": "Soup",
        "per_100g": {"kcal": 50, "protein": 2, "carbs": 6, "fat": 2},
        "amount": 1, "unit": "bowl", "grams": 300,
    }
    assert client.post(ENTRIES, json=entry).status_code == 201


def count_users(db, user_id) -> int:
    return db.scalar(select(func.count()).select_from(User).where(User.id == user_id))


def count_entries(db, user_id) -> int:
    return db.scalar(
        select(func.count()).select_from(FoodLogEntry).where(FoodLogEntry.user_id == user_id)
    )


def test_delete_my_account(client, other_client, user_id, db_session, supabase) -> None:
    log_something(client)
    log_something(other_client)

    response = client.delete(ME)

    assert response.status_code == 204
    [request] = supabase.requests
    assert request.method == "DELETE"
    assert str(request.url) == f"https://nora-test.supabase.co/auth/v1/admin/users/{user_id}"
    assert request.headers["apikey"] == "sb_secret_test"
    assert request.headers["Authorization"] == "Bearer sb_secret_test"
    assert count_users(db_session, user_id) == 0
    assert count_entries(db_session, user_id) == 0
    assert len(other_client.get(ENTRIES, params={"date": "1999-01-02"}).json()) == 1


@pytest.mark.parametrize("failure", ["error", "unreachable"])
def test_if_supabase_fails_nothing_is_deleted(
    client, user_id, db_session, supabase, failure
) -> None:
    """The user can still sign in, so their account must still be there."""
    log_something(client)
    supabase.status = 500
    supabase.unreachable = failure == "unreachable"

    response = client.delete(ME)

    assert response.status_code == 502
    assert count_users(db_session, user_id) == 1
    assert count_entries(db_session, user_id) == 1


def test_a_user_supabase_no_longer_has_is_deleted_here_too(
    client, user_id, db_session, supabase
) -> None:
    """Deleted from the Supabase dashboard, say: retrying must still remove our data."""
    log_something(client)
    supabase.status = 404

    assert client.delete(ME).status_code == 204
    assert count_users(db_session, user_id) == 0


def test_without_the_secret_key_deletion_is_503(client, user_id, db_session, monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "supabase_url", "https://nora-test.supabase.co")
    monkeypatch.setattr(get_settings(), "supabase_secret_key", None)
    log_something(client)

    response = client.delete(ME)

    assert response.status_code == 503
    assert count_users(db_session, user_id) == 1
    assert count_entries(db_session, user_id) == 1
