-- pgbench workload: Wallet Topup
-- Usage: pgbench -c 50 -T 60 -f bench_topup.sql elearning_db
\set user_idx random(1, 10000)
\set amount random(100000, 5000000)
SELECT bench_topup(:user_idx, :amount);
