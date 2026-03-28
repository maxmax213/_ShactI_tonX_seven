from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.parental.schemas import ChildDetail, ChildProgress
from app.modules.parental.service import parental_service
from app.modules.users.models import User
from app.shared.enums import UserRole

router = APIRouter()


@router.get("/children", response_model=list[ChildProgress])
def children_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PARENT)),
) -> list[ChildProgress]:
    return parental_service.get_children_progress(db, current_user.id)


@router.get("/children/{student_id}", response_model=ChildDetail)
def child_detail(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PARENT)),
) -> ChildDetail:
    return parental_service.get_child_detail(db, current_user.id, student_id)

