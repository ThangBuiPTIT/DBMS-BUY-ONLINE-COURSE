-- pgbench workload: Fund Transfer (deadlock-proof ordered locking)
-- Usage: pgbench -c 100 -T 120 -f bench_transfer.sql --log --log-prefix=transfer_ elearning_db
\set from_idx random(1, 5000)
\set to_idx random(5001, 10000)
\set amount random(10000, 1000000)
SELECT bench_transfer(:from_idx, :to_idx, :amount);
