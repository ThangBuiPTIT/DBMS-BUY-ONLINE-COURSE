import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


def utcnow():
    return datetime.now(timezone.utc)


class GeneralCourseCategory(Base):
    __tablename__ = "general_course_categories"

    category_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    courses = relationship("GeneralCourse", back_populates="category")


class GeneralCourse(Base):
    __tablename__ = "general_courses"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teachers.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    category_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("general_course_categories.category_id", ondelete="RESTRICT"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(255))
    price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0.00)
    visibility_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="DRAFT"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        CheckConstraint(
            "visibility_status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')",
            name="ck_course_visibility",
        ),
    )

    category = relationship("GeneralCourseCategory", back_populates="courses")
    teacher = relationship("Teacher", backref="courses")
    modules = relationship(
        "GeneralCourseModule", back_populates="course", order_by="GeneralCourseModule.order_index"
    )
    enrollments = relationship("CourseEnrollment", back_populates="course")


class GeneralCourseModule(Base):
    __tablename__ = "general_course_modules"

    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("general_courses.course_id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(
        Integer, CheckConstraint("order_index > 0"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "course_id", "order_index", name="uq_module_order_per_course"
        ),
    )

    course = relationship("GeneralCourse", back_populates="modules")
    lessons = relationship(
        "GeneralCourseLesson", back_populates="module", order_by="GeneralCourseLesson.order_index"
    )


class GeneralCourseLesson(Base):
    __tablename__ = "general_course_lessons"

    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("general_course_modules.module_id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    video_url: Mapped[str | None] = mapped_column(String(255))
    order_index: Mapped[int] = mapped_column(
        Integer, CheckConstraint("order_index > 0"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "module_id", "order_index", name="uq_lesson_order_per_module"
        ),
    )

    module = relationship("GeneralCourseModule", back_populates="lessons")
    materials = relationship("LearningMaterial", back_populates="lesson")
    comments = relationship("Comment", back_populates="lesson")


class LearningMaterial(Base):
    __tablename__ = "learning_materials"

    material_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("general_course_lessons.lesson_id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content_url: Mapped[str] = mapped_column(String(255), nullable=False)
    material_transcript: Mapped[dict | None] = mapped_column(JSONB)

    lesson = relationship("GeneralCourseLesson", back_populates="materials")


class CourseEnrollment(Base):
    __tablename__ = "course_enrollments"

    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("general_courses.course_id", ondelete="CASCADE"),
        nullable=False,
    )
    progress: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=0.00
    )
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        UniqueConstraint(
            "student_id", "course_id", name="uq_student_course_enrollment"
        ),
        CheckConstraint(
            "progress >= 0 AND progress <= 100", name="ck_enrollment_progress"
        ),
    )

    course = relationship("GeneralCourse", back_populates="enrollments")


class Comment(Base):
    __tablename__ = "comments"

    comment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("general_course_lessons.lesson_id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    lesson = relationship("GeneralCourseLesson", back_populates="comments")
