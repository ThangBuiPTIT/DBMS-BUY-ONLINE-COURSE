from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.auth import LoginRequest, LoginResponse
from app.services.auth import AuthError, authenticate_admin

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/admin-login", response_model=LoginResponse)
async def admin_login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        session_key, user_info = await authenticate_admin(
            db, req.username.strip(), req.password
        )
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    return LoginResponse(
        message="Đăng nhập thành công",
        session_key=session_key,
        user=user_info,
    )
