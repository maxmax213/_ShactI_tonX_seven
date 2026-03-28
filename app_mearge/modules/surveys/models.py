from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.shared.mixins import TimestampMixin


class LessonSurveyResponse(TimestampMixin, Base):
    __tablename__ = "lesson_survey_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    clarity_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    difficulty_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    interest_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    lesson: Mapped["Lesson"] = relationship()
    student: Mapped["User"] = relationship()

    __table_args__ = (
        UniqueConstraint("lesson_id", "student_id", name="uq_lesson_student_survey"),
    )
