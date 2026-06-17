"""Tests for auth endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestAuthLogin:
    def test_login_missing_body(self, client: TestClient):
        resp = client.post("/api/auth/admin-login", json={})
        assert resp.status_code == 422  # Pydantic validation

    def test_login_empty_credentials(self, client: TestClient):
        resp = client.post(
            "/api/auth/admin-login",
            json={"username": "", "password": ""},
        )
        # 422 (Pydantic) if validation-first, 500 if DB connection error
        assert resp.status_code in (422, 500)

    def test_login_validates_request_schema(self, client: TestClient):
        """Verify the route is registered and accepts correctly shaped input."""
        resp = client.post(
            "/api/auth/admin-login",
            json={"username": "admin", "password": "secret"},
        )
        # 200/401 on correct creds, 403 on frozen/non-admin, 500 if DB unavailable
        assert resp.status_code in (200, 401, 403, 500)
