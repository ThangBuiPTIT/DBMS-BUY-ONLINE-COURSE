import uuid

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class MicrolearningTopic(Base):
    __tablename__ = "microlearning_topics"

    topic_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    units = relationship(
        "MicrolearningUnit", back_populates="topic", order_by="MicrolearningUnit.order_index"
    )


class MicrolearningUnit(Base):
    __tablename__ = "microlearning_units"

    unit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    topic_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("microlearning_topics.topic_id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(
        Integer, CheckConstraint("order_index > 0"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "topic_id", "order_index", name="uq_ml_unit_order_per_topic"
        ),
    )

    topic = relationship("MicrolearningTopic", back_populates="units")
    lessons = relationship(
        "MicrolearningLesson", back_populates="unit", order_by="MicrolearningLesson.order_index"
    )


class MicrolearningLesson(Base):
    __tablename__ = "microlearning_lessons"

    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    unit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("microlearning_units.unit_id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    video_url: Mapped[str | None] = mapped_column(String(255))
    order_index: Mapped[int] = mapped_column(
        Integer, CheckConstraint("order_index > 0"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "unit_id", "order_index", name="uq_ml_lesson_order_per_unit"
        ),
    )

    unit = relationship("MicrolearningUnit", back_populates="lessons")
    parts = relationship(
        "MicrolearningLessonPart", back_populates="lesson", order_by="MicrolearningLessonPart.order_index"
    )


class MicrolearningLessonPart(Base):
    __tablename__ = "microlearning_lesson_parts"

    part_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("microlearning_lessons.lesson_id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(String(255))
    part_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(
        Integer, CheckConstraint("order_index > 0"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "lesson_id", "order_index", name="uq_ml_part_order_per_lesson"
        ),
    )

    lesson = relationship("MicrolearningLesson", back_populates="parts")
    questions = relationship("MicrolearningQuestion", back_populates="part")


class MicrolearningQuestion(Base):
    __tablename__ = "microlearning_questions"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    part_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("microlearning_lesson_parts.part_id", ondelete="CASCADE"),
        nullable=False,
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(20), nullable=False)
    options_json: Mapped[list] = mapped_column(JSONB, nullable=False)
    correct_answer: Mapped[str] = mapped_column(String(255), nullable=False)

    part = relationship("MicrolearningLessonPart", back_populates="questions")
