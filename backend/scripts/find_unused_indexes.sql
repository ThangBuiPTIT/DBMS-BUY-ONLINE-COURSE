-- ============================================================================
-- Unused Index Detection — indexes with idx_scan = 0 are candidates for removal
-- ============================================================================
SELECT
    schemaname || '.' || relname AS table_name,
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS scans,
    CASE WHEN idx_scan = 0 THEN 'UNUSED — CANDIDATE FOR DELETION'
         WHEN idx_scan < 100 THEN 'RARELY USED — REVIEW'
         ELSE 'OK' END AS recommendation
FROM pg_stat_user_indexes
WHERE indexrelname NOT LIKE '%pkey%' AND indexrelname NOT LIKE '%uq_%'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC LIMIT 20;
