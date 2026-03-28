from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.shared.mixins import TimestampMixin


class Course(TimestampMixin, Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    enroll_code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    teacher: Mapped["User"] = relationship(back_populates="taught_courses")
    modules: Mapped[list["CourseModule"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    enrollments: Mapped[list["CourseEnrollment"]] = relationship(back_populates="course", cascade="all, delete-orphan")


class CourseModule(TimestampMixin, Base):
    __tablename__ = "course_modules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)

    course: Mapped[Course] = relationship(back_populates="modules")
    lessons: Mapped[list["Lesson"]] = relationship(back_populates="module", cascade="all, delete-orphan")


class Lesson(TimestampMixin, Base):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("course_modules.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    theory_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)

    module: Mapped[CourseModule] = relationship(back_populates="lessons")
    assignments: Mapped[list["Assignment"]] = relationship(back_populates="lesson", cascade="all, delete-orphan")


class CourseEnrollment(TimestampMixin, Base):
    __tablename__ = "course_enrollments"

    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    course: Mapped[Course] = relationship(back_populates="enrollments")
    student: Mapped["User"] = relationship()

