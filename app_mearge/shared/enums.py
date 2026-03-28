from enum import StrEnum


class UserRole(StrEnum):
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"


class AssignmentType(StrEnum):
    BLOCKS = "blocks"
    PYTHON = "python"
    TEST = "test"


class SubmissionStatus(StrEnum):
    PENDING = "pending"
    CHECKED = "checked"
    NEEDS_REWORK = "needs_rework"


class AchievementRarity(StrEnum):
    COMMON = "common"
    RARE = "rare"
    EPIC = "epic"

