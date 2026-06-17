from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.services import microlearning as microlearning_service

router = APIRouter(prefix="/api/microlearning", tags=["Microlearning"])


@router.get("/roadmap")
async def get_roadmap(db: AsyncSession = Depends(get_db)):
    return await microlearning_service.get_roadmap(db)


@router.get("/lessons/{lesson_id}/parts")
async def get_lesson_parts(lesson_id: str, db: AsyncSession = Depends(get_db)):
    if not lesson_id:
        raise HTTPException(400, "Thiếu Lesson ID")
    return await microlearning_service.get_lesson_parts(db, lesson_id)


@router.get("/parts/{part_id}/questions")
async def get_part_questions(part_id: str, db: AsyncSession = Depends(get_db)):
    if not part_id:
        raise HTTPException(400, "Thiếu Part ID")
    return await microlearning_service.get_part_questions(db, part_id)
