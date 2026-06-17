"""streak_provision_trigger

Revision ID: 172d9b20bbc6
Revises: 6fcb33bef44b
Create Date: 2026-06-16 23:50:26.476828
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '172d9b20bbc6'
down_revision: Union[str, None] = '6fcb33bef44b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_create_student_streak()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO student_streaks (student_id, current_streak, highest_streak)
            VALUES (NEW.user_id, 0, 0)
            ON CONFLICT (student_id) DO NOTHING;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("DROP TRIGGER IF EXISTS trg_create_student_streak ON students")
    op.execute("""
        CREATE TRIGGER trg_create_student_streak
        AFTER INSERT ON students
        FOR EACH ROW EXECUTE FUNCTION fn_create_student_streak();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_create_student_streak ON students")
    op.execute("DROP FUNCTION IF EXISTS fn_create_student_streak()")
