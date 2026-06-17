"""v_published_courses

Revision ID: 7a1b2c3d4e5f
Revises: ff27fabf57b0
Create Date: 2026-06-18 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers
revision: str = '7a1b2c3d4e5f'
down_revision: Union[str, None] = 'ff27fabf57b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE VIEW v_published_courses AS
        SELECT
            c.course_id,
            c.title,
            COALESCE(c.description, '') AS description,
            COALESCE(c.image_url, '') AS image_url,
            c.price,
            cat.name AS category_name,
            tp.full_name AS teacher_name,
            COUNT(e.enrollment_id) AS enrollment_count,
            c.updated_at
        FROM general_courses c
        JOIN general_course_categories cat ON cat.category_id = c.category_id
        JOIN teachers t ON t.user_id = c.teacher_id
        JOIN user_profiles tp ON tp.user_id = t.user_id
        LEFT JOIN course_enrollments e ON e.course_id = c.course_id
        WHERE c.visibility_status = 'PUBLISHED'
          AND c.is_deleted = FALSE
        GROUP BY c.course_id, cat.name, tp.full_name;
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_published_courses")
