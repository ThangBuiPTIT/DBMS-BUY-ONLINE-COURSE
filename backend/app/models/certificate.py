"""Certificate model — issued credentials for completed courses."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


def utcnow():
    return datetime.now(timezone.utc)


class Certificate(Base):
    __tablename__ = "certificates"

    certificate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("general_courses.course_id", ondelete="RESTRICT"),
        nullable=False,
    )
    enrollment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("course_enrollments.enrollment_id", ondelete="SET NULL"),
    )
    certificate_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ISSUED"
    )
    metadata_info: Mapped[dict | None] = mapped_column("metadata", JSONB)
    certificate_url: Mapped[str | None] = mapped_column(Text)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('ISSUED', 'REVOKED')", name="ck_certificate_status"
        ),
        UniqueConstraint("student_id", "course_id", name="uq_cert_student_course"),
    )
