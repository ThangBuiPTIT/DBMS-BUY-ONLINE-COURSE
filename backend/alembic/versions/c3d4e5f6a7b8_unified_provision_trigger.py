"""unified_provision_trigger

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-18 10:32:00.000000

Consolidate trg_provision_wallet + trg_create_student_streak into
a single trg_provision_user trigger.

On INSERT into users:
  1. Auto-creates wallet (all users)
  2. Auto-creates student_streaks record (STUDENT role only)

Keeps trg_create_student_streak on students table as defense-in-depth.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove old wallet-only trigger
    op.execute("DROP TRIGGER IF EXISTS trg_provision_wallet ON users")
    op.execute("DROP FUNCTION IF EXISTS fn_provision_wallet()")

    # Create unified provision function
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_provision_new_user()
        RETURNS TRIGGER AS $$
        DECLARE
            v_role_name VARCHAR;
        BEGIN
            INSERT INTO wallets (user_id, balance)
            VALUES (NEW.user_id, 0.00)
            ON CONFLICT (user_id) DO NOTHING;

            SELECT r.role_name INTO v_role_name
            FROM roles r WHERE r.role_id = NEW.role_id;

            IF v_role_name = 'STUDENT' THEN
                INSERT INTO student_streaks (student_id, current_streak, highest_streak)
                VALUES (NEW.user_id, 0, 0)
                ON CONFLICT (student_id) DO NOTHING;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("DROP TRIGGER IF EXISTS trg_provision_user ON users")
    op.execute("""
        CREATE TRIGGER trg_provision_user
        AFTER INSERT ON users
        FOR EACH ROW EXECUTE FUNCTION fn_provision_new_user()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_provision_user ON users")
    op.execute("DROP FUNCTION IF EXISTS fn_provision_new_user()")

    # Restore original wallet-only trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_provision_wallet()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO wallets (user_id, balance) VALUES (NEW.user_id, 0.00);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_provision_wallet
        AFTER INSERT ON users
        FOR EACH ROW EXECUTE FUNCTION fn_provision_wallet()
    """)
