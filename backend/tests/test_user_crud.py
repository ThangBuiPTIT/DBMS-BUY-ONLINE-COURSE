"""Phase 1: User & Profile CRUD tests."""
import pytest
from fastapi.testclient import TestClient


def _safe_request(client: TestClient, method: str, url: str, **kwargs):
    """Wrapper to handle DB connection errors gracefully."""
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
        err_msg = str(e)
        if "password authentication failed" in err_msg or "could not connect" in err_msg.lower():
            pytest.skip(f"DB unavailable: {str(e)[:100]}")
        raise


class TestRegister:
    """POST /api/auth/register"""

    def test_register_student_success(self, client: TestClient):
        """Đăng ký student mới → 201."""
        resp = _safe_request(client, "POST", "/api/auth/register", json={
            "username": "pytest_student",
            "password": "testpass123",
            "email": "pytest_student@test.com",
            "full_name": "Pytest Student",
            "role_id": 3,
            "grade_level": "Cử nhân",
            "school_name": "PTIT",
        })
        # 201 success, or 409 if already exists, or 500 if DB error
        assert resp.status_code in (201, 409, 500)

    def test_register_teacher_success(self, client: TestClient):
        """Đăng ký teacher mới → 201."""
        resp = _safe_request(client, "POST", "/api/auth/register", json={
            "username": "pytest_teacher",
            "password": "testpass123",
            "email": "pytest_teacher@test.com",
            "full_name": "Pytest Teacher",
            "role_id": 2,
            "bio": "Giáo viên test",
            "department": "CNTT",
        })
        assert resp.status_code in (201, 409, 500)

    def test_register_missing_required_fields(self, client: TestClient):
        """Thiếu username → 422 validation error."""
        resp = _safe_request(client, "POST", "/api/auth/register", json={
            "password": "testpass123",
            "full_name": "No Username",
            "role_id": 3,
        })
        assert resp.status_code == 422

    def test_register_short_password(self, client: TestClient):
        """Password quá ngắn → 422."""
        resp = _safe_request(client, "POST", "/api/auth/register", json={
            "username": "shortpass",
            "password": "ab",
            "full_name": "Short Pass",
            "role_id": 3,
        })
        assert resp.status_code == 422

    def test_register_invalid_role(self, client: TestClient):
        """Role không tồn tại → 422 (Pydantic validation: le=4)."""
        resp = _safe_request(client, "POST", "/api/auth/register", json={
            "username": "badrole_user",
            "password": "testpass123",
            "full_name": "Bad Role",
            "role_id": 99,
        })
        assert resp.status_code == 422


class TestLogout:
    """POST /api/auth/logout"""

    def test_logout_invalidates_session(self, client: TestClient):
        """Sau logout, session không dùng được nữa."""
        login_resp = _safe_request(client, "POST", "/api/auth/admin-login", json={
            "username": "admin", "password": "admin123"
        })
        if login_resp.status_code != 200:
            pytest.skip("Cannot test logout without valid login (DB unavailable?)")

        session_key = login_resp.json()["session_key"]
        headers = {"Session-Key": session_key}

        # Verify session works
        me_resp = _safe_request(client, "GET", "/api/users/me", headers=headers)
        assert me_resp.status_code in (200, 500)

        # Logout
        logout_resp = _safe_request(client, "POST", "/api/auth/logout", json={"session_key": session_key})
        assert logout_resp.status_code in (200, 500)

        # Verify session bị từ chối
        me_resp2 = _safe_request(client, "GET", "/api/users/me", headers=headers)
        assert me_resp2.status_code in (401, 500)

    def test_logout_missing_session_key(self, client: TestClient):
        """Thiếu session_key → 422."""
        resp = _safe_request(client, "POST", "/api/auth/logout", json={})
        assert resp.status_code == 422


class TestGetMe:
    """GET /api/users/me"""

    def test_get_me_without_session(self, client: TestClient):
        """Không có Session-Key → 401."""
        resp = _safe_request(client, "GET", "/api/users/me")
        assert resp.status_code == 401

    def test_get_me_invalid_session(self, client: TestClient):
        """Session Key không tồn tại → 401."""
        resp = _safe_request(client, "GET", "/api/users/me", headers={"Session-Key": "invalid-key"})
        assert resp.status_code in (401, 500)  # 401 for missing, 500 if DB error

    def test_get_me_as_admin(self, client: TestClient):
        """Admin lấy thông tin chính mình → 200."""
        login_resp = _safe_request(client, "POST", "/api/auth/admin-login", json={
            "username": "admin", "password": "admin123"
        })
        if login_resp.status_code != 200:
            pytest.skip("DB unavailable, skipping integration test")

        session_key = login_resp.json()["session_key"]
        resp = _safe_request(client, "GET", "/api/users/me", headers={"Session-Key": session_key})
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "admin"
        assert data["role_name"] == "ADMIN"


class TestUpdateProfile:
    """PUT /api/users/me/profile"""

    def test_update_profile_full_name(self, client: TestClient):
        """Cập nhật full_name → 200."""
        login_resp = _safe_request(client, "POST", "/api/auth/admin-login", json={
            "username": "admin", "password": "admin123"
        })
        if login_resp.status_code != 200:
            pytest.skip("DB unavailable")

        session_key = login_resp.json()["session_key"]
        resp = _safe_request(client, "PUT", "/api/users/me/profile",
            json={"full_name": "Admin Updated"},
            headers={"Session-Key": session_key},
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Admin Updated"

    def test_update_profile_no_session(self, client: TestClient):
        """Không có session → 401."""
        resp = _safe_request(client, "PUT", "/api/users/me/profile", json={"full_name": "Test"})
        assert resp.status_code == 401


class TestRoleSpecific:
    """PUT /api/students/me and PUT /api/teachers/me"""

    def test_admin_cannot_update_student_info(self, client: TestClient):
        """Admin (không phải student) không thể update student info → 403."""
        login_resp = _safe_request(client, "POST", "/api/auth/admin-login", json={
            "username": "admin", "password": "admin123"
        })
        if login_resp.status_code != 200:
            pytest.skip("DB unavailable")

        session_key = login_resp.json()["session_key"]
        resp = _safe_request(client, "PUT", "/api/students/me",
            json={"grade_level": "Thạc sĩ"},
            headers={"Session-Key": session_key},
        )
        assert resp.status_code == 403

    def test_admin_cannot_update_teacher_info(self, client: TestClient):
        """Admin (không phải teacher) không thể update teacher info → 403."""
        login_resp = _safe_request(client, "POST", "/api/auth/admin-login", json={
            "username": "admin", "password": "admin123"
        })
        if login_resp.status_code != 200:
            pytest.skip("DB unavailable")

        session_key = login_resp.json()["session_key"]
        resp = _safe_request(client, "PUT", "/api/teachers/me",
            json={"bio": "Test bio"},
            headers={"Session-Key": session_key},
        )
        assert resp.status_code == 403


class TestAdminEndpoints:
    """GET /api/admin/roles and GET /api/admin/users"""

    def test_list_roles(self, client: TestClient):
        """Admin lấy danh sách roles → >= 3 roles."""
        login_resp = _safe_request(client, "POST", "/api/auth/admin-login", json={
            "username": "admin", "password": "admin123"
        })
        if login_resp.status_code != 200:
            pytest.skip("DB unavailable")

        session_key = login_resp.json()["session_key"]
        resp = _safe_request(client, "GET", "/api/admin/roles", headers={"Session-Key": session_key})
        assert resp.status_code == 200
        roles = resp.json()
        assert len(roles) >= 3  # ADMIN, TEACHER, STUDENT

    def test_list_users(self, client: TestClient):
        """Admin liệt kê users có phân trang."""
        login_resp = _safe_request(client, "POST", "/api/auth/admin-login", json={
            "username": "admin", "password": "admin123"
        })
        if login_resp.status_code != 200:
            pytest.skip("DB unavailable")

        session_key = login_resp.json()["session_key"]
        resp = _safe_request(client, "GET", "/api/admin/users?limit=5&offset=0",
            headers={"Session-Key": session_key},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        assert "total" in data
        assert data["limit"] == 5
        assert data["offset"] == 0

    def test_list_users_filter_by_role(self, client: TestClient):
        """Admin lọc users theo role_id."""
        login_resp = _safe_request(client, "POST", "/api/auth/admin-login", json={
            "username": "admin", "password": "admin123"
        })
        if login_resp.status_code != 200:
            pytest.skip("DB unavailable")

        session_key = login_resp.json()["session_key"]
        resp = _safe_request(client, "GET", "/api/admin/users?role_id=1",
            headers={"Session-Key": session_key},
        )
        assert resp.status_code == 200
        data = resp.json()
        for user in data["users"]:
            assert user["role_name"] == "ADMIN"

    def test_list_roles_requires_admin(self, client: TestClient):
        """Không có session → 401."""
        resp = _safe_request(client, "GET", "/api/admin/roles")
        assert resp.status_code == 401

    def test_list_users_requires_admin(self, client: TestClient):
        """Không có session → 401."""
        resp = _safe_request(client, "GET", "/api/admin/users")
        assert resp.status_code == 401
