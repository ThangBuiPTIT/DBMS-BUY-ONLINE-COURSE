# Plan Phase 5: Table Partitioning & Data Distribution

**Status:** 📋 Planning  
**Blueprint Reference:** `Ke_hoach_ap_dung_HQTCSDL_Elearning.md` — Phần 7 (Partitioning) + Phần 8 (Distribution/Replication)  
**Target Branch:** `fastapi`  
**Prerequisites:** Plans 1-4 complete, PostgreSQL 15+

---

## 1. Current State Audit

### 1.1 What Exists

The SQLAlchemy models already have **partition-ready composite primary keys**:

| Table | Model File | Composite PK | Ready for Partitioning? |
|-------|-----------|-------------|------------------------|
| `transaction_logs` | `models/store.py:45` | `(transaction_id, created_at)` | ✅ PK includes partition key |
| `transaction_action_logs` | `models/store.py:81` | `(action_log_id, created_at)` | ✅ PK includes partition key |
| `log` | `models/notification.py:23` | `(log_id, created_at)` | ✅ PK includes partition key |
| `audit_logs` | `models/notification.py:40` | `(audit_id, created_at)` | ✅ PK includes partition key |
| `notification_users` | `models/notification.py:64` | `(notification_id, created_at)` | ✅ PK includes partition key |

However, **NONE of these tables are actually partitioned** — there is no `PARTITION BY RANGE` DDL in any migration. The composite PKs were added in anticipation of partitioning, but the actual partition creation hasn't been done.

### 1.2 Distribution & Replication Status

| Blueprint Technique | Status |
|-------------------|--------|
| Streaming Replication (Primary + Replica) | ❌ Not configured |
| Read/Write Splitting in app code | ❌ Not implemented |
| Logical Replication to OLAP | ❌ Not configured |
| CDN + Object Storage for media URLs | ⚠️ Schema supports it (`video_url`, `content_url`, `avatar_url` are URLs) but no actual CDN config |

### 1.3 Why This Matters

- **Partitioning:** The 5 log tables grow unbounded. Without partitioning:
  - `DELETE old_rows` is painfully slow (must scan + vacuum)
  - Queries scanning all time must read the entire table
  - With partitioning: `DETACH PARTITION` + `DROP` is instant (metadata-only operation)
- **Partition pruning:** `WHERE created_at >= '2026-06-01'` only scans June's partition — not the entire table
- **Read replica:** Offload reporting queries from the primary, critical as the platform scales

---

## 2. Implementation Plan — Partitioning

### 2.1 Step 1: Convert `transaction_logs` to Partitioned Table

**Critical constraint:** PostgreSQL requires the partition key to be part of every unique/primary key constraint. Our models already satisfy this — `PRIMARY KEY (transaction_id, created_at)`.

**Action:** Create Alembic migration `backend/alembic/versions/XXXX_partition_transaction_logs.py`

```sql
-- UPGRADE
-- Bước 1: Tạo bảng cha phân vùng (thay thế bảng cũ)
-- Nếu bảng đã có dữ liệu, cần migrate cẩn thận. Với môi trường dev: drop + recreate.

-- 1a. Backup dữ liệu (nếu có)
-- CREATE TABLE transaction_logs_backup AS SELECT * FROM transaction_logs;

-- 1b. Drop bảng cũ
DROP TABLE IF EXISTS transaction_action_logs CASCADE;
DROP TABLE IF EXISTS transaction_logs CASCADE;

-- 1c. Tạo bảng cha với PARTITION BY RANGE
CREATE TABLE transaction_logs (
    transaction_id      UUID DEFAULT gen_random_uuid(),
    from_wallet_user_id UUID REFERENCES wallets(user_id) ON DELETE RESTRICT,
    to_wallet_user_id   UUID REFERENCES wallets(user_id) ON DELETE RESTRICT,
    amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    status              VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'ROLLED_BACK')),
    message             TEXT,
    related_course_id   UUID REFERENCES general_courses(course_id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (transaction_id, created_at)
) PARTITION BY RANGE (created_at);

-- 1d. Tạo partition cho tháng hiện tại + 6 tháng tới
CREATE TABLE transaction_logs_2026_06
    PARTITION OF transaction_logs
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE transaction_logs_2026_07
    PARTITION OF transaction_logs
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE transaction_logs_2026_08
    PARTITION OF transaction_logs
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE transaction_logs_2026_09
    PARTITION OF transaction_logs
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE transaction_logs_2026_10
    PARTITION OF transaction_logs
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE transaction_logs_2026_11
    PARTITION OF transaction_logs
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE transaction_logs_2026_12
    PARTITION OF transaction_logs
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- 1e. Tạo lại BRIN indexes trên từng partition
-- (PostgreSQL không tự động tạo index trên partition — cần tạo trên bảng cha)
CREATE INDEX idx_tx_logs_created_brin
    ON transaction_logs USING BRIN (created_at) WITH (pages_per_range = 32);

CREATE INDEX idx_tx_logs_status
    ON transaction_logs (status, created_at);

-- 1f. Khôi phục dữ liệu (nếu có backup)
-- INSERT INTO transaction_logs SELECT * FROM transaction_logs_backup;

-- DOWNGRADE
DROP TABLE IF EXISTS transaction_logs CASCADE;

CREATE TABLE transaction_logs (
    transaction_id      UUID DEFAULT gen_random_uuid(),
    from_wallet_user_id UUID REFERENCES wallets(user_id) ON DELETE RESTRICT,
    to_wallet_user_id   UUID REFERENCES wallets(user_id) ON DELETE RESTRICT,
    amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    status              VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'ROLLED_BACK')),
    message             TEXT,
    related_course_id   UUID REFERENCES general_courses(course_id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (transaction_id, created_at)
);
```

### 2.2 Step 2: Partition Remaining 4 Tables

Same pattern for `transaction_action_logs`, `log`, `audit_logs`, `notification_users`.

**Action:** Create migration `backend/alembic/versions/XXXX_partition_all_log_tables.py`

```sql
-- UPGRADE
-- ============================================================================
-- transaction_action_logs
-- ============================================================================
DROP TABLE IF EXISTS transaction_action_logs CASCADE;
CREATE TABLE transaction_action_logs (
    action_log_id   UUID DEFAULT gen_random_uuid(),
    transaction_id  UUID,
    action_type     VARCHAR(40) NOT NULL,
    message         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (action_log_id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================================================
-- log (general system log)
-- ============================================================================
DROP TABLE IF EXISTS log CASCADE;
CREATE TABLE log (
    log_id      UUID DEFAULT gen_random_uuid(),
    action      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (log_id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================================================
-- audit_logs
-- ============================================================================
DROP TABLE IF EXISTS audit_logs CASCADE;
CREATE TABLE audit_logs (
    audit_id        UUID DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL,
    action          VARCHAR(50) NOT NULL,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'ROLLED_BACK')),
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================================================
-- notification_users
-- ============================================================================
DROP TABLE IF EXISTS notification_users CASCADE;
CREATE TABLE notification_users (
    notification_id UUID DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================================================
-- Tạo partition cho từng bảng (tháng hiện tại + 5 tháng tới)
-- Dùng DO block để tạo tự động
-- ============================================================================
DO $$
DECLARE
    v_start DATE;
    v_end   DATE;
    v_tbl   TEXT;
    v_sql   TEXT;
    v_month  TEXT;
    v_tables TEXT[] := ARRAY[
        'transaction_action_logs',
        'log',
        'audit_logs',
        'notification_users'
    ];
BEGIN
    FOR i IN 0..5 LOOP
        v_start := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        v_end   := v_start + INTERVAL '1 month';
        v_month := TO_CHAR(v_start, 'YYYY_MM');

        FOREACH v_tbl IN ARRAY v_tables LOOP
            v_sql := FORMAT(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                v_tbl || '_' || v_month,
                v_tbl,
                v_start,
                v_end
            );
            EXECUTE v_sql;
        END LOOP;
    END LOOP;
END $$;

-- Tạo BRIN indexes trên bảng cha (sẽ áp dụng cho tất cả partition)
CREATE INDEX IF NOT EXISTS idx_tx_action_created_brin ON transaction_action_logs USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_log_created_brin ON log USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created_brin ON audit_logs USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_notif_created_brin ON notification_users USING BRIN (created_at);

-- DOWNGRADE
-- (restore non-partitioned tables — destructive, data loss)
```

---

### 2.3 Step 3: Automatic Partition Management — `pg_partman`

**Rationale:** Manually creating partitions every month is not sustainable. `pg_partman` automates partition creation and retention.

**Setup — `backend/app/db/pg_partman_setup.sql`:**

```sql
-- ============================================================================
-- pg_partman Setup — Tự động quản lý partition
-- Yêu cầu: pg_partman đã được cài đặt (CREATE EXTENSION pg_partman)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_partman;

-- Cấu hình pg_partman cho transaction_logs
-- partman.create_parent(): đăng ký bảng cha với pg_partman
-- p_interval: '1 month'
-- p_premake: 4 (tạo sẵn 4 partition trong tương lai)
-- p_start_partition: bắt đầu từ tháng hiện tại

SELECT partman.create_parent(
    p_parent_table   := 'public.transaction_logs',
    p_control        := 'created_at',
    p_type           := 'native',
    p_interval       := '1 month',
    p_premake        := 4,
    p_start_partition := '2026-06-01'
);

SELECT partman.create_parent(
    p_parent_table   := 'public.transaction_action_logs',
    p_control        := 'created_at',
    p_type           := 'native',
    p_interval       := '1 month',
    p_premake        := 4,
    p_start_partition := '2026-06-01'
);

SELECT partman.create_parent(
    p_parent_table   := 'public.log',
    p_control        := 'created_at',
    p_type           := 'native',
    p_interval       := '1 month',
    p_premake        := 4,
    p_start_partition := '2026-06-01'
);

SELECT partman.create_parent(
    p_parent_table   := 'public.audit_logs',
    p_control        := 'created_at',
    p_type           := 'native',
    p_interval       := '1 month',
    p_premake        := 4,
    p_start_partition := '2026-06-01'
);

SELECT partman.create_parent(
    p_parent_table   := 'public.notification_users',
    p_control        := 'created_at',
    p_type           := 'native',
    p_interval       := '1 month',
    p_premake        := 4,
    p_start_partition := '2026-06-01'
);

-- ============================================================================
-- Retention Policy: tự động DETACH partition > 12 tháng
-- ============================================================================
UPDATE partman.part_config
SET retention = '12 months',
    retention_keep_table = true  -- DETACH thay vì DROP (giữ lại để backup)
WHERE parent_table IN (
    'public.transaction_logs',
    'public.transaction_action_logs',
    'public.log',
    'public.audit_logs',
    'public.notification_users'
);

-- ============================================================================
-- pg_partman background worker (chạy trong PostgreSQL)
-- Nếu dùng pg_cron để schedule partman.run_maintenance():
-- ============================================================================
SELECT cron.schedule(
    'partman-maintenance',
    '@hourly',
    $$SELECT partman.run_maintenance()$$
);

-- Xem trạng thái partition
SELECT
    parent_table,
    partition_table,
    rows,
    pg_size_pretty(pg_relation_size(partition_table::regclass)) AS size
FROM partman.show_partitions('public.transaction_logs');
```

---

### 2.4 Step 4: Partition Pruning Verification

**SQL script — `backend/scripts/verify_partition_pruning.sql`:**

```sql
-- Kiểm tra partition pruning hoạt động
-- Query trong tháng hiện tại → chỉ scan 1 partition

\echo '=== Query trong 1 tháng — nên chỉ scan 1 partition ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*)
FROM transaction_logs
WHERE created_at >= '2026-06-01' AND created_at < '2026-07-01';

-- Expected plan:
--   -> Aggregate
--       -> Append
--           -> Seq Scan on transaction_logs_2026_06  ← ONLY this partition
--   Planning Time: ...
--   Execution Time: ...

\echo '=== Query toàn bộ — nên scan tất cả partition ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM transaction_logs;

-- Liệt kê tất cả partition của 1 bảng
SELECT
    nmsp_parent.nspname AS parent_schema,
    parent.relname      AS parent_table,
    child.relname       AS partition_name,
    pg_get_expr(child.relpartbound, child.oid) AS partition_range
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child  ON pg_inherits.inhrelid  = child.oid
JOIN pg_namespace nmsp_parent ON nmsp_parent.oid = parent.relnamespace
WHERE parent.relname = 'transaction_logs'
ORDER BY child.relname;

-- So sánh kích thước partition
SELECT
    child.relname AS partition_name,
    pg_size_pretty(pg_relation_size(child.oid)) AS size,
    pg_stat_get_live_tuples(child.oid) AS live_rows
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child  ON pg_inherits.inhrelid  = child.oid
WHERE parent.relname = 'transaction_logs'
ORDER BY child.relname;
```

---

## 3. Implementation Plan — Distribution & Replication

### 3.1 Step 5: Read/Write Splitting Configuration

**File to create:** `backend/app/core/database.py` (extend with replica support)

```python
"""
Database connection pool with Read/Write splitting support.
When REPLICA_DATABASE_URL is set, SELECT queries route to replica.
"""
import sys
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings


# Primary (Write) engine
primary_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
)

# Replica (Read) engine — optional
if settings.REPLICA_DATABASE_URL:
    replica_engine = create_async_engine(
        settings.REPLICA_DATABASE_URL,
        echo=settings.DEBUG,
        pool_size=10,
        max_overflow=20,
    )
else:
    replica_engine = primary_engine  # Fallback to primary

# Test mode: use NullPool
if "pytest" in sys.modules:
    primary_engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        poolclass=NullPool,
    )
    replica_engine = primary_engine


PrimarySession = async_sessionmaker(
    primary_engine, class_=AsyncSession, expire_on_commit=False
)
ReplicaSession = async_sessionmaker(
    replica_engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db():
    """Primary DB session (for writes)."""
    async with PrimarySession() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_replica_db():
    """Replica DB session (for reads). Use for GET endpoints that don't need
    strong consistency."""
    async with ReplicaSession() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_db_for_endpoint(method: str):
    """
    Route to correct DB based on HTTP method.
    GET/HEAD → replica (if available), POST/PUT/DELETE → primary.
    """
    if method in ("GET", "HEAD"):
        return get_replica_db()
    return get_db()
```

**Configuration — add to `backend/app/core/config.py`:**

```python
# Read Replica (optional)
REPLICA_DATABASE_URL: str | None = None  # e.g. "postgresql+asyncpg://user:pass@replica-host:5432/elearning_db"
```

**Usage in API endpoints — `backend/app/api/router.py`:**

```python
from app.core.database import get_db, get_replica_db

# Read endpoints → use replica
@router.get("/api/store/courses")
async def get_courses(db: AsyncSession = Depends(get_replica_db)):
    ...

# Write endpoints → use primary (default)
@router.post("/api/store/checkout")
async def checkout(db: AsyncSession = Depends(get_db)):
    ...
```

**Important caveat (for thesis):** Read replicas have **replication lag** (typically <100ms). After a write (e.g., top-up wallet), the subsequent read might not see the new balance if routed to the replica. Strategy:
- Financial reads (wallet balance, transaction history after purchase) → always route to **primary**
- Catalog reads (course listings, dictionary) → safe to route to **replica**

### 3.2 Step 6: CDN & Object Storage URL Separation

**File to create:** `backend/app/core/media.py`

```python
"""
Media URL helper — separates CDN URLs from database storage.
Database stores relative paths. This module resolves them to full CDN URLs.
"""
from app.core.config import settings


def cdn_url(db_path: str | None, asset_type: str = "general") -> str:
    """
    Convert DB-stored path to full CDN URL.

    Args:
        db_path: Path stored in DB (e.g., 'courses/intro.mp4' or full URL)
        asset_type: 'video', 'image', 'content', 'avatar'

    Returns:
        Full CDN URL if CDN is configured, otherwise original path.
    """
    if not db_path:
        return ""

    # Already a full URL (e.g., signed S3 URL) → return as-is
    if db_path.startswith("http://") or db_path.startswith("https://"):
        return db_path

    # Resolve via CDN base URL
    cdn_base = getattr(settings, "CDN_BASE_URL", None)
    if cdn_base:
        return f"{cdn_base.rstrip('/')}/{db_path.lstrip('/')}"

    # Fallback: local/relative path
    return db_path


# Asset type specific helpers
def video_url(db_path: str | None) -> str:
    return cdn_url(db_path, "video")

def image_url(db_path: str | None) -> str:
    return cdn_url(db_path, "image")

def avatar_url(db_path: str | None) -> str:
    return cdn_url(db_path, "avatar")
```

**Add to config.py:**

```python
# CDN / Object Storage
CDN_BASE_URL: str | None = None  # e.g. "https://cdn.example.com"
S3_ENDPOINT: str | None = None    # e.g. "https://s3.amazonaws.com/mybucket"
S3_ACCESS_KEY: str | None = None
S3_SECRET_KEY: str | None = None
```

**Architecture note for thesis:**
- **Hot data** (user profiles, course metadata) → PostgreSQL (indexed, ACID)
- **Cold data** (video files, images, PDFs) → Object Storage (S3/MinIO) + CDN
- Database only stores **references** (URLs), not the binary blobs
- This separation reduces DB size by orders of magnitude (video files are GBs; URLs are bytes)

---

## 4. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/alembic/versions/XXXX_partition_transaction_logs.py` | **CREATE** | Partition transaction_logs |
| `backend/alembic/versions/XXXX_partition_all_log_tables.py` | **CREATE** | Partition remaining 4 tables |
| `backend/app/db/pg_partman_setup.sql` | **CREATE** | pg_partman configuration |
| `backend/app/core/config.py` | **MODIFY** | Add REPLICA_DATABASE_URL, CDN settings |
| `backend/app/core/database.py` | **MODIFY** | Add replica engine + `get_replica_db()` |
| `backend/app/core/media.py` | **CREATE** | CDN URL resolution helper |
| `backend/scripts/verify_partition_pruning.sql` | **CREATE** | Partition pruning test queries |
| `backend/app/api/router.py` | **MODIFY** | Some read endpoints use replica |

---

## 5. Verification Strategy

### 5.1 Python Tests

```python
class TestTablePartitioning:
    """Verify tables are partitioned and partition pruning works."""

    async def test_partitioned_tables_exist(self, db_session):
        """All 5 tables should be partitioned."""
        result = await db_session.execute(text("""
            SELECT relname FROM pg_class
            WHERE relkind = 'p' AND relname IN (
                'transaction_logs', 'transaction_action_logs',
                'log', 'audit_logs', 'notification_users'
            )
        """))
        partitioned = {row[0] for row in result.fetchall()}
        assert len(partitioned) == 5

    async def test_partitions_created(self, db_session):
        """At least 6 partitions should exist for each table."""
        result = await db_session.execute(text("""
            SELECT COUNT(*) FROM pg_inherits
            JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
            WHERE parent.relname = 'transaction_logs'
        """))
        count = result.scalar()
        assert count >= 6  # Current month + 5 future

    async def test_data_routes_to_correct_partition(self, db_session):
        """Inserting a row should go to the correct partition."""
        # Insert a row with June 2026 timestamp
        await db_session.execute(text("""
            INSERT INTO transaction_logs
                (transaction_id, from_wallet_user_id, to_wallet_user_id,
                 amount, status, created_at)
            VALUES
                (gen_random_uuid(), NULL, NULL, 100, 'SUCCESS', '2026-06-15')
        """))
        await db_session.commit()

        # Verify it's in the June partition
        result = await db_session.execute(text("""
            SELECT COUNT(*) FROM transaction_logs_2026_06
        """))
        assert result.scalar() > 0

    async def test_partition_pruning(self, db_session):
        """EXPLAIN shows only 1 partition scanned for month-bounded query."""
        result = await db_session.execute(text("""
            EXPLAIN SELECT COUNT(*) FROM transaction_logs
            WHERE created_at >= '2026-06-01' AND created_at < '2026-07-01'
        """))
        plan = "".join(str(r) for r in result.fetchall())
        # Should only scan transaction_logs_2026_06
        assert "transaction_logs_2026_06" in plan
        # Should NOT scan other partitions
        assert "transaction_logs_2026_07" not in plan


class TestReadWriteSplitting:
    """Verify read/write routing."""

    def test_replica_config_falls_back_to_primary(self):
        """When REPLICA_DATABASE_URL is not set, replica = primary."""
        from app.core.config import settings
        if not settings.REPLICA_DATABASE_URL:
            from app.core.database import primary_engine, replica_engine
            assert primary_engine is replica_engine

    async def test_write_goes_to_primary(self, db_session):
        """INSERT should succeed on primary."""
        ...


class TestCDNMediaUrls:
    """Verify CDN URL resolution."""

    def test_full_url_passthrough(self):
        """Already-full URLs should not be modified."""
        from app.core.media import video_url
        signed = "https://s3.amazonaws.com/bucket/video.mp4?sign=xyz"
        assert video_url(signed) == signed

    def test_relative_path_resolved(self):
        """Relative paths should get CDN prefix."""
        from app.core import media
        import app.core.config as cfg
        # Monkey-patch for test
        cfg.settings.CDN_BASE_URL = "https://cdn.example.com"
        assert media.video_url("courses/intro.mp4") == "https://cdn.example.com/courses/intro.mp4"
        cfg.settings.CDN_BASE_URL = None  # Reset
```

### 5.2 SQL Verification

```sql
-- Kiểm tra bảng nào đã được partition
SELECT relname AS table_name,
       CASE relkind
           WHEN 'p' THEN 'PARTITIONED TABLE'
           WHEN 'r' THEN 'PARTITION'
           ELSE relkind::text
       END AS table_type
FROM pg_class
WHERE relname IN (
    'transaction_logs', 'transaction_action_logs',
    'log', 'audit_logs', 'notification_users'
)
ORDER BY relname;

-- Xem danh sách partition của transaction_logs
SELECT
    child.relname AS partition_name,
    pg_get_expr(child.relpartbound, child.oid) AS date_range,
    pg_size_pretty(pg_relation_size(child.oid)) AS size
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child  ON pg_inherits.inhrelid  = child.oid
WHERE parent.relname = 'transaction_logs'
ORDER BY child.relname;

-- Test: DETACH partition cũ (nhanh — metadata only)
-- ALTER TABLE transaction_logs DETACH PARTITION transaction_logs_2025_01;
-- DROP TABLE transaction_logs_2025_01;  -- hoặc giữ lại để archive
```

### 5.3 Acceptance Criteria

- [ ] `transaction_logs` is a RANGE-partitioned table by `created_at`
- [ ] `transaction_action_logs`, `log`, `audit_logs`, `notification_users` are all partitioned
- [ ] At least 6 monthly partitions exist for each table (current + 5 future)
- [ ] `EXPLAIN` confirms partition pruning: query for 1 month scans only 1 partition
- [ ] Insert into `transaction_logs` routes to the correct monthly partition
- [ ] `pg_partman` is configured to auto-create future partitions + retention
- [ ] `DETACH PARTITION` works (metadata-only, instant)
- [ ] Read/Write splitting routes GET to replica when configured
- [ ] CDN URL helper resolves relative paths to full CDN URLs
- [ ] All existing API endpoints still work after partitioning

---

## 6. Rollback Plan

**IMPORTANT:** Partitioning is a one-way operation. Rolling back requires:

```sql
-- 1. Export data from all partitions
CREATE TABLE transaction_logs_backup AS
SELECT * FROM transaction_logs;

-- 2. Drop partitioned table
DROP TABLE transaction_logs CASCADE;

-- 3. Recreate as non-partitioned table
CREATE TABLE transaction_logs (
    transaction_id UUID DEFAULT gen_random_uuid(),
    ...
    PRIMARY KEY (transaction_id, created_at)
);

-- 4. Restore data
INSERT INTO transaction_logs SELECT * FROM transaction_logs_backup;
DROP TABLE transaction_logs_backup;
```

---

## 7. Estimated Effort

| Step | Hours |
|------|-------|
| Partition migration — transaction_logs | 1.5h |
| Partition migration — remaining 4 tables | 1.5h |
| pg_partman configuration | 1.0h |
| Read/Write splitting config | 1.5h |
| CDN media helper | 0.5h |
| Partition pruning verification | 1.0h |
| Tests | 1.5h |
| **Total** | **8.5h** |
