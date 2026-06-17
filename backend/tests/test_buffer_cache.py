"""Phase 6: Buffer Pool & Redis Cache tests."""
import pytest
from fastapi.testclient import TestClient


def _safe_request(client: TestClient, method: str, url: str, **kwargs):
    try:
        if method == "GET":
            return client.get(url, **kwargs)
    except Exception as e:
        err = str(e).lower()
        if "password authentication failed" in err or "could not connect" in err:
            pytest.skip(f"DB unavailable: {str(e)[:100]}")
        raise


class TestBufferMonitor:
    """Verify buffer pool monitoring functions."""

    def test_get_cache_hit_ratio_import(self):
        from app.core.buffer_monitor import get_cache_hit_ratio
        assert get_cache_hit_ratio is not None

    def test_get_tables_needing_prewarm_import(self):
        from app.core.buffer_monitor import get_tables_needing_prewarm
        assert get_tables_needing_prewarm is not None


class TestCacheInvalidation:
    """Verify cache invalidation hooks exist."""

    def test_invalidate_course_catalog(self):
        from app.core.cache_invalidation import invalidate_course_catalog
        assert invalidate_course_catalog is not None

    def test_invalidate_course_detail(self):
        from app.core.cache_invalidation import invalidate_course_detail
        assert invalidate_course_detail is not None

    def test_invalidate_dictionary(self):
        from app.core.cache_invalidation import invalidate_dictionary_cache
        assert invalidate_dictionary_cache is not None

    def test_invalidate_leaderboard(self):
        from app.core.cache_invalidation import invalidate_leaderboard_cache
        assert invalidate_leaderboard_cache is not None


class TestCacheStats:
    """Verify Redis cache hit/miss tracking."""

    def test_cache_stats_method(self):
        from app.core.cache import cache
        stats = cache.stats()
        assert "hits" in stats
        assert "misses" in stats
        assert "hit_rate_pct" in stats
        assert "enabled" in stats

    def test_cache_disabled_by_default(self):
        from app.core.cache import cache
        stats = cache.stats()
        assert stats["enabled"] is False


class TestHealthCacheEndpoint:
    """Verify the cache health endpoint."""

    def test_health_cache_works(self, client: TestClient):
        resp = _safe_request(client, "GET", "/api/health/cache")
        assert resp.status_code == 200
        data = resp.json()
        assert "postgresql" in data
        assert "cache_hit_ratio_pct" in data["postgresql"]
        assert "redis" in data
        assert "redis_stats" in data


class TestPhase6Migrations:
    """Verify migration exists."""

    def test_pg_prewarm_migration(self):
        import os
        assert os.path.exists("alembic/versions/1a2b3c4d5e6f_pg_prewarm.py")


class TestCacheHitRatioScript:
    """Verify cache monitoring SQL script."""

    def test_script_exists(self):
        import os
        assert os.path.exists("scripts/cache_hit_ratio.sql")


class TestPrewarmInMain:
    """Verify prewarm is called in main.py."""

    def test_prewarm_function_in_main(self):
        with open("app/main.py", "r", encoding="utf-8") as f:
            content = f.read()
        assert "_prewarm_hot_tables" in content
        assert "pg_prewarm" in content
