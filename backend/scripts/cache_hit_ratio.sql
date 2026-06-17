-- ============================================================================
-- PostgreSQL Cache Hit Ratio Monitoring
-- Target: > 99% cache hit ratio
-- ============================================================================

-- Overall cache hit ratio
SELECT SUM(heap_blks_read) AS disk_reads,
       SUM(heap_blks_hit) AS cache_hits,
       ROUND(100.0 * SUM(heap_blks_hit) /
             NULLIF(SUM(heap_blks_hit + heap_blks_read), 0), 2) AS hit_ratio_pct,
       CASE WHEN 100.0 * SUM(heap_blks_hit) /
                 NULLIF(SUM(heap_blks_hit + heap_blks_read), 0) >= 99
            THEN 'EXCELLENT' ELSE 'NEEDS TUNING' END AS verdict
FROM pg_statio_user_tables;

-- Per-table detail (top disk readers)
SELECT relname AS table_name,
       heap_blks_read AS disk_reads,
       ROUND(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) AS hit_pct,
       pg_size_pretty(pg_relation_size(relid)) AS table_size
FROM pg_statio_user_tables
WHERE heap_blks_hit + heap_blks_read > 0
ORDER BY heap_blks_read DESC LIMIT 10;
