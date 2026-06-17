"""Redis cache invalidation hooks — called when data changes."""
from app.core.cache import cache


async def invalidate_course_catalog():
    """Call when: course publish/unpublish, create, delete, price change."""
    await cache.delete("catalog:courses:published")
    await cache.delete_pattern("catalog:course:*")


async def invalidate_course_detail(course_id: str):
    """Call when: course title/description/price changes."""
    await cache.delete(f"catalog:course:{course_id}")


async def invalidate_dictionary_cache(keyword: str | None = None):
    """Call when: dictionary entry added/modified/deleted."""
    if keyword:
        await cache.delete(f"dict:search:{keyword.lower()}")
    else:
        await cache.delete_pattern("dict:search:*")


async def invalidate_leaderboard_cache():
    """Call when: streak changes, achievement awarded."""
    await cache.delete("leaderboard:streaks")
