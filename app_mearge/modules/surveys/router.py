from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.surveys.models import LessonSurveyResponse
from app.modules.surveys.schemas import LessonSurveyRead, LessonSurveySubmit, LessonSurveySummary
from app.modules.surveys.service import survey_service
from app.modules.users.models import User
from app.shared.enums import UserRole

router = APIRouter()


@router.post("/lessons/{lesson_id}", response_model=LessonSurveyRead)
def submit_lesson_survey(
    lesson_id: int,
    payload: LessonSurveySubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT)),
) -> LessonSurveyResponse:
    return survey_service.submit_lesson_survey(db, lesson_id, current_user.id, payload)


@router.get("/my", response_model=list[LessonSurveyRead])
def my_surveys(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT)),
) -> list[LessonSurveyResponse]:
    return survey_service.list_my_surveys(db, current_user.id)


@router.get("/lessons/{lesson_id}/summary", response_model=LessonSurveySummary)
def lesson_survey_summary(
    lesson_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.TEACHER)),
) -> LessonSurveySummary:
    return survey_service.lesson_summary(db, lesson_id)
