from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_db
from app.models.user import User
from app.schemas.admin import BanRequest, MessageResponse
from app.services import admin as admin_service

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/transactions")
async def get_transactions(
    limit: int = Query(10, gt=0),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await admin_service.get_transactions(db, limit, offset)


@router.get("/revenue")
async def get_revenue(db: AsyncSession = Depends(get_db)):
    return await admin_service.get_revenue(db)


@router.post("/users/ban", response_model=MessageResponse)
async def ban_user(
    req: BanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    if not req.user_id:
        raise HTTPException(400, "Dữ liệu yêu cầu không hợp lệ hoặc thiếu User ID")
    try:
        await admin_service.ban_user(db, req.user_id, req.reason)
    except Exception as e:
        raise HTTPException(500, str(e))
    return {"message": "Khóa tài khoản người dùng thành công"}


# ── Phase 4: Wallet Audit & Completion Rate ──

@router.get("/wallets/{user_id}/audit")
async def audit_wallet(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    try:
        return await admin_service.audit_wallet_balance(db, user_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/courses/{course_id}/completion-rate")
async def course_completion_rate(
    course_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await admin_service.get_course_completion_rate(db, course_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
