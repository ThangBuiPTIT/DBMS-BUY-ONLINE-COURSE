"""Certificate issuance, verification, and revocation endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_user, get_db
from app.models.user import User
from app.services import certificate as cert_service

router = APIRouter(tags=["Certificate"])


@router.get("/api/courses/{course_id}/certificate/eligibility/{student_id}")
async def check_eligibility(course_id: str, student_id: str, db: AsyncSession = Depends(get_db)):
    """Check if student is eligible for a certificate."""
    try:
        return await cert_service.check_certificate_eligibility(db, student_id, course_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/api/courses/{course_id}/certificate/issue", status_code=201)
async def issue_certificate(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Issue a certificate after course completion (progress = 100%)."""
    try:
        return await cert_service.issue_certificate(db, str(current_user.user_id), course_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/api/certificates/verify/{certificate_hash}")
async def verify_certificate(certificate_hash: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint: verify a certificate by its hash. No auth required."""
    result = await cert_service.verify_certificate(db, certificate_hash)
    if result is None:
        raise HTTPException(404, "Chứng chỉ không tồn tại")
    return result


@router.post("/api/admin/certificates/{certificate_id}/revoke")
async def revoke_certificate(
    certificate_id: str,
    reason: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin: revoke a certificate."""
    try:
        return await cert_service.revoke_certificate(db, certificate_id, reason or "Revoked by admin")
    except Exception as e:
        raise HTTPException(500, str(e))
