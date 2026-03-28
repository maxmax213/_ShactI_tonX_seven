import json

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.assignments.models import Assignment
from app.modules.submissions.models import Submission
from app.modules.submissions.schemas import SubmissionCreate, SubmissionGrade
from app.modules.users.models import User
from app.shared.enums import AssignmentType, SubmissionStatus


def _update_student_progress(student: User, score: int) -> None:
    gained_xp = max(5, score)
    student.xp += gained_xp
    student.level = max(1, student.xp // 100 + 1)


def _normalize_scalar(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value).strip().lower()


def _normalize_many(value: object) -> set[str]:
    if isinstance(value, (list, tuple, set)):
        return {item for item in (_normalize_scalar(part) for part in value) if item}
    normalized = _normalize_scalar(value)
    return {normalized} if normalized else set()


def _is_answer_correct(question: dict[str, object], answer: object) -> bool:
    if answer is None:
        return False

    expected = question.get("correct")
    question_type = str(question.get("type") or "short_text").strip().lower()

    if question_type == "multiple_choice":
        expected_many = _normalize_many(expected)
        actual_many = _normalize_many(answer)
        if not expected_many:
            return False
        return actual_many == expected_many

    if question_type == "true_false":
        expected_value = _normalize_scalar(expected)
        answer_value = _normalize_scalar(answer)
        return answer_value in {"true", "false"} and answer_value == expected_value

    if isinstance(expected, list):
        accepted = {item for item in (_normalize_scalar(item) for item in expected) if item}
        return _normalize_scalar(answer) in accepted

    return _normalize_scalar(answer) == _normalize_scalar(expected)


def _auto_grade_test(assignment: Assignment, solution_payload: str) -> tuple[int, str]:
    if not assignment.content_payload:
        return 0, "В тесте нет настроенного содержимого"

    try:
        content = json.loads(assignment.content_payload)
        answers = json.loads(solution_payload)
    except json.JSONDecodeError:
        return 0, "Ответы должны быть в формате JSON"

    if not isinstance(content, dict):
        return 0, "Содержимое теста настроено некорректно"

    if not isinstance(answers, dict):
        return 0, "Ответы теста должны быть JSON-объектом"

    questions_raw = content.get("questions", [])
    questions = [
        question
        for question in questions_raw
        if isinstance(question, dict) and question.get("id") is not None
    ]
    if not questions:
        return 0, "В тесте нет корректно настроенных вопросов"

    total = len(questions)
    correct = 0
    for question in questions:
        qid = str(question.get("id"))
        if _is_answer_correct(question, answers.get(qid)):
            correct += 1

    score = int(round(correct / total * 100))
    return score, f"Автопроверка: {correct}/{total} правильных ответов"


class SubmissionsService:
    def submit(
        self,
        db: Session,
        assignment_id: int,
        student_id: int,
        payload: SubmissionCreate,
    ) -> Submission:
        assignment = db.get(Assignment, assignment_id)
        if assignment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

        student = db.get(User, student_id)
        if student is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

        current_attempt = (
            db.query(func.max(Submission.attempt))
            .filter(Submission.assignment_id == assignment_id, Submission.student_id == student_id)
            .scalar()
        )
        attempt = (current_attempt or 0) + 1

        submission = Submission(
            assignment_id=assignment_id,
            student_id=student_id,
            solution_payload=payload.solution_payload,
            attempt=attempt,
            status=SubmissionStatus.PENDING,
        )

        if assignment.assignment_type == AssignmentType.TEST and assignment.is_auto_check:
            score, feedback = _auto_grade_test(assignment, payload.solution_payload)
            submission.status = SubmissionStatus.CHECKED
            submission.score = score
            submission.teacher_feedback = feedback
            _update_student_progress(student, score)

        db.add(submission)
        db.commit()
        db.refresh(submission)
        return submission

    def grade(self, db: Session, submission_id: int, payload: SubmissionGrade) -> Submission:
        submission = db.get(Submission, submission_id)
        if submission is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

        submission.score = payload.score
        submission.teacher_feedback = payload.teacher_feedback
        submission.status = SubmissionStatus.CHECKED

        student = db.get(User, submission.student_id)
        if student is not None:
            _update_student_progress(student, payload.score)

        db.commit()
        db.refresh(submission)
        return submission

    def list_student_submissions(self, db: Session, student_id: int) -> list[Submission]:
        return (
            db.query(Submission)
            .filter(Submission.student_id == student_id)
            .order_by(Submission.id.desc())
            .all()
        )

    def list_assignment_submissions(self, db: Session, assignment_id: int) -> list[Submission]:
        return (
            db.query(Submission)
            .filter(Submission.assignment_id == assignment_id)
            .order_by(Submission.id.desc())
            .all()
        )


submissions_service = SubmissionsService()
