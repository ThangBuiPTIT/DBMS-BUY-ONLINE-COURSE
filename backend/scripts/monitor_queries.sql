-- ============================================================================
-- pg_stat_statements — Top-20 Slow Queries During Benchmarks
-- ============================================================================

-- Top-20 by avg execution time
SELECT queryid,
       LEFT(query, 120) AS query_preview,
       calls,
       ROUND(mean_exec_time::numeric, 2) AS avg_ms,
       ROUND(max_exec_time::numeric, 2) AS max_ms,
       ROUND(total_exec_time::numeric, 2) AS total_ms,
       rows,
       shared_blks_read AS disk_reads,
       shared_blks_hit AS cache_hits,
       ROUND(100.0 * shared_blks_hit /
             NULLIF(shared_blks_hit + shared_blks_read, 0), 2) AS hit_pct
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
  AND query NOT LIKE '%pgbench%'
  AND calls > 0
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Top-20 by total time (cumulative impact)
SELECT queryid,
       LEFT(query, 120) AS query_preview,
       calls,
       ROUND(total_exec_time::numeric, 2) AS total_ms,
       ROUND(mean_exec_time::numeric, 2) AS avg_ms,
       ROUND(100.0 * total_exec_time /
             NULLIF(SUM(total_exec_time) OVER(), 0), 2) AS pct_of_total
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
  AND query NOT LIKE '%pgbench%'
  AND calls > 0
ORDER BY total_exec_time DESC
LIMIT 20;

-- Top-20 by disk reads (buffer miss indicators)
SELECT queryid,
       LEFT(query, 120) AS query_preview,
       calls,
       shared_blks_read AS disk_reads,
       shared_blks_hit AS cache_hits,
       ROUND(100.0 * shared_blks_hit /
             NULLIF(shared_blks_hit + shared_blks_read, 0), 2) AS hit_pct
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
  AND query NOT LIKE '%pgbench%'
  AND calls > 0
ORDER BY shared_blks_read DESC
LIMIT 20;

-- Summary statistics
SELECT count(*) AS unique_queries,
       SUM(calls) AS total_calls,
       ROUND(AVG(mean_exec_time)::numeric, 2) AS overall_avg_ms,
       ROUND(AVG(shared_blks_read)::numeric, 1) AS avg_disk_reads_per_query
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
  AND query NOT LIKE '%pgbench%'
  AND calls > 0;
