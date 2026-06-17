"""PostgreSQL buffer pool monitoring — cache hit ratio metrics."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_cache_hit_ratio(db: AsyncSession) -> dict:
    """Get overall cache hit ratio across all user tables."""
    result = await db.execute(text("""
        SELECT
            SUM(heap_blks_read)::float AS disk_reads,
            SUM(heap_blks_hit)::float AS cache_hits,
            ROUND(100.0 * SUM(heap_blks_hit) /
                  NULLIF(SUM(heap_blks_hit + heap_blks_read), 0), 2) AS hit_ratio_pct
        FROM pg_statio_user_tables
    """))
    row = result.mappings().first()
    return {
        "disk_reads": int(row["disk_reads"] or 0),
        "cache_hits": int(row["cache_hits"] or 0),
        "hit_ratio_pct": float(row["hit_ratio_pct"] or 0),
    }


async def get_tables_needing_prewarm(db: AsyncSession, limit: int = 10) -> list[dict]:
    """Find tables with low cache hit ratio — candidates for pg_prewarm."""
    result = await db.execute(text("""
        SELECT relname AS table_name, heap_blks_read AS disk_reads,
               ROUND(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) AS hit_pct,
               pg_size_pretty(pg_relation_size(relid)) AS table_size
        FROM pg_statio_user_tables
        WHERE heap_blks_hit + heap_blks_read > 100
        ORDER BY heap_blks_read DESC LIMIT :limit
    """), {"limit": limit})
    return [dict(row) for row in result.mappings()]
