"""General integration tests for route registration and docs."""
from fastapi.testclient import TestClient


class TestHealth:
    def test_health_check(self, client: TestClient):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestDocs:
    def test_swagger_ui(self, client: TestClient):
        resp = client.get("/docs")
        assert resp.status_code == 200

    def test_redoc(self, client: TestClient):
        resp = client.get("/redoc")
        assert resp.status_code == 200

    def test_openapi_schema(self, client: TestClient):
        resp = client.get("/openapi.json")
        assert resp.status_code == 200
        schema = resp.json()
        assert "paths" in schema
        # Verify all expected paths exist
        paths = schema["paths"]
        assert "/api/auth/admin-login" in paths
        assert "/api/admin/transactions" in paths
        assert "/api/store/courses" in paths
        assert "/api/gamification/leaderboard" in paths


class TestRouteCount:
    def test_all_routes_registered(self, client: TestClient):
        """Verify all 30+ endpoints are registered."""
        schema = client.get("/openapi.json").json()
        paths = schema["paths"]
        # Only count our API paths (not docs/redoc)
        api_paths = [p for p in paths if p.startswith("/api/")]
        assert len(api_paths) >= 30
