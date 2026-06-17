from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_db
from app.models.user import User
from app.schemas.gamification import (
    AchievementCreateRequest,
    AwardAchievementRequest,
)
from app.services import gamification as gamification_service

router = APIRouter(prefix="/api/gamification", tags=["Gamification"])


@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = Query(20, gt=0),
    db: AsyncSession = Depends(get_db),
):
    entries = await gamification_service.get_leaderboard(db, limit)
    return {"leaderboard": entries, "total": len(entries)}


@router.get("/streak/{student_id}")
async def get_student_streak(student_id: str, db: AsyncSession = Depends(get_db)):
    if not student_id:
        raise HTTPException(400, "Thiếu student_id")
    return await gamification_service.get_student_streak(db, student_id)


# ── Phase 3: Achievements ──

@router.get("/achievements")
async def get_achievements(db: AsyncSession = Depends(get_db)):
    return await gamification_service.get_all_achievements(db)


@router.get("/users/{user_id}/achievements")
async def get_user_achievements(user_id: str, db: AsyncSession = Depends(get_db)):
    return await gamification_service.get_user_achievements(db, user_id)


@router.post("/achievements/award")
async def award_achievement(
    req: AwardAchievementRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    try:
        return await gamification_service.award_achievement(
            db, req.user_id, req.achievement_id
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/achievements", status_code=201)
async def create_achievement(
    req: AchievementCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    return await gamification_service.create_achievement(
        db, req.title, req.description, req.icon_url
    )


@router.post("/streak/{student_id}/sync")
async def sync_streak(student_id: str, db: AsyncSession = Depends(get_db)):
    return await gamification_service.sync_student_streak(db, student_id)


# ── Phase 5: Leaderboard refresh (admin only) ──

@router.post("/leaderboard/refresh")
async def refresh_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    await gamification_service.refresh_leaderboard(db)
    return {"message": "Leaderboard refreshed successfully"}
