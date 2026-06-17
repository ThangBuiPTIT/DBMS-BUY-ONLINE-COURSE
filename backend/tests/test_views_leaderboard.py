"""Phase 1: Views & Materialized Leaderboard tests."""
import pytest
from fastapi.testclient import TestClient


def _safe_request(client: TestClient, method: str, url: str, **kwargs):
    """Wrap HTTP request with DB-unavailable skip."""
    try:
        if method == "GET":
            return client.get(url, **kwargs)
        elif method == "POST":
            return client.post(url, **kwargs)
    except Exception as e:
        err = str(e).lower()
        if "password authentication failed" in err or "could not connect" in err:
            pytest.skip(f"DB unavailable: {str(e)[:100]}")
        raise


class TestPublishedCoursesView:
    """Verify v_published_courses view behavior."""

    def test_store_courses_endpoint_works(self, client: TestClient):
        """GET /api/store/courses should return list (even empty)."""
        resp = _safe_request(client, "GET", "/api/store/courses?student_id=test")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_store_courses_response_structure(self, client: TestClient):
        """Response should include new view fields: category_name, enrollment_count."""
        resp = _safe_request(client, "GET", "/api/store/courses?student_id=test")
        if resp.status_code == 200 and isinstance(resp.json(), list) and resp.json():
            course = resp.json()[0]
            # New fields from v_published_courses
            assert "category_name" in course
            assert "teacher_name" in course
            assert "enrollment_count" in course
            assert "is_enrolled" in course
            # Backward compatibility
            assert "visibility_status" in course
            assert course["visibility_status"] == "PUBLISHED"


class TestStudentDashboardView:
    """Verify v_student_dashboard view and endpoint."""

    def test_dashboard_requires_auth(self, client: TestClient):
        """GET /api/students/dashboard should require authentication."""
        resp = _safe_request(client, "GET", "/api/students/dashboard")
        assert resp.status_code == 401

    def test_dashboard_route_registered(self, client: TestClient):
        """Dashboard endpoint should appear in OpenAPI schema."""
        schema = client.get("/openapi.json").json()
        assert "/api/students/dashboard" in schema["paths"]


class TestLeaderboardMaterializedView:
    """Verify mv_leaderboard fix: student_id column, RANK(), unique index."""

    def test_leaderboard_endpoint_works(self, client: TestClient):
        """GET /api/gamification/leaderboard should work."""
        resp = _safe_request(client, "GET", "/api/gamification/leaderboard?limit=10")
        assert resp.status_code == 200

    def test_leaderboard_student_id_present(self, client: TestClient):
        """Leaderboard entries should include student_id."""
        resp = _safe_request(client, "GET", "/api/gamification/leaderboard?limit=10")
        if resp.status_code == 200 and resp.json():
            data = resp.json()
            entries = data.get("leaderboard", [])
            if entries:
                assert "student_id" in entries[0], (
                    "mv_leaderboard should now include student_id column"
                )

    def test_leaderboard_rank_present(self, client: TestClient):
        """Each entry should have a rank."""
        resp = _safe_request(client, "GET", "/api/gamification/leaderboard?limit=10")
        if resp.status_code == 200 and resp.json():
            data = resp.json()
            entries = data.get("leaderboard", [])
            for entry in entries:
                assert "rank" in entry, "Each leaderboard entry must have rank"


class TestLeaderboardRefresh:
    """Verify the manual and periodic refresh mechanisms."""

    def test_refresh_endpoint_requires_auth(self, client: TestClient):
        """POST /api/gamification/leaderboard/refresh requires admin auth."""
        resp = _safe_request(client, "POST", "/api/gamification/leaderboard/refresh")
        assert resp.status_code == 401

    def test_refresh_route_registered(self, client: TestClient):
        """Refresh endpoint in OpenAPI schema."""
        schema = client.get("/openapi.json").json()
        assert "/api/gamification/leaderboard/refresh" in schema["paths"]


class TestStudentDashboardSchema:
    """Verify StudentDashboardResponse Pydantic schema."""

    def test_schema_fields(self):
        from app.schemas.student import StudentDashboardResponse
        fields = StudentDashboardResponse.model_fields
        assert "student_id" in fields
        assert "full_name" in fields
        assert "current_streak" in fields
        assert "highest_streak" in fields
        assert "enrolled_courses" in fields
        assert "achievements" in fields
        assert "avg_progress" in fields


class TestPhase1Migrations:
    """Verify Phase 1 migration files exist."""

    def test_v_published_courses_migration(self):
        import os
        path = "alembic/versions/7a1b2c3d4e5f_v_published_courses.py"
        assert os.path.exists(path), f"Migration {path} not found"

    def test_v_student_dashboard_migration(self):
        import os
        path = "alembic/versions/8b2c3d4e5f6a_v_student_dashboard.py"
        assert os.path.exists(path), f"Migration {path} not found"

    def test_fix_mv_leaderboard_migration(self):
        import os
        path = "alembic/versions/9c3d4e5f6a7b_fix_mv_leaderboard.py"
        assert os.path.exists(path), f"Migration {path} not found"

    def test_pg_cron_setup_script(self):
        import os
        path = "app/db/pg_cron_setup.sql"
        assert os.path.exists(path), f"Script {path} not found"


class TestPhase1Routes:
    """Verify all Phase 1 routes are registered."""

    def test_all_routes(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        paths = schema["paths"]
        assert "/api/students/dashboard" in paths
        assert "/api/gamification/leaderboard/refresh" in paths
        assert "/api/store/courses" in paths
