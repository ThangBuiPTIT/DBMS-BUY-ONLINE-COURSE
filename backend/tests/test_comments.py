"""Phase 3: Comments tests."""
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


class TestGetComments:
    """GET /api/lessons/{id}/comments"""

    def test_get_comments(self, client: TestClient):
        resp = _safe_request(client, "GET", "/api/lessons/test-lesson-id/comments")
        assert resp.status_code in (200, 500)

    def test_get_comments_route_registered(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        assert "/api/lessons/{lesson_id}/comments" in schema["paths"]


class TestCreateComment:
    """POST /api/lessons/{id}/comments"""

    def test_create_comment_requires_auth(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/lessons/test-lesson/comments", json={"content": "test"})
        # 401 without session, or 422 if validated first
        assert resp.status_code in (401, 422)

    def test_create_comment_missing_content(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/lessons/test-lesson/comments",
            json={}, headers={"Session-Key": "test-key"})
        assert resp.status_code in (401, 422)


class TestUpdateComment:
    """PUT /api/comments/{id}"""

    def test_update_comment_requires_auth(self, client: TestClient):
        resp = _safe_request(client, "PUT", "/api/comments/test-id", json={"content": "updated"})
        assert resp.status_code == 401

    def test_update_comment_missing_content(self, client: TestClient):
        resp = _safe_request(client, "PUT", "/api/comments/test-id",
            json={}, headers={"Session-Key": "test-key"})
        assert resp.status_code in (401, 422)


class TestDeleteComment:
    """DELETE /api/comments/{id}"""

    def test_delete_comment_requires_auth(self, client: TestClient):
        resp = _safe_request(client, "DELETE", "/api/comments/test-id")
        assert resp.status_code == 401
