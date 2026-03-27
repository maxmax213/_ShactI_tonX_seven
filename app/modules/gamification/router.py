from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.modules.gamification.models import Achievement
from app.modules.gamification.schemas import (
    AchievementCreate,
    AchievementRead,
    LeaderboardEntry,
    UserAchievementRead,
)
from app.modules.gamification.service import gamification_service
from app.modules.users.models import User
from app.shared.enums import UserRole

router = APIRouter()


@router.post("/achievements", response_model=AchievementRead)
def create_achievement(
    payload: AchievementCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.TEACHER)),
) -> Achievement:
    return gamification_service.create_achievement(db, payload)


@router.get("/achievements", response_model=list[AchievementRead])
def list_achievements(db: Session = Depends(get_db)) -> list[Achievement]:
    return gamification_service.list_achievements(db)


@router.get("/achievements/my", response_model=list[UserAchievementRead])
def my_achievements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserAchievementRead]:
    return gamification_service.list_user_achievements(db, current_user.id)


@router.post("/achievements/{achievement_id}/award/{student_id}")
def award_achievement(
    achievement_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.TEACHER)),
) -> dict[str, str]:
    gamification_service.award_achievement(db, achievement_id, student_id)
    return {"status": "awarded"}


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def get_leaderboard(limit: int = 50, db: Session = Depends(get_db)) -> list[LeaderboardEntry]:
    return gamification_service.leaderboard(db, limit)
