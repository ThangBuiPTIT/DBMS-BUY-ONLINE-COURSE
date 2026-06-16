from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache


async def get_leaderboard(db: AsyncSession, limit: int = 20) -> list[dict]:
    """Get top learners leaderboard — ưu tiên Redis ZSET, fallback Materialized View."""
    # Try Redis ZSET first
    if cache.enabled:
        redis_entries = await cache.get_top_learners(limit)
        if redis_entries:
            return [
                {"rank": i + 1, **entry} for i, entry in enumerate(redis_entries)
            ]

    # Fallback to Materialized View
    try:
        result = await db.execute(
            text("SELECT * FROM mv_leaderboard ORDER BY rank ASC LIMIT :limit"),
            {"limit": limit},
        )
        return [dict(row) for row in result.mappings()]
    except Exception:
        # Fallback to view if mv doesn't exist yet
        result = await db.execute(
            text("""
                SELECT
                    full_name,
                    COALESCE(avatar_url, '') AS avatar_url,
                    current_streak,
                    highest_streak,
                    total_achievements
                FROM vw_top_learners_leaderboard
                LIMIT :limit
            """),
            {"limit": limit},
        )
        entries = []
        for rank, row in enumerate(result.mappings(), start=1):
            entry = dict(row)
            entry["rank"] = rank
            entries.append(entry)
        return entries


async def refresh_leaderboard(db: AsyncSession) -> None:
    """Refresh materialized view + Redis cache. Gọi định kỳ hoặc sau khi sync streak."""
    await db.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard"))
    await db.commit()

    # Đồng bộ Redis ZSET
    if cache.enabled:
        result = await db.execute(text("SELECT * FROM mv_leaderboard ORDER BY rank ASC"))
        await cache.update_leaderboard([dict(row) for row in result.mappings()])


async def get_student_streak(db: AsyncSession, student_id: str) -> dict:
    """Get student streak info."""
    result = await db.execute(
        text("""
            SELECT student_id::text, current_streak, highest_streak,
                   last_activity_date::text
            FROM student_streaks
            WHERE student_id = :sid
        """),
        {"sid": student_id},
    )
    row = result.mappings().first()
    if row is None:
        return {
            "student_id": student_id,
            "current_streak": 0,
            "highest_streak": 0,
            "last_activity_date": None,
        }
    return dict(row)


# ── Phase 3: Achievements ──

async def get_all_achievements(db: AsyncSession) -> list[dict]:
    """Liệt kê tất cả achievements."""
    result = await db.execute(
        text("SELECT achievement_id, title, description, COALESCE(icon_url, '') AS icon_url FROM achievements ORDER BY achievement_id")
    )
    return [dict(row) for row in result.mappings()]


async def get_user_achievements(db: AsyncSession, user_id: str) -> list[dict]:
    """Xem achievements của một user."""
    result = await db.execute(
        text("""
            SELECT a.achievement_id, a.title, a.description,
                   COALESCE(a.icon_url, '') AS icon_url, ua.earned_at
            FROM user_achievements ua
            JOIN achievements a ON ua.achievement_id = a.achievement_id
            WHERE ua.user_id = :uid
            ORDER BY ua.earned_at DESC
        """),
        {"uid": user_id},
    )
    return [dict(row) for row in result.mappings()]


async def award_achievement(db: AsyncSession, user_id: str, achievement_id: int) -> dict:
    """Trao achievement cho user. Không duplicate (ON CONFLICT DO NOTHING)."""
    # Kiểm tra achievement tồn tại
    ach_result = await db.execute(
        text("SELECT title, description FROM achievements WHERE achievement_id = :aid"),
        {"aid": achievement_id},
    )
    ach = ach_result.mappings().first()
    if not ach:
        raise ValueError("Achievement không tồn tại")

    await db.execute(
        text("""
            INSERT INTO user_achievements (user_id, achievement_id)
            VALUES (:uid, :aid)
            ON CONFLICT (user_id, achievement_id) DO NOTHING
        """),
        {"uid": user_id, "aid": achievement_id},
    )
    await db.commit()

    return {
        "user_id": user_id,
        "achievement_id": achievement_id,
        "title": ach["title"],
        "message": "Trao achievement thành công",
    }


async def create_achievement(db: AsyncSession, title: str, description: str, icon_url: str = "") -> dict:
    """Tạo achievement mới (Admin)."""
    result = await db.execute(
        text("""
            INSERT INTO achievements (title, description, icon_url)
            VALUES (:t, :d, :i)
            RETURNING achievement_id
        """),
        {"t": title, "d": description, "i": icon_url or None},
    )
    achievement_id = result.scalar()
    await db.commit()
    return {"achievement_id": achievement_id, "title": title, "description": description}


# ── Phase 3: Streak Sync ──

async def sync_student_streak(db: AsyncSession, student_id: str) -> dict:
    """Đồng bộ streak khi student có hoạt động học. Gọi sau khi update progress."""
    today = date.today()

    result = await db.execute(
        text("SELECT current_streak, highest_streak, last_activity_date FROM student_streaks WHERE student_id = :sid"),
        {"sid": student_id},
    )
    streak = result.mappings().first()

    if not streak:
        # Tạo mới nếu trigger chưa chạy
        await db.execute(
            text("INSERT INTO student_streaks (student_id, current_streak, highest_streak, last_activity_date) VALUES (:sid, 1, 1, :today) ON CONFLICT (student_id) DO NOTHING"),
            {"sid": student_id, "today": today},
        )
        await db.commit()
        return {
            "student_id": student_id,
            "current_streak": 1,
            "highest_streak": 1,
            "last_activity_date": str(today),
            "streak_updated": True,
        }

    current = streak["current_streak"]
    highest = streak["highest_streak"]
    last_date = streak["last_activity_date"]
    updated = False

    if last_date is None:
        # Lần đầu có hoạt động
        current = 1
        highest = 1
        updated = True
    elif last_date == today:
        # Đã có hoạt động hôm nay → không đổi
        pass
    elif last_date == today - timedelta(days=1):
        # Ngày liên tiếp → tăng streak
        current += 1
        if current > highest:
            highest = current
        updated = True
    else:
        # Đứt streak → reset
        current = 1
        updated = True

    if updated:
        await db.execute(
            text("UPDATE student_streaks SET current_streak = :cur, highest_streak = :high, last_activity_date = :today WHERE student_id = :sid"),
            {"cur": current, "high": highest, "today": today, "sid": student_id},
        )
        await db.commit()

    return {
        "student_id": student_id,
        "current_streak": current,
        "highest_streak": highest,
        "last_activity_date": str(today),
        "streak_updated": updated,
    }
