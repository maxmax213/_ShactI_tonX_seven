from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.courses.models import Lesson
from app.modules.surveys.models import LessonSurveyResponse
from app.modules.surveys.schemas import LessonSurveySubmit, LessonSurveySummary


class SurveyService:
    def submit_lesson_survey(
        self,
        db: Session,
        lesson_id: int,
        student_id: int,
        payload: LessonSurveySubmit,
    ) -> LessonSurveyResponse:
        lesson = db.get(Lesson, lesson_id)
        if lesson is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

        survey = (
            db.query(LessonSurveyResponse)
            .filter(
                LessonSurveyResponse.lesson_id == lesson_id,
                LessonSurveyResponse.student_id == student_id,
            )
            .first()
        )

        if survey is None:
            survey = LessonSurveyResponse(
                lesson_id=lesson_id,
                student_id=student_id,
                **payload.model_dump(),
            )
            db.add(survey)
        else:
            survey.clarity_rating = payload.clarity_rating
            survey.difficulty_rating = payload.difficulty_rating
            survey.interest_rating = payload.interest_rating
            survey.comment = payload.comment

        db.commit()
        db.refresh(survey)
        return survey

    def list_my_surveys(self, db: Session, student_id: int) -> list[LessonSurveyResponse]:
        return (
            db.query(LessonSurveyResponse)
            .filter(LessonSurveyResponse.student_id == student_id)
            .order_by(LessonSurveyResponse.id.desc())
            .all()
        )

    def lesson_summary(self, db: Session, lesson_id: int) -> LessonSurveySummary:
        lesson = db.get(Lesson, lesson_id)
        if lesson is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

        stats = (
            db.query(
                func.count(LessonSurveyResponse.id),
                func.avg(LessonSurveyResponse.clarity_rating),
                func.avg(LessonSurveyResponse.difficulty_rating),
                func.avg(LessonSurveyResponse.interest_rating),
            )
            .filter(LessonSurveyResponse.lesson_id == lesson_id)
            .one()
        )

        count, avg_clarity, avg_difficulty, avg_interest = stats
        return LessonSurveySummary(
            lesson_id=lesson_id,
            responses_count=int(count or 0),
            avg_clarity=round(float(avg_clarity or 0), 2),
            avg_difficulty=round(float(avg_difficulty or 0), 2),
            avg_interest=round(float(avg_interest or 0), 2),
        )


survey_service = SurveyService()
