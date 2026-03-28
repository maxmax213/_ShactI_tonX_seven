from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.modules.users.models import User
from app.modules.users.schemas import (
    ParentLinkByCodeCreate,
    ParentLinkCreate,
    ParentLinkRead,
    UserCreate,
    UserRead,
    UserStatsRead,
)
from app.modules.users.service import user_service
from app.shared.enums import UserRole

router = APIRouter()


@router.get("/", response_model=list[UserRead])
def list_users(
    role: UserRole | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.TEACHER)),
) -> list[User]:
    return user_service.list_users(db, role)


@router.post("/", response_model=UserRead)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    return user_service.create_user(db, payload)


@router.post("/parent-links", response_model=ParentLinkRead)
def link_parent_to_student(
    payload: ParentLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PARENT)),
) -> ParentLinkRead:
    link = user_service.create_parent_link(db, current_user.id, payload)
    return ParentLinkRead.model_validate(link)


@router.post("/parent-links/by-code", response_model=ParentLinkRead)
def link_parent_to_student_by_code(
    payload: ParentLinkByCodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PARENT)),
) -> ParentLinkRead:
    link = user_service.create_parent_link_by_code(db, current_user.id, payload)
    return ParentLinkRead.model_validate(link)


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.get("/me/stats", response_model=UserStatsRead)
def get_my_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserStatsRead:
    return user_service.user_stats(db, current_user.id)
