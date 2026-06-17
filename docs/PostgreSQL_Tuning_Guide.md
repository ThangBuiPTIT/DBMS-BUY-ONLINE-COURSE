# PostgreSQL Buffer Pool Tuning Guide

## Recommended Configuration (16GB RAM Server)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `shared_buffers` | 4GB | 25% of RAM — PostgreSQL's internal page cache |
| `effective_cache_size` | 12GB | 75% of RAM — guides planner toward index scans |
| `work_mem` | 64MB | Per-operation sort/hash memory |
| `maintenance_work_mem` | 512MB | For VACUUM, CREATE INDEX, ALTER TABLE |
| `wal_buffers` | 64MB | Write-Ahead Log buffer |
| `random_page_cost` | 1.1 | SSD-optimized (HDD default is 4.0) |
| `effective_io_concurrency` | 200 | SSD/NVMe concurrent I/O |
| `max_parallel_workers_per_gather` | 4 | Parallel query workers |
| `max_parallel_workers` | 8 | Total parallel workers |

## How to Apply

```sql
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET wal_buffers = '64MB';
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
-- Restart PostgreSQL: pg_ctl restart
```

## Verification

```sql
SELECT name, setting, unit FROM pg_settings
WHERE name IN ('shared_buffers', 'effective_cache_size', 'work_mem');
```
