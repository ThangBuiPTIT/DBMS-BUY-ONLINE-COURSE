"""Advisory-lock-guarded singleton cron tasks for periodic maintenance."""
import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache
from app.core.database import async_session

# Well-known lock IDs — consistent across all app instances
LOCK_ID_REFRESH_LEADERBOARD = 42
LOCK_ID_RESET_STREAKS = 43
LOCK_ID_CLEANUP_SESSIONS = 44


async def try_acquire_advisory_lock(db: AsyncSession, lock_id: int) -> bool:
    """Attempt to acquire a session-level advisory lock. Returns True on success."""
    result = await db.execute(
        text("SELECT pg_try_advisory_lock(:id)"), {"id": lock_id}
    )
    return result.scalar()


async def release_advisory_lock(db: AsyncSession, lock_id: int) -> None:
    """Release a session-level advisory lock."""
    await db.execute(
        text("SELECT pg_advisory_unlock(:id)"), {"id": lock_id}
    )


async def run_singleton_task(lock_id: int, task_name: str, coro):
    """Execute coro with advisory lock — only one instance runs it."""
    async with async_session() as db:
        acquired = await try_acquire_advisory_lock(db, lock_id)
        if not acquired:
            print(f"[Cron] {task_name}: skipped (another instance is running)")
            return
        try:
            print(f"[Cron] {task_name}: running...")
            await coro(db)
            print(f"[Cron] {task_name}: done")
        except Exception as e:
            print(f"[Cron] {task_name}: failed — {e}")
        finally:
            await release_advisory_lock(db, lock_id)


# ── Task implementations ──

async def refresh_leaderboard_task(db: AsyncSession):
    """Refresh mv_leaderboard + sync Redis ZSET."""
    await db.execute(
        text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard")
    )
    await db.commit()
    if cache.enabled:
        from app.services.gamification import refresh_leaderboard
        await refresh_leaderboard(db)


async def cleanup_expired_sessions(db: AsyncSession):
    """Remove expired authentication sessions."""
    await db.execute(
        text("DELETE FROM authentication_sessions WHERE expires_at < NOW()")
    )
    await db.commit()


async def reset_broken_streaks(db: AsyncSession):
    """Reset streaks for students inactive > 7 days."""
    await db.execute(
        text("""
            UPDATE student_streaks SET current_streak = 0
            WHERE last_activity_date < CURRENT_DATE - INTERVAL '7 days'
              AND current_streak > 0
        """)
    )
    await db.commit()
