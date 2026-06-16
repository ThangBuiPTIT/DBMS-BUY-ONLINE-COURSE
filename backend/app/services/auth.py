from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_session_key, get_session_expiry, verify_password
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


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
