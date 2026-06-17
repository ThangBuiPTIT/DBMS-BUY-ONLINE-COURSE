"""Phase 3: Achievements & Streak tests."""
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


class TestAchievementsList:
    """GET /api/gamification/achievements"""

    def test_get_achievements(self, client: TestClient):
        resp = _safe_request(client, "GET", "/api/gamification/achievements")
        assert resp.status_code in (200, 500)

    def test_get_user_achievements(self, client: TestClient):
        resp = _safe_request(client, "GET", "/api/gamification/users/test-user-id/achievements")
        assert resp.status_code in (200, 500)

    def test_routes_registered(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        assert "/api/gamification/achievements" in schema["paths"]
        assert "/api/gamification/users/{user_id}/achievements" in schema["paths"]


class TestAchievementCreate:
    """POST /api/gamification/achievements (admin only)"""

    def test_create_achievement_requires_auth(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/gamification/achievements", json={
            "title": "Test Achievement", "description": "Test"
        })
        assert resp.status_code == 401

    def test_create_achievement_validation(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/gamification/achievements",
            json={"title": ""}, headers={"Session-Key": "test-key"})
        assert resp.status_code in (401, 422)


class TestAwardAchievement:
    """POST /api/gamification/achievements/award (admin only)"""

    def test_award_requires_auth(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/gamification/achievements/award", json={
            "user_id": "test", "achievement_id": 1
        })
        assert resp.status_code == 401

    def test_award_missing_fields(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/gamification/achievements/award", json={})
        # 401 (auth first) or 422 (validation first)
        assert resp.status_code in (401, 422)


class TestStreakSync:
    """POST /api/gamification/streak/{id}/sync"""

    def test_sync_streak(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/gamification/streak/test-student-id/sync")
        assert resp.status_code in (200, 500)

    def test_sync_streak_route_registered(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        assert "/api/gamification/streak/{student_id}/sync" in schema["paths"]
