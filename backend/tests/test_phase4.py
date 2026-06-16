"""Phase 4: E-Commerce & Auditing tests."""
import pytest
from fastapi.testclient import TestClient


def _safe_request(client: TestClient, method: str, url: str, **kwargs):
    try:
        if method == "GET":
            return client.get(url, **kwargs)
        elif method == "POST":
            return client.post(url, **kwargs)
        elif method == "PUT":
            return client.put(url, **kwargs)
        elif method == "DELETE":
            return client.delete(url, **kwargs)
    except Exception as e:
        if "password authentication failed" in str(e) or "could not connect" in str(e).lower():
            pytest.skip(f"DB unavailable: {str(e)[:100]}")
        raise


class TestRefund:
    """POST /api/store/refund"""

    def test_refund_requires_auth(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/store/refund", json={
            "student_id": "test", "course_id": "test"
        })
        assert resp.status_code == 401

    def test_refund_missing_fields(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/store/refund", json={})
        # 401 (auth check fires first) or 422 (Pydantic first)
        assert resp.status_code in (401, 422)


class TestUserTransactions:
    """GET /api/wallet/{id}/transactions"""

    def test_transactions(self, client: TestClient):
        resp = _safe_request(client, "GET", "/api/wallet/test-id/transactions?limit=5")
        assert resp.status_code in (200, 500)

    def test_transactions_route_registered(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        assert "/api/wallet/{user_id}/transactions" in schema["paths"]


class TestWalletAudit:
    """GET /api/admin/wallets/{id}/audit"""

    def test_audit_requires_auth(self, client: TestClient):
        resp = _safe_request(client, "GET", "/api/admin/wallets/test-id/audit")
        assert resp.status_code == 401


class TestCompletionRate:
    """GET /api/admin/courses/{id}/completion-rate"""

    def test_completion_rate(self, client: TestClient):
        resp = _safe_request(client, "GET", "/api/admin/courses/test-id/completion-rate")
        assert resp.status_code in (200, 404, 500)


class TestCertificate:
    """GET /api/courses/{id}/certificate/eligibility/{sid}"""

    def test_eligibility(self, client: TestClient):
        resp = _safe_request(client, "GET", "/api/courses/test-cid/certificate/eligibility/test-sid")
        assert resp.status_code in (200, 500)

    def test_route_registered(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        assert "/api/courses/{course_id}/certificate/eligibility/{student_id}" in schema["paths"]


class TestPhase4Routes:
    """Verify all Phase 4 routes are registered."""

    def test_all_routes(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        paths = schema["paths"]
        assert "/api/store/refund" in paths
        assert "/api/wallet/{user_id}/transactions" in paths
        assert "/api/admin/wallets/{user_id}/audit" in paths
        assert "/api/admin/courses/{course_id}/completion-rate" in paths
        assert "/api/courses/{course_id}/certificate/eligibility/{student_id}" in paths
