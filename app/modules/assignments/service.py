from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.assignments.models import Assignment
from app.modules.assignments.schemas import AssignmentCreate, AssignmentUpdate
from app.modules.courses.models import Course, CourseModule, Lesson


class AssignmentsService:
    def _ensure_teacher_access(self, db: Session, teacher_id: int, lesson_id: int) -> None:
        lesson = db.get(Lesson, lesson_id)
        if lesson is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

        module = db.get(CourseModule, lesson.module_id)
        if module is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")

        course = db.get(Course, module.course_id)
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
        if course.teacher_id != teacher_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    def create_assignment(self, db: Session, payload: AssignmentCreate) -> Assignment:
        lesson = db.get(Lesson, payload.lesson_id)
        if lesson is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

        assignment = Assignment(**payload.model_dump())
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
        return assignment

    def update_assignment(self, db: Session, teacher_id: int, assignment_id: int, payload: AssignmentUpdate) -> Assignment:
        assignment = db.get(Assignment, assignment_id)
        if assignment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
        self._ensure_teacher_access(db, teacher_id, assignment.lesson_id)
        assignment.title = payload.title
        assignment.description = payload.description
        assignment.assignment_type = payload.assignment_type
        assignment.max_score = payload.max_score
        assignment.is_auto_check = payload.is_auto_check
        assignment.content_payload = payload.content_payload
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
