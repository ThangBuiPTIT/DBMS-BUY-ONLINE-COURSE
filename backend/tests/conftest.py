import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app


@pytest.fixture
def client():
    """Synchronous TestClient for FastAPI app."""
    return TestClient(app)


@pytest.fixture
def auth_headers():
    """Headers with a valid session key."""
    return {"Session-Key": "test-session-key"}
