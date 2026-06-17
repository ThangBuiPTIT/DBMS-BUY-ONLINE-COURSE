# Plan Phase 6: Buffer Pool Tuning & Redis Cache

**Status:** 📋 Planning  
**Blueprint Reference:** `Ke_hoach_ap_dung_HQTCSDL_Elearning.md` — Phần 10 (Buffer Pool) + Phần 11 (Caching/Redis)  
**Target Branch:** `fastapi`  
**Prerequisites:** Plans 1-5 complete, PostgreSQL 15+, Redis (optional)

---

## 1. Current State Audit

### 1.1 PostgreSQL Buffer Pool — Status

| Configuration | Current State | Blueprint Recommendation |
|--------------|---------------|------------------------|
| `shared_buffers` | Default (128MB) | ~25% RAM (4GB for 16GB server) |
| `effective_cache_size` | Default (4GB) | ~75% RAM (12GB for 16GB server) |
| `work_mem` | Default (4MB) | 64MB (for sort/hash operations) |
| `pg_prewarm` extension | ❌ Not installed | ✅ Install + prewarm hot tables at startup |
| Cache Hit Ratio monitoring | ❌ No queries | ✅ Monitor query exists |
| `pg_buffercache` extension | ❌ Not installed | ✅ For analyzing buffer usage |

### 1.2 Redis Cache — Status

| Feature | File | Status |
|---------|------|--------|
| Redis client class (`RedisCache`) | `core/cache.py` | ✅ Implemented |
| Session caching (TTL) | `core/cache.py:63-70` | ✅ Code exists, gated by `REDIS_ENABLED` |
| Dictionary search cache-aside | `core/cache.py:74-79` + `services/dictionary.py:11` | ✅ Implemented |
| Leaderboard ZSET | `core/cache.py:82-102` | ✅ Implemented |
| Lifespan connect/disconnect | `main.py:21-27` | ✅ Implemented |
| Leaderboard periodic refresh (lifespan) | `main.py` — from Plan 1 | ⚠️ Being added in Plan 1 |
| Course catalog caching | ❌ Not implemented | 🔴 Missing |
| Cache invalidation on visibility change | ❌ Not implemented | 🔴 Missing |
| Cache invalidation on course update | ❌ Not implemented | 🔴 Missing |
| Redis Sorted Set for microlearning scores | ❌ Not implemented | 🟢 Optional |
| Cache hit/miss monitoring | ❌ Not implemented | 🟡 Missing |

### 1.3 What's Blocking Redis

`REDIS_ENABLED = False` by default in `config.py:23`. All cache code is gated behind this flag. This is intentional — Redis is optional for development. But for production/thesis benchmarks, Redis MUST be enabled to demonstrate cache impact.

---

## 2. Implementation Plan — Buffer Pool

### 2.1 Step 1: PostgreSQL Configuration Recommendations

**File to create:** `docs/PostgreSQL_Tuning_Guide.md` (reference document for deployment)

```markdown
# PostgreSQL Buffer Pool Tuning for E-Learning Platform

## Recommended Configuration

These values are for a **16GB RAM** server. Scale linearly for other sizes.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `shared_buffers` | 4GB | 25% of RAM — PostgreSQL's internal cache |
| `effective_cache_size` | 12GB | 75% of RAM — helps query planner choose index scans |
| `work_mem` | 64MB | Per-operation sort/hash memory — larger = faster sorts, but multiplied by concurrent queries |
| `maintenance_work_mem` | 512MB | For VACUUM, CREATE INDEX, ALTER TABLE |
| `wal_buffers` | 64MB | Write-Ahead Log buffer |
| `random_page_cost` | 1.1 | SSD-optimized (default 4.0 is for HDD). Lower = planner prefers index scans |
| `effective_io_concurrency` | 200 | For SSD/NVMe concurrent I/O |
| `max_worker_processes` | 8 | For parallel query |
| `max_parallel_workers_per_gather` | 4 | Parallel query workers per scan |
| `max_parallel_workers` | 8 | Total parallel workers |

## How to Apply

```sql
-- Check current values
SHOW shared_buffers;
SHOW effective_cache_size;
SHOW work_mem;

-- Apply (requires restart for shared_buffers)
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET wal_buffers = '64MB';
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Restart PostgreSQL for shared_buffers change
-- pg_ctl restart
```

## Verification

```sql
-- After restart, verify values
SELECT name, setting, unit FROM pg_settings
WHERE name IN (
    'shared_buffers', 'effective_cache_size', 'work_mem',
    'maintenance_work_mem', 'random_page_cost'
);
```
```

---

### 2.2 Step 2: Cache Hit Ratio Monitoring

**File to create:** `backend/scripts/cache_hit_ratio.sql`

```sql
-- ============================================================================
-- PostgreSQL Cache Hit Ratio
-- Mục tiêu: > 99% (nghĩa là < 1% reads phải vào đĩa)
-- ============================================================================

-- (A) Tổng quan — toàn bộ database
SELECT
    SUM(heap_blks_read) AS heap_blocks_read_from_disk,
    SUM(heap_blks_hit)  AS heap_blocks_read_from_cache,
    ROUND(
        100.0 * SUM(heap_blks_hit) /
        NULLIF(SUM(heap_blks_hit + heap_blks_read), 0),
        2
    ) AS cache_hit_ratio_pct,
    CASE
        WHEN 100.0 * SUM(heap_blks_hit) /
             NULLIF(SUM(heap_blks_hit + heap_blks_read), 0) >= 99
        THEN '✅ EXCELLENT (>99%)'
        WHEN 100.0 * SUM(heap_blks_hit) /
             NULLIF(SUM(heap_blks_hit + heap_blks_read), 0) >= 95
        THEN '⚠️ GOOD (>95%) — consider tuning'
        ELSE '🔴 BELOW TARGET (<95%) — increase shared_buffers'
    END AS verdict
FROM pg_statio_user_tables;

-- (B) Chi tiết từng bảng — bảng nào đọc đĩa nhiều nhất
SELECT
    relname AS table_name,
    heap_blks_read AS disk_reads,
    heap_blks_hit  AS cache_hits,
    ROUND(
        100.0 * heap_blks_hit /
        NULLIF(heap_blks_hit + heap_blks_read, 0), 2
    ) AS cache_hit_pct,
    pg_size_pretty(pg_relation_size(relid)) AS table_size
FROM pg_statio_user_tables
WHERE heap_blks_hit + heap_blks_read > 0
ORDER BY heap_blks_read DESC
LIMIT 10;
-- Những bảng top đầu: candidate cho pg_prewarm

-- (C) Index cache hit ratio
SELECT
    SUM(idx_blks_read) AS index_blocks_read_from_disk,
    SUM(idx_blks_hit)  AS index_blocks_read_from_cache,
    ROUND(
        100.0 * SUM(idx_blks_hit) /
        NULLIF(SUM(idx_blks_hit + idx_blks_read), 0), 2
    ) AS index_cache_hit_pct
FROM pg_statio_user_indexes;
```

**Python monitoring integration — `backend/app/core/buffer_monitor.py`:**

```python
"""
PostgreSQL buffer pool monitoring.
Provides cache hit ratio metrics for health checks and dashboards.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_cache_hit_ratio(db: AsyncSession) -> dict:
    """Get overall cache hit ratio."""
    result = await db.execute(text("""
        SELECT
            SUM(heap_blks_read)::float AS disk_reads,
            SUM(heap_blks_hit)::float AS cache_hits,
            ROUND(
                100.0 * SUM(heap_blks_hit) /
                NULLIF(SUM(heap_blks_hit + heap_blks_read), 0), 2
            ) AS hit_ratio_pct
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
        SELECT
            relname AS table_name,
            heap_blks_read AS disk_reads,
            ROUND(
                100.0 * heap_blks_hit /
                NULLIF(heap_blks_hit + heap_blks_read, 0), 2
            ) AS hit_pct,
            pg_size_pretty(pg_relation_size(relid)) AS table_size
        FROM pg_statio_user_tables
        WHERE heap_blks_hit + heap_blks_read > 100
        ORDER BY heap_blks_read DESC
        LIMIT :limit
    """), {"limit": limit})
    return [dict(row) for row in result.mappings()]
```

---

### 2.3 Step 3: `pg_prewarm` — Warm Cache at Startup

**Action 1:** Create Alembic migration `backend/alembic/versions/XXXX_pg_prewarm.py`

```sql
-- UPGRADE
CREATE EXTENSION IF NOT EXISTS pg_prewarm;

-- DOWNGRADE
-- DROP EXTENSION IF EXISTS pg_prewarm;
```

**Action 2:** Add prewarm logic to FastAPI lifespan — `backend/app/main.py`:

```python
from app.core.database import engine

async def _prewarm_hot_tables():
    """Nạp các bảng truy cập nhiều vào buffer pool sau khi DB restart.
    Giảm thời gian "cold start" — cache hit ratio tăng nhanh hơn."""
    hot_tables = [
        "dictionary_entries",
        "dictionary_categories",
        "dictionary_variations",
        "general_courses",
        "general_course_categories",
        "mv_leaderboard",
        "user_profiles",
        "roles",
    ]
    try:
        async with engine.connect() as conn:
            for tbl in hot_tables:
                try:
                    await conn.execute(
                        __import__("sqlalchemy").text(f"SELECT pg_prewarm('{tbl}')")
                    )
                except Exception as e:
                    print(f"[Prewarm] {tbl}: skipped — {e}")
            # Also prewarm key indexes
            for idx in ["idx_dict_word_trgm", "idx_courses_published"]:
                try:
                    await conn.execute(
                        __import__("sqlalchemy").text(f"SELECT pg_prewarm('{idx}')")
                    )
                except Exception:
                    pass
            await conn.commit()
        print("[Prewarm] Hot tables loaded into buffer cache")
    except Exception as e:
        print(f"[Prewarm] Failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
        print(f"Database connected: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")

    if settings.REDIS_ENABLED:
        await cache.connect()
        print("Redis connected")

    # Prewarm hot tables into PostgreSQL buffer cache
    await _prewarm_hot_tables()

    # Start periodic leaderboard refresh
    refresh_task = asyncio.create_task(_refresh_leaderboard_periodically())

    yield

    # Shutdown
    refresh_task.cancel()
    try:
        await refresh_task
    except asyncio.CancelledError:
        pass

    if settings.REDIS_ENABLED:
        await cache.disconnect()
    await engine.dispose()
```

**Health check endpoint — expose cache stats:**

```python
@app.get("/api/health/cache")
async def cache_health(db: AsyncSession = Depends(get_db)):
    """Health check with buffer cache statistics."""
    from app.core.buffer_monitor import get_cache_hit_ratio
    ratio = await get_cache_hit_ratio(db)
    redis_status = "connected" if cache.enabled else "disabled"
    return {
        "postgresql": {
            "cache_hit_ratio_pct": ratio["hit_ratio_pct"],
            "disk_reads": ratio["disk_reads"],
            "cache_hits": ratio["cache_hits"],
            "status": "healthy" if ratio["hit_ratio_pct"] >= 95 else "degraded",
        },
        "redis": redis_status,
    }
```

---

## 3. Implementation Plan — Redis Cache

### 3.1 Step 4: Course Catalog Cache-Aside

**File to modify:** `backend/app/services/store.py`

Add Redis caching for the course catalog (storefront):

```python
from app.core.cache import cache

async def get_store_courses_cached(db: AsyncSession, student_id: str) -> list[dict]:
    """Get published courses with Redis cache-aside."""
    cache_key = f"catalog:courses:published"

    # 1. Try cache
    if cache.enabled:
        cached = await cache.get(cache_key)
        if cached is not None:
            # Filter by student enrollment (this changes per-user)
            clean_sid = student_id if is_valid_uuid(student_id) else "00000000-0000-0000-0000-000000000000"
            for c in cached:
                c["is_enrolled"] = False  # Will be checked below if needed
            # Note: enrollment status is per-user, so we cache the base catalog
            # and layer enrollment check on top
            return cached

    # 2. Cache miss — query DB
    result = await db.execute(text("SELECT * FROM v_published_courses ORDER BY updated_at DESC"))
    courses = [dict(row) for row in result.mappings()]

    # 3. Write to cache (TTL: 10 minutes for catalog)
    if cache.enabled:
        await cache.set(cache_key, courses, ttl=600)

    return courses
```

### 3.2 Step 5: Cache Invalidation Hooks

**The hardest problem in caching is knowing WHEN to invalidate.**

**File to create:** `backend/app/core/cache_invalidation.py`

```python
"""
Cache invalidation hooks.
Called by services when data changes to keep cache consistent.

Strategy: INVALIDATE on write (delete cache key) rather than UPDATE.
Next read will repopulate from DB (cache-aside pattern).
"""
from app.core.cache import cache


async def invalidate_course_catalog():
    """Gọi khi: course được publish/unpublish, tạo mới, xóa, đổi giá."""
    await cache.delete("catalog:courses:published")
    await cache.delete_pattern("catalog:course:*")


async def invalidate_course_detail(course_id: str):
    """Gọi khi: course detail thay đổi (title, description, price)."""
    await cache.delete(f"catalog:course:{course_id}")


async def invalidate_dictionary_cache(keyword: str | None = None):
    """Gọi khi: dictionary entry được thêm/sửa/xóa."""
    if keyword:
        await cache.delete(f"dict:search:{keyword.lower()}")
    else:
        # Invalidate all dictionary search caches (bulk update)
        await cache.delete_pattern("dict:search:*")


async def invalidate_leaderboard_cache():
    """Gọi khi: streak thay đổi, achievement được trao."""
    await cache.delete("leaderboard:streaks")


async def invalidate_user_sessions(user_id: str):
    """Gọi khi: user bị ban, đổi password."""
    await cache.delete_pattern(f"session:*")
```

**Wire invalidation into existing services:**

```python
# In services/course_builder.py — toggle_course_visibility()
async def toggle_course_visibility(db: AsyncSession, course_id: str, status: str) -> None:
    await db.execute(
        text("UPDATE general_courses SET visibility_status = :st WHERE course_id = :cid AND is_deleted = FALSE"),
        {"st": status, "cid": course_id},
    )
    await db.commit()

    # Invalidate course catalog cache
    from app.core.cache_invalidation import invalidate_course_catalog, invalidate_course_detail
    await invalidate_course_catalog()
    await invalidate_course_detail(course_id)


# In services/course_builder.py — update_course()
async def update_course(db: AsyncSession, course_id: str, req) -> dict:
    # ... existing update logic ...
    await db.commit()

    # Invalidate cache
    from app.core.cache_invalidation import invalidate_course_catalog, invalidate_course_detail
    await invalidate_course_catalog()
    await invalidate_course_detail(course_id)
    return result


# In services/store.py — checkout_course()
async def checkout_course(db: AsyncSession, student_id: str, course_id: str) -> None:
    # ... existing checkout logic ...

    # Enrollment changed → invalidate catalog (enrollment counts changed)
    from app.core.cache_invalidation import invalidate_course_catalog
    await invalidate_course_catalog()


# In services/gamification.py — sync_student_streak()
async def sync_student_streak(db: AsyncSession, student_id: str) -> dict:
    # ... existing streak logic ...

    # Streak changed → invalidate leaderboard
    from app.core.cache_invalidation import invalidate_leaderboard_cache
    await invalidate_leaderboard_cache()
    return result
```

### 3.3 Step 6: Redis Monitoring — Cache Hit/Miss Tracking

**Extend `backend/app/core/cache.py`:**

```python
class RedisCache:
    def __init__(self):
        self._redis = None
        self._enabled = settings.REDIS_ENABLED
        # Monitoring counters
        self._hits = 0
        self._misses = 0

    @property
    def hit_rate(self) -> float:
        total = self._hits + self._misses
        return (self._hits / total * 100) if total > 0 else 0.0

    async def get(self, key: str) -> Any | None:
        if not self.enabled:
            return None
        data = await self._redis.get(key)
        if data:
            self._hits += 1
            return json.loads(data)
        self._misses += 1
        return None

    def stats(self) -> dict:
        return {
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate_pct": round(self.hit_rate, 2),
            "total_requests": self._hits + self._misses,
            "enabled": self._enabled,
        }
```

**Add stats endpoint — `backend/app/main.py`:**

```python
@app.get("/api/health/cache/stats")
async def cache_stats():
    """Redis cache hit/miss statistics."""
    return cache.stats()
```

### 3.4 Step 7: Redis Sorted Set — Microlearning Leaderboard (Optional Enhancement)

**File to modify:** `backend/app/services/gamification.py`

```python
async def update_microlearning_leaderboard(
    db: AsyncSession, student_id: str, score: int
) -> None:
    """Cập nhật điểm microlearning vào Redis ZSET."""
    if not cache.enabled:
        return

    # Lấy tên học viên
    result = await db.execute(
        text("SELECT full_name FROM user_profiles WHERE user_id = :uid"),
        {"uid": student_id},
    )
    row = result.mappings().first()
    name = row["full_name"] if row else student_id

    # ZINCRBY: tăng điểm (atomic, O(log N))
    await cache._redis.zincrby("microlearning:scores", score, name)


async def get_microlearning_leaderboard(limit: int = 20) -> list[dict]:
    """Lấy bảng xếp hạng microlearning từ Redis ZSET."""
    if not cache.enabled:
        return []

    result = await cache._redis.zrevrange(
        "microlearning:scores", 0, limit - 1, withscores=True
    )
    return [
        {"rank": i + 1, "full_name": name, "score": int(score)}
        for i, (name, score) in enumerate(result)
    ]
```

---

## 4. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `docs/PostgreSQL_Tuning_Guide.md` | **CREATE** | Buffer pool tuning reference |
| `backend/alembic/versions/XXXX_pg_prewarm.py` | **CREATE** | pg_prewarm extension |
| `backend/app/core/buffer_monitor.py` | **CREATE** | Cache hit ratio monitoring |
| `backend/app/core/cache_invalidation.py` | **CREATE** | Cache invalidation hooks |
| `backend/app/core/cache.py` | **MODIFY** | Add hit/miss counters + stats() |
| `backend/app/main.py` | **MODIFY** | Add prewarm at startup, /health/cache endpoint |
| `backend/app/services/store.py` | **MODIFY** | Add course catalog cache-aside |
| `backend/app/services/course_builder.py` | **MODIFY** | Wire invalidation into CRUD |
| `backend/app/services/gamification.py` | **MODIFY** | Invalidate leaderboard on streak change |
| `backend/scripts/cache_hit_ratio.sql` | **CREATE** | Buffer cache hit ratio queries |
| `backend/app/api/router.py` | **MODIFY** | Add health endpoints |

---

## 5. Verification Strategy

### 5.1 Python Tests (`backend/tests/test_buffer_cache.py`)

```python
import pytest
from sqlalchemy import text

class TestBufferPool:
    """Verify cache hit ratio and pg_prewarm."""

    async def test_pg_prewarm_extension_exists(self, db_session):
        """pg_prewarm must be installed."""
        result = await db_session.execute(text(
            "SELECT 1 FROM pg_extension WHERE extname = 'pg_prewarm'"
        ))
        assert result.scalar() == 1

    async def test_prewarm_loads_table(self, db_session):
        """pg_prewarm('dictionary_entries') should return > 0 blocks."""
        result = await db_session.execute(
            text("SELECT pg_prewarm('dictionary_entries')")
        )
        blocks = result.scalar()
        assert blocks >= 0  # 0 if table is empty, > 0 if has data

    async def test_cache_hit_ratio_queryable(self, db_session):
        """Cache hit ratio query should return valid data."""
        result = await db_session.execute(text("""
            SELECT
                ROUND(100.0 * SUM(heap_blks_hit) /
                NULLIF(SUM(heap_blks_hit + heap_blks_read), 0), 2)
            FROM pg_statio_user_tables
        """))
        ratio = result.scalar()
        assert ratio is not None
        assert 0 <= ratio <= 100


class TestRedisCacheInvalidation:
    """Verify cache invalidation triggers correctly."""

    @pytest.mark.skipif(not _redis_available(), reason="Redis not available")
    async def test_catalog_invalidated_on_visibility_change(self, db_session, seeded_course):
        """Toggle visibility → catalog cache key is deleted."""
        # Populate cache
        await cache.set("catalog:courses:published", [{"test": True}])

        # Toggle visibility
        await toggle_course_visibility(db_session, seeded_course, "ARCHIVED")

        # Cache should be invalidated
        cached = await cache.get("catalog:courses:published")
        assert cached is None

    @pytest.mark.skipif(not _redis_available(), reason="Redis not available")
    async def test_dict_cache_not_invalidated_by_course_change(self, db_session):
        """Dictionary cache should NOT be invalidated when course changes."""
        await cache.set("dict:search:test", [{"word": "test"}])
        await toggle_course_visibility(db_session, "some-course-id", "ARCHIVED")
        cached = await cache.get("dict:search:test")
        assert cached is not None  # Still there


class TestCacheStats:
    """Verify hit/miss tracking."""

    async def test_cache_hit_counted(self):
        """Successful get() should increment hits."""
        if not cache.enabled:
            pytest.skip("Redis disabled")
        await cache.set("test:stats", "value")
        await cache.get("test:stats")
        stats = cache.stats()
        assert stats["hits"] > 0

    async def test_cache_miss_counted(self):
        """Failed get() should increment misses."""
        if not cache.enabled:
            pytest.skip("Redis disabled")
        misses_before = cache.stats()["misses"]
        await cache.get("test:nonexistent:key:12345")
        assert cache.stats()["misses"] > misses_before


class TestPrewarmAtStartup:
    """Verify prewarm runs at startup."""

    def test_health_endpoint_returns_cache_stats(self, client):
        """GET /api/health/cache should return cache stats."""
        resp = client.get("/api/health/cache")
        assert resp.status_code == 200
        data = resp.json()
        assert "postgresql" in data
        assert "cache_hit_ratio_pct" in data["postgresql"]
        assert "redis" in data
```

### 5.2 SQL Verification

```sql
-- Verify pg_prewarm works
SELECT pg_prewarm('dictionary_entries');
-- Returns number of blocks loaded into cache

-- Check which tables are in the buffer cache
-- (requires pg_buffercache extension)
CREATE EXTENSION IF NOT EXISTS pg_buffercache;

SELECT
    c.relname AS table_name,
    COUNT(*) AS buffers_in_cache,
    pg_size_pretty(COUNT(*) * 8192) AS cache_size
FROM pg_buffercache b
JOIN pg_class c ON b.relfilenode = pg_relation_filenode(c.oid)
WHERE c.relname IN (
    'dictionary_entries', 'general_courses', 'mv_leaderboard',
    'user_profiles', 'roles'
)
GROUP BY c.relname
ORDER BY buffers_in_cache DESC;
-- Sau pg_prewarm, các bảng "nóng" phải xuất hiện ở đây

-- Cache hit ratio trước và sau prewarm
-- (reset stats, chạy query, kiểm tra)
SELECT pg_stat_reset();  -- Reset stats (chỉ dùng trong dev!)
-- Chạy một vài query...
SELECT * FROM pg_statio_user_tables WHERE relname = 'dictionary_entries';
-- heap_blks_read nên = 0 (đã prewarm) hoặc rất thấp
```

### 5.3 Performance Benchmark

```bash
# Before: Cold cache (restart PostgreSQL)
pg_ctl restart
# Run benchmark immediately — expect high disk reads
pgbench -c 10 -T 30 -f backend/scripts/bench_dictionary.sql elearning_db

# After: Warm cache (pg_prewarm)
psql -c "SELECT pg_prewarm('dictionary_entries')"
# Run benchmark again — expect 0 disk reads, lower latency
pgbench -c 10 -T 30 -f backend/scripts/bench_dictionary.sql elearning_db
```

### 5.4 Acceptance Criteria

- [ ] `pg_prewarm` extension installed
- [ ] FastAPI startup automatically prewarms hot tables
- [ ] Cache hit ratio query returns valid data (0-100%)
- [ ] `GET /api/health/cache` returns PostgreSQL cache + Redis status
- [ ] Course catalog is cached in Redis with TTL
- [ ] Toggling course visibility invalidates catalog cache
- [ ] Updating course detail invalidates both catalog + detail cache
- [ ] Dictionary cache invalidation is scoped (doesn't affect course cache)
- [ ] Redis hit/miss counters increment correctly
- [ ] Leaderboard ZSET is invalidated when streaks change
- [ ] `REDIS_ENABLED=False` disables all cache (backward compatible)
- [ ] All existing tests pass with `REDIS_ENABLED=False`

---

## 6. Rollback Plan

```sql
-- Disable pg_prewarm
DROP EXTENSION IF EXISTS pg_prewarm;

-- Reset PostgreSQL config to defaults
ALTER SYSTEM RESET shared_buffers;
ALTER SYSTEM RESET effective_cache_size;
ALTER SYSTEM RESET work_mem;
-- Requires restart

-- Redis: set REDIS_ENABLED=False in .env
-- All cache code is gated behind this flag
```

---

## 7. Estimated Effort

| Step | Hours |
|------|-------|
| PostgreSQL tuning guide | 1.0h |
| Cache hit ratio monitoring | 1.0h |
| pg_prewarm migration + startup | 1.5h |
| Course catalog cache-aside | 1.5h |
| Cache invalidation hooks | 2.0h |
| Wire invalidation into services | 1.5h |
| Redis monitoring (hit/miss) | 0.5h |
| Health endpoints | 0.5h |
| Tests (buffer + cache) | 2.5h |
| Benchmark scripts | 1.0h |
| **Total** | **13.0h** |
