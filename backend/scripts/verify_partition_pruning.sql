-- ============================================================================
-- Verify Partition Pruning
-- ============================================================================

-- List all partitions of transaction_logs
SELECT child.relname AS partition_name,
       pg_get_expr(child.relpartbound, child.oid) AS date_range,
       pg_size_pretty(pg_relation_size(child.oid)) AS size
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'transaction_logs'
ORDER BY child.relname;

-- Check partition pruning: month-scoped query should scan only 1 partition
EXPLAIN SELECT COUNT(*) FROM transaction_logs
WHERE created_at >= '2026-06-01' AND created_at < '2026-07-01';

-- Verify all 5 tables are partitioned
SELECT relname FROM pg_class
WHERE relkind = 'p' AND relname IN (
    'transaction_logs', 'transaction_action_logs',
    'log', 'audit_logs', 'notification_users'
);
