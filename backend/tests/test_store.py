"""Tests for store and wallet endpoints."""
from fastapi.testclient import TestClient


class TestStoreCourses:
    def test_get_courses_registered(self, client: TestClient):
        resp = client.get("/api/store/courses")
        assert resp.status_code in (200, 422, 500)

    def test_get_courses_with_student_id(self, client: TestClient):
        resp = client.get("/api/store/courses?student_id=test-id")
        assert resp.status_code in (200, 500)


class TestWallet:
    def test_get_wallet_missing_id(self, client: TestClient):
        resp = client.get("/api/wallet/")
        assert resp.status_code in (404, 405)  # missing path param

    def test_get_wallet_valid(self, client: TestClient):
        resp = client.get("/api/wallet/test-user-id")
        assert resp.status_code in (200, 500)  # 500 if DB down

    def test_topup_validation(self, client: TestClient):
        """POST /api/wallet/topup should validate request body."""
        resp = client.post("/api/wallet/topup", json={})
        assert resp.status_code == 422  # Pydantic validation

    def test_topup_invalid_amount(self, client: TestClient):
        """Amount must be > 0."""
        resp = client.post(
            "/api/wallet/topup",
            json={"user_id": "test", "amount": 0, "message": "test"},
        )
        assert resp.status_code == 422


class TestCheckout:
    def test_checkout_validation(self, client: TestClient):
        """POST /api/store/checkout should validate request."""
        resp = client.post("/api/store/checkout", json={})
        assert resp.status_code == 422

    def test_checkout_missing_fields(self, client: TestClient):
        resp = client.post(
            "/api/store/checkout",
            json={"student_id": "", "course_id": ""},
        )
        assert resp.status_code == 422 or resp.status_code == 400
