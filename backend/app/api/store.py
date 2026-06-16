from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.store import (
    CheckoutRequest,
    StoreSuccessResponse,
    TopupRequest,
    WalletInfoResponse,
)
from app.services import store as store_service
from app.services.store import StoreError

router = APIRouter(tags=["Store"])


@router.get("/api/store/courses")
async def get_store_courses(
    student_id: str = None,
    db: AsyncSession = Depends(get_db),
):
    return await store_service.get_store_courses(db, student_id or "")


@router.get("/api/wallet/{user_id}", response_model=WalletInfoResponse)
async def get_wallet(user_id: str, db: AsyncSession = Depends(get_db)):
    if not user_id:
        raise HTTPException(400, "Thiếu User ID")
    return await store_service.get_wallet(db, user_id)


@router.post("/api/wallet/topup", response_model=StoreSuccessResponse)
async def topup_wallet(req: TopupRequest, db: AsyncSession = Depends(get_db)):
    if not req.user_id or req.amount <= 0:
        raise HTTPException(400, "Dữ liệu nạp tiền thiếu hoặc không hợp lệ")
    try:
        await store_service.topup_wallet(db, req.user_id, req.amount, req.message)
    except Exception as e:
        raise HTTPException(500, str(e))
    return {"status": "SUCCESS", "message": "Nạp tiền thành công"}


@router.post("/api/store/checkout", response_model=StoreSuccessResponse)
async def checkout_course(req: CheckoutRequest, db: AsyncSession = Depends(get_db)):
    if not req.student_id or not req.course_id:
        raise HTTPException(400, "Thiếu ID Học viên hoặc ID Khóa học")
    try:
        await store_service.checkout_course(db, req.student_id, req.course_id)
    except StoreError as e:
        raise HTTPException(e.status_code, e.message)
    except Exception as e:
        raise HTTPException(500, str(e))
    return {"status": "SUCCESS", "message": "Mua khóa học thành công"}
