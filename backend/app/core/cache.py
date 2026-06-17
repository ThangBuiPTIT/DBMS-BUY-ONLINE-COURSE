"""Redis cache layer — optional, gated by settings.REDIS_ENABLED."""
from __future__ import annotations

import json
from typing import Any

from app.core.config import settings


class RedisCache:
    """Async Redis client wrapper. All methods are no-op when REDIS_ENABLED=False."""

    def __init__(self):
        self._redis = None
        self._enabled = settings.REDIS_ENABLED
        self._hits = 0
        self._misses = 0

    def stats(self) -> dict:
        total = self._hits + self._misses
        return {
            "hits": self._hits, "misses": self._misses,
            "hit_rate_pct": round(self._hits / total * 100, 2) if total > 0 else 0.0,
            "total_requests": total, "enabled": self._enabled,
        }

    def _record_hit(self): self._hits += 1
    def _record_miss(self): self._misses += 1

    async def connect(self) -> None:
        if not self._enabled:
            return
        import redis.asyncio as aioredis
        self._redis = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        await self._redis.ping()

    async def disconnect(self) -> None:
        if self._redis:
            await self._redis.close()
            self._redis = None

    @property
    def enabled(self) -> bool:
        return self._enabled and self._redis is not None

    # ── Generic get/set ──

    async def get(self, key: str) -> Any | None:
        if not self.enabled:
            return None
        data = await self._redis.get(key)
        return json.loads(data) if data else None

    async def set(self, key: str, value: Any, ttl: int = 3600) -> None:
        if not self.enabled:
            return
        await self._redis.setex(key, ttl, json.dumps(value, default=str))

    async def delete(self, key: str) -> None:
        if not self.enabled:
            return
        await self._redis.delete(key)

    async def delete_pattern(self, pattern: str) -> None:
        if not self.enabled:
            return
        keys = await self._redis.keys(pattern)
        if keys:
            await self._redis.delete(*keys)

    # ── Session cache ──

    async def get_session(self, session_key: str) -> dict | None:
        return await self.get(f"session:{session_key}")

    async def set_session(self, session_key: str, user_data: dict, ttl: int) -> None:
        await self.set(f"session:{session_key}", user_data, ttl)

    async def delete_session(self, session_key: str) -> None:
        await self.delete(f"session:{session_key}")

    # ── Dictionary cache ──

    async def get_dict_search(self, keyword: str) -> list[dict] | None:
        return await self.get(f"dict:search:{keyword.lower()}")

    async def set_dict_search(self, keyword: str, entries: list[dict]) -> None:
        await self.set(f"dict:search:{keyword.lower()}", entries, ttl=3600)

    # ── Leaderboard cache (Redis Sorted Set) ──

    async def update_leaderboard(self, entries: list[dict]) -> None:
        """Cập nhật ZSET leaderboard (O(N) rebuild)."""
        if not self.enabled:
            return
        pipe = self._redis.pipeline()
        key = "leaderboard:streaks"
        pipe.delete(key)
        for entry in entries:
            pipe.zadd(key, {entry["full_name"]: entry["current_streak"]})
        await pipe.execute()
        await self._redis.expire(key, 3600)

    async def get_top_learners(self, limit: int = 20) -> list[dict]:
        """Lấy top learners từ ZSET (O(log N))."""
        if not self.enabled:
            return []
        result = await self._redis.zrevrange(
            "leaderboard:streaks", 0, limit - 1, withscores=True
        )
        return [{"full_name": name, "current_streak": int(score)} for name, score in result]


# Singleton
cache = RedisCache()
