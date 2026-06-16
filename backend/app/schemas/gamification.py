from pydantic import BaseModel


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
