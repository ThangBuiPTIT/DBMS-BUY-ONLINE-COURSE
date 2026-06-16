"""leaderboard_materialized_view

Revision ID: ff27fabf57b0
Revises: 8c88ee18335c
Create Date: 2026-06-17 00:16:00.374035
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers
revision: str = 'ff27fabf57b0'
down_revision: Union[str, None] = '8c88ee18335c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard")
