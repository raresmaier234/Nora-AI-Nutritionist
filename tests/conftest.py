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
