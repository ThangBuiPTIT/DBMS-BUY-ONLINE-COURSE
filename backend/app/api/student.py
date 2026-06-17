from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.course_builder import ProgressUpdateRequest
from app.services import course_builder as course_builder_service
from app.services import student as student_service

router = APIRouter(prefix="/api/students", tags=["Student"])


@router.get("/search")
async def search_students(
    keyword: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    return await student_service.search_students(db, keyword)


@router.get("/progress")
async def get_progress(db: AsyncSession = Depends(get_db)):
    return await student_service.get_progress_report(db)


@router.post("/progress")
async def update_progress(req: ProgressUpdateRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await course_builder_service.update_course_progress(db, req)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Lỗi cập nhật tiến độ: {e}")


@router.get("/inactive")
async def get_inactive(db: AsyncSession = Depends(get_db)):
    return await student_service.get_inactive_students(db)


@router.get("/dashboard")
async def student_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard tổng quan của học viên đang đăng nhập."""
    result = await student_service.get_student_dashboard(db, str(current_user.user_id))
    if result is None:
        raise HTTPException(status_code=404, detail="Student record not found")
    return result
