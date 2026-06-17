"""Database locking helpers for pessimistic/optimistic locking."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def lock_wallet_for_update(db: AsyncSession, user_id: str) -> dict | None:
    """Acquire pessimistic lock on wallet row. Returns (balance, updated_at)."""
    result = await db.execute(
        text("SELECT balance, updated_at FROM wallets WHERE user_id = :uid FOR UPDATE"),
        {"uid": user_id},
    )
    row = result.mappings().first()
    if row is None:
        return None
    return {"balance": float(row["balance"]), "updated_at": row["updated_at"]}


async def lock_course_for_update(db: AsyncSession, course_id: str) -> dict | None:
    """Acquire pessimistic lock on course row."""
    result = await db.execute(
        text("""
            SELECT course_id, title, price, visibility_status, updated_at
            FROM general_courses
            WHERE course_id = :cid AND is_deleted = FALSE
            FOR UPDATE
        """),
        {"cid": course_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def fetch_notifications_skip_locked(
    db: AsyncSession, batch_size: int = 100
) -> list[dict]:
    """Worker queue: get unread notifications without blocking other workers.
    Uses SKIP LOCKED so each worker gets a disjoint batch."""
    result = await db.execute(
        text("""
            SELECT notification_id::text, user_id::text, title, message
            FROM notification_users
            WHERE is_read = FALSE
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT :limit
        """),
        {"limit": batch_size},
    )
    return [dict(row) for row in result.mappings()]
