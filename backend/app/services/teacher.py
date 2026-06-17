from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_teacher_dashboard(db: AsyncSession, teacher_id: str) -> dict | None:
    """Get teacher dashboard stats from vw_teacher_dashboard."""
    result = await db.execute(
        text("""
            SELECT teacher_id::text, teacher_name, total_courses, total_students, total_generated_revenue
            FROM vw_teacher_dashboard
            WHERE teacher_id = :teacher_id
        """),
        {"teacher_id": teacher_id},
    )
    row = result.mappings().first()
    if row is None:
        return {
            "teacher_id": teacher_id,
            "teacher_name": "",
            "total_courses": 0,
            "total_students": 0,
            "total_generated_revenue": 0.0,
        }
    return dict(row)


async def get_teacher_courses(db: AsyncSession, teacher_id: str) -> list[dict]:
    """Get course analytics for a teacher."""
    result = await db.execute(
        text("""
            SELECT va.course_id::text, va.course_title, va.teacher_name,
                   va.total_students, va.avg_progress, va.avg_rating
            FROM vw_course_analytics va
            JOIN general_courses c ON va.course_id = c.course_id
            WHERE c.teacher_id = :teacher_id
            ORDER BY va.total_students DESC
        """),
        {"teacher_id": teacher_id},
    )
    return [dict(row) for row in result.mappings()]


async def get_teacher_feedback(db: AsyncSession, teacher_id: str) -> list[dict]:
    """Get feedback summary for a teacher's courses."""
    result = await db.execute(
        text("""
            SELECT f.course_or_context, f.total_feedbacks, f.average_rating,
                   f.five_stars, f.one_star
            FROM vw_course_feedback_summary f
            JOIN general_courses c ON f.course_or_context LIKE '%' || c.title || '%'
            WHERE c.teacher_id = :teacher_id
            ORDER BY f.average_rating DESC
        """),
        {"teacher_id": teacher_id},
    )
    return [dict(row) for row in result.mappings()]
