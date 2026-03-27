from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.submissions.models import Submission
from app.modules.submissions.schemas import SubmissionCreate, SubmissionGrade, SubmissionRead
from app.modules.submissions.service import submissions_service
from app.modules.users.models import User
from app.shared.enums import UserRole

router = APIRouter()


@router.post("/assignments/{assignment_id}", response_model=SubmissionRead)
def submit_assignment(
    assignment_id: int,
    payload: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT)),
) -> Submission:
    return submissions_service.submit(db, assignment_id, current_user.id, payload)


@router.get("/assignments/{assignment_id}", response_model=list[SubmissionRead])
def assignment_submissions(
    assignment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.TEACHER)),
) -> list[Submission]:
    return submissions_service.list_assignment_submissions(db, assignment_id)


@router.post("/{submission_id}/grade", response_model=SubmissionRead)
def grade_submission(
    submission_id: int,
    payload: SubmissionGrade,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.TEACHER)),
) -> Submission:
    return submissions_service.grade(db, submission_id, payload)


@router.get("/my", response_model=list[SubmissionRead])
def my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT)),
) -> list[Submission]:
    return submissions_service.list_student_submissions(db, current_user.id)
