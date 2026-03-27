from __future__ import annotations

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.shared.enums import UserRole
from app.shared.mixins import TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    xp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Used by parent accounts to connect with a child profile.
    parent_link_code: Mapped[str | None] = mapped_column(String(10), unique=True, nullable=True, index=True)

    taught_courses: Mapped[list["Course"]] = relationship(back_populates="teacher")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="student")
    comments: Mapped[list["Comment"]] = relationship(back_populates="author")
    achievements: Mapped[list["UserAchievement"]] = relationship(back_populates="user")


class ParentStudentLink(TimestampMixin, Base):
    __tablename__ = "parent_student_links"

    parent_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    link_code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)

    parent: Mapped[User] = relationship(foreign_keys=[parent_id])
    student: Mapped[User] = relationship(foreign_keys=[student_id])
