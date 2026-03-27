import os
import json
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON, UniqueConstraint, \
    Boolean, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from dotenv import load_dotenv
import enum


try:
    load_dotenv(encoding="utf-8")
except UnicodeDecodeError:
    load_dotenv(encoding="cp1251")

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


