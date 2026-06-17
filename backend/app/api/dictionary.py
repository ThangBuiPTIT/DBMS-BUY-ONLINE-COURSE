from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.services import dictionary as dictionary_service

router = APIRouter(prefix="/api/dictionary", tags=["Dictionary"])


@router.get("/search")
async def search_entries(
    word: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    entries = await dictionary_service.search_entries(db, word)
    return {"entries": entries, "total": len(entries), "keyword": word}


@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    return await dictionary_service.get_categories(db)


@router.get("/entries/{entry_id}/variations")
async def get_variations(entry_id: str, db: AsyncSession = Depends(get_db)):
    if not entry_id:
        raise HTTPException(400, "Thiếu entry_id")
    variations = await dictionary_service.get_variations(db, entry_id)
    return {"entry_id": entry_id, "variations": variations, "total": len(variations)}
