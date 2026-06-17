"""Certificate issuance, verification, and revocation."""
import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings


def _generate_certificate_hash(student_id: str, course_id: str, issued_at: datetime) -> str:
    """SHA-256 hash for public verification. Includes secret key to prevent forgery."""
    payload = f"{student_id}:{course_id}:{issued_at.isoformat()}:{settings.SECRET_KEY}"
    return hashlib.sha256(payload.encode()).hexdigest()


async def check_certificate_eligibility(db: AsyncSession, student_id: str, course_id: str) -> dict:
    """Check if student is eligible for a certificate (progress = 100)."""
    prog_result = await db.execute(
        text("SELECT progress FROM course_enrollments WHERE student_id = :sid AND course_id = :cid"),
        {"sid": student_id, "cid": course_id},
    )
    progress_row = prog_result.mappings().first()
    current_progress = float(progress_row["progress"]) if progress_row else 0.0

    result = await db.execute(
        text("SELECT fn_check_certificate_eligibility(:sid, :cid)"),
        {"sid": student_id, "cid": course_id},
    )
    eligible = result.scalar()

    # Check if already issued
    cert_result = await db.execute(
        text("SELECT certificate_id::text, certificate_hash, status FROM certificates WHERE student_id = :sid AND course_id = :cid"),
        {"sid": student_id, "cid": course_id},
    )
    existing = cert_result.mappings().first()

    return {
        "student_id": student_id,
        "course_id": course_id,
        "eligible": eligible,
        "current_progress": current_progress,
        "remaining": round(100.0 - current_progress, 2),
        "already_issued": dict(existing) if existing else None,
    }


async def issue_certificate(db: AsyncSession, student_id: str, course_id: str) -> dict:
    """Issue a certificate after verifying eligibility."""
    # 1. Verify eligibility
    eligible = await db.execute(
        text("SELECT fn_check_certificate_eligibility(:sid, :cid)"),
        {"sid": student_id, "cid": course_id},
    )
    if not eligible.scalar():
        raise ValueError("Bạn chưa hoàn thành khóa học này (progress < 100%)")

    # 2. Check if already issued
    existing = await db.execute(
        text("SELECT certificate_id::text, certificate_hash, status FROM certificates WHERE student_id = :sid AND course_id = :cid AND status = 'ISSUED'"),
        {"sid": student_id, "cid": course_id},
    )
    existing_row = existing.mappings().first()
    if existing_row:
        return {
            **dict(existing_row),
            "verification_url": f"/api/certificates/verify/{existing_row['certificate_hash']}",
            "message": "Chứng chỉ đã được cấp trước đó",
        }

    # 3. Get enrollment_id
    enrollment = await db.execute(
        text("SELECT enrollment_id FROM course_enrollments WHERE student_id = :sid AND course_id = :cid"),
        {"sid": student_id, "cid": course_id},
    )
    enrollment_id = enrollment.scalar()

    # 4. Generate hash and issue
    issued_at = datetime.now(timezone.utc)
    cert_hash = _generate_certificate_hash(student_id, course_id, issued_at)

    result = await db.execute(
        text("""
            INSERT INTO certificates (student_id, course_id, enrollment_id, certificate_hash, metadata)
            VALUES (:sid, :cid, :eid, :hash, :meta::jsonb)
            RETURNING certificate_id::text, certificate_hash, issued_at
        """),
        {
            "sid": student_id, "cid": course_id, "eid": enrollment_id,
            "hash": cert_hash,
            "meta": json.dumps({"generated_by": "api", "version": "1.0"}),
        },
    )
    cert = dict(result.mappings().first())
    await db.commit()

    cert["verification_url"] = f"/api/certificates/verify/{cert_hash}"
    cert["message"] = "Chứng chỉ đã được cấp thành công"
    return cert


async def verify_certificate(db: AsyncSession, certificate_hash: str) -> dict | None:
    """Public verification: look up certificate by hash."""
    result = await db.execute(
        text("""
            SELECT c.certificate_id::text, c.certificate_hash, c.status,
                   c.issued_at, c.revoked_at, c.revoked_reason,
                   up.full_name AS student_name,
                   gc.title AS course_title
            FROM certificates c
            JOIN user_profiles up ON c.student_id = up.user_id
            JOIN general_courses gc ON c.course_id = gc.course_id
            WHERE c.certificate_hash = :hash
        """),
        {"hash": certificate_hash},
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def revoke_certificate(db: AsyncSession, certificate_id: str, reason: str) -> dict:
    """Admin revokes a certificate."""
    await db.execute(
        text("UPDATE certificates SET status = 'REVOKED', revoked_at = NOW(), revoked_reason = :reason WHERE certificate_id = :cid AND status = 'ISSUED'"),
        {"reason": reason, "cid": certificate_id},
    )
    await db.commit()
    return {"certificate_id": certificate_id, "status": "REVOKED", "reason": reason}
