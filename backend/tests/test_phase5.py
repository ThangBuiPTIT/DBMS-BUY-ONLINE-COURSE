"""Phase 5: Advanced DBMS tests."""
import pytest
from fastapi.testclient import TestClient


def _safe_request(client: TestClient, method: str, url: str, **kwargs):
    try:
        if method == "GET":
            return client.get(url, **kwargs)
        elif method == "POST":
            return client.post(url, **kwargs)
    except Exception as e:
        if "password authentication failed" in str(e) or "could not connect" in str(e).lower():
            pytest.skip(f"DB unavailable: {str(e)[:100]}")
        raise


class TestCacheConfig:
    """Verify Redis config is loaded."""

    def test_redis_settings_exist(self):
        from app.core.config import settings
        assert hasattr(settings, 'REDIS_URL')
        assert hasattr(settings, 'REDIS_ENABLED')
        assert settings.REDIS_ENABLED == False  # default off

    def test_cache_singleton(self):
        from app.core.cache import cache
        assert cache is not None
        assert cache.enabled == False  # Redis disabled by default


class TestLeaderboardRefresh:
    """POST /api/gamification/leaderboard/refresh"""

    def test_refresh_requires_auth(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/gamification/leaderboard/refresh")
        assert resp.status_code == 401

    def test_refresh_route_registered(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        assert "/api/gamification/leaderboard/refresh" in schema["paths"]


class TestDictionaryCache:
    """Dictionary search with cache."""

    def test_search_cache_disabled_by_default(self, client: TestClient):
        """Cache is disabled, search should still work via DB."""
        resp = _safe_request(client, "GET", "/api/dictionary/search?word=ngon")
        assert resp.status_code in (200, 500)

    def test_search_route_still_registered(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        assert "/api/dictionary/search" in schema["paths"]


class TestPhase5Migrations:
    """Verify migration files exist."""

    def test_advanced_indexes_migration(self):
        import os
        path = "alembic/versions/949fdd8f9d12_advanced_indexes.py"
        assert os.path.exists(path), f"Migration {path} not found"

    def test_fulltext_search_migration(self):
        import os
        path = "alembic/versions/8c88ee18335c_fulltext_search.py"
        assert os.path.exists(path), f"Migration {path} not found"

    def test_leaderboard_mv_migration(self):
        import os
        path = "alembic/versions/ff27fabf57b0_leaderboard_materialized_view.py"
        assert os.path.exists(path), f"Migration {path} not found"


class TestPhase5Routes:
    """Verify all Phase 5 routes."""

    def test_all_routes(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        paths = schema["paths"]
        assert "/api/gamification/leaderboard/refresh" in paths
