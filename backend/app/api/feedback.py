from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.course import FeedbackCreateRequest
from app.services import feedback as feedback_service

router = APIRouter(prefix="/api/courses", tags=["Feedback"])


@router.get("/{course_id}/feedback")
async def get_feedback(course_id: str, db: AsyncSession = Depends(get_db)):
    return await feedback_service.get_course_feedback(db, course_id)


@router.post("/{course_id}/feedback", status_code=201)
async def submit_feedback(
    course_id: str,
    req: FeedbackCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await feedback_service.submit_feedback(
            db, str(current_user.user_id), course_id, req.rating, req.feedback_text
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
