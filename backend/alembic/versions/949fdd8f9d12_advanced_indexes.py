"""advanced_indexes

Revision ID: 949fdd8f9d12
Revises: 172d9b20bbc6
Create Date: 2026-06-17 00:15:59.723970
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers
revision: str = '949fdd8f9d12'
down_revision: Union[str, None] = '172d9b20bbc6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. GIN Indexes for JSONB columns
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_materials_transcript_gin
        ON learning_materials USING GIN (material_transcript);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_ml_questions_options_gin
        ON microlearning_questions USING GIN (options_json);
    """)

    # 2. Partial Indexes (exclude soft-deleted rows)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_users_active
        ON users (username, email) WHERE is_deleted = FALSE;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_courses_published
        ON general_courses (teacher_id, category_id, updated_at DESC)
        WHERE is_deleted = FALSE AND visibility_status = 'PUBLISHED';
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_dict_entries_active
        ON dictionary_entries (category_id, word) WHERE is_deleted = FALSE;
    """)

    # 3. Covering Indexes (INCLUDE — avoid heap lookup)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_enrollments_progress_covering
        ON course_enrollments (student_id, course_id) INCLUDE (progress);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_wallets_balance_covering
        ON wallets (user_id) INCLUDE (balance);
    """)

    # 4. BRIN Indexes for partitioned tables (time-series data)
    for tbl in ['transaction_logs', 'notification_users', 'audit_logs', 'log']:
        op.execute(f"""
            CREATE INDEX IF NOT EXISTS idx_{tbl}_created_brin
            ON {tbl} USING BRIN (created_at) WITH (pages_per_range = 32);
        """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_materials_transcript_gin")
    op.execute("DROP INDEX IF EXISTS idx_ml_questions_options_gin")
    op.execute("DROP INDEX IF EXISTS idx_users_active")
    op.execute("DROP INDEX IF EXISTS idx_courses_published")
    op.execute("DROP INDEX IF EXISTS idx_dict_entries_active")
    op.execute("DROP INDEX IF EXISTS idx_enrollments_progress_covering")
    op.execute("DROP INDEX IF EXISTS idx_wallets_balance_covering")
    for tbl in ['transaction_logs', 'notification_users', 'audit_logs', 'log']:
        op.execute(f"DROP INDEX IF EXISTS idx_{tbl}_created_brin")
