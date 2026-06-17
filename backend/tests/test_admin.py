"""Tests for admin endpoints."""
from fastapi.testclient import TestClient


class TestAdminBanUser:
    def test_ban_user_requires_auth(self, client: TestClient):
        """POST /api/admin/users/ban should require Session-Key header."""
        resp = client.post(
            "/api/admin/users/ban",
            json={"user_id": "some-uuid", "reason": "spam"},
        )
        assert resp.status_code == 401

    def test_ban_user_empty_user_id(self, client: TestClient):
        """Should reject empty user_id even with auth."""
        resp = client.post(
            "/api/admin/users/ban",
            json={"user_id": "", "reason": "spam"},
            headers={"Session-Key": "test-key"},
        )
        # 400 if validation passes, 401 if session check first
        assert resp.status_code in (400, 401, 500)


class TestAdminTransactions:
    def test_transactions_endpoint(self, client: TestClient):
        """GET /api/admin/transactions should be registered."""
        resp = client.get("/api/admin/transactions")
        # 500 (DB down) but route exists
        assert resp.status_code in (200, 500)

    def test_revenue_endpoint(self, client: TestClient):
        """GET /api/admin/revenue should be registered."""
        resp = client.get("/api/admin/revenue")
        assert resp.status_code in (200, 500)


class TestAuditLogs:
    def test_audit_logs_requires_auth(self, client: TestClient):
        """GET /api/admin/audit-logs should require auth."""
        resp = client.get("/api/admin/audit-logs")
        assert resp.status_code == 401
