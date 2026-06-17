"""Phase 3: Procedures, Transactions & Locking tests."""
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
    except Exception as e:
        err = str(e).lower()
        if "password authentication failed" in err or "could not connect" in err:
            pytest.skip(f"DB unavailable: {str(e)[:100]}")
        raise


class TestIsolationModule:
    """Verify transaction isolation context managers exist and are importable."""

    def test_serializable_import(self):
        from app.core.isolation import serializable
        assert serializable is not None

    def test_repeatable_read_import(self):
        from app.core.isolation import repeatable_read
        assert repeatable_read is not None

    def test_read_committed_import(self):
        from app.core.isolation import read_committed
        assert read_committed is not None


class TestLockingModule:
    """Verify locking helpers are importable."""

    def test_lock_wallet_import(self):
        from app.core.locking import lock_wallet_for_update
        assert lock_wallet_for_update is not None

    def test_lock_course_import(self):
        from app.core.locking import lock_course_for_update
        assert lock_course_for_update is not None

    def test_skip_locked_import(self):
        from app.core.locking import fetch_notifications_skip_locked
        assert fetch_notifications_skip_locked is not None


class TestCronModule:
    """Verify cron advisory lock helpers are importable."""

    def test_advisory_lock_import(self):
        from app.core.cron import try_acquire_advisory_lock, release_advisory_lock
        assert try_acquire_advisory_lock is not None
        assert release_advisory_lock is not None

    def test_singleton_task_import(self):
        from app.core.cron import run_singleton_task
        assert run_singleton_task is not None

    def test_lock_ids_defined(self):
        from app.core.cron import (
            LOCK_ID_REFRESH_LEADERBOARD,
            LOCK_ID_CLEANUP_SESSIONS,
            LOCK_ID_RESET_STREAKS,
        )
        assert LOCK_ID_REFRESH_LEADERBOARD == 42
        assert LOCK_ID_RESET_STREAKS == 43
        assert LOCK_ID_CLEANUP_SESSIONS == 44


class TestOptimisticLocking:
    """Verify ConflictError and optimistic lock function exist."""

    def test_conflict_error_import(self):
        from app.services.course_builder import ConflictError
        err = ConflictError("test conflict", 409)
        assert err.message == "test conflict"
        assert err.status_code == 409

    def test_optimistic_lock_fn_import(self):
        from app.services.course_builder import update_course_with_optimistic_lock
        assert update_course_with_optimistic_lock is not None


class TestTransferEndpoint:
    """Verify transfer API endpoint is registered and validates input."""

    def test_transfer_route_registered(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        assert "/api/wallet/transfer" in schema["paths"]

    def test_transfer_validates_amount(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/wallet/transfer", json={
            "from_user_id": "a", "to_user_id": "b", "amount": 0
        })
        assert resp.status_code == 422  # Pydantic validation: amount > 0

    def test_transfer_requires_fields(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/wallet/transfer", json={})
        assert resp.status_code == 422


class TestCheckoutV2Endpoint:
    """Verify v2 checkout endpoint is registered."""

    def test_checkout_v2_route_registered(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        assert "/api/store/checkout/v2" in schema["paths"]

    def test_checkout_v2_validates(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/store/checkout/v2", json={})
        assert resp.status_code == 422


class TestStoreServiceV2:
    """Verify new service functions exist."""

    def test_transfer_funds_fn(self):
        from app.services.store import transfer_funds
        assert transfer_funds is not None

    def test_checkout_v2_fn(self):
        from app.services.store import checkout_course_v2
        assert checkout_course_v2 is not None


class TestPhase3Procedures:
    """Verify stored procedures exist in procedures.sql."""

    def test_sp_transfer_funds_in_sql(self):
        with open("app/db/procedures.sql", "r", encoding="utf-8") as f:
            content = f.read()
        assert "sp_transfer_funds" in content
        assert "DEADLOCK PREVENTION" in content.upper() or "chong deadlock" in content.lower()

    def test_sp_enroll_paid_course_in_sql(self):
        with open("app/db/procedures.sql", "r", encoding="utf-8") as f:
            content = f.read()
        assert "sp_enroll_paid_course" in content

    def test_ordered_locking_in_sql(self):
        """Deadlock prevention: khóa theo user_id tăng dần."""
        with open("app/db/procedures.sql", "r", encoding="utf-8") as f:
            content = f.read()
        assert "IF p_from < p_to THEN" in content or "p_from < p_to" in content


class TestPhase3Routes:
    """Verify all Phase 3 routes registered."""

    def test_all_routes(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        paths = schema["paths"]
        assert "/api/wallet/transfer" in paths
        assert "/api/store/checkout/v2" in paths
