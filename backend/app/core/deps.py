from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import async_session
from app.models.user import AuthenticationSession, Role, User


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_current_admin(
    session_key: str | None = Header(None, alias="Session-Key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Verify admin session and return the user. Raises 401/403 on failure."""
    if not session_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thiếu Session-Key",
        )

    # Look up session
    result = await db.execute(
        select(AuthenticationSession)
        .options(joinedload(AuthenticationSession.user).joinedload(User.role))
        .where(
            AuthenticationSession.session_key == session_key,
            AuthenticationSession.expires_at > datetime.now(timezone.utc),
        )
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session không hợp lệ hoặc đã hết hạn",
        )

    user = session.user

    if user.status == "frozen":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản này đã bị khóa (frozen)",
        )

    if user.role.role_name != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Truy cập bị từ chối: Chỉ dành cho Admin",
        )

    return user


async def get_current_user(
    session_key: str | None = Header(None, alias="Session-Key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Xác thực session và trả về user (bất kỳ role nào). Dùng cho /users/me, /students/me, /teachers/me."""
    if not session_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thiếu Session-Key",
        )

    result = await db.execute(
        select(AuthenticationSession)
        .options(joinedload(AuthenticationSession.user).joinedload(User.role))
        .where(
            AuthenticationSession.session_key == session_key,
            AuthenticationSession.expires_at > datetime.now(timezone.utc),
        )
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session không hợp lệ hoặc đã hết hạn",
        )

    if session.user.status == "frozen":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản này đã bị khóa (frozen)",
        )

    return session.user
