"""v_student_dashboard

Revision ID: 8b2c3d4e5f6a
Revises: 7a1b2c3d4e5f
Create Date: 2026-06-18 10:01:00.000000
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers
revision: str = '8b2c3d4e5f6a'
down_revision: Union[str, None] = '7a1b2c3d4e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE VIEW v_student_dashboard AS
        SELECT
            s.user_id AS student_id,
            p.full_name,
            ss.current_streak,
            ss.highest_streak,
            COUNT(DISTINCT e.course_id) AS enrolled_courses,
            COUNT(DISTINCT ua.achievement_id) AS achievements,
            ROUND(AVG(e.progress), 2) AS avg_progress
        FROM students s
        JOIN user_profiles p ON p.user_id = s.user_id
        LEFT JOIN student_streaks ss ON ss.student_id = s.user_id
        LEFT JOIN course_enrollments e ON e.student_id = s.user_id
        LEFT JOIN user_achievements ua ON ua.user_id = s.user_id
        GROUP BY s.user_id, p.full_name, ss.current_streak, ss.highest_streak;
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_student_dashboard")
