from __future__ import annotations

from sqlalchemy import Enum, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.shared.enums import SubmissionStatus
from app.shared.mixins import TimestampMixin


class Submission(TimestampMixin, Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    solution_payload: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[SubmissionStatus] = mapped_column(Enum(SubmissionStatus), default=SubmissionStatus.PENDING)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    teacher_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    assignment: Mapped["Assignment"] = relationship(back_populates="submissions")
    student: Mapped["User"] = relationship(back_populates="submissions")

    __table_args__ = (
        UniqueConstraint("assignment_id", "student_id", "attempt", name="uq_assignment_student_attempt"),
    )

