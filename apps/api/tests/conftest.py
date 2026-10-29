"""Shared pytest fixtures."""

import pytest
from sqlalchemy.orm import Session

from app.db.database import engine


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
def client(db_session):
    """An API client whose requests use `db_session`, so route tests roll back too.

    Food search runs on PostgreSQL here: the development search index is never touched.
    Tests of the index swap in a throwaway one (see test_food_search_index.py).
    """
    from fastapi.testclient import TestClient

    from app.db.session import get_db
    from app.main import app
    from app.services.food_index import get_food_index

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_food_index] = lambda: None
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_food_index, None)
