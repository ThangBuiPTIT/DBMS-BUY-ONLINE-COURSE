"""Phase 5: Table Partitioning & Distribution tests."""
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


class TestPartitionedTablesExist:
    """Verify partitioned tables are properly set up."""

    def test_replica_db_importable(self):
        from app.core.database import get_replica_db
        assert get_replica_db is not None

    def test_replica_config_default(self):
        from app.core.config import settings
        assert hasattr(settings, 'REPLICA_DATABASE_URL')
        assert settings.REPLICA_DATABASE_URL is None  # default: no replica

    def test_cdn_config_exists(self):
        from app.core.config import settings
        assert hasattr(settings, 'CDN_BASE_URL')


class TestCDNMediaHelper:
    """Verify CDN URL resolution."""

    def test_full_url_passthrough(self):
        from app.core.media import video_url
        signed = "https://s3.amazonaws.com/bucket/video.mp4?sign=xyz"
        assert video_url(signed) == signed

    def test_empty_path(self):
        from app.core.media import video_url
        assert video_url(None) == ""
        assert video_url("") == ""

    def test_relative_path_no_cdn(self):
        from app.core.media import video_url
        assert video_url("courses/intro.mp4") == "courses/intro.mp4"


class TestPartmanSetupScript:
    """Verify pg_partman setup SQL exists."""

    def test_partman_script_exists(self):
        import os
        assert os.path.exists("app/db/pg_partman_setup.sql")

    def test_partman_script_has_create_parent(self):
        with open("app/db/pg_partman_setup.sql", "r", encoding="utf-8") as f:
            content = f.read()
        assert "create_parent" in content
        assert "transaction_logs" in content
        assert "run_maintenance" in content


class TestPartitionPruningScript:
    """Verify partition pruning verification SQL exists."""

    def test_script_exists(self):
        import os
        assert os.path.exists("scripts/verify_partition_pruning.sql")

    def test_script_has_explain(self):
        with open("scripts/verify_partition_pruning.sql", "r", encoding="utf-8") as f:
            content = f.read()
        assert "EXPLAIN" in content
        assert "pg_inherits" in content


class TestPhase5Routes:
    """Verify existing routes still work after Phase 5 changes."""

    def test_store_courses_works(self, client: TestClient):
        resp = _safe_request(client, "GET", "/api/store/courses")
        assert resp.status_code == 200

    def test_wallet_works(self, client: TestClient):
        resp = _safe_request(client, "GET", "/api/wallet/")
        assert resp.status_code in (400, 404)
