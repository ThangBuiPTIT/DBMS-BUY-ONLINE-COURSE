"""fix_covering_index

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-18 11:01:00.000000

Replace covering index to match blueprint spec:
  (student_id) INCLUDE (course_id, progress, enrolled_at)
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_enrollments_progress_covering")
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_enrollments_student_cover
        ON course_enrollments (student_id)
        INCLUDE (course_id, progress, enrolled_at);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_enrollments_student_cover")
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_enrollments_progress_covering
        ON course_enrollments (student_id, course_id) INCLUDE (progress);
    """)
