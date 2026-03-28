from __future__ import annotations

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.shared.enums import AssignmentType
from app.shared.mixins import TimestampMixin


class Assignment(TimestampMixin, Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    assignment_type: Mapped[AssignmentType] = mapped_column(Enum(AssignmentType), nullable=False)
    max_score: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_auto_check: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    content_payload: Mapped[str | None] = mapped_column(Text, nullable=True)

    lesson: Mapped["Lesson"] = relationship(back_populates="assignments")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="assignment", cascade="all, delete-orphan")
    comments: Mapped[list["Comment"]] = relationship(back_populates="assignment", cascade="all, delete-orphan")

