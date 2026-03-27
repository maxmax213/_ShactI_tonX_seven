import os
import json
from datetime import datetime, timedelta
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON, UniqueConstraint, \
    Boolean, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.dialects.postgresql import JSONB
from dotenv import load_dotenv
import enum

# Загрузка переменных окружения
load_dotenv()

Base = declarative_base()


# Перечисления (ENUM)
class UserRole(enum.Enum):
    STUDENT = "student"
    PARENT = "parent"
    TEACHER = "teacher"


class AssignmentType(enum.Enum):
    BLOCKS = "blocks"
    CODE = "code"
    TEST = "test"


class SubmissionStatus(enum.Enum):
    PENDING = "pending"
    CHECKED = "checked"
    FAILED = "failed"


# 1. Пользователи и авторизация
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    full_name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Связи
    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    courses = relationship("Course", back_populates="teacher")
    submissions = relationship("Submission", back_populates="student")
    grades = relationship("Grade", back_populates="student")
    comments = relationship("Comment", back_populates="user")
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    received_messages = relationship("Message", foreign_keys="Message.receiver_id", back_populates="receiver")
    parent_students = relationship("ParentStudent", foreign_keys="ParentStudent.student_id", back_populates="student")
    parent_of = relationship("ParentStudent", foreign_keys="ParentStudent.parent_id", back_populates="parent")


# 2. Профиль и настройки
class Profile(Base):
    __tablename__ = "profiles"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    avatar_url = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    settings = Column(JSONB, default={})

    # Связи
    user = relationship("User", back_populates="profile")


# 3. Учебная структура
class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    enroll_key = Column(String(10), nullable=True, unique=True)
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    teacher = relationship("User", back_populates="courses")
    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan")
    grades = relationship("Grade", back_populates="course", cascade="all, delete-orphan")


class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    course = relationship("Course", back_populates="modules")
    lessons = relationship("Lesson", back_populates="module", cascade="all, delete-orphan")


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    content = Column(JSONB, default={})
    order_index = Column(Integer, nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    module = relationship("Module", back_populates="lessons")
    assignments = relationship("Assignment", back_populates="lesson", cascade="all, delete-orphan")


# 4. Задания и контент
class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(AssignmentType), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    max_score = Column(Integer, nullable=False)
    content = Column(JSONB, nullable=True)
    deadline = Column(DateTime, nullable=True)
    is_auto_grade = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    lesson = relationship("Lesson", back_populates="assignments")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="assignment", cascade="all, delete-orphan")


# 5. Решения и проверка
class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    solution_data = Column(Text, nullable=True)
    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.PENDING)
    score = Column(Integer, nullable=True)
    feedback = Column(Text, nullable=True)
    attempt_number = Column(Integer, default=1)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    checked_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Связи
    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("User", foreign_keys=[student_id], back_populates="submissions")
    checker = relationship("User", foreign_keys=[checked_by])

    __table_args__ = (
        UniqueConstraint('assignment_id', 'student_id', 'attempt_number', name='unique_submission_attempt'),
    )


# 6. Оценки и статистика
class Grade(Base):
    __tablename__ = "grades"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    total_score = Column(Integer, default=0)
    completed_assignments = Column(Integer, default=0)
    total_assignments = Column(Integer, default=0)
    average_score = Column(Integer, default=0)
    last_activity = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    student = relationship("User", back_populates="grades")
    course = relationship("Course", back_populates="grades")

    __table_args__ = (UniqueConstraint('student_id', 'course_id', name='unique_student_course'),)


# 7. Комментарии
class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    parent_comment_id = Column(Integer, ForeignKey("comments.id"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    user = relationship("User", back_populates="comments")
    assignment = relationship("Assignment", back_populates="comments")
    replies = relationship("Comment", backref="parent", remote_side=[id])


# 8. Личные сообщения
class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject = Column(String(255), nullable=True)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    is_deleted_by_sender = Column(Boolean, default=False)
    is_deleted_by_receiver = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)

    # Связи
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_messages")


# 9. Родительский контроль
class ParentStudent(Base):
    __tablename__ = "parent_students"

    parent_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    can_view_grades = Column(Boolean, default=True)
    can_view_submissions = Column(Boolean, default=True)
    can_receive_notifications = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    parent = relationship("User", foreign_keys=[parent_id], back_populates="parent_of")
    student = relationship("User", foreign_keys=[student_id], back_populates="parent_students")


# 10. Уведомления
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)
    is_read = Column(Boolean, default=False)
    link = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    user = relationship("User")


# 11. Система ачивок (достижений)
class Achievement(Base):
    """Модель достижения (ачивки)"""
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    icon_url = Column(String(500), nullable=True)
    badge_image = Column(String(500), nullable=True)
    category = Column(String(100), nullable=False)
    rarity = Column(String(50), default='common')
    xp_reward = Column(Integer, default=0)
    points_reward = Column(Integer, default=0)

    condition_type = Column(String(100), nullable=False)
    condition_value = Column(Integer, nullable=False)
    condition_extra = Column(JSONB, default={})

    is_secret = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    user_achievements = relationship("UserAchievement", back_populates="achievement", cascade="all, delete-orphan")


class UserAchievement(Base):
    """Модель полученных ачивок пользователями"""
    __tablename__ = "user_achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    achievement_id = Column(Integer, ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False)

    progress = Column(Integer, default=0)
    completed_at = Column(DateTime, nullable=True)
    is_notified = Column(Boolean, default=False)
    earned_data = Column(JSONB, default={})

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    user = relationship("User", backref="user_achievements")
    achievement = relationship("Achievement", back_populates="user_achievements")

    __table_args__ = (UniqueConstraint('user_id', 'achievement_id', name='unique_user_achievement'),)


class UserStats(Base):
    """Расширенная статистика пользователя для ачивок и прогресса"""
    __tablename__ = "user_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    total_xp = Column(Integer, default=0)
    total_achievement_points = Column(Integer, default=0)
    total_achievements = Column(Integer, default=0)

    total_submissions = Column(Integer, default=0)
    perfect_scores = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)

    completed_courses = Column(Integer, default=0)
    completed_assignments = Column(Integer, default=0)
    average_score = Column(Integer, default=0)

    last_activity_date = Column(DateTime, nullable=True)
    last_streak_update = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    user = relationship("User", backref="stats")


class AchievementProgress(Base):
    """Модель прогресса пользователя по ачивкам (для отслеживания)"""
    __tablename__ = "achievement_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    achievement_id = Column(Integer, ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False)

    current_value = Column(Integer, default=0)
    target_value = Column(Integer, nullable=False)
    is_completed = Column(Boolean, default=False)
    last_updated = Column(DateTime, default=datetime.utcnow)

    # Связи
    user = relationship("User")
    achievement = relationship("Achievement")

    __table_args__ = (UniqueConstraint('user_id', 'achievement_id', name='unique_progress'),)


# Настройка базы данных PostgreSQL
class DatabaseManager:
    def __init__(self, db_url=None):
        """
        Инициализация подключения к PostgreSQL
        Пример db_url: postgresql://user:password@localhost:5432/dbname
        """
        if db_url is None:
            db_url = f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', 'password')}@" \
                     f"{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5432')}/" \
                     f"{os.getenv('DB_NAME', 'education_db')}"

        self.engine = create_engine(
            db_url,
            pool_size=int(os.getenv('DB_POOL_SIZE', '10')),
            max_overflow=int(os.getenv('DB_MAX_OVERFLOW', '20')),
            pool_pre_ping=True,
            echo=os.getenv('DB_ECHO', 'False').lower() == 'true'
        )

        Base.metadata.create_all(self.engine)

        self.SessionLocal = sessionmaker(
            bind=self.engine,
            autocommit=False,
            autoflush=False
        )

    def get_session(self):
        return self.SessionLocal()

    def close(self):
        self.engine.dispose()


# Класс для управления ачивками
class AchievementManager:
    """Менеджер для работы с ачивками"""

    def __init__(self, db_session):
        self.session = db_session

    def create_achievement(self, name, description, condition_type, condition_value,
                           category='course', icon_url=None, badge_image=None,
                           rarity='common', xp_reward=0, points_reward=0,
                           is_secret=False, condition_extra=None):
        """Создание нового достижения"""
        achievement = Achievement(
            name=name,
            description=description,
            icon_url=icon_url,
            badge_image=badge_image,
            category=category,
            rarity=rarity,
            xp_reward=xp_reward,
            points_reward=points_reward,
            condition_type=condition_type,
            condition_value=condition_value,
            condition_extra=condition_extra or {},
            is_secret=is_secret
        )
        self.session.add(achievement)
        self.session.commit()
        return achievement

    def get_achievement(self, achievement_id):
        """Получение ачивки по ID"""
        return self.session.query(Achievement).get(achievement_id)

    def get_all_achievements(self, active_only=True, category=None):
        """Получение всех ачивок"""
        query = self.session.query(Achievement)
        if active_only:
            query = query.filter(Achievement.is_active == True)
        if category:
            query = query.filter(Achievement.category == category)
        return query.order_by(Achievement.order_index).all()

    def update_achievement(self, achievement_id, **kwargs):
        """Обновление ачивки"""
        achievement = self.session.query(Achievement).get(achievement_id)
        if achievement:
            for key, value in kwargs.items():
                if hasattr(achievement, key):
                    setattr(achievement, key, value)
            achievement.updated_at = datetime.utcnow()
            self.session.commit()
        return achievement

    def delete_achievement(self, achievement_id):
        """Удаление ачивки"""
        achievement = self.session.query(Achievement).get(achievement_id)
        if achievement:
            # Удаляем связанные записи
            self.session.query(UserAchievement).filter(
                UserAchievement.achievement_id == achievement_id
            ).delete()
            self.session.query(AchievementProgress).filter(
                AchievementProgress.achievement_id == achievement_id
            ).delete()
            self.session.delete(achievement)
            self.session.commit()
            return True
        return False

    def toggle_achievement_active(self, achievement_id):
        """Включить/выключить ачивку"""
        achievement = self.session.query(Achievement).get(achievement_id)
        if achievement:
            achievement.is_active = not achievement.is_active
            achievement.updated_at = datetime.utcnow()
            self.session.commit()
            return achievement.is_active
        return None

    def import_achievements_from_json(self, json_file_path):
        """Импорт ачивок из JSON файла"""
        with open(json_file_path, 'r', encoding='utf-8') as f:
            achievements_data = json.load(f)

        created_count = 0
        for ach_data in achievements_data:
            # Проверяем, существует ли ачивка с таким названием
            existing = self.session.query(Achievement).filter(
                Achievement.name == ach_data['name']
            ).first()

            if not existing:
                self.create_achievement(**ach_data)
                created_count += 1

        self.session.commit()
        return created_count

    def export_achievements_to_json(self, json_file_path):
        """Экспорт ачивок в JSON файл"""
        achievements = self.get_all_achievements(active_only=False)

        achievements_data = []
        for ach in achievements:
            achievements_data.append({
                "name": ach.name,
                "description": ach.description,
                "icon_url": ach.icon_url,
                "badge_image": ach.badge_image,
                "category": ach.category,
                "rarity": ach.rarity,
                "xp_reward": ach.xp_reward,
                "points_reward": ach.points_reward,
                "condition_type": ach.condition_type,
                "condition_value": ach.condition_value,
                "condition_extra": ach.condition_extra,
                "is_secret": ach.is_secret,
                "is_active": ach.is_active,
                "order_index": ach.order_index
            })

        with open(json_file_path, 'w', encoding='utf-8') as f:
            json.dump(achievements_data, f, ensure_ascii=False, indent=2)

        return len(achievements_data)


# Класс для работы с базой данных
class EducationDB:
    def __init__(self, db_manager):
        self.db = db_manager
        self.session = db_manager.get_session()
        self.achievement_manager = AchievementManager(self.session)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.session.rollback()
        self.session.close()

    # ==================== ОПЕРАЦИИ С ПОЛЬЗОВАТЕЛЯМИ ====================

    def create_user(self, email, password_hash, role, full_name):
        """Создание нового пользователя"""
        user = User(
            email=email,
            password_hash=password_hash,
            role=role,
            full_name=full_name
        )
        self.session.add(user)
        self.session.commit()

        profile = Profile(user_id=user.id)
        self.session.add(profile)
        self.session.commit()

        return user

    def get_user_by_email(self, email):
        return self.session.query(User).filter(User.email == email).first()

    def get_user_by_id(self, user_id):
        return self.session.query(User).get(user_id)

    def update_user_profile(self, user_id, **kwargs):
        profile = self.session.query(Profile).filter(Profile.user_id == user_id).first()
        if profile:
            for key, value in kwargs.items():
                if hasattr(profile, key):
                    setattr(profile, key, value)
            self.session.commit()
        return profile

    # ==================== ОПЕРАЦИИ С КУРСАМИ ====================

    def create_course(self, teacher_id, title, description=None, enroll_key=None):
        course = Course(
            teacher_id=teacher_id,
            title=title,
            description=description,
            enroll_key=enroll_key
        )
        self.session.add(course)
        self.session.commit()
        return course

    def get_courses_by_teacher(self, teacher_id):
        return self.session.query(Course).filter(Course.teacher_id == teacher_id).all()

    def get_course_by_enroll_key(self, enroll_key):
        return self.session.query(Course).filter(Course.enroll_key == enroll_key).first()

    def add_module(self, course_id, title, order_index, description=None):
        module = Module(
            course_id=course_id,
            title=title,
            description=description,
            order_index=order_index
        )
        self.session.add(module)
        self.session.commit()
        return module

    def add_lesson(self, module_id, title, order_index, description=None, duration_minutes=None):
        lesson = Lesson(
            module_id=module_id,
            title=title,
            description=description,
            order_index=order_index,
            duration_minutes=duration_minutes
        )
        self.session.add(lesson)
        self.session.commit()
        return lesson

    # ==================== ОПЕРАЦИИ С ЗАДАНИЯМИ ====================

    def create_assignment(self, lesson_id, assignment_type, title, max_score,
                          description=None, content=None, deadline=None):
        assignment = Assignment(
            lesson_id=lesson_id,
            type=assignment_type,
            title=title,
            description=description,
            max_score=max_score,
            content=content or {},
            deadline=deadline
        )
        self.session.add(assignment)
        self.session.commit()

        self._update_total_assignments(lesson_id)

        return assignment

    def _update_total_assignments(self, lesson_id):
        lesson = self.session.query(Lesson).get(lesson_id)
        if lesson:
            module = lesson.module
            course = module.course

            total = self.session.query(Assignment).join(Lesson).join(Module).filter(
                Module.course_id == course.id
            ).count()

            grades = self.session.query(Grade).filter(Grade.course_id == course.id).all()
            for grade in grades:
                grade.total_assignments = total
            self.session.commit()

    # ==================== ОПЕРАЦИИ С РЕШЕНИЯМИ ====================

    def create_submission(self, assignment_id, student_id, solution_data):
        attempts = self.session.query(Submission).filter(
            Submission.assignment_id == assignment_id,
            Submission.student_id == student_id
        ).count()

        submission = Submission(
            assignment_id=assignment_id,
            student_id=student_id,
            solution_data=solution_data,
            attempt_number=attempts + 1
        )
        self.session.add(submission)
        self.session.commit()

        assignment = self.session.query(Assignment).get(assignment_id)
        if assignment and assignment.is_auto_grade:
            self.auto_grade_submission(submission.id)

        return submission

    def auto_grade_submission(self, submission_id):
        submission = self.session.query(Submission).get(submission_id)
        if not submission:
            return None

        assignment = submission.assignment

        score = 0
        feedback = "Автоматическая проверка: "

        if assignment.type == AssignmentType.CODE:
            if submission.solution_data and "print" in submission.solution_data:
                score = assignment.max_score
                feedback = "Код успешно выполнен!"
            else:
                feedback = "Ошибка: неверный код"
        elif assignment.type == AssignmentType.TEST:
            score = assignment.max_score // 2
            feedback = "Частично верно"
        elif assignment.type == AssignmentType.BLOCKS:
            score = assignment.max_score
            feedback = "Отлично!"

        submission.score = score
        submission.feedback = feedback
        submission.status = SubmissionStatus.CHECKED
        self.session.commit()

        self.update_student_grade(submission.student_id, assignment.lesson.module.course_id)

        self.create_notification(
            submission.student_id,
            "Задание проверено",
            f"Ваше решение '{assignment.title}' проверено. Оценка: {score}/{assignment.max_score}",
            "grade"
        )

        self.handle_submission_event(submission.id)

        return submission

    def manual_grade_submission(self, submission_id, score, feedback=None, checker_id=None):
        submission = self.session.query(Submission).get(submission_id)
        if submission:
            submission.score = score
            submission.feedback = feedback
            submission.status = SubmissionStatus.CHECKED
            submission.checked_by = checker_id
            self.session.commit()

            self.update_student_grade(submission.student_id,
                                      submission.assignment.lesson.module.course_id)

            self.handle_submission_event(submission.id)

            self.create_notification(
                submission.student_id,
                "Задание проверено",
                f"Ваше решение '{submission.assignment.title}' проверено. Оценка: {score}/{submission.assignment.max_score}",
                "grade"
            )

        return submission

    def update_student_grade(self, student_id, course_id):
        submissions = self.session.query(Submission).join(Assignment).join(Lesson).join(Module).filter(
            Submission.student_id == student_id,
            Module.course_id == course_id,
            Submission.status == SubmissionStatus.CHECKED
        ).all()

        total_score = sum(s.score or 0 for s in submissions)
        completed_count = len(submissions)

        total_assignments = self.session.query(Assignment).join(Lesson).join(Module).filter(
            Module.course_id == course_id
        ).count()

        avg_score = total_score // len(submissions) if submissions else 0

        grade = self.session.query(Grade).filter(
            Grade.student_id == student_id,
            Grade.course_id == course_id
        ).first()

        if grade:
            grade.total_score = total_score
            grade.completed_assignments = completed_count
            grade.total_assignments = total_assignments
            grade.average_score = avg_score
            grade.last_activity = datetime.utcnow()
        else:
            grade = Grade(
                student_id=student_id,
                course_id=course_id,
                total_score=total_score,
                completed_assignments=completed_count,
                total_assignments=total_assignments,
                average_score=avg_score
            )
            self.session.add(grade)

        self.session.commit()
        return grade

    # ==================== ОПЕРАЦИИ С КОММЕНТАРИЯМИ ====================

    def add_comment(self, user_id, assignment_id, content, parent_comment_id=None):
        comment = Comment(
            user_id=user_id,
            assignment_id=assignment_id,
            parent_comment_id=parent_comment_id,
            content=content
        )
        self.session.add(comment)
        self.session.commit()

        assignment = self.session.query(Assignment).get(assignment_id)
        if assignment:
            lesson = assignment.lesson
            course = lesson.module.course
            self.create_notification(
                course.teacher_id,
                "Новый комментарий",
                f"Новый комментарий к заданию '{assignment.title}' от {comment.user.full_name}",
                "comment"
            )

        return comment

    def get_assignment_comments(self, assignment_id):
        return self.session.query(Comment).filter(
            Comment.assignment_id == assignment_id
        ).order_by(Comment.created_at).all()

    # ==================== ОПЕРАЦИИ С СООБЩЕНИЯМИ ====================

    def send_message(self, sender_id, receiver_id, body, subject=None):
        message = Message(
            sender_id=sender_id,
            receiver_id=receiver_id,
            subject=subject,
            body=body
        )
        self.session.add(message)
        self.session.commit()

        self.create_notification(
            receiver_id,
            "Новое сообщение",
            f"Новое сообщение от {message.sender.full_name}",
            "message",
            f"/messages/{message.id}"
        )

        return message

    def get_user_messages(self, user_id, only_unread=False):
        query = self.session.query(Message).filter(
            Message.receiver_id == user_id,
            Message.is_deleted_by_receiver == False
        )

        if only_unread:
            query = query.filter(Message.is_read == False)

        return query.order_by(Message.created_at.desc()).all()

    def mark_message_as_read(self, message_id):
        message = self.session.query(Message).get(message_id)
        if message:
            message.is_read = True
            message.read_at = datetime.utcnow()
            self.session.commit()
        return message

    # ==================== ОПЕРАЦИИ С РОДИТЕЛЬСКИМ КОНТРОЛЕМ ====================

    def link_parent_to_student(self, parent_id, student_id):
        parent_student = ParentStudent(
            parent_id=parent_id,
            student_id=student_id
        )
        self.session.add(parent_student)
        self.session.commit()
        return parent_student

    def get_students_for_parent(self, parent_id):
        parent_students = self.session.query(ParentStudent).filter(
            ParentStudent.parent_id == parent_id
        ).all()
        return [ps.student for ps in parent_students]

    def get_parents_for_student(self, student_id):
        parent_students = self.session.query(ParentStudent).filter(
            ParentStudent.student_id == student_id
        ).all()
        return [ps.parent for ps in parent_students]

    def get_child_progress(self, parent_id, child_id):
        link = self.session.query(ParentStudent).filter(
            ParentStudent.parent_id == parent_id,
            ParentStudent.student_id == child_id
        ).first()

        if not link:
            return None

        grades = self.session.query(Grade).filter(
            Grade.student_id == child_id
        ).all()

        progress = []
        for grade in grades:
            course_data = {
                "course_id": grade.course_id,
                "course_title": grade.course.title,
                "total_score": grade.total_score,
                "completed_assignments": grade.completed_assignments,
                "total_assignments": grade.total_assignments,
                "progress_percentage": (grade.completed_assignments / grade.total_assignments * 100)
                if grade.total_assignments > 0 else 0,
                "last_activity": grade.last_activity
            }
            progress.append(course_data)

        return progress

    # ==================== УВЕДОМЛЕНИЯ ====================

    def create_notification(self, user_id, title, message, type, link=None):
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=type,
            link=link
        )
        self.session.add(notification)
        self.session.commit()
        return notification

    def get_user_notifications(self, user_id, only_unread=False, limit=50):
        query = self.session.query(Notification).filter(
            Notification.user_id == user_id
        ).order_by(Notification.created_at.desc())

        if only_unread:
            query = query.filter(Notification.is_read == False)

        return query.limit(limit).all()

    def mark_notification_as_read(self, notification_id):
        notification = self.session.query(Notification).get(notification_id)
        if notification:
            notification.is_read = True
            self.session.commit()
        return notification

    # ==================== СТАТИСТИКА И ЛИДЕРБОРДЫ ====================

    def get_course_leaderboard(self, course_id, limit=10):
        return self.session.query(Grade).filter(
            Grade.course_id == course_id
        ).join(User).filter(
            User.is_active == True
        ).order_by(Grade.total_score.desc()).limit(limit).all()

    def get_student_detailed_progress(self, student_id, course_id):
        grade = self.session.query(Grade).filter(
            Grade.student_id == student_id,
            Grade.course_id == course_id
        ).first()

        if not grade:
            return None

        submissions = self.session.query(Submission).join(Assignment).join(Lesson).join(Module).filter(
            Submission.student_id == student_id,
            Module.course_id == course_id
        ).order_by(Assignment.created_at).all()

        assignments_data = []
        for submission in submissions:
            assignment_data = {
                "assignment_id": submission.assignment_id,
                "title": submission.assignment.title,
                "max_score": submission.assignment.max_score,
                "score": submission.score,
                "status": submission.status.value,
                "submitted_at": submission.submitted_at,
                "feedback": submission.feedback
            }
            assignments_data.append(assignment_data)

        return {
            "course_title": grade.course.title,
            "total_score": grade.total_score,
            "completed_assignments": grade.completed_assignments,
            "total_assignments": grade.total_assignments,
            "average_score": grade.average_score,
            "progress_percentage": (grade.completed_assignments / grade.total_assignments * 100)
            if grade.total_assignments > 0 else 0,
            "last_activity": grade.last_activity,
            "assignments": assignments_data
        }

    def get_teacher_statistics(self, teacher_id):
        courses = self.session.query(Course).filter(Course.teacher_id == teacher_id).all()

        stats = {
            "total_courses": len(courses),
            "total_students": 0,
            "total_assignments": 0,
            "pending_submissions": 0,
            "courses_stats": []
        }

        for course in courses:
            students_count = self.session.query(Grade).filter(
                Grade.course_id == course.id
            ).count()

            assignments_count = self.session.query(Assignment).join(Lesson).join(Module).filter(
                Module.course_id == course.id
            ).count()

            pending = self.session.query(Submission).join(Assignment).join(Lesson).join(Module).filter(
                Module.course_id == course.id,
                Submission.status == SubmissionStatus.PENDING
            ).count()

            stats["total_students"] += students_count
            stats["total_assignments"] += assignments_count
            stats["pending_submissions"] += pending

            stats["courses_stats"].append({
                "course_id": course.id,
                "title": course.title,
                "students_count": students_count,
                "assignments_count": assignments_count,
                "pending_submissions": pending
            })

        return stats

    # ==================== СИСТЕМА АЧИВОК ====================

    def check_and_award_achievements(self, user_id, event_type, event_data=None):
        """Проверка и выдача ачивок при различных событиях"""
        user = self.session.query(User).get(user_id)
        if not user:
            return []

        user_stats = self.session.query(UserStats).filter(UserStats.user_id == user_id).first()
        if not user_stats:
            user_stats = self.create_user_stats(user_id)

        # Получаем только активные ачивки
        achievements = self.session.query(Achievement).filter(
            Achievement.is_active == True
        ).all()

        earned_ids = [ua.achievement_id for ua in self.session.query(UserAchievement).filter(
            UserAchievement.user_id == user_id,
            UserAchievement.completed_at.isnot(None)
        ).all()]

        awarded_achievements = []

        for achievement in achievements:
            if achievement.id in earned_ids:
                continue

            if self._check_achievement_condition(user_id, user_stats, achievement, event_type, event_data):
                user_achievement = self.award_achievement(user_id, achievement.id, event_data)
                if user_achievement:
                    awarded_achievements.append(user_achievement)

        return awarded_achievements

    def _check_achievement_condition(self, user_id, user_stats, achievement, event_type, event_data):
        """Проверка условия выполнения ачивки"""

        if achievement.condition_type == 'submissions':
            required = achievement.condition_value
            current = user_stats.total_submissions
            return current >= required

        elif achievement.condition_type == 'perfect_score':
            required = achievement.condition_value
            current = user_stats.perfect_scores
            return current >= required

        elif achievement.condition_type == 'streak':
            required = achievement.condition_value
            current = user_stats.current_streak
            return current >= required

        elif achievement.condition_type == 'course_complete':
            required = achievement.condition_value
            current = user_stats.completed_courses

            if achievement.condition_extra.get('course_id') and event_data:
                course_id = achievement.condition_extra['course_id']
                if event_data.get('course_id') == course_id:
                    return True
            return current >= required

        elif achievement.condition_type == 'total_score':
            required = achievement.condition_value

            total_score = self.session.query(func.sum(Submission.score)).filter(
                Submission.student_id == user_id,
                Submission.status == SubmissionStatus.CHECKED
            ).scalar() or 0

            return total_score >= required

        elif achievement.condition_type == 'assignment_score':
            if event_type == 'perfect_score' and event_data:
                assignment_id = event_data.get('assignment_id')
                required_assignment_id = achievement.condition_extra.get('assignment_id')
                if required_assignment_id and assignment_id == required_assignment_id:
                    return True
            return False

        elif achievement.condition_type == 'login_streak':
            required = achievement.condition_value
            return user_stats.current_streak >= required

        elif achievement.condition_type == 'early_bird':
            if event_type == 'login' and event_data:
                login_hour = event_data.get('hour', 0)
                required_hour = achievement.condition_extra.get('hour', 8)
                if login_hour < required_hour:
                    return True
            return False

        return False

    def award_achievement(self, user_id, achievement_id, earned_data=None):
        """Выдача ачивки пользователю"""
        existing = self.session.query(UserAchievement).filter(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id == achievement_id,
            UserAchievement.completed_at.isnot(None)
        ).first()

        if existing:
            return existing

        achievement = self.session.query(Achievement).get(achievement_id)
        if not achievement:
            return None

        user_achievement = UserAchievement(
            user_id=user_id,
            achievement_id=achievement_id,
            completed_at=datetime.utcnow(),
            earned_data=earned_data or {},
            progress=100
        )
        self.session.add(user_achievement)

        user_stats = self.session.query(UserStats).filter(UserStats.user_id == user_id).first()
        if user_stats:
            user_stats.total_achievements += 1
            user_stats.total_achievement_points += achievement.points_reward
            user_stats.total_xp += achievement.xp_reward
            user_stats.updated_at = datetime.utcnow()
        else:
            user_stats = UserStats(
                user_id=user_id,
                total_achievements=1,
                total_achievement_points=achievement.points_reward,
                total_xp=achievement.xp_reward
            )
            self.session.add(user_stats)

        self.session.commit()

        self.create_notification(
            user_id,
            f"Получено достижение: {achievement.name}",
            f"Вы получили достижение '{achievement.name}'! +{achievement.xp_reward} XP",
            "achievement",
            f"/achievements/{achievement.id}"
        )

        return user_achievement

    def update_achievement_progress(self, user_id, achievement_id, current_value):
        """Обновление прогресса по ачивке"""
        achievement = self.session.query(Achievement).get(achievement_id)
        if not achievement:
            return None

        progress = self.session.query(AchievementProgress).filter(
            AchievementProgress.user_id == user_id,
            AchievementProgress.achievement_id == achievement_id
        ).first()

        if not progress:
            progress = AchievementProgress(
                user_id=user_id,
                achievement_id=achievement_id,
                current_value=current_value,
                target_value=achievement.condition_value
            )
            self.session.add(progress)
        else:
            progress.current_value = current_value
            progress.last_updated = datetime.utcnow()

        if current_value >= achievement.condition_value and not progress.is_completed:
            progress.is_completed = True
            self.award_achievement(user_id, achievement_id)

        self.session.commit()
        return progress

    def create_user_stats(self, user_id):
        """Создание статистики пользователя"""
        stats = UserStats(user_id=user_id)
        self.session.add(stats)
        self.session.commit()
        return stats

    def update_user_stats(self, user_id, event_type, event_data=None):
        """Обновление статистики пользователя"""
        stats = self.session.query(UserStats).filter(UserStats.user_id == user_id).first()
        if not stats:
            stats = self.create_user_stats(user_id)

        now = datetime.utcnow()

        if event_type == 'submission':
            stats.total_submissions += 1

            if event_data and event_data.get('is_perfect', False):
                stats.perfect_scores += 1

            self._update_streak(stats, now)

        elif event_type == 'course_complete':
            stats.completed_courses += 1

        elif event_type == 'assignment_complete':
            stats.completed_assignments += 1

        elif event_type == 'login':
            self._update_streak(stats, now)

        if stats.total_submissions > 0:
            total_score = self.session.query(func.sum(Submission.score)).filter(
                Submission.student_id == user_id,
                Submission.status == SubmissionStatus.CHECKED
            ).scalar() or 0
            stats.average_score = total_score // stats.total_submissions

        stats.updated_at = now
        self.session.commit()

        return stats

    def _update_streak(self, stats, current_date):
        """Обновление серии активности"""
        if not stats.last_activity_date:
            stats.current_streak = 1
            stats.last_activity_date = current_date
            stats.last_streak_update = current_date
            stats.longest_streak = max(stats.longest_streak, stats.current_streak)
            return

        last_date = stats.last_activity_date.date()
        current_day = current_date.date()
        delta = (current_day - last_date).days

        if delta == 1:
            stats.current_streak += 1
            stats.longest_streak = max(stats.longest_streak, stats.current_streak)
        elif delta > 1:
            stats.current_streak = 1

        stats.last_activity_date = current_date
        stats.last_streak_update = current_date

    def get_user_achievements(self, user_id, category=None, only_earned=True):
        """Получение списка ачивок пользователя"""
        query = self.session.query(Achievement)

        if only_earned:
            query = query.join(UserAchievement).filter(
                UserAchievement.user_id == user_id,
                UserAchievement.completed_at.isnot(None)
            )
        else:
            query = query.outerjoin(UserAchievement).filter(
                UserAchievement.user_id == user_id
            )

        if category:
            query = query.filter(Achievement.category == category)

        achievements = query.all()

        result = []
        for ach in achievements:
            user_achievement = self.session.query(UserAchievement).filter(
                UserAchievement.user_id == user_id,
                UserAchievement.achievement_id == ach.id
            ).first()

            result.append({
                "id": ach.id,
                "name": ach.name,
                "description": ach.description,
                "icon_url": ach.icon_url,
                "badge_image": ach.badge_image,
                "category": ach.category,
                "rarity": ach.rarity,
                "xp_reward": ach.xp_reward,
                "points_reward": ach.points_reward,
                "is_secret": ach.is_secret,
                "earned": user_achievement is not None and user_achievement.completed_at is not None,
                "earned_at": user_achievement.completed_at if user_achievement else None,
                "progress": user_achievement.progress if user_achievement else 0,
                "condition_type": ach.condition_type,
                "condition_value": ach.condition_value
            })

        return result

    def get_achievement_leaderboard(self, limit=10):
        """Получение таблицы лидеров по очкам достижений"""
        return self.session.query(UserStats).join(User).filter(
            User.is_active == True,
            UserStats.total_achievement_points > 0
        ).order_by(
            UserStats.total_achievement_points.desc()
        ).limit(limit).all()

    def get_user_achievement_stats(self, user_id):
        """Получение статистики по ачивкам пользователя"""
        user_stats = self.session.query(UserStats).filter(UserStats.user_id == user_id).first()

        categories_stats = self.session.query(
            Achievement.category,
            func.count(UserAchievement.id).label('earned_count')
        ).outerjoin(
            UserAchievement,
            (Achievement.id == UserAchievement.achievement_id) &
            (UserAchievement.user_id == user_id) &
            (UserAchievement.completed_at.isnot(None))
        ).group_by(Achievement.category).all()

        rarity_stats = self.session.query(
            Achievement.rarity,
            func.count(UserAchievement.id).label('earned_count')
        ).outerjoin(
            UserAchievement,
            (Achievement.id == UserAchievement.achievement_id) &
            (UserAchievement.user_id == user_id) &
            (UserAchievement.completed_at.isnot(None))
        ).group_by(Achievement.rarity).all()

        total_achievements = self.session.query(Achievement).filter(
            Achievement.is_active == True
        ).count()

        return {
            "total_xp": user_stats.total_xp if user_stats else 0,
            "total_points": user_stats.total_achievement_points if user_stats else 0,
            "total_earned": user_stats.total_achievements if user_stats else 0,
            "total_available": total_achievements,
            "completion_percentage": (user_stats.total_achievements / total_achievements * 100)
            if user_stats and total_achievements > 0 else 0,
            "current_streak": user_stats.current_streak if user_stats else 0,
            "longest_streak": user_stats.longest_streak if user_stats else 0,
            "categories": [{"category": cat, "earned": count} for cat, count in categories_stats],
            "rarity": [{"rarity": rar, "earned": count} for rar, count in rarity_stats]
        }

    def get_next_achievements(self, user_id, limit=5):
        """Получение следующих достижений, которые можно получить"""
        user_stats = self.session.query(UserStats).filter(UserStats.user_id == user_id).first()

        earned_ids = [ua.achievement_id for ua in self.session.query(UserAchievement).filter(
            UserAchievement.user_id == user_id,
            UserAchievement.completed_at.isnot(None)
        ).all()]

        available_achievements = self.session.query(Achievement).filter(
            Achievement.is_active == True,
            ~Achievement.id.in_(earned_ids) if earned_ids else True
        ).order_by(
            Achievement.condition_value.asc()
        ).limit(limit).all()

        next_achievements = []
        for achievement in available_achievements:
            current_progress = self._get_current_progress(user_id, user_stats, achievement)

            next_achievements.append({
                "id": achievement.id,
                "name": achievement.name,
                "description": achievement.description,
                "icon_url": achievement.icon_url,
                "rarity": achievement.rarity,
                "xp_reward": achievement.xp_reward,
                "current_progress": current_progress,
                "target_value": achievement.condition_value,
                "progress_percentage": (current_progress / achievement.condition_value * 100)
                if achievement.condition_value > 0 else 0
            })

        return next_achievements

    def _get_current_progress(self, user_id, user_stats, achievement):
        """Получение текущего прогресса по ачивке"""
        if achievement.condition_type == 'submissions':
            return user_stats.total_submissions if user_stats else 0
        elif achievement.condition_type == 'perfect_score':
            return user_stats.perfect_scores if user_stats else 0
        elif achievement.condition_type == 'streak':
            return user_stats.current_streak if user_stats else 0
        elif achievement.condition_type == 'course_complete':
            return user_stats.completed_courses if user_stats else 0
        elif achievement.condition_type == 'total_score':
            total_score = self.session.query(func.sum(Submission.score)).filter(
                Submission.student_id == user_id,
                Submission.status == SubmissionStatus.CHECKED
            ).scalar() or 0
            return total_score
        else:
            return 0

    def handle_submission_event(self, submission_id):
        """Обработка события отправки решения"""
        submission = self.session.query(Submission).get(submission_id)
        if not submission:
            return

        self.update_user_stats(
            submission.student_id,
            'submission',
            {'is_perfect': submission.score == submission.assignment.max_score}
        )

        event_data = {
            'assignment_id': submission.assignment_id,
            'score': submission.score,
            'max_score': submission.assignment.max_score
        }

        if submission.score == submission.assignment.max_score:
            self.check_and_award_achievements(
                submission.student_id,
                'perfect_score',
                event_data
            )

        self.check_and_award_achievements(
            submission.student_id,
            'submission',
            event_data
        )

    def handle_course_complete_event(self, student_id, course_id):
        """Обработка события завершения курса"""
        self.update_user_stats(student_id, 'course_complete', {'course_id': course_id})

        self.check_and_award_achievements(
            student_id,
            'course_complete',
            {'course_id': course_id}
        )

    def handle_login_event(self, user_id):
        """Обработка события входа пользователя"""
        now = datetime.utcnow()

        self.update_user_stats(user_id, 'login')

        self.check_and_award_achievements(
            user_id,
            'login',
            {'hour': now.hour}
        )

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()


# Пример использования
if __name__ == "__main__":
    # Подключение к базе данных PostgreSQL
    db_manager = DatabaseManager()

    with EducationDB(db_manager) as db:
        # Создаем пользователей
        teacher = db.create_user(
            email="teacher@school.com",
            password_hash="hashed_password_123",
            role=UserRole.TEACHER,
            full_name="Иван Петрович Сидоров"
        )

        student = db.create_user(
            email="student@school.com",
            password_hash="hashed_password_456",
            role=UserRole.STUDENT,
            full_name="Анна Иванова"
        )

        parent = db.create_user(
            email="parent@family.com",
            password_hash="hashed_password_789",
            role=UserRole.PARENT,
            full_name="Елена Сидорова"
        )

        print(f"Созданы пользователи: {teacher.full_name}, {student.full_name}, {parent.full_name}")

        # Создаем статистику для студента
        db.create_user_stats(student.id)

        # Пример создания ачивки через менеджер
        achievement = db.achievement_manager.create_achievement(
            name="Первые шаги",
            description="Отправить первое решение",
            condition_type="submissions",
            condition_value=1,
            category="course",
            rarity="common",
            xp_reward=10,
            points_reward=5
        )

        print(f"Создана ачивка: {achievement.name}")

        # Получаем все ачивки
        all_achievements = db.achievement_manager.get_all_achievements()
        print(f"Всего ачивок: {len(all_achievements)}")

        # Обновляем ачивку
        db.achievement_manager.update_achievement(
            achievement.id,
            description="Отправить первое решение в системе",
            xp_reward=20
        )

        # Создаем курс
        course = db.create_course(
            teacher_id=teacher.id,
            title="Python программирование",
            description="Изучение основ Python",
            enroll_key="PY2024"
        )

        # Добавляем модуль
        module = db.add_module(
            course_id=course.id,
            title="Введение",
            order_index=1,
            description="Знакомство с Python"
        )

        # Добавляем урок
        lesson = db.add_lesson(
            module_id=module.id,
            title="Первая программа",
            order_index=1,
            description="Написание Hello World",
            duration_minutes=30
        )

        # Создаем задание
        assignment = db.create_assignment(
            lesson_id=lesson.id,
            assignment_type=AssignmentType.CODE,
            title="Hello World",
            max_score=100,
            description="Напишите программу, которая выводит 'Hello, World!'",
            content={
                "test_cases": ["Hello, World!"],
                "starter_code": "print('')",
                "hints": ["Используйте функцию print()"]
            }
        )

        print(f"Создан курс: {course.title}")

        # Симулируем вход пользователя
        db.handle_login_event(student.id)

        # Студент отправляет решение
        submission = db.create_submission(
            assignment_id=assignment.id,
            student_id=student.id,
            solution_data="print('Hello, World!')"
        )

        # Учитель проверяет решение
        db.manual_grade_submission(
            submission_id=submission.id,
            score=100,
            feedback="Отлично! Правильное решение.",
            checker_id=teacher.id
        )

        # Привязываем родителя к ученику
        db.link_parent_to_student(parent.id, student.id)

        # Получаем ачивки пользователя
        achievements = db.get_user_achievements(student.id, only_earned=True)
        print(f"Полученные ачивки: {len(achievements)}")
        for ach in achievements:
            print(f"  - {ach['name']}: {ach['description']}")

        # Получаем статистику ачивок
        achievement_stats = db.get_user_achievement_stats(student.id)
        print(f"Статистика ачивок: {achievement_stats}")

        # Получаем следующие достижения
        next_achievements = db.get_next_achievements(student.id)
        print(f"Следующие достижения: {next_achievements}")

        # Экспортируем ачивки в JSON
        db.achievement_manager.export_achievements_to_json("achievements_export.json")
        print("Ачивки экспортированы в achievements_export.json")

        # Импортируем ачивки из JSON (если файл существует)
        # db.achievement_manager.import_achievements_from_json("achievements.json")

    db_manager.close()
    print("База данных успешно настроена и протестирована!")