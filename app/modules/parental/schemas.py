from pydantic import BaseModel


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
