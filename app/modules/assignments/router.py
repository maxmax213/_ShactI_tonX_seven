from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.assignments.models import Assignment
from app.modules.assignments.schemas import AssignmentCreate, AssignmentRead
from app.modules.assignments.service import assignments_service
from app.modules.users.models import User
from app.shared.enums import UserRole

router = APIRouter()


@router.post("/", response_model=AssignmentRead)
def create_assignment(
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.TEACHER)),
) -> Assignment:
    return assignments_service.create_assignment(db, payload)


@router.get("/{assignment_id}", response_model=AssignmentRead)
def get_assignment(assignment_id: int, db: Session = Depends(get_db)) -> Assignment:
    return assignments_service.get_assignment(db, assignment_id)


@router.get("/lesson/{lesson_id}", response_model=list[AssignmentRead])
def list_assignments(lesson_id: int, db: Session = Depends(get_db)) -> list[Assignment]:
    return assignments_service.list_by_lesson(db, lesson_id)
