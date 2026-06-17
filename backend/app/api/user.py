from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_user, get_db
from app.models.user import User
from app.schemas.user import (
    UserProfileUpdateRequest,
    StudentUpdateRequest,
    TeacherUpdateRequest,
    MessageResponse,
)
from app.services import user as user_service

router = APIRouter(tags=["Users"])


@router.get("/api/users/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await user_service.get_current_user_info(db, str(current_user.user_id))
    if result is None:
        raise HTTPException(404, "Không tìm thấy người dùng")
    return result


@router.put("/api/users/me/profile")
async def update_my_profile(
    req: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.update_profile(db, str(current_user.user_id), req)


@router.put("/api/students/me")
async def update_my_student_info(
    req: StudentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.role_name != "STUDENT":
        raise HTTPException(403, "Chỉ dành cho Học viên")
    return await user_service.update_student_info(db, str(current_user.user_id), req)


@router.put("/api/teachers/me")
async def update_my_teacher_info(
    req: TeacherUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.role_name != "TEACHER":
        raise HTTPException(403, "Chỉ dành cho Giáo viên")
    return await user_service.update_teacher_info(db, str(current_user.user_id), req)


@router.get("/api/admin/roles")
async def get_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return await user_service.get_roles(db)


@router.get("/api/admin/users")
async def list_users(
    limit: int = Query(20, gt=0),
    offset: int = Query(0, ge=0),
    role_id: int | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return await user_service.list_users(db, limit, offset, role_id, status)
