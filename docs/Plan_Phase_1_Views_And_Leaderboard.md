# Plan Phase 1: Views & Materialized Leaderboard

**Status:** 📋 Planning  
**Blueprint Reference:** `Ke_hoach_ap_dung_HQTCSDL_Elearning.md` — Phần 2 (Views)  
**Target Branch:** `fastapi`  
**Prerequisites:** PostgreSQL 15+, existing ERD schema

---

## 1. Current State Audit

### 1.1 What Exists

| View | Type | Location | Service Consumer | Status |
|------|------|----------|-----------------|--------|
| `vw_student_progress_report` | Normal | `procedures.sql:18` | `services/student.py:15` | ✅ Wired |
| `vw_course_analytics` | Normal | `procedures.sql:33` | `services/teacher.py:29` | ✅ Wired |
| `vw_top_learners_leaderboard` | Normal | `procedures.sql:44` | `services/gamification.py:29` (fallback) | ✅ Wired |
| `vw_revenue_by_course` | Normal | `procedures.sql:54` | `services/admin.py:50` | ✅ Wired |
| `vw_teacher_dashboard` | Normal | `procedures.sql:65` | `services/teacher.py:6` | ✅ Wired |
| `vw_inactive_students` | Normal | `procedures.sql:79` | `services/student.py:23` | ✅ Wired |
| `vw_course_feedback_summary` | Normal | `procedures.sql:89` | `services/teacher.py:43` | ✅ Wired |
| `vw_detailed_transaction_history` | Normal | `procedures.sql:100` | `services/admin.py:16` | ✅ Wired |
| `mv_leaderboard` | Materialized | `alembic/versions/ff27fabf57b0` | `services/gamification.py:22` | ⚠️ Partial |

### 1.2 Gaps Identified

1. **Missing Views from Blueprint:** The blueprint proposes `v_published_courses` (catalog storefront) and `v_student_dashboard` (student overview). Neither exists as a named view — their logic is embedded in raw SQL inside services.

2. **Materialized View Design Issue:** `mv_leaderboard` (created in migration `ff27fabf57b0`) has a **structural mismatch** vs the blueprint:
   - **Blueprint spec:** Unique index on `student_id` column → enables `REFRESH MATERIALIZED VIEW CONCURRENTLY`
   - **Current implementation:** Has `ROW_NUMBER()` instead of `RANK()`, no `student_id` column, and the unique index is on `(full_name, current_streak)` — this is **incorrect** because:
     - Two users can have the same `full_name` + `current_streak` → unique constraint violation
     - `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a unique index that covers every row — the current index may fail on real data with duplicate names
   - Uses `WHERE ss.current_streak > 0` which hides new students with 0 streak

3. **No Periodic Refresh Mechanism:** `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard` is not called automatically anywhere. The `refresh_leaderboard()` function exists in `services/gamification.py:50` but is only exposed via a manual API endpoint `POST /api/gamification/leaderboard/refresh`.

4. **No `pg_cron` or lifespan-based scheduler** to auto-refresh the materialized view.

---

## 2. Implementation Plan

### 2.1 Step 1: Create View `v_published_courses` (Storefront Catalog)

**Rationale:** Encapsulates the storefront query as a reusable DB object instead of ad-hoc raw SQL in `services/store.py:6-28`.

**Action:** Create Alembic migration `backend/alembic/versions/XXXX_v_published_courses.py`

```sql
-- UPGRADE
CREATE OR REPLACE VIEW v_published_courses AS
SELECT
    c.course_id,
    c.title,
    COALESCE(c.description, '') AS description,
    COALESCE(c.image_url, '') AS image_url,
    c.price,
    cat.name AS category_name,
    tp.full_name AS teacher_name,
    COUNT(e.enrollment_id) AS enrollment_count,
    c.updated_at
FROM general_courses c
JOIN general_course_categories cat ON cat.category_id = c.category_id
JOIN teachers t ON t.user_id = c.teacher_id
JOIN user_profiles tp ON tp.user_id = t.user_id
LEFT JOIN course_enrollments e ON e.course_id = c.course_id
WHERE c.visibility_status = 'PUBLISHED'
  AND c.is_deleted = FALSE
GROUP BY c.course_id, cat.name, tp.full_name;

-- DOWNGRADE
DROP VIEW IF EXISTS v_published_courses;
```

**Service Refactor — `backend/app/services/store.py`:**

Replace the raw SQL in `get_store_courses()` to use the view:

```python
async def get_store_courses(db: AsyncSession, student_id: str) -> list[dict]:
    clean_sid = student_id if is_valid_uuid(student_id) else "00000000-0000-0000-0000-000000000000"
    result = await db.execute(
        text("""
            SELECT
                v.course_id::text,
                v.title,
                v.description,
                v.image_url,
                v.price,
                v.category_name,
                v.teacher_name,
                v.enrollment_count,
                v.updated_at,
                EXISTS(
                    SELECT 1 FROM course_enrollments e
                    WHERE e.course_id = v.course_id AND e.student_id = :sid
                ) AS is_enrolled
            FROM v_published_courses v
            ORDER BY v.updated_at DESC
        """),
        {"sid": clean_sid},
    )
    return [dict(row) for row in result.mappings()]
```

---

### 2.2 Step 2: Create View `v_student_dashboard`

**Action:** Create Alembic migration `backend/alembic/versions/XXXX_v_student_dashboard.py`

```sql
-- UPGRADE
CREATE OR REPLACE VIEW v_student_dashboard AS
SELECT
    s.user_id AS student_id,
    p.full_name,
    ss.current_streak,
    ss.highest_streak,
    COUNT(DISTINCT e.course_id) AS enrolled_courses,
    COUNT(DISTINCT ua.achievement_id) AS achievements,
    ROUND(AVG(e.progress), 2) AS avg_progress
FROM students s
JOIN user_profiles p ON p.user_id = s.user_id
LEFT JOIN student_streaks ss ON ss.student_id = s.user_id
LEFT JOIN course_enrollments e ON e.student_id = s.user_id
LEFT JOIN user_achievements ua ON ua.user_id = s.user_id
GROUP BY s.user_id, p.full_name, ss.current_streak, ss.highest_streak;

-- DOWNGRADE
DROP VIEW IF EXISTS v_student_dashboard;
```

**New API endpoint** `GET /api/students/dashboard` — add to `backend/app/api/student.py`:

```python
@router.get("/students/dashboard")
async def student_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard tổng quan của học viên đang đăng nhập."""
    result = await db.execute(
        text("SELECT * FROM v_student_dashboard WHERE student_id = :uid"),
        {"uid": current_user.user_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Student record not found")
    return dict(row)
```

---

### 2.3 Step 3: Fix `mv_leaderboard` — Add `student_id` + Correct Unique Index

**Problem:** The current `mv_leaderboard` lacks a `student_id` column and its unique index on `(full_name, current_streak)` is not guaranteed unique.

**Action:** Create a **replacement migration** that drops and recreates `mv_leaderboard`:

```sql
-- UPGRADE
DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard;

CREATE MATERIALIZED VIEW mv_leaderboard AS
SELECT
    s.user_id AS student_id,
    p.full_name,
    COALESCE(p.avatar_url, '') AS avatar_url,
    ss.current_streak,
    ss.highest_streak,
    COUNT(ua.achievement_id) AS achievement_count,
    RANK() OVER (
        ORDER BY ss.highest_streak DESC, COUNT(ua.achievement_id) DESC
    ) AS rank
FROM students s
JOIN user_profiles p ON p.user_id = s.user_id
LEFT JOIN student_streaks ss ON ss.student_id = s.user_id
LEFT JOIN user_achievements ua ON ua.user_id = s.user_id
GROUP BY s.user_id, p.full_name, p.avatar_url, ss.current_streak, ss.highest_streak
WITH DATA;

-- REQUIRED for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_leaderboard_student
ON mv_leaderboard (student_id);
```

**Key fixes:**
1. Adds `student_id` column → the unique index is now on a truly unique column
2. Uses `RANK()` instead of `ROW_NUMBER()` — ties get the same rank (matching blueprint spec)
3. Removes `WHERE ss.current_streak > 0` filter — all students appear on leaderboard
4. Uses `highest_streak` for ranking (blueprint spec) instead of `current_streak`

**Service update — `backend/app/services/gamification.py:22`:**

The `get_leaderboard()` already queries `mv_leaderboard` by `rank ASC`. Add `student_id` to the returned fields:

```python
result = await db.execute(
    text("SELECT student_id::text, full_name, avatar_url, current_streak, highest_streak, achievement_count, rank FROM mv_leaderboard ORDER BY rank ASC LIMIT :limit"),
    {"limit": limit},
)
```

---

### 2.4 Step 4: Periodic Refresh — Lifespan Background Task

**File to modify:** `backend/app/main.py`

Add an asyncio background task that refreshes `mv_leaderboard` every 5 minutes during the application's lifetime:

```python
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.cache import cache
from app.core.config import settings
from app.core.database import engine, async_session


async def _refresh_leaderboard_periodically():
    """Refresh mv_leaderboard every LEADERBOARD_REFRESH_MINUTES."""
    while True:
        await asyncio.sleep(settings.LEADERBOARD_REFRESH_MINUTES * 60)
        try:
            async with async_session() as db:
                await db.execute(
                    __import__("sqlalchemy").text(
                        "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard"
                    )
                )
                await db.commit()
                # Also sync Redis ZSET if enabled
                if settings.REDIS_ENABLED and cache.enabled:
                    from app.services.gamification import refresh_leaderboard
                    await refresh_leaderboard(db)
        except Exception as e:
            print(f"[Leaderboard Refresh] Failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.connect() as conn:
        await conn.execute(
            __import__("sqlalchemy").text("SELECT 1")
        )
        print(f"Database connected: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")

    if settings.REDIS_ENABLED:
        await cache.connect()
        print("Redis connected")

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
        print("Redis disconnected")
    await engine.dispose()
    print("Database disconnected")
```

---

### 2.5 Step 5: `pg_cron` Setup (Production-Grade Alternative)

For production deployments where the app may have multiple instances, use PostgreSQL's built-in job scheduler instead of in-app asyncio.

**Setup Script — `backend/app/db/pg_cron_setup.sql`:**

```sql
-- Enable pg_cron extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule leaderboard refresh every 5 minutes
-- pg_cron uses UTC by default
SELECT cron.schedule(
    'refresh-leaderboard',        -- job name
    '*/5 * * * *',                -- cron expression: every 5 minutes
    $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard$$
);

-- Schedule dictionary cache warm (every hour)
SELECT cron.schedule(
    'warm-dictionary-cache',
    '0 * * * *',
    $$SELECT pg_prewarm('dictionary_entries')$$
);

-- List all scheduled jobs
SELECT jobid, schedule, command, nodename, nodeport, database, username
FROM cron.job;
```

**Note:** `pg_cron` requires the extension to be installed in the `postgres` database (it runs as a background worker). Add this to `backend/app/db/procedures.sql` or a dedicated migration.

---

## 3. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/alembic/versions/XXXX_v_published_courses.py` | **CREATE** | New view migration |
| `backend/alembic/versions/XXXX_v_student_dashboard.py` | **CREATE** | New view migration |
| `backend/alembic/versions/XXXX_fix_mv_leaderboard.py` | **CREATE** | Recreate mv_leaderboard with student_id |
| `backend/app/services/store.py` | **MODIFY** | Refactor `get_store_courses()` to use `v_published_courses` |
| `backend/app/api/student.py` | **MODIFY** | Add `GET /students/dashboard` endpoint |
| `backend/app/services/student.py` | **MODIFY** | Add `get_student_dashboard()` service function |
| `backend/app/main.py` | **MODIFY** | Add periodic refresh background task |
| `backend/app/services/gamification.py` | **MODIFY** | Return `student_id` in leaderboard response |
| `backend/app/schemas/student.py` | **MODIFY** | Add `StudentDashboardResponse` schema |
| `backend/app/db/pg_cron_setup.sql` | **CREATE** | pg_cron configuration for production |

---

## 4. Verification Strategy

### 4.1 Unit/Integration Tests

Create `backend/tests/test_views_leaderboard.py`:

```python
class TestPublishedCoursesView:
    """Verify v_published_courses returns correct data."""

    def test_view_exists(self, db_session):
        """View should be queryable."""
        result = db_session.execute(text("SELECT 1 FROM v_published_courses LIMIT 1"))
        assert result is not None

    def test_only_published_returned(self, db_session):
        """DRAFT/ARCHIVED courses must not appear."""
        result = db_session.execute(
            text("SELECT course_id FROM v_published_courses WHERE visibility_status != 'PUBLISHED'")
        )
        assert result.fetchone() is None

    def test_deleted_courses_excluded(self, db_session):
        """Soft-deleted courses must not appear."""
        result = db_session.execute(
            text("SELECT course_id FROM v_published_courses WHERE ...")
        )
        # ...verify no deleted courses

class TestStudentDashboardView:
    """Verify v_student_dashboard aggregates correctly."""

    def test_aggregates_enrolled_courses(self, db_session):
        """enrolled_courses should match actual enrollment count."""

    def test_zero_state_student(self, db_session):
        """New student with no enrollments should get 0 averages, not NULL."""

class TestMaterializedViewRefresh:
    """Verify mv_leaderboard concurrent refresh."""

    def test_concurrent_refresh_does_not_block_reads(self, db_session):
        """REFRESH CONCURRENTLY should not lock readers."""

    def test_unique_index_no_duplicates(self, db_session):
        """After refresh, no duplicate student_id rows."""

    def test_rank_ties_same_value(self, db_session):
        """Students with identical scores should have the same rank (RANK, not ROW_NUMBER)."""
```

### 4.2 SQL Verification Scripts

```sql
-- Verify mv_leaderboard structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mv_leaderboard'
ORDER BY ordinal_position;

-- Verify unique index exists
SELECT indexname FROM pg_indexes WHERE tablename = 'mv_leaderboard';

-- Compare view performance vs direct query
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM mv_leaderboard ORDER BY rank LIMIT 20;
-- vs
EXPLAIN (ANALYZE, BUFFERS)
SELECT s.user_id, ... RANK() OVER (...) FROM students s ...;

-- Check that REFRESH CONCURRENTLY works
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard;
-- Should succeed without error
```

### 4.3 Acceptance Criteria

- [ ] `v_published_courses` returns only PUBLISHED + non-deleted courses
- [ ] `v_student_dashboard` correctly aggregates for students with 0 enrollments
- [ ] `mv_leaderboard` has a unique index on `student_id`
- [ ] `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard` succeeds
- [ ] Leaderboard auto-refreshes every 5 minutes (verify via logs)
- [ ] `GET /api/students/dashboard` returns correct data for authenticated student
- [ ] All existing leaderboard API tests still pass

---

## 5. Rollback Plan

If the new views or mv_leaderboard changes cause issues:

```sql
-- Rollback v_published_courses
DROP VIEW IF EXISTS v_published_courses;

-- Rollback v_student_dashboard
DROP VIEW IF EXISTS v_student_dashboard;

-- Rollback mv_leaderboard to previous version
DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard;
-- Then re-run migration ff27fabf57b0 (the original version)
```

The service code changes are backward-compatible — store.py falls back to raw SQL if the view doesn't exist (no change to response format).

---

## 6. Estimated Effort

| Step | Hours |
|------|-------|
| Create 2 new view migrations | 0.5h |
| Fix mv_leaderboard migration | 0.5h |
| Refactor store.py service | 0.5h |
| Add student dashboard endpoint | 1.0h |
| Add lifespan background task | 1.0h |
| pg_cron setup script | 0.5h |
| Write tests | 1.5h |
| **Total** | **5.5h** |
