"""missing_fk_indexes

Revision ID: 2b3c4d5e6f7a
Revises: 1a2b3c4d5e6f
Create Date: 2026-06-18 14:00:00.000000

Add indexes on FK columns that PostgreSQL does NOT auto-index.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '2b3c4d5e6f7a'
down_revision: Union[str, None] = '1a2b3c4d5e6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Comments access patterns
    op.execute("CREATE INDEX IF NOT EXISTS idx_comments_lesson ON comments (lesson_id, created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_comments_user ON comments (user_id, created_at DESC)")

    # Feedback access patterns
    op.execute("CREATE INDEX IF NOT EXISTS idx_feedbacks_user ON user_feedbacks (user_id, created_at DESC)")

    # Enrollment lookups
    op.execute("CREATE INDEX IF NOT EXISTS idx_enrollments_course ON course_enrollments (course_id)")

    # Notification polling (partial: only unread)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
        ON notification_users (user_id, created_at DESC) WHERE is_read = FALSE
    """)

    # Session cleanup
    op.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expires ON authentication_sessions (expires_at)")

    # Transaction lookups
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_tx_logs_from_user
        ON transaction_logs (from_wallet_user_id, status, created_at DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_tx_logs_to_user
        ON transaction_logs (to_wallet_user_id, status, created_at DESC)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_comments_lesson")
    op.execute("DROP INDEX IF EXISTS idx_comments_user")
    op.execute("DROP INDEX IF EXISTS idx_feedbacks_user")
    op.execute("DROP INDEX IF EXISTS idx_enrollments_course")
    op.execute("DROP INDEX IF EXISTS idx_notifications_user_unread")
    op.execute("DROP INDEX IF EXISTS idx_sessions_expires")
    op.execute("DROP INDEX IF EXISTS idx_tx_logs_from_user")
    op.execute("DROP INDEX IF EXISTS idx_tx_logs_to_user")
