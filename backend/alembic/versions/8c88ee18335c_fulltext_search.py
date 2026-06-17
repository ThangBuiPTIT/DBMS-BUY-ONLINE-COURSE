"""fulltext_search

Revision ID: 8c88ee18335c
Revises: 949fdd8f9d12
Create Date: 2026-06-17 00:16:00.060684
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers
revision: str = '8c88ee18335c'
down_revision: Union[str, None] = '949fdd8f9d12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # Dictionary entries — word & meaning search
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_dict_word_trgm
        ON dictionary_entries USING GIN (word gin_trgm_ops)
        WHERE is_deleted = FALSE;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_dict_meaning_trgm
        ON dictionary_entries USING GIN (meaning gin_trgm_ops)
        WHERE is_deleted = FALSE;
    """)

    # Users — username search
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_users_username_trgm
        ON users USING GIN (username gin_trgm_ops)
        WHERE is_deleted = FALSE;
    """)

    # User profiles — full_name search
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_profiles_fullname_trgm
        ON user_profiles USING GIN (full_name gin_trgm_ops);
    """)

    # Courses — title & description search
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_courses_title_trgm
        ON general_courses USING GIN (title gin_trgm_ops)
        WHERE is_deleted = FALSE;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_courses_desc_trgm
        ON general_courses USING GIN (description gin_trgm_ops)
        WHERE is_deleted = FALSE;
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_dict_word_trgm")
    op.execute("DROP INDEX IF EXISTS idx_dict_meaning_trgm")
    op.execute("DROP INDEX IF EXISTS idx_users_username_trgm")
    op.execute("DROP INDEX IF EXISTS idx_profiles_fullname_trgm")
    op.execute("DROP INDEX IF EXISTS idx_courses_title_trgm")
    op.execute("DROP INDEX IF EXISTS idx_courses_desc_trgm")
