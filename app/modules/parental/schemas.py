from datetime import datetime

from pydantic import BaseModel

from app.shared.enums import AchievementRarity, AssignmentType, SubmissionStatus


class ChildProgress(BaseModel):
    student_id: int
    student_name: str
    xp: int
    level: int
    streak: int
    achievements_count: int
    active_courses_count: int
    total_submissions: int
    average_score: float


class ChildAchievement(BaseModel):
    achievement_id: int
    slug: str
    title: str
    description: str
    rarity: AchievementRarity
    xp_reward: int


class ChildSubmissionInfo(BaseModel):
    submission_id: int
    assignment_id: int
    title: str
    assignment_type: AssignmentType
    attempt: int
    status: SubmissionStatus
    score: int | None
    max_score: int
    updated_at: datetime


class ChildDetail(BaseModel):
    student_id: int
    student_name: str
    xp: int
    level: int
    streak: int
    achievements_count: int
    active_courses_count: int
    total_submissions: int
    average_score: float
    achievements: list[ChildAchievement]
    submissions: list[ChildSubmissionInfo]
