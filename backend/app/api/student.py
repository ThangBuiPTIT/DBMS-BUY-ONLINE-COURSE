from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.services import student as student_service

router = APIRouter(prefix="/api/students", tags=["Student"])


@router.get("/search")
async def search_students(
    keyword: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    return await student_service.search_students(db, keyword)


@router.get("/progress")
async def get_progress(db: AsyncSession = Depends(get_db)):
    return await student_service.get_progress_report(db)


@router.get("/inactive")
async def get_inactive(db: AsyncSession = Depends(get_db)):
    return await student_service.get_inactive_students(db)
