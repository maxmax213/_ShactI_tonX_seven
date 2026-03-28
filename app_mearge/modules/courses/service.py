import secrets

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.modules.courses.models import Course, CourseEnrollment, CourseModule, Lesson
from app.modules.courses.schemas import (
    AssignmentTreeRead,
    CourseCreate,
    CourseTreeRead,
    LessonCreate,
    LessonTreeRead,
    ModuleCreate,
    ModuleTreeRead,
)
from app.modules.users.models import User
from app.shared.enums import UserRole


def _generate_numeric_code(length: int = 6) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


class CoursesService:
    def create_course(self, db: Session, teacher_id: int, payload: CourseCreate) -> Course:
        course = Course(
            teacher_id=teacher_id,
            title=payload.title,
            description=payload.description,
            enroll_code=_generate_numeric_code(),
        )
        db.add(course)
        db.commit()
        db.refresh(course)
        return course

    def set_published(self, db: Session, course_id: int, is_published: bool) -> Course:
        course = db.get(Course, course_id)
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        course.is_published = is_published
        db.commit()
        db.refresh(course)
        return course

    def list_user_courses(self, db: Session, user: User) -> list[Course]:
        if user.role == UserRole.TEACHER:
            return db.query(Course).filter(Course.teacher_id == user.id).order_by(Course.id.desc()).all()

        if user.role == UserRole.STUDENT:
            courses = (
                db.query(Course)
                .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
                .filter(CourseEnrollment.student_id == user.id)
                .order_by(Course.id.desc())
                .all()
            )
            if courses:
                return courses

            # Safety net: student always gets at least one ready-to-learn course.
            self.ensure_student_default_enrollment(db, user.id)
            return (
                db.query(Course)
                .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
                .filter(CourseEnrollment.student_id == user.id)
                .order_by(Course.id.desc())
                .all()
            )

        return []

    def ensure_student_default_enrollment(self, db: Session, student_id: int) -> None:
        target_course = db.query(Course).filter(Course.enroll_code == "654321").first()
        if target_course is None:
            target_course = db.query(Course).filter(Course.is_published.is_(True)).order_by(Course.id.asc()).first()
        if target_course is None:
            target_course = db.query(Course).order_by(Course.id.asc()).first()
        if target_course is None:
            return

        enrollment = db.get(CourseEnrollment, (target_course.id, student_id))
        if enrollment is not None:
            return

        db.add(CourseEnrollment(course_id=target_course.id, student_id=student_id))
        db.commit()

    def create_module(self, db: Session, course_id: int, payload: ModuleCreate) -> CourseModule:
        course = db.get(Course, course_id)
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        module = CourseModule(
            course_id=course_id,
            title=payload.title,
            description=payload.description,
            order_index=payload.order_index,
        )
        db.add(module)
        db.commit()
        db.refresh(module)
        return module

    def create_lesson(self, db: Session, module_id: int, payload: LessonCreate) -> Lesson:
        module = db.get(CourseModule, module_id)
        if module is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")

        lesson = Lesson(
            module_id=module_id,
            title=payload.title,
            theory_text=payload.theory_text,
            order_index=payload.order_index,
        )
        db.add(lesson)
        db.commit()
        db.refresh(lesson)
        return lesson

    def enroll_by_code(self, db: Session, student_id: int, enroll_code: str) -> CourseEnrollment:
        course = db.query(Course).filter(Course.enroll_code == enroll_code).first()
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        enrollment = db.get(CourseEnrollment, (course.id, student_id))
        if enrollment:
            return enrollment

        enrollment = CourseEnrollment(course_id=course.id, student_id=student_id)
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)
        return enrollment

    def get_course_tree(self, db: Session, course_id: int) -> CourseTreeRead:
        course = (
            db.query(Course)
            .options(
                joinedload(Course.modules)
                .joinedload(CourseModule.lessons)
                .joinedload(Lesson.assignments)
            )
            .filter(Course.id == course_id)
            .first()
        )
        if course is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        modules: list[ModuleTreeRead] = []
        for module in sorted(course.modules, key=lambda item: item.order_index):
            lessons: list[LessonTreeRead] = []
            for lesson in sorted(module.lessons, key=lambda item: item.order_index):
                assignments = [
                    AssignmentTreeRead(
                        id=assignment.id,
                        title=assignment.title,
                        assignment_type=assignment.assignment_type.value,
                        max_score=assignment.max_score,
                    )
                    for assignment in lesson.assignments
                ]
                lessons.append(
                    LessonTreeRead(
                        id=lesson.id,
                        title=lesson.title,
                        theory_text=lesson.theory_text,
                        order_index=lesson.order_index,
                        assignments=assignments,
                    )
                )
            modules.append(
                ModuleTreeRead(
                    id=module.id,
                    title=module.title,
                    description=module.description,
                    order_index=module.order_index,
                    lessons=lessons,
                )
            )

        return CourseTreeRead(
            id=course.id,
            title=course.title,
            description=course.description,
            enroll_code=course.enroll_code,
            is_published=course.is_published,
            modules=modules,
        )


courses_service = CoursesService()
