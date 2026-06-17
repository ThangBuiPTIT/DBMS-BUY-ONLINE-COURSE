"""audit_wallet_trigger

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-18 10:31:00.000000

Add trg_audit_wallet: auto-logs every wallet balance change to the log table.
Ensures immutable audit trail for all financial mutations.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_audit_wallet_change()
        RETURNS TRIGGER AS $$
        BEGIN
            IF OLD.balance IS DISTINCT FROM NEW.balance THEN
                INSERT INTO log (action)
                VALUES (
                    format(
                        'WALLET %s: %s -> %s (delta: %s)',
                        NEW.user_id, OLD.balance, NEW.balance,
                        NEW.balance - OLD.balance
                    )
                );
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("DROP TRIGGER IF EXISTS trg_audit_wallet ON wallets")
    op.execute("""
        CREATE TRIGGER trg_audit_wallet
        AFTER UPDATE OF balance ON wallets
        FOR EACH ROW
        WHEN (OLD.balance IS DISTINCT FROM NEW.balance)
        EXECUTE FUNCTION fn_audit_wallet_change()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_audit_wallet ON wallets")
    op.execute("DROP FUNCTION IF EXISTS fn_audit_wallet_change()")
