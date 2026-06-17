"""create_certificates_table

Revision ID: 3c4d5e6f7a8b
Revises: 2b3c4d5e6f7a
Create Date: 2026-06-18 15:00:00.000000

Create certificates table for credential issuance and verification.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = '3c4d5e6f7a8b'
down_revision: Union[str, None] = '2b3c4d5e6f7a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'certificates',
        sa.Column('certificate_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('student_id', UUID(as_uuid=True), sa.ForeignKey('users.user_id', ondelete='RESTRICT'), nullable=False),
        sa.Column('course_id', UUID(as_uuid=True), sa.ForeignKey('general_courses.course_id', ondelete='RESTRICT'), nullable=False),
        sa.Column('enrollment_id', UUID(as_uuid=True), sa.ForeignKey('course_enrollments.enrollment_id', ondelete='SET NULL'), nullable=True),
        sa.Column('certificate_hash', sa.String(64), unique=True, nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='ISSUED'),
        sa.Column('metadata', sa.dialects.postgresql.JSONB, nullable=True),
        sa.Column('certificate_url', sa.Text, nullable=True),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_reason', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.CheckConstraint("status IN ('ISSUED', 'REVOKED')", name='ck_certificate_status'),
        sa.UniqueConstraint('student_id', 'course_id', name='uq_cert_student_course'),
    )
    op.create_index('idx_certificates_hash', 'certificates', ['certificate_hash'])
    op.create_index('idx_certificates_student', 'certificates', ['student_id'])


def downgrade() -> None:
    op.drop_table('certificates')
