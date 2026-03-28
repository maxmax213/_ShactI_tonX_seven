from pydantic import BaseModel, ConfigDict, Field


class LessonSurveySubmit(BaseModel):
    clarity_rating: int = Field(ge=1, le=5)
    difficulty_rating: int = Field(ge=1, le=5)
    interest_rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class LessonSurveyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lesson_id: int
    student_id: int
    clarity_rating: int
    difficulty_rating: int
    interest_rating: int
    comment: str | None


class LessonSurveySummary(BaseModel):
    lesson_id: int
    responses_count: int
    avg_clarity: float
    avg_difficulty: float
    avg_interest: float
