from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles, get_current_user
from app.modules.courses.models import Course, Lesson
from app.modules.courses.schemas import (
    CourseCreate,
    CourseParticipantRead,
    CourseRead,
    CourseTreeRead,
    CourseUpdate,
    LessonCreate,
    LessonRead,
    LessonUpdate,
    ModuleCreate,
    ModuleRead,
    ModuleUpdate,
)
from app.modules.courses.service import courses_service
from app.modules.users.models import User
from app.shared.enums import UserRole

router = APIRouter()


@router.post("/", response_model=CourseRead)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TEACHER)),
) -> Course:
    return courses_service.create_course(db, current_user.id, payload)


@router.patch("/{course_id}", response_model=CourseRead)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TEACHER)),
) -> Course:
    return courses_service.update_course(db, current_user.id, course_id, payload)


@router.get("/my", response_model=list[CourseRead])
def my_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Course]:
    return courses_service.list_user_courses(db, current_user)


@router.post("/{course_id}/publish", response_model=CourseRead)
def publish_course(
    course_id: int,
    is_published: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TEACHER)),
) -> Course:
    return courses_service.set_published(db, current_user.id, course_id, is_published)


@router.get("/{course_id}/tree", response_model=CourseTreeRead)
def course_tree(course_id: int, db: Session = Depends(get_db)) -> CourseTreeRead:
    return courses_service.get_course_tree(db, course_id)


@router.post("/{course_id}/modules", response_model=ModuleRead)
def create_module(
    course_id: int,
    payload: ModuleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.TEACHER)),
) -> ModuleRead:
    return ModuleRead.model_validate(courses_service.create_module(db, course_id, payload))


@router.patch("/modules/{module_id}", response_model=ModuleRead)
def update_module(
    module_id: int,
    payload: ModuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TEACHER)),
) -> ModuleRead:
    return ModuleRead.model_validate(courses_service.update_module(db, current_user.id, module_id, payload))


@router.post("/modules/{module_id}/lessons", response_model=LessonRead)
def create_lesson(
    module_id: int,
    payload: LessonCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.TEACHER)),
) -> Lesson:
    return courses_service.create_lesson(db, module_id, payload)


@router.patch("/lessons/{lesson_id}", response_model=LessonRead)
def update_lesson(
    lesson_id: int,
    payload: LessonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TEACHER)),
) -> Lesson:
    return courses_service.update_lesson(db, current_user.id, lesson_id, payload)


@router.get("/{course_id}/participants", response_model=list[CourseParticipantRead])
def course_participants(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TEACHER)),
) -> list[CourseParticipantRead]:
    return courses_service.list_course_participants(db, current_user.id, course_id)


@router.post("/enroll/{enroll_code}")
def enroll(
    enroll_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT)),
) -> dict[str, str]:
    courses_service.enroll_by_code(db, current_user.id, enroll_code)
    return {"status": "enrolled"}
