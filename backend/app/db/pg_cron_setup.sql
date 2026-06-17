-- ====================================================================================
-- pg_cron Setup — Production-Grade Periodic Tasks
-- ====================================================================================
-- Yêu cầu: pg_cron extension được cài trong database "postgres" (background worker).
--          Chạy script này với quyền SUPERUSER.
--          Trong môi trường multi-instance, dùng pg_cron thay vì in-app asyncio scheduler.
-- ====================================================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule leaderboard refresh every 5 minutes
-- pg_cron uses UTC timezone by default
SELECT cron.schedule(
    'refresh-leaderboard',        -- job name (unique)
    '*/5 * * * *',                -- cron expression: every 5 minutes
    $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard$$
);

-- Schedule dictionary cache warm every hour
-- Pre-loads dictionary_entries into PostgreSQL buffer cache
-- Reduces latency on first search after DB restart
SELECT cron.schedule(
    'warm-dictionary-cache',
    '0 * * * *',                  -- at minute 0 of every hour
    $$SELECT pg_prewarm('dictionary_entries')$$
);

-- Schedule session cleanup every hour
-- Removes expired authentication sessions
SELECT cron.schedule(
    'cleanup-expired-sessions',
    '0 * * * *',
    $$DELETE FROM authentication_sessions WHERE expires_at < NOW()$$
);

-- ====================================================================================
-- Verification Queries
-- ====================================================================================

-- List all scheduled jobs
SELECT jobid, schedule, command, nodename, nodeport, database, username
FROM cron.job;

-- Check job run history (last 10 runs)
SELECT jobid, runid, job_pid, database, username, command,
       status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- Unschedule a job (example)
-- SELECT cron.unschedule('refresh-leaderboard');
