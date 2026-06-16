from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
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
