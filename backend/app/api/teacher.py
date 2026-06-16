from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.services import teacher as teacher_service

router = APIRouter(prefix="/api/teacher", tags=["Teacher"])


@router.get("/{teacher_id}/dashboard")
async def get_dashboard(teacher_id: str, db: AsyncSession = Depends(get_db)):
    if not teacher_id:
        raise HTTPException(400, "Thiếu Teacher ID")
    result = await teacher_service.get_teacher_dashboard(db, teacher_id)
    if result is None:
        raise HTTPException(404, "Không tìm thấy giáo viên")
    return result


@router.get("/{teacher_id}/courses")
async def get_courses(teacher_id: str, db: AsyncSession = Depends(get_db)):
    if not teacher_id:
        raise HTTPException(400, "Thiếu Teacher ID")
    return await teacher_service.get_teacher_courses(db, teacher_id)


@router.get("/{teacher_id}/feedback")
async def get_feedback(teacher_id: str, db: AsyncSession = Depends(get_db)):
    if not teacher_id:
        raise HTTPException(400, "Thiếu Teacher ID")
    return await teacher_service.get_teacher_feedback(db, teacher_id)


@router.get("/{teacher_id}/feedbacks")
async def get_feedback_alias(teacher_id: str, db: AsyncSession = Depends(get_db)):
    """Alias for /feedback (Go code registers both paths)."""
    if not teacher_id:
        raise HTTPException(400, "Thiếu Teacher ID")
    return await teacher_service.get_teacher_feedback(db, teacher_id)
