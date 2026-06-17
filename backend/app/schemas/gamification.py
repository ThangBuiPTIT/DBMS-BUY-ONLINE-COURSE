from datetime import datetime

from pydantic import BaseModel, Field


class LeaderboardEntry(BaseModel):
    rank: int
    full_name: str
    avatar_url: str
    current_streak: int
    highest_streak: int
    total_achievements: int

    model_config = {"from_attributes": True}


class LeaderboardResponse(BaseModel):
    leaderboard: list[LeaderboardEntry]
    total: int


class StudentStreakResponse(BaseModel):
    student_id: str
    current_streak: int
    highest_streak: int
    last_activity_date: str | None = None

    model_config = {"from_attributes": True}


# ── Phase 3: Achievements ──

class AchievementResponse(BaseModel):
    achievement_id: int
    title: str
    description: str
    icon_url: str | None

    model_config = {"from_attributes": True}


class AchievementCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1)
    icon_url: str = ""


class UserAchievementResponse(BaseModel):
    achievement_id: int
    title: str
    description: str
    icon_url: str | None
    earned_at: datetime

    model_config = {"from_attributes": True}


class AwardAchievementRequest(BaseModel):
    user_id: str
    achievement_id: int


class StreakSyncResponse(BaseModel):
    student_id: str
    current_streak: int
    highest_streak: int
    last_activity_date: str | None
    streak_updated: bool
