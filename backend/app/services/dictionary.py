from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def search_entries(db: AsyncSession, keyword: str) -> list[dict]:
    """Search dictionary entries (ILIKE on word and meaning) with batch variations."""
    result = await db.execute(
        text("""
            SELECT
                e.entry_id::text,
                e.category_id,
                COALESCE(c.name, '') AS category_name,
                e.word,
                e.meaning,
                e.updated_at
            FROM dictionary_entries e
            LEFT JOIN dictionary_categories c ON e.category_id = c.category_id
            WHERE e.is_deleted = FALSE
              AND (:kw = '' OR e.word ILIKE '%' || :kw || '%' OR e.meaning ILIKE '%' || :kw || '%')
            ORDER BY
                CASE WHEN LOWER(e.word) = LOWER(:kw) THEN 0
                     WHEN LOWER(e.word) LIKE LOWER(:kw) || '%' THEN 1
                     ELSE 2 END,
                e.word ASC
            LIMIT 30
        """),
        {"kw": keyword},
    )
    entries = [dict(row) for row in result.mappings()]
    entry_ids = [e["entry_id"] for e in entries]

    # Batch fetch variations (avoid N+1)
    variations_map: dict[str, list] = {eid: [] for eid in entry_ids}
    if entry_ids:
        # Build IN clause with placeholders
        placeholders = ", ".join(f":eid{i}" for i in range(len(entry_ids)))
        params = {f"eid{i}": eid for i, eid in enumerate(entry_ids)}
        var_result = await db.execute(
            text(f"""
                SELECT
                    variation_id::text,
                    entry_id::text,
                    COALESCE(region, '') AS region,
                    video_url,
                    COALESCE(description, '') AS description
                FROM dictionary_variations
                WHERE entry_id IN ({placeholders})
                ORDER BY region ASC
            """),
            params,
        )
        for row in var_result.mappings():
            row_dict = dict(row)
            eid = row_dict.pop("entry_id")
            variations_map[eid].append(row_dict)

    for entry in entries:
        entry["variations"] = variations_map.get(entry["entry_id"], [])

    return entries


async def get_categories(db: AsyncSession) -> list[dict]:
    """Get dictionary categories."""
    result = await db.execute(
        text("SELECT category_id, name, COALESCE(description, '') AS description FROM dictionary_categories ORDER BY name ASC")
    )
    return [dict(row) for row in result.mappings()]


async def get_variations(db: AsyncSession, entry_id: str) -> list[dict]:
    """Get variations for a dictionary entry."""
    result = await db.execute(
        text("""
            SELECT
                variation_id::text,
                entry_id::text,
                COALESCE(region, '') AS region,
                video_url,
                COALESCE(description, '') AS description
            FROM dictionary_variations
            WHERE entry_id = :eid
            ORDER BY region ASC
        """),
        {"eid": entry_id},
    )
    return [dict(row) for row in result.mappings()]
