"""streak_sync_trigger

Revision ID: a1b2c3d4e5f6
Revises: 9c3d4e5f6a7b
Create Date: 2026-06-18 10:30:00.000000

Add trg_streak_sync: DB-level trigger that auto-raises highest_streak
when current_streak exceeds it, and auto-sets last_activity_date.
This replaces the manual logic in gamification.py sync_student_streak().
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '9c3d4e5f6a7b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_sync_highest_streak()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.current_streak > NEW.highest_streak THEN
                NEW.highest_streak := NEW.current_streak;
            END IF;
            IF TG_OP = 'UPDATE' AND NEW.current_streak IS DISTINCT FROM OLD.current_streak THEN
                NEW.last_activity_date := CURRENT_DATE;
            ELSIF TG_OP = 'INSERT' THEN
                NEW.last_activity_date := COALESCE(NEW.last_activity_date, CURRENT_DATE);
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("DROP TRIGGER IF EXISTS trg_streak_sync ON student_streaks")
    op.execute("""
        CREATE TRIGGER trg_streak_sync
        BEFORE INSERT OR UPDATE OF current_streak ON student_streaks
        FOR EACH ROW EXECUTE FUNCTION fn_sync_highest_streak()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_streak_sync ON student_streaks")
    op.execute("DROP FUNCTION IF EXISTS fn_sync_highest_streak()")
