from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def check_certificate_eligibility(db: AsyncSession, student_id: str, course_id: str) -> dict:
    """Kiểm tra student có đủ điều kiện nhận chứng chỉ không.
    Gọi fn_check_certificate_eligibility() — trả về TRUE nếu progress = 100."""

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

    return {
        "student_id": student_id,
        "course_id": course_id,
        "eligible": eligible,
        "current_progress": current_progress,
        "remaining": round(100.0 - current_progress, 2),
    }
