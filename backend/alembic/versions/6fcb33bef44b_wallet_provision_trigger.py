"""wallet_provision_trigger

Revision ID: 6fcb33bef44b
Revises: 429743bc5cea
Create Date: 2026-06-16 23:50:15.464642
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '6fcb33bef44b'
down_revision: Union[str, None] = '429743bc5cea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_provision_wallet()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO wallets (user_id, balance) VALUES (NEW.user_id, 0.00);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("DROP TRIGGER IF EXISTS trg_provision_wallet ON users")
    op.execute("""
        CREATE TRIGGER trg_provision_wallet
        AFTER INSERT ON users
        FOR EACH ROW EXECUTE FUNCTION fn_provision_wallet();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_provision_wallet ON users")
    op.execute("DROP FUNCTION IF EXISTS fn_provision_wallet()")
