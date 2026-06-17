# MASTER PLAN INDEX — Database Optimization Implementation

**Date:** 2026-06-17  
**Scope:** Complete implementation of all 12 techniques from `Ke_hoach_ap_dung_HQTCSDL_Elearning.md`  
**Target Branch:** `fastapi`  
**Total Estimated Effort:** ~59 hours (~7.5 days)

---

## Overview

This document is the master index for 6 detailed implementation plans that cover EVERY technique mentioned in the database optimization blueprint. Each plan is self-contained with: gap analysis, exact SQL/DDL, Python code modifications, file manifests, verification test scripts, and rollback procedures.

## Plan Files

| # | Plan File | Blueprint Sections | Est. Hours | Priority |
|---|-----------|-------------------|------------|----------|
| 1 | [`Plan_Phase_1_Views_And_Leaderboard.md`](Plan_Phase_1_Views_And_Leaderboard.md) | Phần 2 — Views | 5.5h | 🔴 Critical |
| 2 | [`Plan_Phase_2_Triggers_And_Integrity.md`](Plan_Phase_2_Triggers_And_Integrity.md) | Phần 3 — Triggers | 5.5h | 🔴 Critical |
| 3 | [`Plan_Phase_3_Procedures_Transactions_Locking.md`](Plan_Phase_3_Procedures_Transactions_Locking.md) | Phần 4, 5, 12 — Procedures, Transactions, Concurrency | 13.5h | 🔴 Critical |
| 4 | [`Plan_Phase_4_Advanced_Indexing_Query_Tuning.md`](Plan_Phase_4_Advanced_Indexing_Query_Tuning.md) | Phần 6, 9 — Indexing, Query Optimization | 13.0h | 🟡 High |
| 5 | [`Plan_Phase_5_Partitioning_Distribution.md`](Plan_Phase_5_Partitioning_Distribution.md) | Phần 7, 8 — Partitioning, Distribution | 8.5h | 🟡 High |
| 6 | [`Plan_Phase_6_Buffer_Pool_And_Redis_Cache.md`](Plan_Phase_6_Buffer_Pool_And_Redis_Cache.md) | Phần 10, 11 — Buffer Pool, Redis Cache | 13.0h | 🟡 High |

## Execution Order

```
Plan 1 (Views) ──┐
                  ├── Plan 3 (Procedures/Locking) ── Plan 4 (Indexing/Query)
Plan 2 (Triggers) ┘                                      │
                                                     Plan 5 (Partitioning)
                                                         │
                                                     Plan 6 (Buffer/Cache)
```

- **Plans 1 & 2** can be executed in parallel (independent)
- **Plan 3** depends on Plans 1-2 (procedures reference views; locking tests need triggers)
- **Plan 4** depends on Plan 3 (keyset pagination + N+1 fixes are independent of procedures but EXPLAIN testing needs stable schema)
- **Plan 5** depends on Plan 4 (partitioning builds on indexing foundation)
- **Plan 6** can start after Plan 3 (Redis caching is independent of partitioning)

## Gap Summary: What's Missing Today

### 🔴 Critical Gaps (6 items)

| Gap | Plan | Impact |
|-----|------|--------|
| `sp_transfer_funds` procedure not created | Plan 3 | No deadlock-proof money transfer |
| `sp_enroll_paid_course` not created | Plan 3 | Can't chain transfer + enrollment atomically |
| Deadlock prevention (ordered locking) | Plan 3 | Concurrent transfers risk deadlock |
| Full-Text Search index (`idx_dict_fts`) | Plan 4 | Dictionary search lacks relevance ranking |
| `pg_stat_statements` not enabled | Plan 4 | No quantitative before/after data for thesis |
| Table partitioning not actually applied | Plan 5 | Log tables grow unbounded, no partition pruning |

### 🟡 High Priority Gaps (8 items)

| Gap | Plan | Impact |
|-----|------|--------|
| `mv_leaderboard` missing `student_id` + wrong unique index | Plan 1 | `REFRESH CONCURRENTLY` may fail on duplicates |
| No periodic leaderboard refresh | Plan 1 | Leaderboard data goes stale |
| `trg_streak_sync` not in DB (done in app code) | Plan 2 | `highest_streak` can be bypassed |
| `trg_audit_wallet` not created | Plan 2 | No automatic audit trail for balance changes |
| No SERIALIZABLE isolation for wallet ops | Plan 3 | Write-skew possible under concurrent load |
| No optimistic locking pattern | Plan 3 | Lost updates on course editing |
| Keyset pagination not implemented | Plan 4 | Deep OFFSET pages are slow |
| N+1 queries in course content tree | Plan 4 | 4 DB round trips for one course view |

### 🟢 Medium Priority Gaps (7 items)

| Gap | Plan | Impact |
|-----|------|--------|
| `v_published_courses` view not created | Plan 1 | Storefront query logic embedded in service |
| `v_student_dashboard` view not created | Plan 1 | Student overview requires multiple API calls |
| `SKIP LOCKED` for notification worker queue | Plan 3 | Parallel workers compete for same rows |
| Advisory locks for cron singleton tasks | Plan 3 | Multiple app instances duplicate cron work |
| Covering index doesn't match blueprint spec | Plan 4 | Suboptimal for "My Courses" query |
| Read/Write splitting not configured | Plan 5 | All queries hit primary |
| Course catalog not cached in Redis | Plan 6 | Storefront queries hit DB on every request |
| Cache invalidation not wired | Plan 6 | Cached data goes stale after updates |

## New Files to Create (Across All Plans)

### Alembic Migrations (17 new)
```
backend/alembic/versions/
├── XXXX_v_published_courses.py
├── XXXX_v_student_dashboard.py
├── XXXX_fix_mv_leaderboard.py
├── XXXX_streak_sync_trigger.py
├── XXXX_audit_wallet_trigger.py
├── XXXX_unified_provision_trigger.py
├── XXXX_dict_fulltext_search.py
├── XXXX_fix_covering_index.py
├── XXXX_pg_stat_statements.py
├── XXXX_partition_transaction_logs.py
├── XXXX_partition_all_log_tables.py
└── XXXX_pg_prewarm.py
```

### New Python Modules (8 new)
```
backend/app/core/
├── isolation.py           # Transaction isolation context managers
├── locking.py             # Pessimistic/optimistic locking helpers
├── cron.py                # Advisory-lock-guarded cron tasks
├── pagination.py          # Keyset pagination utilities
├── media.py               # CDN URL resolution
├── buffer_monitor.py      # Cache hit ratio monitoring
└── cache_invalidation.py  # Redis cache invalidation hooks
```

### SQL Scripts (7 new)
```
backend/scripts/
├── monitor_queries.sql        # pg_stat_statements top-N
├── explain_queries.sql        # EXPLAIN ANALYZE for key queries
├── run_explain.py             # Python EXPLAIN runner
├── find_unused_indexes.sql    # Unused index detection
├── cache_hit_ratio.sql        # Buffer cache hit ratio
├── verify_partition_pruning.sql  # Partition pruning tests
└── bench_transfer.sql         # pgbench transfer stress test
```

### Database Setup Scripts (2 new)
```
backend/app/db/
├── pg_cron_setup.sql      # pg_cron scheduled jobs
└── pg_partman_setup.sql   # pg_partman partition management
```

### Documentation (1 new)
```
docs/
└── PostgreSQL_Tuning_Guide.md  # Buffer pool tuning reference
```

## Files to Modify (17 existing)

| File | Plans | Changes |
|------|-------|---------|
| `backend/app/main.py` | 1, 3, 6 | Lifespan: prewarm, cron scheduler, health endpoints |
| `backend/app/core/config.py` | 5, 6 | Add REPLICA_URL, CDN settings |
| `backend/app/core/database.py` | 5 | Add replica engine, read/write routing |
| `backend/app/core/cache.py` | 6 | Add hit/miss counters, stats() |
| `backend/app/db/procedures.sql` | 2, 3 | Add sp_transfer_funds, sp_enroll_paid_course, trg_prevent_self_transfer, trigger registry |
| `backend/app/services/store.py` | 1, 3, 4, 6 | Use views, add transfer, keyset pagination, catalog cache |
| `backend/app/services/gamification.py` | 1, 2, 6 | Return student_id, simplify streak sync, invalidate cache |
| `backend/app/services/course_builder.py` | 3, 4, 6 | Optimistic locking, N+1 fix, cache invalidation |
| `backend/app/services/dictionary.py` | 4 | Add FTS search |
| `backend/app/services/auth.py` | 2 | Update trigger comments |
| `backend/app/api/student.py` | 1 | Add dashboard endpoint |
| `backend/app/api/dictionary.py` | 4 | Add FTS search endpoint |
| `backend/app/api/store.py` | 3, 4 | Add transfer endpoint, v2 transactions cursor |
| `backend/app/api/router.py` | 5, 6 | Health endpoints, replica routing |
| `backend/app/schemas/store.py` | 3 | Add TransferRequest |
| `backend/app/schemas/student.py` | 1 | Add StudentDashboardResponse |

## Testing Strategy

### New Test Files to Create

```
backend/tests/
├── test_views_leaderboard.py      # Plan 1: view correctness + mv refresh
├── test_triggers.py               # Plan 2: trigger firing + integrity
├── test_procedures_locking.py     # Plan 3: ACID, deadlock, optimistic lock
├── test_indexes_query_tuning.py   # Plan 4: FTS, keyset, N+1 fix
├── test_partitioning.py           # Plan 5: partition pruning, routing
└── test_buffer_cache.py           # Plan 6: prewarm, cache invalidation
```

### Test Categories

| Category | Tools | Plans |
|----------|-------|-------|
| **Unit tests** (schema, triggers, functions) | pytest + SQLAlchemy | 1, 2, 5 |
| **Integration tests** (API + DB) | pytest + httpx | 1, 3, 4, 6 |
| **Concurrency tests** (deadlock, isolation) | pytest-asyncio + asyncio.gather | 3 |
| **Performance benchmarks** | pgbench, locust | 3, 4, 6 |
| **SQL verification** | EXPLAIN ANALYZE, pg_stat_statements | 4, 5, 6 |

## Key Metrics for Thesis (Before/After)

| Metric | Measurement Tool | Target |
|--------|-----------------|--------|
| Query latency (p50/p95/p99) | pg_stat_statements + locust | 50% reduction |
| Cache hit ratio | `pg_statio_user_tables` | > 99% |
| TPS (transactions/sec) | pgbench | 2-3x improvement |
| Deadlock count under load | pg_stat_database.deadlocks | 0 |
| Index usage (idx_scan > 0) | pg_stat_user_indexes | 100% of indexes |
| Redis cache hit rate | Custom stats() | > 80% for catalog/dictionary |
| Partition pruning effectiveness | EXPLAIN (rows scanned) | 1 partition vs all |
| Connection pool utilization | pg_stat_activity | < 80% of max |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Partitioning migration on live data | Medium | High | Dev-only DROP+RECREATE; production: staged migration with pg_partman |
| Deadlock from new locking adds latency | Low | Medium | Ordered locking prevents deadlocks; benchmark before merge |
| Redis eviction under memory pressure | Medium | Medium | All cache code gated by `REDIS_ENABLED`; fail-open to DB |
| Composite PK change breaks SQLAlchemy | Low | Low | Models already have composite PKs; no ORM change needed |
| Cache invalidation misses edge case | Medium | Medium | Invalidation on write; TTL as safety net; monitoring alerts |

---

## Quick Start

```bash
# 1. Review the master plan
cat docs/MASTER_PLAN_INDEX.md

# 2. Read individual plans
cat docs/Plan_Phase_1_Views_And_Leaderboard.md
cat docs/Plan_Phase_2_Triggers_And_Integrity.md
cat docs/Plan_Phase_3_Procedures_Transactions_Locking.md
cat docs/Plan_Phase_4_Advanced_Indexing_Query_Tuning.md
cat docs/Plan_Phase_5_Partitioning_Distribution.md
cat docs/Plan_Phase_6_Buffer_Pool_And_Redis_Cache.md

# 3. Execute plans in order (each on its own branch)
git checkout -b plan/1-views-and-leaderboard
# ... implement Plan 1 ...
git checkout -b plan/2-triggers-and-integrity
# ... implement Plan 2 ...
# ... etc.

# 4. After all plans: final benchmark
pgbench -c 50 -T 120 -f backend/scripts/bench_transfer.sql elearning_db
```

---

## Related Documents

- [`Ke_hoach_ap_dung_HQTCSDL_Elearning.md`](Ke_hoach_ap_dung_HQTCSDL_Elearning.md) — Original blueprint (Vietnamese)
- [`Ke_hoach_hoan_thien_codebase.md`](Ke_hoach_hoan_thien_codebase.md) — 5-phase gap closure plan (completed)
- [`API_ENDPOINT_MAPPING.md`](API_ENDPOINT_MAPPING.md) — Go → FastAPI endpoint mapping
- [`TRANSFORMATION_PLAN.md`](TRANSFORMATION_PLAN.md) — Step-by-step migration plan
