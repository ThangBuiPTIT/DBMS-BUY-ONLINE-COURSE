from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, LogoutRequest
from app.services.auth import AuthError, authenticate_admin, register_user, logout_user

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


@router.post("/register", status_code=201, response_model=RegisterResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await register_user(db, req)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi đăng ký: {str(e)}")
    return result


@router.post("/logout")
async def logout(
    req: LogoutRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        await logout_user(db, req.session_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Đăng xuất thành công"}
