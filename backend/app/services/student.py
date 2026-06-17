from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def search_students(db: AsyncSession, keyword: str) -> list[dict]:
    """Search students using fn_search_students function."""
    result = await db.execute(
        text("SELECT student_id::text, username, full_name, grade_level, school_name, created_at FROM fn_search_students(:kw)"),
        {"kw": keyword},
    )
    return [dict(row) for row in result.mappings()]


async def get_progress_report(db: AsyncSession) -> list[dict]:
    """Get student progress report from view."""
    result = await db.execute(
        text("SELECT student_name, email, school_name, course_title, progress, enrolled_at, learning_status FROM vw_student_progress_report")
    )
    return [dict(row) for row in result.mappings()]


async def get_inactive_students(db: AsyncSession) -> list[dict]:
    """Get inactive students from view."""
    result = await db.execute(
        text("SELECT enrollment_id::text, student_id::text, full_name, phone_number, course_title, last_activity_date FROM vw_inactive_students")
    )
    return [dict(row) for row in result.mappings()]


async def get_student_dashboard(db: AsyncSession, student_id: str) -> dict | None:
    """Get student dashboard summary from v_student_dashboard view."""
    result = await db.execute(
        text("""
            SELECT student_id::text, full_name, current_streak, highest_streak,
                   enrolled_courses, achievements, avg_progress
            FROM v_student_dashboard
            WHERE student_id = :uid
        """),
        {"uid": student_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None
