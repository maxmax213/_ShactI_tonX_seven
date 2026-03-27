import json
from pathlib import Path
import secrets

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.modules.assignments.models import Assignment
from app.modules.courses.models import Course, CourseEnrollment, CourseModule, Lesson
from app.modules.gamification.models import Achievement
from app.modules.users.models import ParentStudentLink, User
from app.shared.enums import AchievementRarity, AssignmentType, UserRole


def _generate_numeric_code(length: int = 6) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def _seed_users(db: Session) -> tuple[User, User, User]:
    teacher = db.query(User).filter(User.email == "teacher@demo.local").first()
    if teacher is None:
        teacher = User(
            email="teacher@demo.local",
            password_hash=hash_password("teacher123"),
            full_name="Тестовый учитель",
            role=UserRole.TEACHER,
        )
        db.add(teacher)

    student = db.query(User).filter(User.email == "student@demo.local").first()
    if student is None:
        student = User(
            email="student@demo.local",
            password_hash=hash_password("student123"),
            full_name="Тестовый ученик",
            role=UserRole.STUDENT,
            parent_link_code="123456",
        )
        db.add(student)

    parent = db.query(User).filter(User.email == "parent@demo.local").first()
    if parent is None:
        parent = User(
            email="parent@demo.local",
            password_hash=hash_password("parent123"),
            full_name="Тестовый родитель",
            role=UserRole.PARENT,
        )
        db.add(parent)

    db.commit()
    db.refresh(teacher)
    db.refresh(student)
    db.refresh(parent)

    link = db.get(ParentStudentLink, (parent.id, student.id))
    if link is None:
        db.add(
            ParentStudentLink(
                parent_id=parent.id,
                student_id=student.id,
                link_code=student.parent_link_code or "123456",
            )
        )
        db.commit()

    return teacher, student, parent


def _seed_course(db: Session, teacher: User, student: User) -> None:
    lesson_1_test_payload = {
        "questions": [
            {
                "id": "q1",
                "type": "single_choice",
                "prompt": "Какой оператор выводит текст на экран?",
                "options": [
                    {"id": "a", "text": "print()"},
                    {"id": "b", "text": "input()"},
                    {"id": "c", "text": "return"},
                ],
                "correct": "a",
            },
            {
                "id": "q2",
                "type": "multiple_choice",
                "prompt": "Выберите корректные имена переменных в Python",
                "options": [
                    {"id": "a", "text": "user_name"},
                    {"id": "b", "text": "2score"},
                    {"id": "c", "text": "_count"},
                    {"id": "d", "text": "my-name"},
                ],
                "correct": ["a", "c"],
            },
            {
                "id": "q3",
                "type": "true_false",
                "prompt": "Оператор if используется для ветвления логики.",
                "correct": True,
            },
            {
                "id": "q4",
                "type": "short_text",
                "prompt": "Впишите ключевое слово: ___ i in range(5):",
                "correct": "for",
            },
        ]
    }

    functions_test_payload = {
        "questions": [
            {
                "id": "q1",
                "type": "single_choice",
                "prompt": "Какое ключевое слово объявляет функцию?",
                "options": [
                    {"id": "a", "text": "func"},
                    {"id": "b", "text": "def"},
                    {"id": "c", "text": "function"},
                ],
                "correct": "b",
            },
            {
                "id": "q2",
                "type": "single_choice",
                "prompt": "Чем вернуть значение из функции?",
                "options": [
                    {"id": "a", "text": "print"},
                    {"id": "b", "text": "yield"},
                    {"id": "c", "text": "return"},
                ],
                "correct": "c",
            },
            {
                "id": "q3",
                "type": "short_text",
                "prompt": "Напишите имя встроенной функции длины коллекции",
                "correct": ["len", "len()"],
            },
        ]
    }

    course = (
        db.query(Course)
        .filter(or_(Course.enroll_code == "654321", Course.title == "Тестовый курс Python"))
        .first()
    )
    if course is None:
        course = Course(
            teacher_id=teacher.id,
            title="Тестовый курс Python",
            description="Курс доступен сразу после запуска приложения",
            enroll_code="654321",
            is_published=True,
        )
        db.add(course)
        db.commit()
        db.refresh(course)
    else:
        course.title = "Тестовый курс Python"
        course.description = "Курс доступен сразу после запуска приложения"
        course.is_published = True
        if course.enroll_code != "654321":
            course.enroll_code = "654321"
        db.commit()
        db.refresh(course)

    module = (
        db.query(CourseModule)
        .filter(CourseModule.course_id == course.id, CourseModule.order_index == 1)
        .first()
    )
    if module is None:
        module = CourseModule(
            course_id=course.id,
            title="Основы синтаксиса",
            description="Переменные, условия, циклы",
            order_index=1,
        )
        db.add(module)
        db.commit()
        db.refresh(module)

    lesson = db.query(Lesson).filter(Lesson.module_id == module.id, Lesson.order_index == 1).first()
    if lesson is None:
        lesson = Lesson(
            module_id=module.id,
            title="Первый урок",
            theory_text="print, переменные и условные операторы",
            order_index=1,
        )
        db.add(lesson)
        db.commit()
        db.refresh(lesson)

    practice = (
        db.query(Assignment)
        .filter(Assignment.lesson_id == lesson.id, Assignment.title == "Практика: положительное число")
        .first()
    )
    if practice is None:
        practice = Assignment(
            lesson_id=lesson.id,
            title="Практика: положительное число",
            assignment_type=AssignmentType.PYTHON,
            max_score=100,
            is_auto_check=False,
        )
        db.add(practice)
    practice.description = "Напишите программу, которая печатает 'YES', если число положительное"
    practice.max_score = 100
    practice.is_auto_check = False

    blocks_practice = (
        db.query(Assignment)
        .filter(Assignment.lesson_id == lesson.id, Assignment.title == "Блоки: проверка числа")
        .first()
    )
    if blocks_practice is None:
        blocks_practice = Assignment(
            lesson_id=lesson.id,
            title="Блоки: проверка числа",
            assignment_type=AssignmentType.BLOCKS,
            max_score=100,
            is_auto_check=False,
        )
        db.add(blocks_practice)
    blocks_practice.description = (
        "Соберите алгоритм из блоков: ввод числа, проверка условия, вывод YES/NO."
    )
    blocks_practice.content_payload = json.dumps(
        {
            "hint": "Используйте блоки: input -> if -> print",
            "starter_blocks": ["input", "if", "print"],
        },
        ensure_ascii=False,
    )

    quick_test = (
        db.query(Assignment)
        .filter(Assignment.lesson_id == lesson.id, Assignment.title == "Тест: базовые команды")
        .first()
    )
    if quick_test is None:
        quick_test = Assignment(
            lesson_id=lesson.id,
            title="Тест: базовые команды",
            assignment_type=AssignmentType.TEST,
            max_score=100,
            is_auto_check=True,
        )
        db.add(quick_test)
    quick_test.description = "Автоматическая проверка по теории урока"
    quick_test.max_score = 100
    quick_test.is_auto_check = True
    quick_test.content_payload = json.dumps(lesson_1_test_payload, ensure_ascii=False)

    lesson_2 = db.query(Lesson).filter(Lesson.module_id == module.id, Lesson.order_index == 2).first()
    if lesson_2 is None:
        lesson_2 = Lesson(
            module_id=module.id,
            title="Второй урок: циклы",
            theory_text="Циклы for и while, range, вложенные циклы",
            order_index=2,
        )
        db.add(lesson_2)
        db.commit()
        db.refresh(lesson_2)

    loop_practice = (
        db.query(Assignment)
        .filter(Assignment.lesson_id == lesson_2.id, Assignment.title == "Практика: таблица умножения")
        .first()
    )
    if loop_practice is None:
        loop_practice = Assignment(
            lesson_id=lesson_2.id,
            title="Практика: таблица умножения",
            assignment_type=AssignmentType.PYTHON,
            max_score=100,
            is_auto_check=False,
        )
        db.add(loop_practice)
    loop_practice.description = "Выведите таблицу умножения от 1 до 5 через вложенные циклы"
    loop_practice.max_score = 100
    loop_practice.is_auto_check = False

    second_module = (
        db.query(CourseModule)
        .filter(CourseModule.course_id == course.id, CourseModule.order_index == 2)
        .first()
    )
    if second_module is None:
        second_module = CourseModule(
            course_id=course.id,
            title="Функции и мини-тест",
            description="Аргументы функций, return, простая декомпозиция",
            order_index=2,
        )
        db.add(second_module)
        db.commit()
        db.refresh(second_module)

    function_lesson = (
        db.query(Lesson)
        .filter(Lesson.module_id == second_module.id, Lesson.order_index == 1)
        .first()
    )
    if function_lesson is None:
        function_lesson = Lesson(
            module_id=second_module.id,
            title="Урок: функции",
            theory_text="Как объявлять функцию, передавать параметры и возвращать значение",
            order_index=1,
        )
        db.add(function_lesson)
        db.commit()
        db.refresh(function_lesson)

    function_test = (
        db.query(Assignment)
        .filter(Assignment.lesson_id == function_lesson.id, Assignment.title == "Тест: функции")
        .first()
    )
    if function_test is None:
        function_test = Assignment(
            lesson_id=function_lesson.id,
            title="Тест: функции",
            assignment_type=AssignmentType.TEST,
            max_score=100,
            is_auto_check=True,
        )
        db.add(function_test)
    function_test.description = "Проверка теории по функциям"
    function_test.max_score = 100
    function_test.is_auto_check = True
    function_test.content_payload = json.dumps(functions_test_payload, ensure_ascii=False)

    mini_project = (
        db.query(Assignment)
        .filter(Assignment.lesson_id == function_lesson.id, Assignment.title == "Мини-проект: калькулятор функций")
        .first()
    )
    if mini_project is None:
        mini_project = Assignment(
            lesson_id=function_lesson.id,
            title="Мини-проект: калькулятор функций",
            assignment_type=AssignmentType.PYTHON,
            max_score=100,
            is_auto_check=False,
        )
        db.add(mini_project)
    mini_project.description = (
        "Создайте функции add, sub, mul и покажите пример их вызова в одной программе."
    )
    mini_project.max_score = 100
    mini_project.is_auto_check = False

    enrollment = db.get(CourseEnrollment, (course.id, student.id))
    if enrollment is None:
        db.add(CourseEnrollment(course_id=course.id, student_id=student.id))

    db.commit()


def _seed_achievements(db: Session) -> None:
    path = Path(__file__).resolve().parents[2] / "seed" / "achievements.json"
    if not path.exists():
        return

    data = json.loads(path.read_text(encoding="utf-8"))
    for item in data:
        exists = db.query(Achievement).filter(Achievement.slug == item["slug"]).first()
        if exists:
            continue

        db.add(
            Achievement(
                slug=item["slug"],
                title=item["title"],
                description=item["description"],
                rarity=AchievementRarity(item["rarity"]),
                xp_reward=item["xp_reward"],
            )
        )

    db.commit()


def ensure_demo_data(db: Session) -> None:
    teacher, student, _ = _seed_users(db)
    _seed_course(db, teacher, student)
    _seed_achievements(db)
