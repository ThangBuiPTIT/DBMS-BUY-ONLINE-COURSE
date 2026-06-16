from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_session_key, get_session_expiry, hash_password, verify_password
from app.models.user import AuthenticationSession, Role, User


async def authenticate_admin(
    db: AsyncSession, username: str, password: str
) -> tuple[str, dict]:
    """Authenticate an admin user. Returns (session_key, user_info_dict)."""
    result = await db.execute(
        select(User)
        .join(Role)
        .where(User.username == username, User.is_deleted == False)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise AuthError("Username hoặc mật khẩu không chính xác", 401)

    if user.status == "frozen":
        raise AuthError("Tài khoản này đã bị khóa (frozen)", 403)

    if user.role.role_name != "ADMIN":
        raise AuthError("Truy cập bị từ chối: Chỉ dành cho Admin", 403)

    if not verify_password(password, user.password_hash):
        raise AuthError("Username hoặc mật khẩu không chính xác", 401)

    session_key = create_session_key()
    expires_at = get_session_expiry()

    session = AuthenticationSession(
        user_id=user.user_id,
        session_key=session_key,
        expires_at=expires_at,
    )
    db.add(session)
    await db.commit()

    user_info = {
        "user_id": str(user.user_id),
        "username": user.username,
        "email": user.email or "",
        "role_name": user.role.role_name,
    }

    return session_key, user_info


async def register_user(db: AsyncSession, req) -> dict:
    """Đăng ký user mới. Tự động tạo profile + student/teacher record.
    Wallet và streak được provision bởi DB triggers."""

    # 1. Kiểm tra username uniqueness
    result = await db.execute(
        text("SELECT user_id FROM users WHERE username = :un"),
        {"un": req.username},
    )
    if result.scalar_one_or_none():
        raise AuthError("Username đã tồn tại", 409)

    # 2. Kiểm tra email uniqueness (nếu có)
    if req.email:
        result = await db.execute(
            text("SELECT user_id FROM users WHERE email = :em"),
            {"em": req.email},
        )
        if result.scalar_one_or_none():
            raise AuthError("Email đã tồn tại", 409)

    # 3. Validate role_id
    result = await db.execute(
        text("SELECT role_name FROM roles WHERE role_id = :rid"),
        {"rid": req.role_id},
    )
    role_row = result.mappings().first()
    if not role_row:
        raise AuthError("Role không hợp lệ", 400)
    role_name = role_row["role_name"]

    # 4. Hash password
    hashed = hash_password(req.password)

    # 5. Insert user
    result = await db.execute(
        text("""
            INSERT INTO users (username, password_hash, email, role_id)
            VALUES (:un, :pw, :em, :rid)
            RETURNING user_id
        """),
        {"un": req.username, "pw": hashed, "em": req.email, "rid": req.role_id},
    )
    user_id = result.scalar()

    # 6. Insert profile
    await db.execute(
        text("""
            INSERT INTO user_profiles (user_id, full_name)
            VALUES (:uid, :fn)
        """),
        {"uid": user_id, "fn": req.full_name},
    )

    # 7. Insert role-specific record
    if role_name == "STUDENT":
        await db.execute(
            text("""
                INSERT INTO students (user_id, grade_level, school_name)
                VALUES (:uid, :gl, :sn)
            """),
            {"uid": user_id, "gl": req.grade_level, "sn": req.school_name},
        )
        # Trigger trg_create_student_streak tự động tạo streak row
    elif role_name == "TEACHER":
        await db.execute(
            text("""
                INSERT INTO teachers (user_id, bio, department)
                VALUES (:uid, :bio, :dept)
            """),
            {"uid": user_id, "bio": req.bio or "", "dept": req.department or ""},
        )

    # Trigger trg_provision_wallet tự động tạo wallet row

    await db.commit()

    return {
        "message": "Đăng ký thành công",
        "user_id": str(user_id),
        "username": req.username,
        "role_name": role_name,
    }


async def logout_user(db: AsyncSession, session_key: str) -> None:
    """Hủy session — xóa khỏi authentication_sessions."""
    await db.execute(
        text("DELETE FROM authentication_sessions WHERE session_key = :sk"),
        {"sk": session_key},
    )
    await db.commit()


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
