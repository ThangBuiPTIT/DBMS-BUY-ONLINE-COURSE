"""fix_mv_leaderboard

Revision ID: 9c3d4e5f6a7b
Revises: 8b2c3d4e5f6a
Create Date: 2026-06-18 10:02:00.000000

Fix mv_leaderboard:
 - Add student_id column (required for unique index on CONCURRENTLY refresh)
 - Use RANK() instead of ROW_NUMBER() so ties share the same rank
 - Remove WHERE ss.current_streak > 0 so all students appear
 - Rank by highest_streak (matching blueprint spec)
 - Unique index on student_id (truly unique) instead of (full_name, current_streak)
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers
revision: str = '9c3d4e5f6a7b'
down_revision: Union[str, None] = '8b2c3d4e5f6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old materialized view (it has structural issues)
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard")

    # Recreate with corrected structure
    op.execute("""
        CREATE MATERIALIZED VIEW mv_leaderboard AS
        SELECT
            s.user_id AS student_id,
            p.full_name,
            COALESCE(p.avatar_url, '') AS avatar_url,
            ss.current_streak,
            ss.highest_streak,
            COUNT(ua.achievement_id) AS achievement_count,
            RANK() OVER (
                ORDER BY ss.highest_streak DESC, COUNT(ua.achievement_id) DESC
            ) AS rank
        FROM students s
        JOIN user_profiles p ON p.user_id = s.user_id
        LEFT JOIN student_streaks ss ON ss.student_id = s.user_id
        LEFT JOIN user_achievements ua ON ua.user_id = s.user_id
        GROUP BY s.user_id, p.full_name, p.avatar_url, ss.current_streak, ss.highest_streak
        WITH DATA;
    """)

    # REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY
    # student_id is naturally unique (one row per student)
    op.execute("""
        CREATE UNIQUE INDEX idx_mv_leaderboard_student
        ON mv_leaderboard (student_id);
    """)


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard")
    # Restore original version from ff27fabf57b0
    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_leaderboard AS
        SELECT
            ROW_NUMBER() OVER (
                ORDER BY ss.current_streak DESC, total_achievements DESC
            ) AS rank,
            up.full_name,
            up.avatar_url,
            ss.current_streak,
            ss.highest_streak,
            (
                SELECT COUNT(*)
                FROM user_achievements ua
                WHERE ua.user_id = s.user_id
            ) AS total_achievements
        FROM students s
        JOIN user_profiles up ON s.user_id = up.user_id
        JOIN student_streaks ss ON s.user_id = ss.student_id
        WHERE ss.current_streak > 0;
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_leaderboard_rank
        ON mv_leaderboard (full_name, current_streak);
    """)
