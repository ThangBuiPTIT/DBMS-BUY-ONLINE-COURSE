-- ====================================================================================
-- pg_partman Setup — Automatic Partition Management
-- ====================================================================================
-- Yêu cầu: pg_partman installed. Run: CREATE EXTENSION pg_partman;
-- ====================================================================================

CREATE EXTENSION IF NOT EXISTS pg_partman;

-- Register all 5 partitioned tables with pg_partman
-- p_interval: 1 month, p_premake: 4 future partitions

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

-- Retention: auto-detach partitions older than 12 months
UPDATE partman.part_config
SET retention = '12 months', retention_keep_table = true
WHERE parent_table IN (
    'public.transaction_logs', 'public.transaction_action_logs',
    'public.log', 'public.audit_logs', 'public.notification_users'
);

-- Schedule maintenance via pg_cron
SELECT cron.schedule('partman-maintenance', '@hourly',
    $$SELECT partman.run_maintenance()$$
);
