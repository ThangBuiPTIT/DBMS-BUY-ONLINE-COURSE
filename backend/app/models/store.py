import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    PrimaryKeyConstraint,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


def utcnow():
    return datetime.now(timezone.utc)


class Wallet(Base):
    __tablename__ = "wallets"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        primary_key=True,
    )
    balance: Mapped[float] = mapped_column(
        Numeric(14, 2), nullable=False, default=0.00
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        CheckConstraint("balance >= 0", name="ck_wallets_balance_non_negative"),
    )

    user = relationship("User", back_populates="wallet")


class TransactionLog(Base):
    """Partitioned table — raw SQL only for queries."""
    __tablename__ = "transaction_logs"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), default=uuid.uuid4
    )
    from_wallet_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("wallets.user_id", ondelete="RESTRICT"),
    )
    to_wallet_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("wallets.user_id", ondelete="RESTRICT"),
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    related_course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("general_courses.course_id", ondelete="SET NULL"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        PrimaryKeyConstraint("transaction_id", "created_at"),
        CheckConstraint("amount > 0", name="ck_transaction_logs_amount"),
        CheckConstraint(
            "status IN ('SUCCESS', 'FAILED', 'ROLLED_BACK')",
            name="ck_transaction_logs_status",
        ),
    )


class TransactionActionLog(Base):
    """Partitioned table — raw SQL only for queries."""
    __tablename__ = "transaction_action_logs"

    action_log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), default=uuid.uuid4
    )
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    action_type: Mapped[str] = mapped_column(String(40), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        PrimaryKeyConstraint("action_log_id", "created_at"),
    )
