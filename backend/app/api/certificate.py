from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.services import certificate as cert_service

router = APIRouter(prefix="/api/courses", tags=["Certificate"])


@router.get("/{course_id}/certificate/eligibility/{student_id}")
async def check_eligibility(
    course_id: str,
    student_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await cert_service.check_certificate_eligibility(db, student_id, course_id)
    except Exception as e:
        raise HTTPException(500, str(e))
