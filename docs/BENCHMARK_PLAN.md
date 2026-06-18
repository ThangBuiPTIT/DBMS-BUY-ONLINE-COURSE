# Benchmark Plan — E-Learning Platform Performance Measurement

**Date:** 2026-06-18
**Branch:** `fastapi`
**Purpose:** Define benchmarks, data generation strategies, and measurement methodology for the DBMS E-Learning platform thesis.

---

## 1. Why Benchmarking Matters for This System

The thesis (`Ke_hoach_ap_dung_HQTCSDL_Elearning.md`) applies 12 database optimization techniques. Each technique must be justified with **quantitative before/after evidence**:

- Without benchmarks, claims like "FTS is faster than ILIKE" or "partition pruning reduces scan time" are unsubstantiated.
- With benchmarks, the thesis demonstrates the **trade-off** between each technique's cost and benefit.

**Core principle from the blueprint:** "A system cannot optimize every table uniformly. Measuring first, classifying, then applying the right technique is the difference between an experienced engineer's design and a theoretical one."

---

## 2. System Access Pattern Classification

Before defining benchmarks, classify every table by its access pattern (from the blueprint analysis):

### 2.1 Read-Heavy — Lookup (Tra cứu)

| Table | Query Pattern | Dominant Operation | Growth Rate |
|-------|--------------|-------------------|-------------|
| `dictionary_entries` | Search by keyword (ILIKE, FTS, trigram) | SELECT 95%, INSERT 5% | Slow (manual curation) |
| `dictionary_variations` | Fetch by entry_id (batch) | SELECT 95%, INSERT 5% | Slow |
| `dictionary_categories` | List all | SELECT 99% | Static |
| `microlearning_topics` | Nested JSON aggregation (topics->units->lessons) | SELECT 99% | Slow |
| `microlearning_units` | Fetch by topic_id | SELECT 99% | Slow |
| `microlearning_lessons` | Fetch by unit_id | SELECT 99% | Slow |

**Benchmarks:** Search latency (p50/p95/p99), FTS vs ILIKE vs trigram, cache hit rate

### 2.2 Read-Heavy — Catalog (Danh mục khóa học)

| Table | Query Pattern | Dominant Operation | Growth Rate |
|-------|--------------|-------------------|-------------|
| `general_course_categories` | List all | SELECT 99% | Static |
| `general_courses` | Filter PUBLISHED + not deleted, search by category | SELECT 90%, UPDATE 10% | Moderate |
| `general_course_modules` | Tree fetch (course -> modules -> lessons -> materials) | SELECT 95%, INSERT 5% | Moderate |
| `general_course_lessons` | Fetch by module_id | SELECT 95% | Moderate |
| `learning_materials` | Fetch by lesson_id | SELECT 98% | Moderate |

**Benchmarks:** Storefront listing latency, course detail tree latency (N+1 vs optimized), Redis catalog cache hit rate

### 2.3 Write-Heavy — Time-Series (Log hệ thống)

| Table | Query Pattern | Dominant Operation | Growth Rate |
|-------|--------------|-------------------|-------------|
| `transaction_logs` | Append-only + range queries by date | INSERT 80%, SELECT 20% | Fast (every purchase, topup, refund) |
| `transaction_action_logs` | Append-only | INSERT 99% | Fast |
| `log` | Append-only | INSERT 99% | Fast |
| `audit_logs` | Append-only + admin range queries | INSERT 90%, SELECT 10% | Fast |
| `notification_users` | Append + point-read by user_id + UPDATE is_read | INSERT 60%, SELECT 30%, UPDATE 10% | Fast |

**Benchmarks:** Insert throughput (rows/sec), partition pruning effectiveness, BRIN vs B-tree index size, range query latency

### 2.4 Critical Consistency — Financial (Tài chính)

| Table | Query Pattern | Dominant Operation |
|-------|--------------|-------------------|
| `wallets` | Hot row — UPDATE balance, SELECT balance | UPDATE 60%, SELECT 40% |
| `course_enrollments` | INSERT on purchase, UPDATE progress | INSERT 30%, UPDATE 50%, SELECT 20% |

**Benchmarks:** Concurrent transfer TPS, deadlock count under load, isolation level correctness

### 2.5 Session / Short-Lived (Phiên đăng nhập)

| Table | Query Pattern | Dominant Operation |
|-------|--------------|-------------------|
| `authentication_sessions` | INSERT on login, SELECT on auth check, DELETE on logout/expiry | INSERT 30%, SELECT 50%, DELETE 20% |

**Benchmarks:** Redis vs PostgreSQL session lookup latency, TTL eviction correctness

### 2.6 Hot-Update — Gamification (Gamification)

| Table | Query Pattern | Dominant Operation |
|-------|--------------|-------------------|
| `student_streaks` | UPDATE current_streak daily, SELECT for dashboard | UPDATE 70%, SELECT 30% |
| `user_achievements` | INSERT on award, SELECT for display | INSERT 30%, SELECT 70% |
| `user_feedbacks` | INSERT with trigger validation, SELECT aggregate | INSERT 40%, SELECT 60% |

**Benchmarks:** Trigger overhead on INSERT, mv_leaderboard refresh time, ZSET vs MV leaderboard latency

---

## 3. Benchmark Categories

### Category A: Query Performance Benchmarks (Micro-benchmarks)

**Goal:** Prove each DBMS technique works in isolation.

| # | Benchmark | Technique Tested | Measurement | Target |
|---|----------|-----------------|-------------|--------|
| A1 | Dictionary search: ILIKE vs FTS vs Trigram | Full-Text Search, GIN index | p50/p95/p99 latency for 1000 searches | FTS p95 < 10ms |
| A2 | Course catalog: direct query vs covering index | Covering Index (INCLUDE) | Index-only scan vs seq scan blocks read | Index-only: heap_blks_read = 0 |
| A3 | Deep pagination: OFFSET vs Keyset cursor | Keyset Pagination | Latency at page 1, 10, 100, 1000 | Keyset flat; OFFSET linear growth |
| A4 | Leaderboard: direct query vs Materialized View | Materialized View | Latency, staleness window | MV < 5ms, stale < 5 min |
| A5 | Transaction insert: unpartitioned vs partitioned | Range Partitioning | Insert 100K rows, then SELECT by month | Partition: scan 1 child; unpartitioned: seq scan |
| A6 | Session lookup: PostgreSQL vs Redis | Redis Cache | p50/p95 latency | Redis p95 < 2ms |
| A7 | Course tree: N+1 (4 queries) vs JOIN (1 query) | Query Optimization | Total fetch time for 1 course | Single JOIN < 20ms |
| A8 | BRIN vs B-tree on transaction_logs.created_at | BRIN Index | Index size + range query latency | BRIN 100x smaller, comparable speed |
| A9 | FTS relevance ranking vs simple ILIKE ORDER BY | GIN + ts_rank | Result quality + latency | FTS returns relevant results; ILIKE returns noise |
| A10 | Transfer with SERIALIZABLE vs READ COMMITTED | Isolation Levels | Write-skew occurrences under 50 concurrent txns | SERIALIZABLE: 0 write-skew |

### Category B: Throughput Benchmarks (Load Testing)

**Goal:** Measure system capacity and identify bottlenecks.

| # | Benchmark | Workload | Concurrency Levels | Target |
|---|----------|---------|-------------------|--------|
| B1 | Wallet topup throughput | `sp_topup_wallet` calls | 10, 50, 100, 200 clients | 200+ TPS |
| B2 | Course purchase throughput | `sp_buy_course_with_wallet` (full checkout) | 10, 50, 100 clients | 50+ TPS at 100 clients |
| B3 | Concurrent transfers (same hot wallet) | `sp_transfer_funds` with ordered locking | 10, 50, 100 clients | 0 deadlocks; 50+ TPS |
| B4 | Course catalog browsing | GET /api/store/courses?student_id=X | 10, 50, 100, 200 clients | 500+ req/s with Redis cache |
| B5 | Dictionary search | GET /api/dictionary/search?keyword=X | 10, 50, 100, 200 clients | 300+ req/s with cache |
| B6 | Leaderboard fetch | GET /api/gamification/leaderboard?limit=20 | 10, 50, 100, 200 clients | 1000+ req/s (MV + Redis) |
| B7 | Mixed workload (realistic) | 60% read, 25% search, 10% purchase, 5% write | 50, 100, 200 clients | 200+ req/s aggregate |

### Category C: Resource Utilization Benchmarks

**Goal:** Prove resource efficiency under sustained load.

| # | Benchmark | Metric | Tool | Target |
|---|----------|--------|------|--------|
| C1 | Buffer cache hit ratio | `heap_blks_hit / (hit + read)` | `pg_statio_user_tables` | > 99% |
| C2 | Index usage ratio | `idx_scan > 0` for all non-PK/UQ indexes | `pg_stat_user_indexes` | 100% of indexes used |
| C3 | Partition pruning | Partitions scanned per query | `EXPLAIN` | Exactly 1 partition per month-scoped query |
| C4 | Redis memory usage | Used memory / maxmemory | `INFO memory` | < 80% of maxmemory |
| C5 | Connection pool utilization | Active connections / max | `pg_stat_activity` | < 80% |
| C6 | PostgreSQL cache prewarm time | Time from restart to cache hit ratio > 99% | Custom script | < 30 seconds |
| C7 | pg_stat_statements top-10 slow queries | mean_time, calls, shared_blks_read | `pg_stat_statements` | All queries < 100ms mean |

### Category D: Correctness Under Load Benchmarks

**Goal:** Prove ACID guarantees hold under concurrent load.

| # | Benchmark | Verification | Target |
|---|----------|-------------|--------|
| D1 | No double-spend: total money constant | SUM(wallets.balance) before and after concurrent transfers | Delta = 0 |
| D2 | No deadlocks | `pg_stat_database.deadlocks` after transfer stress test | 0 deadlocks |
| D3 | No lost updates (optimistic locking) | Concurrent course edits; verify version increments | Each edit increments updated_at |
| D4 | No phantom enrollments | Concurrent enrollments on same course; verify no duplicates | UNIQUE(student_id, course_id) never violated |
| D5 | Trigger integrity | Verify streak.highest_streak >= streak.current_streak after concurrent updates | 0 violations |

---

## 4. Data Generation Strategy

**Problem:** Current seed data has ~52 rows total. Benchmarks need realistic volumes to produce measurable differences.

### 4.1 Target Data Volumes

| Table | Current Rows | Target Rows | Rationale |
|-------|-------------|-------------|-----------|
| `roles` | 3 | 3 | Static |
| `users` | 3 | **10,000** | Need many students for leaderboard, search, concurrent load |
| `user_profiles` | 3 | 10,000 | 1:1 with users |
| `students` | 1 | **8,000** | Primary user type |
| `teachers` | 1 | **2,000** | Course creators |
| `wallets` | 2 | 10,000 | 1:1 with users |
| `general_course_categories` | 1 | **20** | Realistic catalog diversity |
| `general_courses` | 2 | **5,000** | Need many courses for catalog + enrollment benchmarks |
| `general_course_modules` | 2 | **15,000** | Avg 3 modules per course |
| `general_course_lessons` | 4 | **45,000** | Avg 3 lessons per module |
| `learning_materials` | 1 | **45,000** | Avg 1 material per lesson |
| `course_enrollments` | 2 | **50,000** | Many students enrolled in multiple courses |
| `comments` | 0 | **100,000** | Need volume for keyset vs OFFSET benchmark |
| `user_feedbacks` | 5 | **20,000** | Need volume for feedback summary view |
| `dictionary_entries` | 4 | **10,000** | Realistic dictionary size for FTS benchmarks |
| `dictionary_variations` | 5 | **30,000** | Avg 3 variations per entry |
| `dictionary_categories` | 3 | **15** | Realistic category count |
| `student_streaks` | 0 | **8,000** | One per student |
| `achievements` | 0 | **20** | Realistic achievement set |
| `user_achievements` | 0 | **40,000** | Avg 5 achievements per student |
| `transaction_logs` | 3 | **500,000** | Span 12 months for partition benchmarks |
| `transaction_action_logs` | 0 | **250,000** | Related to transaction_logs |
| `audit_logs` | 2 | **200,000** | Span 12 months |
| `notification_users` | 2 | **100,000** | Span 12 months |
| `log` | 0 | **100,000** | System log entries |
| `authentication_sessions` | 0 | **5,000** | Active + expired sessions |
| `microlearning_topics` | 2 | **10** | Realistic topic count |
| `microlearning_units` | 3 | **50** | Avg 5 per topic |
| `microlearning_lessons` | 1 | **200** | Avg 4 per unit |
| `microlearning_lesson_parts` | 1 | **600** | Avg 3 per lesson |
| `microlearning_questions` | 1 | **2,000** | Avg 3-4 per part |

**Total: ~1.3 million rows across all tables**

### 4.2 Data Generation Approach

Create a Python script `backend/scripts/generate_benchmark_data.py` that:

1. **Deterministic generation** using seeded random — reproducible benchmarks
2. **Realistic distributions:**
   - Course prices: log-normal (mean 500,000 VND, most courses 100K-2M)
   - Enrollment progress: beta distribution (many at 0-20% and 80-100%, fewer in middle)
   - Transaction amounts: mixture of small (topups 100K-5M) + large (course purchases)
   - Streak lengths: geometric distribution (most 0-7 days, long tail)
   - Ratings: skewed toward 4-5 stars
   - Comment lengths: 20-500 characters from Vietnamese text corpus
3. **Temporal spread** for partitioned tables: 12 months of data (2025-07 to 2026-06)
4. **Foreign key integrity:** all references valid
5. **Batch inserts:** Use `asyncpg COPY` or multi-row INSERT for speed
6. **Configurable scale:** `--scale 0.1` = 10% of target, `--scale 1.0` = full targets

### 4.3 Script Location

```
backend/scripts/
├── generate_benchmark_data.py   # Data generator
├── bench_config.py              # Scale factors, distributions
└── README_BENCHMARK.md          # Usage instructions
```

---

## 5. Benchmark Tool Selection

### 5.1 SQL-Level Benchmarks: pgbench

PostgreSQL's built-in benchmarking tool. Best for:
- Raw transaction throughput (sp_topup_wallet, sp_transfer_funds)
- Testing isolation levels
- Connection pool stress

**Scripts to create:**

```sql
-- backend/scripts/pgbench/bench_topup.sql
\set user_id random(1, 10000)
\set amount random(100000, 5000000)
CALL sp_topup_wallet(:user_id::uuid, :amount, 'pgbench topup');

-- backend/scripts/pgbench/bench_transfer.sql
\set from_id random(1, 5000)
\set to_id random(5001, 10000)
\set amount random(10000, 1000000)
CALL sp_transfer_funds(:from_id::uuid, :to_id::uuid, :amount, 'pgbench transfer');

-- backend/scripts/pgbench/bench_checkout.sql
\set student_id random(1, 8000)
\set course_id random(1, 5000)
CALL sp_buy_course_with_wallet(:student_id::uuid, :course_id::uuid);
```

**pgbench commands:**
```bash
# Initialize
pgbench -i elearning_db --scale 10

# 100 clients for 2 minutes
pgbench -c 100 -T 120 -f backend/scripts/pgbench/bench_transfer.sql elearning_db

# Report in CSV for analysis
pgbench -c 50 -T 60 -f bench_transfer.sql --log --log-prefix=transfer_ elearning_db
```

### 5.2 API-Level Benchmarks: k6 (Recommended)

Grafana k6 for HTTP-level load testing. Better than locust for:
- JavaScript test scripts (easy to read + version control)
- Built-in metrics: http_req_duration, http_reqs, checks, thresholds
- Native percentile reporting (p50/p90/p95/p99)
- Output to CSV/JSON for thesis charts

**Script to create:** `backend/scripts/k6/k6_benchmark.js`

```javascript
// k6 run --vus 100 --duration 120s backend/scripts/k6/k6_benchmark.js
```

### 5.3 PostgreSQL Monitoring: Built-in Views

| View/Extension | What It Measures | Use For |
|---------------|-----------------|---------|
| `pg_stat_statements` | Per-query calls, total_time, mean_time, blks_read/hit | Finding slow queries (Category C7) |
| `pg_statio_user_tables` | heap_blks_read, heap_blks_hit, idx_scan | Cache hit ratio (C1), index usage (C2) |
| `pg_stat_user_indexes` | idx_scan, idx_tup_read, idx_tup_fetch | Unused index detection |
| `pg_stat_database` | deadlocks, xact_commit, xact_rollback | Deadlock count (D2) |
| `pg_stat_activity` | backend count, query, state | Connection pool utilization (C5) |
| `pg_buffercache` | Buffer usage per table | Verify pg_prewarm works (C6) |

### 5.4 Redis Monitoring

| Metric | Command | Use For |
|--------|---------|---------|
| Cache hit rate | `cache.stats()` (custom) | Category C4 |
| Memory usage | `INFO memory` | C4 |
| Keyspace | `INFO keyspace` | Monitoring |
| Eviction count | `INFO stats` | Tuning maxmemory |

---

## 6. Benchmark Execution Plan

### 6.1 Prerequisites

- [ ] PostgreSQL 15+ with `pg_stat_statements` enabled (already done — migration `f6a7b8c9d0e1`)
- [ ] Redis running (optional — gated by `REDIS_ENABLED`)
- [ ] All 6 optimization phases complete (Views, Triggers, Procedures, Indexing, Partitioning, Buffer/Cache)
- [ ] PostgreSQL tuned per `docs/PostgreSQL_Tuning_Guide.md`
- [ ] Benchmark data generated (see Section 4)

### 6.2 Benchmark Runs

Run each benchmark **twice**: once with optimizations enabled (current state), once with a specific optimization disabled, to isolate the impact.

| Run | What's Enabled | What's Disabled | Purpose |
|-----|---------------|-----------------|---------|
| **BASELINE** | Nothing | FTS, partitions, covering indexes, keyset, Redis, MV, BRIN, prewarm | Raw PostgreSQL performance |
| **INDEXES** | FTS GIN, covering indexes, BRIN | Partitions, Redis, MV | Index-only impact |
| **INDEXES+PART** | FTS, covering, BRIN, partitions | Redis, MV | Add partition pruning |
| **INDEXES+PART+MV** | Above + MV leaderboard, views | Redis | Add materialization |
| **FULL** (current) | Everything + Redis cache + prewarm | Nothing | Maximum optimization |

**Important:** For the thesis, each run produces its own metrics, enabling before/after charts.

### 6.3 Execution Order (per run)

```
1. Restart PostgreSQL (clear buffer cache)
2. If FULL run: run pg_prewarm (or skip for cold-cache baseline)
3. Start monitoring capture:
   - Snapshot pg_stat_statements cumulative counters
   - Snapshot pg_statio_user_tables (pre-run values)
4. Run SQL-level benchmarks (pgbench) — Categories B1-B3
5. Run API-level benchmarks (k6) — Categories B4-B7
6. Run query micro-benchmarks (custom Python script) — Categories A1-A10
7. Run concurrency correctness tests — Categories D1-D5
8. Capture post-run monitoring snapshots
9. Compute deltas, generate reports
```

### 6.4 Warm-up and Cooldown

- **Warm-up:** 30 seconds at 50% target concurrency (not measured)
- **Steady state:** 2-5 minutes at target concurrency (measured)
- **Cooldown:** 30 seconds ramp-down (not measured)
- **Between runs:** 60-second wait (connection pool drain)

---

## 7. Metric Collection & Thesis Reporting

### 7.1 Dashboard SQL — Real-time Snapshot During Load

```sql
-- Snapshot current query stats
SELECT queryid, query,
       calls, mean_exec_time, max_exec_time,
       shared_blks_read, shared_blks_hit,
       ROUND(100.0 * shared_blks_hit /
         NULLIF(shared_blks_hit + shared_blks_read, 0), 2) AS hit_pct
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC LIMIT 15;
```

### 7.2 Key Charts for Thesis

| Chart | X-Axis | Y-Axis | Series |
|-------|--------|--------|--------|
| Search latency comparison | Technique (ILIKE, Trigram, FTS) | p95 latency (ms) | Bar chart |
| OFFSET vs Keyset | Page depth | Latency (ms) | Two lines |
| Partition pruning | Query date range | Blocks read | Before/After bars |
| Throughput scaling | Concurrent clients | Transactions/sec | Line chart |
| Cache hit ratio over time | Minutes after restart | Hit ratio % | Line chart |
| Leaderboard latency | Technique (direct, MV, Redis ZSET) | p95 latency (ms) | Bar chart |
| Deadlock count under load | Technique (unordered, ordered locking) | Deadlock count | Before/After bars |
| Index size: BRIN vs B-tree | Index name | Size (MB) | Bar chart |

### 7.3 Thesis Table Template

For each optimization technique, produce this table:

| Technique | Metric | Before | After | Improvement |
|-----------|--------|--------|-------|-------------|
| FTS (GIN) | p95 search latency | 450ms | 8ms | 98.2% |
| Covering Index | heap_blks_read per query | 4.2 | 0 | 100% (index-only) |
| Keyset Pagination | p95 page 1000 latency | 320ms | 12ms | 96.3% |
| Materialized View | Leaderboard p95 latency | 180ms | 3ms | 98.3% |
| Partition Pruning | Blocks scanned (month query) | 15,000 | 800 | 94.7% |
| Ordered Locking | Deadlock count (100 clients) | 23 | 0 | 100% |
| Redis Session Cache | p95 auth check latency | 45ms | 1.2ms | 97.3% |
| pg_prewarm | Time to hit ratio > 99% | 8 min | 22 sec | 95.4% |
| BRIN index | Index size (transaction_logs) | 28 MB | 0.3 MB | 98.9% |

---

## 8. Data Generation Script Design

### 8.1 Script: `backend/scripts/generate_benchmark_data.py`

```python
"""
Benchmark Data Generator for E-Learning Platform.
Generates ~1.3M rows of realistic data across all tables.

Usage:
    python -m scripts.generate_benchmark_data --scale 1.0
    python -m scripts.generate_benchmark_data --scale 0.1  # 10% for quick tests
    python -m scripts.generate_benchmark_data --reset        # Truncate all first
"""

import asyncio
import asyncpg
import random
import uuid
from datetime import datetime, timedelta, date
from typing import List, Dict, Any

# Configuration
SCALE = 1.0  # Override via --scale flag

TARGETS = {
    "users": 10_000,
    "general_course_categories": 20,
    "general_courses": 5_000,
    "general_course_modules": 15_000,
    "general_course_lessons": 45_000,
    "learning_materials": 45_000,
    "course_enrollments": 50_000,
    "comments": 100_000,
    "user_feedbacks": 20_000,
    "dictionary_entries": 10_000,
    "dictionary_variations": 30_000,
    "dictionary_categories": 15,
    "student_streaks": 8_000,
    "achievements": 20,
    "user_achievements": 40_000,
    "transaction_logs": 500_000,
    "transaction_action_logs": 250_000,
    "audit_logs": 200_000,
    "notification_users": 100_000,
    "log": 100_000,
    "authentication_sessions": 5_000,
    "microlearning_topics": 10,
    "microlearning_units": 50,
    "microlearning_lessons": 200,
    "microlearning_lesson_parts": 600,
    "microlearning_questions": 2_000,
}

# Vietnamese given names for realistic data
FAMILY_NAMES = ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Huynh", "Phan", "Vu", "Vo", "Dang",
                "Bui", "Do", "Ho", "Ngo", "Duong", "Ly", "Trinh", "Mai", "Ha", "Ninh"]
MIDDLE_NAMES = ["Van", "Thi", "Minh", "Thanh", "Ngoc", "Quang", "Tuan", "Hong", "Duc", "Xuan"]
GIVEN_NAMES = ["Anh", "Binh", "Chi", "Dung", "Em", "Giang", "Ha", "Hung", "Linh", "Mai",
               "Nam", "Oanh", "Phuc", "Quynh", "Tam", "Thuy", "Trang", "Viet", "Xuan", "Yen"]

COURSE_TITLES = [
    "Co ban ve Ngon ngu Ky hieu",
    "Giao tiep hang ngay bang NNKH",
    "Ky hieu cho giao duc",
    "Ky hieu cho y te",
    "Ky hieu cho cong so",
    "Ngon ngu Ky hieu nang cao",
    "Ky hieu van hoc nghe thuat",
    "Ky hieu cho du lich",
    "Ky hieu cho am nhac",
    "Ky hieu cho the thao",
    "Giao tiep NNKH voi tre em",
    "Ngon ngu Ky hieu cho cong nghe",
    "Ky hieu cho an toan giao thong",
    "Ky hieu cho moi truong",
    "Ky hieu cho phap luat",
    "Giao tiep NNKH trong gia dinh",
    "Ky hieu cho tinh nguyen",
    "Ky hieu cho truyen thong",
    "Ky hieu cho nha hang",
    "Ky hieu cho ngan hang",
]

DICT_WORDS = [
    "Xin chao", "Cam on", "Xin loi", "Tam biet", "Vui long", "Gia dinh", "Nha", "Truong hoc",
    "Benh vien", "Cong vien", "An uong", "Ngu nghi", "Di lai", "Lam viec", "Giai tri",
    "Thoi gian", "Thoi tiet", "Mua sắm", "Giao thong", "Dien thoai", "May tinh", "Internet",
    "Suc khoe", "Giao duc", "Hanh phuc", "Tinh ban", "Tinh yeu", "Cong viec", "Tien bac",
    # ... plus many more for 10,000 entries
]

async def generate_users(conn, scale: float) -> List[str]:
    """Generate users, profiles, students, teachers, wallets."""
    n = int(TARGETS["users"] * scale)
    n_students = int(n * 0.8)
    n_teachers = n - n_students - 3  # 3 reserved for admin + test users
    
    user_ids = []
    batch = []
    
    for i in range(n):
        uid = str(uuid.uuid4())
        user_ids.append(uid)
        username = f"user_{i:06d}"
        email = f"user_{i:06d}@elearning.vn"
        role = "STUDENT" if i < n_students else "TEACHER"
        
        # ... build INSERT batches for users, profiles, students/teachers, wallets
        # Use COPY protocol for speed: 50,000 rows/sec vs 5,000 rows/sec for INSERT
    
    return user_ids

# ... (additional generation functions for each table group)

async def main():
    # Parse args, connect to DB, generate data in dependency order:
    # 1. users, profiles, students, teachers, wallets
    # 2. course categories, courses, modules, lessons, materials
    # 3. dictionary categories, entries, variations
    # 4. microlearning topics, units, lessons, parts, questions
    # 5. enrollments, streaks, achievements, user_achievements
    # 6. comments, feedbacks
    # 7. transactions (spread over 12 months)
    # 8. audit logs, notifications, log entries
    # 9. authentication sessions
    pass
```

### 8.2 Data Distribution Details

**Transaction timestamps** (for partition spread):
- Spread over 12 months: July 2025 → June 2026
- Distribution: 40% in last 3 months (recent activity), 60% in prior 9 months
- This ensures 12 partitions have data, enabling measurable partition pruning

**Enrollment progress** (for realistic queries):
- 40%: 0-10% (just started)
- 20%: 10-50% (in progress)
- 15%: 50-90% (nearly done)
- 25%: 100% (completed)
- This gives meaning to completion rate, certificate eligibility queries

**Wallet balances**:
- 70%: 0 - 1,000,000 VND (typical student)
- 20%: 1,000,000 - 5,000,000 VND (active learner)
- 8%: 5,000,000 - 20,000,000 VND (heavy user)
- 2%: 20,000,000 - 100,000,000 VND (power user / admin)

**Comment content**:
- Use a pool of 500 Vietnamese sentences (50-200 chars each)
- Randomly assemble 1-3 sentences per comment
- created_at spread over 12 months

---

## 9. Quick-Start Commands

### 9.1 Generate Data

```bash
cd backend

# Full dataset (~1.3M rows, takes ~5-10 minutes)
python -m scripts.generate_benchmark_data --scale 1.0

# Light dataset for quick testing (~130K rows)
python -m scripts.generate_benchmark_data --scale 0.1

# Reset existing data first
python -m scripts.generate_benchmark_data --scale 1.0 --reset
```

### 9.2 Run SQL Benchmarks (pgbench)

```bash
# Initialize pgbench with connection info
pgbench -h localhost -U elearning -d elearning_db -i

# Run transfer benchmark
pgbench -h localhost -U elearning -d elearning_db \
  -c 100 -T 120 \
  -f backend/scripts/pgbench/bench_transfer.sql \
  --log --log-prefix=transfer_

# Analyze results
pgbench -h localhost -U elearning -d elearning_db \
  --aggregate-interval=10 --log --log-prefix=transfer_ \
  -c 50 -T 60 -f backend/scripts/pgbench/bench_transfer.sql
```

### 9.3 Run API Benchmarks (k6)

```bash
# Install k6 (once)
winget install k6  # Windows
# or: brew install k6  # macOS
# or: sudo apt install k6  # Linux

# Run benchmark
k6 run --vus 100 --duration 120s backend/scripts/k6/k6_benchmark.js

# With output to JSON for analysis
k6 run --vus 100 --duration 120s \
  --out json=results.json \
  backend/scripts/k6/k6_benchmark.js
```

### 9.4 Collect Database Metrics

```bash
# Run during load test to capture point-in-time metrics
psql -h localhost -U elearning -d elearning_db \
  -f backend/scripts/cache_hit_ratio.sql

psql -h localhost -U elearning -d elearning_db \
  -c "SELECT query, calls, mean_exec_time, max_exec_time
      FROM pg_stat_statements
      WHERE query NOT LIKE '%pg_stat%'
      ORDER BY mean_exec_time DESC LIMIT 15;"

psql -h localhost -U elearning -d elearning_db \
  -f backend/scripts/verify_partition_pruning.sql

psql -h localhost -U elearning -d elearning_db \
  -c "SELECT deadlocks, xact_commit, xact_rollback FROM pg_stat_database WHERE datname = 'elearning_db';"
```

### 9.5 Run Full Benchmark Suite

```bash
cd backend

# 1. Generate data
python -m scripts.generate_benchmark_data --scale 1.0 --reset

# 2. Run all benchmarks and collect metrics
python -m scripts.run_benchmarks --output results/

# This script:
# - Runs pgbench for SQL benchmarks
# - Runs k6 for API benchmarks
# - Captures pg_stat_statements before/after
# - Captures pg_statio_user_tables before/after
# - Generates a summary JSON + Markdown report
```

---

## 10. Benchmark Run Checklist

Use this per-run checklist to ensure consistent, reproducible results.

### Pre-Run

- [ ] PostgreSQL restarted (clear buffer cache for cold-start benchmarks)
- [ ] Or: pg_prewarm executed (for warm-cache benchmarks)
- [ ] No other processes using significant CPU/memory/disk I/O
- [ ] Redis flushed (`FLUSHALL`) if running cache benchmarks
- [ ] `pg_stat_statements` reset: `SELECT pg_stat_statements_reset()`
- [ ] `pg_stat_reset()` to clear cumulative IO stats
- [ ] Connection pool set to target max (e.g., 20 for pgbench, 50 for k6)
- [ ] Record: PostgreSQL config (`SELECT name, setting FROM pg_settings WHERE ...`)
- [ ] Record: `SELECT count(*)` on each table (verify data volume)

### During Run

- [ ] Monitor CPU/memory/disk via system tools (Task Manager / htop)
- [ ] Monitor PostgreSQL activity: `SELECT count(*) FROM pg_stat_activity WHERE state = 'active'`
- [ ] Monitor lock waits: `SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock'`

### Post-Run

- [ ] Capture `pg_stat_statements` top-20 queries
- [ ] Capture `pg_statio_user_tables` cache hit ratios
- [ ] Capture `pg_stat_user_indexes` for unused index check
- [ ] Capture `pg_stat_database.deadlocks`
- [ ] Capture Redis `INFO stats` (if Redis was used)
- [ ] Archive raw log files (pgbench logs, k6 JSON output)
- [ ] Compute deltas from pre-run snapshots
- [ ] Add run metadata: timestamp, git commit hash, scale factor, concurrency

---

## 11. Files to Create (Summary)

```
backend/scripts/
├── generate_benchmark_data.py     # Data generator (~400 lines)
├── run_benchmarks.py              # Orchestrator (~200 lines)
├── pgbench/
│   ├── bench_topup.sql            # Topup workload
│   ├── bench_transfer.sql         # Transfer workload
│   ├── bench_checkout.sql         # Checkout workload
│   └── bench_mixed.sql            # Mixed workload
├── k6/
│   └── k6_benchmark.js            # API-level load test (~150 lines)
├── monitor_queries.sql            # pg_stat_statements top-N (exists? check)
├── explain_queries.sql            # EXPLAIN ANALYZE key queries ✓ (exists)
├── cache_hit_ratio.sql            # Buffer hit ratio ✓ (exists)
├── find_unused_indexes.sql        # Unused indexes ✓ (exists)
└── verify_partition_pruning.sql   # Partition pruning ✓ (exists)

docs/
└── BENCHMARK_PLAN.md              # This document
```

---

## 12. Appendix: Quick Benchmark for Thesis — "10 Metrics in 10 Minutes"

If time is limited, run this minimal set to populate the thesis table:

1. **Dictionary search latency** → Read-heavy lookup benchmark (A1)
2. **Deep pagination latency** → Keyset vs OFFSET (A3)
3. **Leaderboard latency** → MV effectiveness (A4)
4. **Partition pruning blocks** → Partitioning effectiveness (A5)
5. **Session lookup latency** → Redis cache effectiveness (A6)
6. **Transfer TPS under load** → Throughput (B3)
7. **Buffer cache hit ratio** → Resource utilization (C1)
8. **Concurrent transfer deadlocks** → Correctness (D2)
9. **BRIN vs B-tree index size** → Space efficiency (A8)
10. **FTS relevance vs ILIKE** → Quality of results (A9)

These 10 metrics cover all 6 access pattern groups and provide a complete thesis argument.

---

## Related Documents

- [`Ke_hoach_ap_dung_HQTCSDL_Elearning.md`](Ke_hoach_ap_dung_HQTCSDL_Elearning.md) — Database techniques blueprint
- [`MASTER_PLAN_INDEX.md`](MASTER_PLAN_INDEX.md) — 6-phase implementation plan
- [`PostgreSQL_Tuning_Guide.md`](PostgreSQL_Tuning_Guide.md) — PostgreSQL configuration reference
- [`Plan_Phase_4_Advanced_Indexing_Query_Tuning.md`](Plan_Phase_4_Advanced_Indexing_Query_Tuning.md) — Indexing details
- [`Plan_Phase_5_Partitioning_Distribution.md`](Plan_Phase_5_Partitioning_Distribution.md) — Partitioning details
- [`Plan_Phase_6_Buffer_Pool_And_Redis_Cache.md`](Plan_Phase_6_Buffer_Pool_And_Redis_Cache.md) — Cache details
