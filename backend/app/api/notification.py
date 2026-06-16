from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_db
from app.models.user import User
from app.services import notification as notification_service

router = APIRouter(tags=["Notification"])


@router.get("/api/notifications/{user_id}")
async def get_notifications(user_id: str, db: AsyncSession = Depends(get_db)):
    if not user_id:
        raise HTTPException(400, "Thiếu user_id")
    result = await notification_service.get_notifications(db, user_id)
    return result if result else []


@router.put("/api/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str, db: AsyncSession = Depends(get_db)
):
    if not notification_id:
        raise HTTPException(400, "Thiếu notification_id")
    try:
        await notification_service.mark_notification_as_read(db, notification_id)
    except ValueError as e:
        raise HTTPException(500, str(e))
    return {"message": "Đã đánh dấu đã đọc"}


@router.get("/api/admin/audit-logs")
async def get_audit_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    result = await notification_service.get_audit_logs(db)
    return result if result else []
