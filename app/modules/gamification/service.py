from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.gamification.models import Achievement, UserAchievement
from app.modules.gamification.schemas import AchievementCreate, LeaderboardEntry, UserAchievementRead
from app.modules.users.models import User
from app.shared.enums import UserRole


class GamificationService:
    def create_achievement(self, db: Session, payload: AchievementCreate) -> Achievement:
        existing = db.query(Achievement).filter(Achievement.slug == payload.slug).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already exists")

        achievement = Achievement(**payload.model_dump())
        db.add(achievement)
        db.commit()
        db.refresh(achievement)
        return achievement

    def list_achievements(self, db: Session) -> list[Achievement]:
        return db.query(Achievement).order_by(Achievement.id.asc()).all()

    def award_achievement(self, db: Session, achievement_id: int, user_id: int) -> UserAchievement:
        achievement = db.get(Achievement, achievement_id)
        if achievement is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Achievement not found")

        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        existing = (
            db.query(UserAchievement)
            .filter(
                UserAchievement.user_id == user_id,
                UserAchievement.achievement_id == achievement_id,
            )
            .first()
        )
        if existing:
            return existing

        user_achievement = UserAchievement(user_id=user_id, achievement_id=achievement_id)
        user.xp += achievement.xp_reward
        user.level = max(1, user.xp // 100 + 1)

        db.add(user_achievement)
        db.commit()
        db.refresh(user_achievement)
        return user_achievement

    def list_user_achievements(self, db: Session, user_id: int) -> list[UserAchievementRead]:
        rows = (
            db.query(UserAchievement, Achievement)
            .join(Achievement, Achievement.id == UserAchievement.achievement_id)
            .filter(UserAchievement.user_id == user_id)
            .all()
        )

        return [
            UserAchievementRead(
                achievement_id=achievement.id,
                slug=achievement.slug,
                title=achievement.title,
                rarity=achievement.rarity,
                xp_reward=achievement.xp_reward,
            )
            for _, achievement in rows
        ]

    def leaderboard(self, db: Session, limit: int = 50) -> list[LeaderboardEntry]:
        users = (
            db.query(User)
            .filter(User.role == UserRole.STUDENT)
            .order_by(User.xp.desc(), User.id.asc())
            .limit(limit)
            .all()
        )
        return [
            LeaderboardEntry(
                user_id=user.id,
                full_name=user.full_name,
                xp=user.xp,
                level=user.level,
                streak=user.streak,
                rank=index,
            )
            for index, user in enumerate(users, start=1)
        ]


gamification_service = GamificationService()
