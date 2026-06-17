from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.course import CommentCreateRequest, CommentUpdateRequest
from app.services import comment as comment_service

router = APIRouter(prefix="/api", tags=["Comments"])


@router.get("/lessons/{lesson_id}/comments")
async def get_comments(lesson_id: str, db: AsyncSession = Depends(get_db)):
    return await comment_service.get_lesson_comments(db, lesson_id)


@router.post("/lessons/{lesson_id}/comments", status_code=201)
async def create_comment(
    lesson_id: str,
    req: CommentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await comment_service.create_comment(
        db, lesson_id, str(current_user.user_id), req.content
    )
    return result


@router.put("/comments/{comment_id}")
async def update_comment(
    comment_id: str,
    req: CommentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await comment_service.update_comment(
            db, comment_id, str(current_user.user_id), req.content
        )
    except ValueError as e:
        raise HTTPException(403, str(e))
    return {"message": "Cập nhật bình luận thành công"}


@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    is_admin = current_user.role.role_name == "ADMIN"
    try:
        await comment_service.delete_comment(
            db, comment_id, str(current_user.user_id), is_admin
        )
    except ValueError as e:
        raise HTTPException(403, str(e))
    return {"message": "Xóa bình luận thành công"}
