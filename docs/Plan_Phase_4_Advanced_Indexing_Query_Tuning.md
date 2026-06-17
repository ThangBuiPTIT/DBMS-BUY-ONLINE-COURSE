# Plan Phase 4: Advanced Indexing & Query Tuning

**Status:** 📋 Planning  
**Blueprint Reference:** `Ke_hoach_ap_dung_HQTCSDL_Elearning.md` — Phần 6 (Indexing) + Phần 9 (Query Optimization)  
**Target Branch:** `fastapi`  
**Prerequisites:** Plans 1-3 complete

---

## 1. Current State Audit

### 1.1 Existing Indexes (from Alembic Migrations)

| Index | Table | Type | Migration | Matches Blueprint? |
|-------|-------|------|-----------|-------------------|
| `idx_users_active` | users | **Partial** (WHERE is_deleted=FALSE) | `949fdd8f9d12` | ✅ Yes |
| `idx_courses_published` | general_courses | **Partial** (WHERE published) | `949fdd8f9d12` | ✅ Yes |
| `idx_dict_entries_active` | dictionary_entries | **Partial** (WHERE is_deleted=FALSE) | `949fdd8f9d12` | ✅ Yes |
| `idx_enrollments_progress_covering` | course_enrollments | **Covering** (INCLUDE progress) | `949fdd8f9d12` | ⚠️ Differs from blueprint |
| `idx_wallets_balance_covering` | wallets | **Covering** (INCLUDE balance) | `949fdd8f9d12` | ✅ Extra (good) |
| `idx_materials_transcript_gin` | learning_materials | **GIN** (JSONB) | `949fdd8f9d12` | ✅ Extra (good) |
| `idx_ml_questions_options_gin` | microlearning_questions | **GIN** (JSONB) | `949fdd8f9d12` | ✅ Yes |
| `idx_dict_word_trgm` | dictionary_entries | **GIN trigram** (word) | `8c88ee18335c` | ✅ Yes |
| `idx_dict_meaning_trgm` | dictionary_entries | **GIN trigram** (meaning) | `8c88ee18335c` | ✅ Extra (good) |
| `idx_users_username_trgm` | users | **GIN trigram** | `8c88ee18335c` | ✅ Extra (good) |
| `idx_profiles_fullname_trgm` | user_profiles | **GIN trigram** | `8c88ee18335c` | ✅ Extra (good) |
| `idx_courses_title_trgm` | general_courses | **GIN trigram** | `8c88ee18335c` | ✅ Extra (good) |
| `idx_courses_desc_trgm` | general_courses | **GIN trigram** | `8c88ee18335c` | ✅ Extra (good) |
| `idx_*_created_brin` | 4 tables | **BRIN** | `949fdd8f9d12` | ✅ Yes |

### 1.2 Gaps — What the Blueprint Requires But Is Missing

| Blueprint Spec | Current Status | Severity |
|---------------|---------------|----------|
| **FTS Index** `idx_dict_fts` using `to_tsvector('simple', word || ' ' || meaning)` | ❌ **MISSING** | 🔴 Critical |
| Covering index should be `(student_id) INCLUDE (course_id, progress, enrolled_at)` | ⚠️ Current: `(student_id, course_id) INCLUDE (progress)` | 🟡 Medium |
| `pg_stat_statements` extension | ❌ Not enabled | 🔴 Critical (no quantitative data for thesis) |
| Keyset pagination for all list endpoints | ❌ All use OFFSET | 🟡 High |
| N+1 query prevention in course tree | ⚠️ 4 sequential queries in `get_course_content()` | 🟡 High |
| EXPLAIN ANALYZE verification scripts | ❌ None | 🟡 High |
| Unused index detection (`idx_scan = 0`) | ❌ Not monitored | 🟢 Medium |

### 1.3 Current Pagination Status (All OFFSET-Based)

| Endpoint | File | Current Method |
|----------|------|---------------|
| `GET /admin/transactions` | `services/admin.py:16` | `LIMIT :limit OFFSET :offset` |
| `GET /wallet/{id}/transactions` | `services/store.py:137` | `LIMIT :limit OFFSET :offset` |
| `GET /notifications/{id}` | `services/notification.py` | No pagination (returns all) |

None use keyset/cursor pagination.

---

## 2. Implementation Plan

### 2.1 Step 1: Create Full-Text Search Index for Dictionary

**Rationale:** Trigram indexes (`pg_trgm`) are for fuzzy/substring matching. Full-Text Search (`tsvector`) is for linguistic search — stemming, ranking, phrase matching. The blueprint specifies BOTH.

**Action:** Create Alembic migration `backend/alembic/versions/XXXX_dict_fulltext_search.py`

```sql
-- UPGRADE
-- Full-Text Search index on dictionary entries (word + meaning)
-- Using 'simple' config for Vietnamese (no built-in Vietnamese stemmer)
-- For production, consider a custom Vietnamese text search configuration
CREATE INDEX IF NOT EXISTS idx_dict_fts
ON dictionary_entries
USING GIN (to_tsvector('simple', COALESCE(word, '') || ' ' || COALESCE(meaning, '')))
WHERE is_deleted = FALSE;

-- Add a generated tsvector column for better performance (optional, Phase 4+)
-- ALTER TABLE dictionary_entries ADD COLUMN fts_vector tsvector
--     GENERATED ALWAYS AS (to_tsvector('simple', COALESCE(word, '') || ' ' || COALESCE(meaning, ''))) STORED;
-- CREATE INDEX idx_dict_fts_vector ON dictionary_entries USING GIN (fts_vector) WHERE is_deleted = FALSE;

-- DOWNGRADE
DROP INDEX IF EXISTS idx_dict_fts;
```

**New service function — FTS search in `backend/app/services/dictionary.py`:**

```python
async def search_entries_fts(
    db: AsyncSession, query: str, limit: int = 30
) -> list[dict]:
    """
    Full-Text Search trên dictionary_entries.
    Hỗ trợ: plain text, phrase search ("cụm từ"), prefix matching (tiếng:*)
    """
    # Convert user query to tsquery
    # Split words, append :* for prefix matching
    words = query.strip().split()
    tsquery_parts = []
    for w in words:
        # Escape special tsquery characters
        clean = w.replace("'", "").replace("\\", "")
        if clean:
            tsquery_parts.append(f"{clean}:*")

    if not tsquery_parts:
        return []

    tsquery = " & ".join(tsquery_parts)

    result = await db.execute(
        text("""
            SELECT
                e.entry_id::text,
                e.word,
                e.meaning,
                ts_rank(
                    to_tsvector('simple', COALESCE(e.word, '') || ' ' || COALESCE(e.meaning, '')),
                    to_tsquery('simple', :query)
                ) AS relevance
            FROM dictionary_entries e
            WHERE e.is_deleted = FALSE
              AND to_tsvector('simple', COALESCE(e.word, '') || ' ' || COALESCE(e.meaning, ''))
                  @@ to_tsquery('simple', :query)
            ORDER BY relevance DESC
            LIMIT :limit
        """),
        {"query": tsquery, "limit": limit},
    )
    entries = [dict(row) for row in result.mappings()]

    # Batch-fetch variations (existing N+1 prevention pattern)
    entry_ids = [e["entry_id"] for e in entries]
    if entry_ids:
        variations_map = await _batch_get_variations(db, entry_ids)
        for entry in entries:
            entry["variations"] = variations_map.get(entry["entry_id"], [])

    return entries


async def _batch_get_variations(db: AsyncSession, entry_ids: list[str]) -> dict[str, list]:
    """Helper: batch fetch variations for multiple entries."""
    if not entry_ids:
        return {}
    placeholders = ", ".join(f":eid{i}" for i in range(len(entry_ids)))
    params = {f"eid{i}": eid for i, eid in enumerate(entry_ids)}
    result = await db.execute(
        text(f"""
            SELECT variation_id::text, entry_id::text, region, video_url, description
            FROM dictionary_variations
            WHERE entry_id IN ({placeholders})
            ORDER BY region ASC
        """),
        params,
    )
    variations_map: dict[str, list] = {eid: [] for eid in entry_ids}
    for row in result.mappings():
        d = dict(row)
        eid = d.pop("entry_id")
        variations_map[eid].append(d)
    return variations_map
```

**New API endpoint:** `GET /api/dictionary/search/fts?q=cụm từ tìm kiếm`

Add to `backend/app/api/dictionary.py`:

```python
@router.get("/dictionary/search/fts")
async def dictionary_fts_search(
    q: str = Query(..., min_length=1, description="Full-text search query"),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Tìm kiếm từ điển với Full-Text Search (tsvector/tsquery).
    Hỗ trợ: prefix matching, phrase search, relevance ranking."""
    from app.services.dictionary import search_entries_fts
    entries = await search_entries_fts(db, q, limit)
    return {"query": q, "total": len(entries), "entries": entries}
```

---

### 2.2 Step 2: Fix Covering Index to Match Blueprint Spec

**Rationale:** The blueprint specifies `(student_id) INCLUDE (course_id, progress, enrolled_at)` for the "My Courses" page. The existing index `idx_enrollments_progress_covering` uses `(student_id, course_id) INCLUDE (progress)` — the `course_id` is in the key, not INCLUDE, and `enrolled_at` is missing.

**Action:** Create migration to replace the covering index:

```sql
-- UPGRADE
-- Drop old covering index
DROP INDEX IF EXISTS idx_enrollments_progress_covering;

-- Create blueprint-spec covering index
-- The "My Courses" query pattern:
--   SELECT course_id, progress, enrolled_at
--   FROM course_enrollments WHERE student_id = $1
-- This index enables an Index-Only Scan — no heap access needed
CREATE INDEX IF NOT EXISTS idx_enrollments_student_cover
ON course_enrollments (student_id)
INCLUDE (course_id, progress, enrolled_at);

-- DOWNGRADE
DROP INDEX IF EXISTS idx_enrollments_student_cover;
CREATE INDEX IF NOT EXISTS idx_enrollments_progress_covering
ON course_enrollments (student_id, course_id) INCLUDE (progress);
```

**Verification — confirm Index-Only Scan:**

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT course_id, progress, enrolled_at
FROM course_enrollments
WHERE student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: "Index Only Scan using idx_enrollments_student_cover"
-- Heap Fetches: 0
```

---

### 2.3 Step 3: Enable `pg_stat_statements` Extension

**Rationale:** This is the single most important tool for quantitative analysis in the thesis. Without it, you cannot produce "before/after" numbers for query performance.

**Action 1:** Create Alembic migration `backend/alembic/versions/XXXX_pg_stat_statements.py`

```sql
-- UPGRADE
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Verify it's working
-- SELECT query, calls, mean_exec_time, total_exec_time
-- FROM pg_stat_statements
-- ORDER BY total_exec_time DESC
-- LIMIT 10;

-- DOWNGRADE
-- DROP EXTENSION IF EXISTS pg_stat_statements;
-- (Keep it — no reason to drop monitoring)
```

**Action 2:** Add to `postgresql.conf` (documentation for deployment):

```ini
# pg_stat_statements configuration
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000
pg_stat_statements.track_utility = on
```

**Action 3:** Create monitoring query script `backend/scripts/monitor_queries.sql`:

```sql
-- ============================================================================
-- TOP 10 CHẬM NHẤT (theo tổng thời gian)
-- ============================================================================
SELECT
    queryid,
    LEFT(query, 120) AS query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) AS avg_ms,
    ROUND(total_exec_time::numeric, 2) AS total_ms,
    ROUND((100.0 * total_exec_time / SUM(total_exec_time) OVER())::numeric, 2) AS pct_total,
    rows,
    shared_blks_hit,
    shared_blks_read,
    ROUND(
        (100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric, 2
    ) AS cache_hit_pct
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 10;

-- ============================================================================
-- TOP 10 GỌI NHIỀU NHẤT
-- ============================================================================
SELECT
    LEFT(query, 120) AS query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) AS avg_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY calls DESC
LIMIT 10;

-- ============================================================================
-- RESET STATS (cho lần benchmark sau)
-- ============================================================================
-- SELECT pg_stat_statements_reset();
```

---

### 2.4 Step 4: Keyset Pagination (Cursor-Based)

**Rationale:** `OFFSET 100000` must scan and discard 100,000 rows. Keyset pagination uses `WHERE created_at < $last_cursor` which hits the index directly — O(1) to find the start position.

**Implementation pattern — `backend/app/core/pagination.py`:**

```python
"""
Keyset (cursor-based) pagination utilities.
Replaces OFFSET-based pagination for list endpoints.
"""
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class CursorPage:
    """Generic cursor-based page result."""

    def __init__(
        self,
        items: list[dict],
        next_cursor: str | None,
        has_more: bool,
    ):
        self.items = items
        self.next_cursor = next_cursor
        self.has_more = has_more

    def to_response(self) -> dict:
        return {
            "items": self.items,
            "next_cursor": self.next_cursor,
            "has_more": self.has_more,
        }


def encode_cursor(value: Any) -> str:
    """Encode a cursor value to opaque string.
    Uses base64 to discourage client-side cursor manipulation."""
    import base64
    return base64.urlsafe_b64encode(str(value).encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> str:
    """Decode cursor back to original value."""
    import base64
    padding = 4 - len(cursor) % 4
    if padding != 4:
        cursor += "=" * padding
    return base64.urlsafe_b64decode(cursor.encode()).decode()
```

**Refactor `get_user_transactions()` to use keyset pagination — `backend/app/services/store.py`:**

```python
async def get_user_transactions_cursor(
    db: AsyncSession,
    user_id: str,
    limit: int = 20,
    cursor: str | None = None,  # encoded created_at ISO timestamp
) -> CursorPage:
    """Lịch sử giao dịch với keyset pagination (cursor-based)."""
    if not is_valid_uuid(user_id):
        return CursorPage([], None, False)

    # Decode cursor
    cursor_ts = None
    if cursor:
        try:
            cursor_ts = decode_cursor(cursor)
        except Exception:
            cursor_ts = None

    # Build query
    if cursor_ts:
        result = await db.execute(
            text("""
                SELECT
                    tl.transaction_id::text,
                    tl.created_at,
                    tl.amount,
                    tl.status,
                    tl.message,
                    CASE WHEN tl.from_wallet_user_id = :uid THEN 'OUT' ELSE 'IN' END AS direction
                FROM transaction_logs tl
                WHERE (tl.from_wallet_user_id = :uid OR tl.to_wallet_user_id = :uid)
                  AND tl.status = 'SUCCESS'
                  AND tl.created_at < :cursor_ts
                ORDER BY tl.created_at DESC
                LIMIT :limit
            """),
            {"uid": user_id, "cursor_ts": cursor_ts, "limit": limit + 1},  # +1 to detect has_more
        )
    else:
        result = await db.execute(
            text("""
                SELECT ...
                FROM transaction_logs tl
                WHERE (tl.from_wallet_user_id = :uid OR tl.to_wallet_user_id = :uid)
                  AND tl.status = 'SUCCESS'
                ORDER BY tl.created_at DESC
                LIMIT :limit
            """),
            {"uid": user_id, "limit": limit + 1},
        )

    rows = [dict(row) for row in result.mappings()]
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    next_cursor = None
    if has_more and rows:
        last_ts = rows[-1]["created_at"]
        next_cursor = encode_cursor(last_ts.isoformat())

    return CursorPage(rows, next_cursor, has_more)
```

**Note on migration strategy:** Keep the old OFFSET-based endpoint and add a NEW keyset endpoint (`GET /api/wallet/{id}/transactions/v2?cursor=...`). This avoids breaking existing clients. After all clients migrate, deprecate the old endpoint.

---

### 2.5 Step 5: Fix N+1 Query in Course Content Tree

**Current problem (`backend/app/services/course_builder.py:8-85`):**

```python
# Query 1: course info
# Query 2: modules (separate round trip)
# Query 3: lessons (separate round trip)
# Query 4: materials (separate round trip)
# Total: 4 DB round trips for one course tree
```

**Fix:** Replace 4 queries with 1 optimized JOIN query, then assemble the tree in Python:

```python
async def get_course_content_optimized(db: AsyncSession, course_id: str) -> dict:
    """Get full course tree in ONE query using JOINs. No N+1."""
    if not is_valid_uuid(course_id):
        raise ValueError("course not found")

    result = await db.execute(
        text("""
            SELECT
                -- Course
                c.course_id::text AS course_id,
                c.title AS course_title,
                c.visibility_status,
                -- Module
                m.module_id::text AS module_id,
                m.title AS module_title,
                m.order_index AS module_order,
                -- Lesson
                l.lesson_id::text AS lesson_id,
                l.title AS lesson_title,
                COALESCE(l.video_url, '') AS lesson_video_url,
                l.order_index AS lesson_order,
                -- Material
                mat.material_id::text AS material_id,
                mat.title AS material_title,
                mat.content_url AS material_url
            FROM general_courses c
            LEFT JOIN general_course_modules m
                ON m.course_id = c.course_id
            LEFT JOIN general_course_lessons l
                ON l.module_id = m.module_id
            LEFT JOIN learning_materials mat
                ON mat.lesson_id = l.lesson_id
            WHERE c.course_id = :cid AND c.is_deleted = FALSE
            ORDER BY m.order_index, l.order_index, mat.material_id
        """),
        {"cid": course_id},
    )

    rows = [dict(row) for row in result.mappings()]
    if not rows:
        raise ValueError("course not found")

    # Assemble tree in Python (single pass)
    course = {
        "course_id": rows[0]["course_id"],
        "title": rows[0]["course_title"],
        "visibility_status": rows[0]["visibility_status"],
        "modules": [],
    }

    modules_map: dict[str, dict] = {}
    lessons_map: dict[str, dict] = {}

    for row in rows:
        # Module
        mid = row["module_id"]
        if mid and mid not in modules_map:
            mod = {
                "module_id": mid,
                "title": row["module_title"],
                "order_index": row["module_order"],
                "lessons": [],
            }
            modules_map[mid] = mod
            course["modules"].append(mod)

        # Lesson
        lid = row["lesson_id"]
        if lid and mid and lid not in lessons_map:
            les = {
                "lesson_id": lid,
                "title": row["lesson_title"],
                "video_url": row["lesson_video_url"],
                "order_index": row["lesson_order"],
                "materials": [],
            }
            lessons_map[lid] = les
            if mid in modules_map:
                modules_map[mid]["lessons"].append(les)

        # Material
        if row["material_id"] and lid:
            mat = {
                "material_id": row["material_id"],
                "title": row["material_title"],
                "content_url": row["material_url"],
            }
            if lid in lessons_map:
                lessons_map[lid]["materials"].append(mat)

    return course
```

**Performance comparison:**
- **Before:** 4 round trips × ~5ms each = ~20ms network latency (local), much worse over WAN
- **After:** 1 round trip × ~5ms + Python assembly (~1ms) = ~6ms
- **Expected improvement:** ~70% reduction in response time

---

### 2.6 Step 6: EXPLAIN ANALYZE Verification Scripts

**File:** `backend/scripts/explain_queries.sql`

```sql
-- ============================================================================
-- EXPLAIN ANALYZE — Các truy vấn chính
-- Chạy từng câu và lưu kết quả để so sánh trước/sau khi thêm index.
-- ============================================================================

-- (A) Tìm kiếm từ điển — TRIGRAM vs FTS
\echo '=== (A1) Trigram Search ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT word, meaning FROM dictionary_entries
WHERE is_deleted = FALSE AND word ILIKE '%ngon%'
LIMIT 30;

\echo '=== (A2) Full-Text Search ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT word, meaning, ts_rank(
    to_tsvector('simple', COALESCE(word,'') || ' ' || COALESCE(meaning,'')),
    to_tsquery('simple', 'ngon:*')
) AS relevance
FROM dictionary_entries
WHERE is_deleted = FALSE
  AND to_tsvector('simple', COALESCE(word,'') || ' ' || COALESCE(meaning,''))
      @@ to_tsquery('simple', 'ngon:*')
ORDER BY relevance DESC
LIMIT 30;

-- (B) Khóa học đã publish (Partial Index test)
\echo '=== (B) Published Courses ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT course_id, title, price
FROM general_courses
WHERE visibility_status = 'PUBLISHED' AND is_deleted = FALSE
ORDER BY updated_at DESC
LIMIT 20;

-- (C) "Khóa học của tôi" (Covering Index test)
\echo '=== (C) My Enrollments — Index-Only Scan ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT course_id, progress, enrolled_at
FROM course_enrollments
WHERE student_id = '00000000-0000-0000-0000-000000000001';

-- (D) Đếm giao dịch theo tháng (BRIN Index test)
\echo '=== (D) Transaction Count by Month (BRIN) ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*)
FROM transaction_logs
WHERE created_at BETWEEN '2026-01-01' AND '2026-06-30'
GROUP BY 1 ORDER BY 1;

-- (E) Keyset Pagination vs OFFSET
\echo '=== (E1) OFFSET Pagination (Deep Page) ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT comment_id, content, created_at
FROM comments
ORDER BY created_at DESC
OFFSET 10000 LIMIT 20;

\echo '=== (E2) Keyset Pagination (Same Position) ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT comment_id, content, created_at
FROM comments
WHERE created_at < '2026-01-15T00:00:00Z'
ORDER BY created_at DESC
LIMIT 20;

-- (F) Leaderboard — View vs Materialized View
\echo '=== (F1) Direct Leaderboard Query ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT
    s.user_id AS student_id, p.full_name,
    ss.highest_streak,
    COUNT(ua.achievement_id) AS achievement_count,
    RANK() OVER (ORDER BY ss.highest_streak DESC, COUNT(ua.achievement_id) DESC) AS rank
FROM students s
JOIN user_profiles p ON p.user_id = s.user_id
LEFT JOIN student_streaks ss ON ss.student_id = s.user_id
LEFT JOIN user_achievements ua ON ua.user_id = s.user_id
GROUP BY s.user_id, p.full_name, ss.highest_streak
ORDER BY rank LIMIT 20;

\echo '=== (F2) Materialized View ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM mv_leaderboard ORDER BY rank LIMIT 20;

-- ============================================================================
-- Kiểm tra index không dùng (Unused Index Detection)
-- ============================================================================
SELECT
    schemaname || '.' || relname AS table_name,
    indexrelname AS index_name,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%pkey%'
ORDER BY pg_relation_size(indexrelid) DESC;
-- Nếu có index nào ở đây → candidate để xóa (tốn disk + làm chậm write)
```

**Python verification helper — `backend/scripts/run_explain.py`:**

```python
"""
Run EXPLAIN ANALYZE on key queries and output JSON for comparison.
Usage: python backend/scripts/run_explain.py > explain_results.json
"""
import asyncio
import json
from app.core.database import async_session
from sqlalchemy import text

QUERIES = {
    "trigram_search": """
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT word, meaning FROM dictionary_entries
        WHERE is_deleted = FALSE AND word ILIKE '%ngon%' LIMIT 30
    """,
    "fts_search": """
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT word, meaning FROM dictionary_entries
        WHERE is_deleted = FALSE
          AND to_tsvector('simple', COALESCE(word,'') || ' ' || COALESCE(meaning,''))
              @@ to_tsquery('simple', 'ngon:*')
        LIMIT 30
    """,
    "published_courses": """
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT course_id, title, price FROM general_courses
        WHERE visibility_status = 'PUBLISHED' AND is_deleted = FALSE
        ORDER BY updated_at DESC LIMIT 20
    """,
    # ... add all key queries
}

async def main():
    results = {}
    async with async_session() as db:
        for name, query in QUERIES.items():
            result = await db.execute(text(query))
            plan = result.scalar()
            results[name] = {
                "plan": plan[0] if plan else None,
                "execution_time_ms": plan[0].get("Execution Time", 0) if plan else 0,
            }
    print(json.dumps(results, indent=2, default=str))

if __name__ == "__main__":
    asyncio.run(main())
```

---

### 2.7 Step 7: Unused Index Detection & Cleanup

**SQL script — `backend/scripts/find_unused_indexes.sql`:**

```sql
-- ============================================================================
-- Phát hiện index không dùng (idx_scan = 0) — candidates để xóa
-- CHÚ Ý: Chỉ phân tích sau khi hệ thống đã chạy production ít nhất 1 tuần
--        (index có thể chưa được dùng trong môi trường dev/test)
-- ============================================================================

-- Indexes with ZERO scans (unused since last stats reset)
SELECT
    schemaname || '.' || relname AS table_name,
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%pkey%'
  AND indexrelname NOT LIKE '%uq_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Indexes with low "ROI" (few scans, large size)
SELECT
    schemaname || '.' || relname AS table_name,
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS scans,
    CASE
        WHEN idx_scan = 0 THEN 'NEVER USED — CANDIDATE FOR DELETION'
        WHEN idx_scan < 100 THEN 'RARELY USED — REVIEW'
        ELSE 'OK'
    END AS recommendation
FROM pg_stat_user_indexes
WHERE indexrelname NOT LIKE '%pkey%'
  AND indexrelname NOT LIKE '%uq_%'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
LIMIT 20;
```

---

## 3. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/alembic/versions/XXXX_dict_fulltext_search.py` | **CREATE** | FTS index migration |
| `backend/alembic/versions/XXXX_fix_covering_index.py` | **CREATE** | Replace covering index |
| `backend/alembic/versions/XXXX_pg_stat_statements.py` | **CREATE** | Enable monitoring extension |
| `backend/app/core/pagination.py` | **CREATE** | Keyset pagination utilities |
| `backend/app/services/dictionary.py` | **MODIFY** | Add `search_entries_fts()` |
| `backend/app/api/dictionary.py` | **MODIFY** | Add `/dictionary/search/fts` endpoint |
| `backend/app/services/course_builder.py` | **MODIFY** | Add `get_course_content_optimized()` |
| `backend/app/services/store.py` | **MODIFY** | Add `get_user_transactions_cursor()` |
| `backend/app/api/store.py` | **MODIFY** | Add v2 transactions endpoint with cursor |
| `backend/scripts/monitor_queries.sql` | **CREATE** | `pg_stat_statements` top-N queries |
| `backend/scripts/explain_queries.sql` | **CREATE** | EXPLAIN ANALYZE scripts |
| `backend/scripts/run_explain.py` | **CREATE** | Python EXPLAIN runner |
| `backend/scripts/find_unused_indexes.sql` | **CREATE** | Unused index detection |

---

## 4. Verification Strategy

### 4.1 Python Tests

```python
class TestFullTextSearch:
    """Verify FTS index is used and returns correct results."""

    async def test_fts_matches_word(self, db_session):
        """Tìm "ngon" → trả về entries có "ngon ngữ"."""
        ...

    async def test_fts_ranking(self, db_session):
        """Exact match ranks higher than partial match."""
        ...

    async def test_fts_index_used(self, db_session):
        """EXPLAIN shows GIN index scan, not Seq Scan."""
        result = await db_session.execute(text(
            "EXPLAIN SELECT ... WHERE to_tsvector(...) @@ to_tsquery(...)"
        ))
        plan = "".join(str(r) for r in result.fetchall())
        assert "Index Scan" in plan or "Bitmap Index Scan" in plan


class TestKeysetPagination:
    """Verify cursor-based pagination."""

    async def test_first_page_no_cursor(self, db_session):
        """First page: no cursor, returns items + next_cursor."""

    async def test_second_page_with_cursor(self, db_session):
        """Second page: uses cursor, returns disjoint set."""

    async def test_last_page_no_next(self, db_session):
        """Last page: has_more=False, next_cursor=None."""

    async def test_cursor_stable_order(self, db_session):
        """No duplicates across pages, no missing items."""


class TestOptimizedCourseTree:
    """Verify single-query course tree is correct."""

    async def test_tree_structure(self, db_session):
        """Modules → lessons → materials nesting is correct."""

    async def test_empty_course(self, db_session):
        """Course with no modules returns empty modules list, not error."""

    async def test_equivalent_to_old(self, db_session):
        """Optimized version returns same data as old 4-query version."""
        old = await get_course_content(db_session, course_id)
        new = await get_course_content_optimized(db_session, course_id)
        assert old == new
```

### 4.2 SQL Verification

```sql
-- Verify FTS index is used
EXPLAIN (ANALYZE, BUFFERS)
SELECT word FROM dictionary_entries
WHERE to_tsvector('simple', word || ' ' || meaning) @@ to_tsquery('simple', 'ngon:*');
-- Expected: "Bitmap Index Scan on idx_dict_fts"

-- Verify Covering Index enables Index-Only Scan
EXPLAIN (ANALYZE, BUFFERS)
SELECT course_id, progress, enrolled_at
FROM course_enrollments WHERE student_id = '...';
-- Expected: "Index Only Scan using idx_enrollments_student_cover"
-- "Heap Fetches: 0"

-- Verify pg_stat_statements is tracking
SELECT COUNT(*) FROM pg_stat_statements;
-- Expected: > 0

-- Verify no unused indexes (after system has run)
SELECT COUNT(*) FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%pkey%';
-- Goal: 0 (all indexes are being used)
```

### 4.3 Acceptance Criteria

- [ ] `idx_dict_fts` created and used by FTS queries (confirmed via EXPLAIN)
- [ ] FTS search returns relevance-ranked results for Vietnamese text
- [ ] `idx_enrollments_student_cover` enables Index-Only Scan (0 heap fetches)
- [ ] `pg_stat_statements` enabled and collecting query statistics
- [ ] Keyset pagination returns disjoint pages with no duplicates
- [ ] Keyset pagination uses index (no Seq Scan on deep pages)
- [ ] `get_course_content_optimized()` returns identical data to original 4-query version
- [ ] Optimized course tree query executes in 1 round trip
- [ ] Unused index report identifies any indexes that can be dropped
- [ ] All existing tests still pass

---

## 5. Estimated Effort

| Step | Hours |
|------|-------|
| FTS index migration + service | 2.0h |
| Fix covering index | 0.5h |
| pg_stat_statements setup | 1.0h |
| Keyset pagination core + refactor 3 endpoints | 3.0h |
| N+1 fix for course tree | 2.0h |
| EXPLAIN ANALYZE scripts | 1.5h |
| Unused index detection | 0.5h |
| Tests | 2.5h |
| **Total** | **13.0h** |
