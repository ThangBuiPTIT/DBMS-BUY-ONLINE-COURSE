import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    PrimaryKeyConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


def utcnow():
    return datetime.now(timezone.utc)


class StudentStreak(Base):
    __tablename__ = "student_streaks"

    streak_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.user_id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    current_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    highest_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_activity_date: Mapped[datetime | None] = mapped_column(Date)

    __table_args__ = (
        CheckConstraint(
            "current_streak >= 0 AND highest_streak >= 0",
            name="ck_streak_non_negative",
        ),
        CheckConstraint(
            "highest_streak >= current_streak",
            name="ck_streak_highest_gte_current",
        ),
    )

    student = relationship("Student", back_populates="streak")


class Achievement(Base):
    __tablename__ = "achievements"

    achievement_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon_url: Mapped[str | None] = mapped_column(String(255))


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    achievement_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("achievements.achievement_id", ondelete="CASCADE"),
        nullable=False,
    )
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        PrimaryKeyConstraint("user_id", "achievement_id"),
    )


class UserFeedback(Base):
    __tablename__ = "user_feedbacks"

    feedback_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    rating: Mapped[int | None] = mapped_column(Integer)
    feedback_text: Mapped[str | None] = mapped_column(Text)
    context: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        CheckConstraint(
            "rating IS NULL OR (rating BETWEEN 1 AND 5)", name="ck_feedback_rating"
        ),
    )
