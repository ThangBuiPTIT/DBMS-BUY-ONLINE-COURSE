import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


def utcnow():
    return datetime.now(timezone.utc)


class DictionaryCategory(Base):
    __tablename__ = "dictionary_categories"

    category_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    entries = relationship("DictionaryEntry", back_populates="category")


class DictionaryEntry(Base):
    __tablename__ = "dictionary_entries"

    entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    category_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("dictionary_categories.category_id", ondelete="RESTRICT"),
        nullable=False,
    )
    word: Mapped[str] = mapped_column(String(100), nullable=False)
    meaning: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        UniqueConstraint(
            "category_id", "word", name="uq_dict_entry_per_category"
        ),
    )

    category = relationship("DictionaryCategory", back_populates="entries")
    variations = relationship(
        "DictionaryVariation", back_populates="entry", order_by="DictionaryVariation.region"
    )


class DictionaryVariation(Base):
    __tablename__ = "dictionary_variations"

    variation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dictionary_entries.entry_id", ondelete="CASCADE"),
        nullable=False,
    )
    region: Mapped[str | None] = mapped_column(String(100))
    video_url: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint(
            "entry_id", "video_url", name="uq_dict_variation_video"
        ),
    )

    entry = relationship("DictionaryEntry", back_populates="variations")
