from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_leaderboard(db: AsyncSession, limit: int = 20) -> list[dict]:
    """Get top learners leaderboard."""
    result = await db.execute(
        text("""
            SELECT
                full_name,
                COALESCE(avatar_url, '') AS avatar_url,
                current_streak,
                highest_streak,
                total_achievements
            FROM vw_top_learners_leaderboard
            LIMIT :limit
        """),
        {"limit": limit},
    )
    entries = []
    for rank, row in enumerate(result.mappings(), start=1):
        entry = dict(row)
        entry["rank"] = rank
        entries.append(entry)
    return entries


async def get_student_streak(db: AsyncSession, student_id: str) -> dict:
    """Get student streak info."""
    result = await db.execute(
        text("""
            SELECT student_id::text, current_streak, highest_streak,
                   last_activity_date::text
            FROM student_streaks
            WHERE student_id = :sid
        """),
        {"sid": student_id},
    )
    row = result.mappings().first()
    if row is None:
        return {
            "student_id": student_id,
            "current_streak": 0,
            "highest_streak": 0,
            "last_activity_date": None,
        }
    return dict(row)
