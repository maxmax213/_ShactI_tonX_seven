from pydantic import BaseModel, ConfigDict, Field


class CourseCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str | None = None


class CourseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    title: str
    description: str | None
    enroll_code: str
    is_published: bool


class ModuleCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str | None = None
    order_index: int = Field(ge=1)


class ModuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    description: str | None
    order_index: int


class LessonCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    theory_text: str | None = None
    order_index: int = Field(ge=1)


class LessonRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    module_id: int
    title: str
    theory_text: str | None
    order_index: int


class AssignmentTreeRead(BaseModel):
    id: int
    title: str
    assignment_type: str
    max_score: int


class LessonTreeRead(BaseModel):
    id: int
    title: str
    theory_text: str | None
    order_index: int
    assignments: list[AssignmentTreeRead]


class ModuleTreeRead(BaseModel):
    id: int
    title: str
    description: str | None
    order_index: int
    lessons: list[LessonTreeRead]


class CourseTreeRead(BaseModel):
    id: int
    title: str
    description: str | None
    enroll_code: str
    is_published: bool
    modules: list[ModuleTreeRead]
