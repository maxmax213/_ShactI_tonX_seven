from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.modules.gamification.models import Achievement, UserAchievement
from app.modules.gamification.schemas import AchievementCreate, LeaderboardEntry, UserAchievementRead
from app.modules.submissions.models import Submission
from app.modules.users.models import User
from app.shared.enums import SubmissionStatus, UserRole


class GamificationService:
    def _period_start(self, period: str) -> datetime | None:
        now = datetime.now(UTC)

        if period == "all_time":
            return None
        if period == "today":
            return now.replace(hour=0, minute=0, second=0, microsecond=0)
        if period == "week":
            start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            return start_of_today - timedelta(days=start_of_today.weekday())
        if period == "month":
            return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported leaderboard period")

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

    def leaderboard(
        self,
        db: Session,
        limit: int = 50,
        period: str = "all_time",
        include_user_id: int | None = None,
    ) -> list[LeaderboardEntry]:
        period_start = self._period_start(period)

        if period_start is None:
            achievement_count_subquery = (
                db.query(
                    UserAchievement.user_id.label("user_id"),
                    func.count(UserAchievement.id).label("achievement_count"),
                )
                .group_by(UserAchievement.user_id)
                .subquery()
            )

            rows = (
                db.query(
                    User.id,
                    User.full_name,
                    User.xp,
                    User.level,
                    User.streak,
                    func.coalesce(achievement_count_subquery.c.achievement_count, 0).label("achievement_count"),
                )
                .outerjoin(achievement_count_subquery, achievement_count_subquery.c.user_id == User.id)
                .filter(User.role == UserRole.STUDENT)
                .order_by(User.xp.desc(), User.streak.desc(), User.full_name.asc(), User.id.asc())
                .all()
            )
        else:
            submission_xp_subquery = (
                db.query(
                    Submission.student_id.label("user_id"),
                    func.sum(
                        case(
                            (Submission.score.is_(None), 0),
                            (Submission.score < 5, 5),
                            else_=Submission.score,
                        )
                    ).label("submission_xp"),
                )
                .filter(
                    Submission.status == SubmissionStatus.CHECKED,
                    Submission.updated_at >= period_start,
                )
                .group_by(Submission.student_id)
                .subquery()
            )

            achievement_period_subquery = (
                db.query(
                    UserAchievement.user_id.label("user_id"),
                    func.count(UserAchievement.id).label("achievement_count"),
                    func.sum(Achievement.xp_reward).label("achievement_xp"),
                )
                .join(Achievement, Achievement.id == UserAchievement.achievement_id)
                .filter(UserAchievement.created_at >= period_start)
                .group_by(UserAchievement.user_id)
                .subquery()
            )

            rows = (
                db.query(
                    User.id,
                    User.full_name,
                    (
                        func.coalesce(submission_xp_subquery.c.submission_xp, 0)
                        + func.coalesce(achievement_period_subquery.c.achievement_xp, 0)
                    ).label("xp"),
                    User.level,
                    User.streak,
                    func.coalesce(achievement_period_subquery.c.achievement_count, 0).label("achievement_count"),
                )
                .outerjoin(submission_xp_subquery, submission_xp_subquery.c.user_id == User.id)
                .outerjoin(achievement_period_subquery, achievement_period_subquery.c.user_id == User.id)
                .filter(User.role == UserRole.STUDENT)
                .order_by(
                    (
                        func.coalesce(submission_xp_subquery.c.submission_xp, 0)
                        + func.coalesce(achievement_period_subquery.c.achievement_xp, 0)
                    ).desc(),
                    User.streak.desc(),
                    User.full_name.asc(),
                    User.id.asc(),
                )
                .all()
            )

        ranked_entries = [
            LeaderboardEntry(
                user_id=row.id,
                full_name=row.full_name,
                xp=row.xp,
                level=row.level,
                achievement_count=row.achievement_count,
                streak=row.streak,
                rank=index,
            )
            for index, row in enumerate(rows, start=1)
        ]

        visible_entries = ranked_entries[:limit]
        if include_user_id is None or any(entry.user_id == include_user_id for entry in visible_entries):
            return visible_entries

        current_entry = next((entry for entry in ranked_entries if entry.user_id == include_user_id), None)
        if current_entry is not None:
            return [*visible_entries, current_entry]

        return visible_entries


gamification_service = GamificationService()
