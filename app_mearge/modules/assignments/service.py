from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.assignments.models import Assignment
from app.modules.assignments.schemas import AssignmentCreate
from app.modules.courses.models import Lesson


class AssignmentsService:
    def create_assignment(self, db: Session, payload: AssignmentCreate) -> Assignment:
        lesson = db.get(Lesson, payload.lesson_id)
        if lesson is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

        assignment = Assignment(**payload.model_dump())
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
        return assignment

    def get_assignment(self, db: Session, assignment_id: int) -> Assignment:
        assignment = db.get(Assignment, assignment_id)
        if assignment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
        return assignment

    def list_by_lesson(self, db: Session, lesson_id: int) -> list[Assignment]:
        return (
            db.query(Assignment)
            .filter(Assignment.lesson_id == lesson_id)
            .order_by(Assignment.id.asc())
            .all()
        )


assignments_service = AssignmentsService()
