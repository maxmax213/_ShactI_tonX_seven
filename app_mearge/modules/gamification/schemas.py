from pydantic import BaseModel, ConfigDict, Field

from app.shared.enums import AchievementRarity


class AchievementCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=120)
    title: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=2, max_length=2000)
    rarity: AchievementRarity
    xp_reward: int = Field(default=0, ge=0)


class AchievementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    description: str
    rarity: AchievementRarity
    xp_reward: int


class UserAchievementRead(BaseModel):
    achievement_id: int
    slug: str
    title: str
    rarity: AchievementRarity
    xp_reward: int


class LeaderboardEntry(BaseModel):
    user_id: int
    full_name: str
    xp: int
    level: int
    streak: int
    rank: int
