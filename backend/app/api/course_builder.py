from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.course_builder import (
    CourseCreateRequest,
    CourseUpdateRequest,
    LessonCreateRequest,
    LessonReorderRequest,
    LessonUpdateRequest,
    MaterialCreateRequest,
    MaterialUpdateRequest,
    ModuleCreateRequest,
    ModuleUpdateRequest,
    ProgressUpdateRequest,
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


# ── Phase 2: Course CRUD ──

@router.post("/courses", status_code=201)
async def create_course(req: CourseCreateRequest, db: AsyncSession = Depends(get_db)):
    if not req.teacher_id or not req.title:
        raise HTTPException(400, "Thiếu Teacher ID hoặc Title")
    try:
        return await course_builder_service.create_course(db, req)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Lỗi tạo khóa học: {e}")


@router.put("/courses/{course_id}")
async def update_course(course_id: str, req: CourseUpdateRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await course_builder_service.update_course(db, course_id, req)
    except Exception as e:
        raise HTTPException(500, f"Lỗi cập nhật khóa học: {e}")


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str, db: AsyncSession = Depends(get_db)):
    try:
        await course_builder_service.delete_course(db, course_id)
    except Exception as e:
        raise HTTPException(500, f"Lỗi xóa khóa học: {e}")
    return {"message": "Xóa khóa học thành công"}


# ── Phase 2: Module CRUD ──

@router.put("/modules/{module_id}")
async def update_module(module_id: str, req: ModuleUpdateRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await course_builder_service.update_module(db, module_id, req.title)
    except Exception as e:
        raise HTTPException(500, f"Lỗi cập nhật chương: {e}")


@router.delete("/modules/{module_id}")
async def delete_module(module_id: str, db: AsyncSession = Depends(get_db)):
    try:
        await course_builder_service.delete_module(db, module_id)
    except ValueError:
        raise HTTPException(404, "Không tìm thấy chương")
    except Exception as e:
        raise HTTPException(500, f"Lỗi xóa chương: {e}")
    return {"message": "Xóa chương thành công"}


# ── Phase 2: Lesson CRUD ──

@router.put("/lessons/{lesson_id}")
async def update_lesson(lesson_id: str, req: LessonUpdateRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await course_builder_service.update_lesson(db, lesson_id, req)
    except Exception as e:
        raise HTTPException(500, f"Lỗi cập nhật bài học: {e}")


@router.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: str, db: AsyncSession = Depends(get_db)):
    try:
        await course_builder_service.delete_lesson(db, lesson_id)
    except ValueError:
        raise HTTPException(404, "Không tìm thấy bài học")
    except Exception as e:
        raise HTTPException(500, f"Lỗi xóa bài học: {e}")
    return {"message": "Xóa bài học thành công"}


# ── Phase 2: Material CRUD ──

@router.post("/materials", status_code=201)
async def create_material(req: MaterialCreateRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await course_builder_service.create_material(db, req)
    except Exception as e:
        raise HTTPException(500, f"Lỗi tạo tài liệu: {e}")


@router.put("/materials/{material_id}")
async def update_material(material_id: str, req: MaterialUpdateRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await course_builder_service.update_material(db, material_id, req)
    except Exception as e:
        raise HTTPException(500, f"Lỗi cập nhật tài liệu: {e}")


@router.delete("/materials/{material_id}")
async def delete_material(material_id: str, db: AsyncSession = Depends(get_db)):
    try:
        await course_builder_service.delete_material(db, material_id)
    except Exception as e:
        raise HTTPException(500, f"Lỗi xóa tài liệu: {e}")
    return {"message": "Xóa tài liệu thành công"}
