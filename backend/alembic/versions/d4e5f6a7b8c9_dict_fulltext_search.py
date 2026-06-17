"""dict_fulltext_search

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-18 11:00:00.000000

Add Full-Text Search index on dictionary_entries using tsvector.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_dict_fts
        ON dictionary_entries
        USING GIN (to_tsvector('simple', COALESCE(word, '') || ' ' || COALESCE(meaning, '')))
        WHERE is_deleted = FALSE;
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_dict_fts")
