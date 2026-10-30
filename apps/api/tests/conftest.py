"""Shared pytest fixtures."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.database import engine
from tests.auth_tokens import VERIFIER, auth_headers


@pytest.fixture()
def db_session():
    """A Session bound to a transaction that's always rolled back, so tests never
    leave rows behind in the real database."""
    connection = engine.connect()
    outer_transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")

    yield session

    session.close()
    outer_transaction.rollback()
    connection.close()


@pytest.fixture()
def api(db_session):
    """The app, with requests using `db_session` (so route tests roll back too) and access
    tokens checked against the test signing key (tests/auth_tokens.py), never Supabase.

    Food search runs on PostgreSQL here: the development search index is never touched.
    Tests of the index swap in a throwaway one (see test_food_search_index.py).
    """
    from app.db.session import get_db
    from app.main import app
    from app.services.auth import get_token_verifier
    from app.services.food_index import get_food_index

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_food_index] = lambda: None
    app.dependency_overrides[get_token_verifier] = lambda: VERIFIER
    try:
        yield app
    finally:
        for dependency in (get_db, get_food_index, get_token_verifier):
            app.dependency_overrides.pop(dependency, None)


@pytest.fixture()
def user_id() -> uuid.UUID:
    """Who `client` is signed in as: a new user each test, created by their first request."""
    return uuid.uuid4()


@pytest.fixture()
def client(api, user_id):
    """An API client signed in as `user_id`."""
    return TestClient(api, headers=auth_headers(user_id))


@pytest.fixture()
def other_client(api):
    """An API client signed in as a second user, for isolation tests."""
    return TestClient(api, headers=auth_headers(uuid.uuid4(), email="someone-else@example.com"))


@pytest.fixture()
def anon_client(api):
    """An API client with no access token."""
    return TestClient(api)
