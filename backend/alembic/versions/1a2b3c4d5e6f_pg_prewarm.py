"""pg_prewarm

Revision ID: 1a2b3c4d5e6f
Revises: f6a7b8c9d0e1
Create Date: 2026-06-18 12:00:00.000000

Enable pg_prewarm extension for buffer cache warming.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_prewarm")


def downgrade() -> None:
    pass
