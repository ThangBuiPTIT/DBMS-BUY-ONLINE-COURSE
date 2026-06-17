"""auto_updated_at_trigger

Revision ID: 429743bc5cea
Revises:
Create Date: 2026-06-16 23:50:04.713112
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '429743bc5cea'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_auto_update_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    for tbl in ['users', 'dictionary_entries', 'general_courses', 'wallets']:
        op.execute(f"DROP TRIGGER IF EXISTS trg_auto_updated_at ON {tbl}")
        op.execute(f"""
            CREATE TRIGGER trg_auto_updated_at
            BEFORE UPDATE ON {tbl}
            FOR EACH ROW EXECUTE FUNCTION fn_auto_update_timestamp();
        """)


def downgrade() -> None:
    for tbl in ['users', 'dictionary_entries', 'general_courses', 'wallets']:
        op.execute(f"DROP TRIGGER IF EXISTS trg_auto_updated_at ON {tbl}")
    op.execute("DROP FUNCTION IF EXISTS fn_auto_update_timestamp()")
