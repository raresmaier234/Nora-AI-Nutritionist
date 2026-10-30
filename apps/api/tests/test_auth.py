"""Tests for sign-in: checking Supabase access tokens, and the user behind each request."""

import json
import re
import threading
import uuid
from datetime import UTC, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from jwt import PyJWKClientConnectionError
from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.models.user import User
from app.main import app
from app.services import users
from app.services.auth import TokenVerifier, get_token_verifier
from tests.auth_tokens import ISSUER, JWKS, VERIFIER, auth_headers, make_token

ME = "/api/v1/users/me"
PUBLIC_PATHS = {"/api/v1/health"}
# What a Supabase project signed tokens with before asymmetric keys: never to be accepted.
LEGACY_SECRET = "the-legacy-shared-jwt-secret-0123456789"


def protected_endpoints() -> list[tuple[str, str]]:
    """Every endpoint in the API's spec except the public ones, path parameters filled in."""
    endpoints = [
        (method.upper(), re.sub(r"\{[^}]+\}", "1", path))
        for path, operations in app.openapi()["paths"].items()
        if path not in PUBLIC_PATHS
        for method in operations
    ]
    assert len(endpoints) >= 10, endpoints  # the spec really was read
    return endpoints


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def assert_unauthorized(response) -> None:
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize(("method", "path"), protected_endpoints())
def test_every_endpoint_but_health_needs_a_token(anon_client, method, path) -> None:
    assert_unauthorized(anon_client.request(method, path))


def test_a_valid_token_creates_the_user_once_and_reuses_them(client, user_id, db_session) -> None:
    first = client.get(ME)
    second = client.get(ME)

    assert first.status_code == second.status_code == 200
    assert first.json()["id"] == second.json()["id"] == str(user_id)
    rows = db_session.scalar(select(func.count()).select_from(User).where(User.id == user_id))
    assert rows == 1


def test_the_users_first_requests_may_arrive_together(user_id, db_session, monkeypatch) -> None:
    """Two first requests both find no row; the slower one uses the faster one's."""
    claims = VERIFIER.verify(make_token(user_id))
    created = users.get_or_create(db_session, claims)
    real_get = db_session.get
    missed = []

    def get(*args, **kwargs):
        if not missed:  # the slower request's first lookup ran before the row existed
            missed.append(True)
            return None
        return real_get(*args, **kwargs)

    monkeypatch.setattr(db_session, "get", get)

    assert users.get_or_create(db_session, claims) is created
    assert missed == [True]


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(lambda sub: make_token(sub, expires_in=-3600), id="expired"),
        pytest.param(lambda sub: make_token(sub, exp=None), id="no-expiry"),
        pytest.param(
            lambda sub: make_token(sub, iss="https://another.supabase.co/auth/v1"), id="wrong-iss"
        ),
        pytest.param(lambda sub: make_token(sub, aud="another-audience"), id="wrong-aud"),
        pytest.param(lambda sub: make_token(sub, role="anon"), id="anon-role"),
        pytest.param(lambda sub: make_token(sub, role="service_role"), id="service-role"),
        pytest.param(lambda sub: make_token(sub, role=None), id="no-role"),
        pytest.param(lambda sub: make_token(sub, is_anonymous=True), id="anonymous-sign-in"),
        pytest.param(
            lambda sub: make_token(sub, key=ec.generate_private_key(ec.SECP256R1())),
            id="bad-signature",
        ),
        pytest.param(
            lambda sub: make_token(sub, key=LEGACY_SECRET, algorithm="HS256"), id="hs256"
        ),
        pytest.param(lambda sub: make_token(sub, key=None, algorithm="none"), id="unsigned"),
        pytest.param(lambda sub: make_token("not-a-uuid"), id="sub-not-a-uuid"),
        pytest.param(lambda sub: "not-a-jwt", id="garbage"),
    ],
)
def test_an_invalid_token_is_401(anon_client, user_id, db_session, token) -> None:
    response = anon_client.get(ME, headers=bearer(token(user_id)))

    assert_unauthorized(response)
    assert response.json()["detail"].startswith("Invalid access token")
    assert db_session.get(User, user_id) is None  # and no user was created


def test_a_missing_or_non_bearer_header_is_401(anon_client) -> None:
    assert_unauthorized(anon_client.get(ME))
    assert_unauthorized(anon_client.get(ME, headers={"Authorization": "Basic dXNlcjpwYXNz"}))
    assert_unauthorized(anon_client.get(ME, headers={"Authorization": "Bearer"}))


@pytest.fixture()
def unconfigured(api, monkeypatch):
    """As if SUPABASE_URL were unset: the real verifier, with no project to check against."""
    monkeypatch.setattr(get_settings(), "supabase_url", None)
    monkeypatch.delitem(api.dependency_overrides, get_token_verifier)


@pytest.mark.parametrize(("method", "path"), protected_endpoints())
def test_without_supabase_url_every_protected_endpoint_refuses(
    unconfigured, api, method, path
) -> None:
    """Fail closed: even a well-signed token gets nowhere."""
    client = TestClient(api, headers=auth_headers(uuid.uuid4()))

    response = client.request(method, path)

    assert response.status_code == 503
    assert response.json() == {"detail": "Sign-in is not configured on this server."}


def test_without_supabase_url_health_still_answers(unconfigured, anon_client) -> None:
    assert anon_client.get("/api/v1/health").status_code == 200


def test_the_verifier_follows_supabase_url(monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "supabase_url", "https://abcd1234.supabase.co/")

    verifier = get_token_verifier()

    assert verifier.issuer == "https://abcd1234.supabase.co/auth/v1"
    jwks = verifier.signing_key.__self__  # the PyJWKClient behind it
    assert jwks.uri == "https://abcd1234.supabase.co/auth/v1/.well-known/jwks.json"
    assert get_token_verifier().signing_key.__self__ is jwks  # keys are cached, not refetched


@pytest.fixture()
def supabase_url():
    """A local stand-in for a Supabase project: it publishes the test key as its JWKS."""
    body = json.dumps(JWKS).encode()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path != "/auth/v1/.well-known/jwks.json":
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args) -> None:
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    server.server_close()


def test_tokens_are_checked_against_the_projects_published_keys(
    api, supabase_url, user_id, monkeypatch
) -> None:
    """The real verifier, end to end: keys fetched from the JWKS, issuer from SUPABASE_URL."""
    monkeypatch.setattr(get_settings(), "supabase_url", supabase_url)
    monkeypatch.delitem(api.dependency_overrides, get_token_verifier)
    client = TestClient(api)
    issuer = f"{supabase_url}/auth/v1"

    signed_in = client.get(ME, headers=bearer(make_token(user_id, iss=issuer)))
    assert signed_in.status_code == 200
    assert signed_in.json()["id"] == str(user_id)

    another_key = ec.generate_private_key(ec.SECP256R1())
    assert_unauthorized(client.get(ME, headers=bearer(make_token(user_id))))  # other project
    assert_unauthorized(
        client.get(ME, headers=bearer(make_token(user_id, iss=issuer, key=another_key)))
    )
    unknown_key = make_token(user_id, iss=issuer, kid="unknown")
    assert_unauthorized(client.get(ME, headers=bearer(unknown_key)))


def test_unreachable_signing_keys_are_503_not_401(api, user_id, monkeypatch) -> None:
    """A 401 would make the app sign the user out over a network blip."""

    def unreachable(token: str):
        raise PyJWKClientConnectionError("Fail to fetch data from the url")

    verifier = TokenVerifier(issuer=ISSUER, signing_key=unreachable)
    monkeypatch.setitem(api.dependency_overrides, get_token_verifier, lambda: verifier)

    response = TestClient(api, headers=auth_headers(user_id)).get(ME)

    assert response.status_code == 503


def test_the_email_follows_the_token(api, user_id) -> None:
    TestClient(api, headers=auth_headers(user_id, email="old@example.com")).get(ME)

    me = TestClient(api, headers=auth_headers(user_id, email="new@example.com")).get(ME).json()

    assert me["email"] == "new@example.com"


def test_a_missing_name_is_filled_in_but_a_chosen_one_is_kept(api, user_id) -> None:
    """Apple sends the name only once; the app saves it to Supabase after the first token."""
    first = TestClient(api, headers=auth_headers(user_id, name=None)).get(ME).json()
    assert first["display_name"] is None

    named = TestClient(api, headers=auth_headers(user_id, name="Ana Pop"))
    assert named.get(ME).json()["display_name"] == "Ana Pop"

    named.patch(ME, json={"display_name": "Ana"})
    assert named.get(ME).json()["display_name"] == "Ana"


def test_last_seen_is_written_at_most_hourly(client, user_id, db_session) -> None:
    client.get(ME)
    user = db_session.get(User, user_id)

    recently = datetime.now(UTC) - timedelta(minutes=10)
    user.last_seen_at = recently
    db_session.flush()
    client.get(ME)
    db_session.refresh(user)
    assert user.last_seen_at == recently

    user.last_seen_at = datetime.now(UTC) - timedelta(hours=2)
    db_session.flush()
    client.get(ME)
    db_session.refresh(user)
    assert user.last_seen_at > recently


def test_hs256_is_never_an_accepted_algorithm() -> None:
    """Even a token signed with the right shared secret must not get through."""
    verifier = TokenVerifier(issuer=ISSUER, signing_key=lambda token: LEGACY_SECRET)
    token = make_token(uuid.uuid4(), key=LEGACY_SECRET, algorithm="HS256")

    with pytest.raises(jwt.InvalidAlgorithmError):
        verifier.verify(token)
