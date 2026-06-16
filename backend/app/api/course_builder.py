from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.course_builder import (
    LessonCreateRequest,
    LessonReorderRequest,
    ModuleCreateRequest,
    VisibilityRequest,
)
from app.services import course_builder as course_builder_service

router = APIRouter(prefix="/api/teacher", tags=["Course Builder"])


@router.get("/courses/{course_id}/content")
async def get_course_content(course_id: str, db: AsyncSession = Depends(get_db)):
    if not course_id:
        raise HTTPException(400, "Thiếu Course ID")
    try:
        return await course_builder_service.get_course_content(db, course_id)
    except ValueError:
        raise HTTPException(404, "Lỗi lấy nội dung khóa học: course not found")


@router.post("/modules", status_code=201)
async def create_module(req: ModuleCreateRequest, db: AsyncSession = Depends(get_db)):
    if not req.course_id or not req.title:
        raise HTTPException(400, "Thiếu Course ID hoặc Title")
    try:
        return await course_builder_service.create_module(db, req.course_id, req.title)
    except Exception as e:
        raise HTTPException(500, f"Lỗi tạo chương mới: {e}")


@router.post("/lessons", status_code=201)
async def create_lesson(req: LessonCreateRequest, db: AsyncSession = Depends(get_db)):
    if not req.module_id or not req.title:
        raise HTTPException(400, "Thiếu Module ID hoặc Title")
    try:
        return await course_builder_service.create_lesson(
            db, req.module_id, req.title, req.video_url
        )
    except Exception as e:
        raise HTTPException(500, f"Lỗi tạo bài học mới: {e}")


@router.put("/lessons/reorder")
async def update_lesson_order(
    req: LessonReorderRequest, db: AsyncSession = Depends(get_db)
):
    if not req.module_id or not req.lesson_ids:
        raise HTTPException(400, "Thiếu Module ID hoặc Danh sách Lesson ID")
    try:
        await course_builder_service.update_lesson_order(
            db, req.module_id, req.lesson_ids
        )
    except Exception as e:
        raise HTTPException(500, f"Lỗi sắp xếp lại bài học: {e}")
    return {"message": "Sắp xếp bài học thành công"}


@router.put("/courses/{course_id}/visibility")
async def toggle_visibility(
    course_id: str,
    req: VisibilityRequest,
    db: AsyncSession = Depends(get_db),
):
    if not course_id:
        raise HTTPException(400, "Thiếu Course ID")
    try:
        await course_builder_service.toggle_course_visibility(
            db, course_id, req.visibility_status
        )
    except Exception as e:
        raise HTTPException(500, f"Lỗi cập nhật trạng thái hiển thị: {e}")
    return {"message": "Cập nhật trạng thái thành công"}
