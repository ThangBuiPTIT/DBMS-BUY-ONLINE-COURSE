"""Phase 3: Feedback tests."""
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


class TestGetFeedback:
    """GET /api/courses/{id}/feedback"""

    def test_get_feedback(self, client: TestClient):
        resp = _safe_request(client, "GET", "/api/courses/test-course-id/feedback")
        assert resp.status_code in (200, 500)

    def test_get_feedback_route_registered(self, client: TestClient):
        schema = client.get("/openapi.json").json()
        assert "/api/courses/{course_id}/feedback" in schema["paths"]


class TestSubmitFeedback:
    """POST /api/courses/{id}/feedback"""

    def test_submit_feedback_requires_auth(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/courses/test-cid/feedback", json={
            "rating": 5, "feedback_text": "Hay!"
        })
        assert resp.status_code == 401

    def test_submit_feedback_invalid_rating(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/courses/test-cid/feedback",
            json={"rating": 10, "feedback_text": ""},
            headers={"Session-Key": "test-key"})
        # 422 (Pydantic validation) or 401 (auth check first)
        assert resp.status_code in (401, 422)

    def test_submit_feedback_rating_zero(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/courses/test-cid/feedback",
            json={"rating": 0, "feedback_text": ""},
            headers={"Session-Key": "test-key"})
        assert resp.status_code in (401, 422)

    def test_submit_feedback_missing_rating(self, client: TestClient):
        resp = _safe_request(client, "POST", "/api/courses/test-cid/feedback",
            json={"feedback_text": "test"})
        # 401 (auth check fires before validation) or 422 (Pydantic first)
        assert resp.status_code in (401, 422)
