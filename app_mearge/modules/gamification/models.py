from __future__ import annotations

from sqlalchemy import Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.shared.enums import AchievementRarity
from app.shared.mixins import TimestampMixin


class Achievement(TimestampMixin, Base):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    rarity: Mapped[AchievementRarity] = mapped_column(Enum(AchievementRarity), nullable=False)
    xp_reward: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    user_achievements: Mapped[list["UserAchievement"]] = relationship(
        back_populates="achievement",
        cascade="all, delete-orphan",
    )


class UserAchievement(TimestampMixin, Base):
    __tablename__ = "user_achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    achievement_id: Mapped[int] = mapped_column(ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False)

    user: Mapped["User"] = relationship(back_populates="achievements")
    achievement: Mapped[Achievement] = relationship(back_populates="user_achievements")

    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
    )

