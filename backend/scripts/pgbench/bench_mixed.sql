-- pgbench workload: Mixed (60% read, 25% transfer, 10% topup, 5% checkout)
-- Usage: pgbench -c 100 -T 300 -f bench_mixed.sql --log --log-prefix=mixed_ elearning_db
\set r random(0, 99)
\set user_idx random(1, 10000)
\set from_idx random(1, 5000)
\set to_idx random(5001, 10000)
\set amount random(10000, 500000)
\set student_idx random(1, 8000)
\set course_idx random(1, 5000)

SELECT CASE
    WHEN :r < 60 THEN (SELECT count(*) FROM general_courses WHERE visibility_status = 'PUBLISHED' AND is_deleted = FALSE)
    WHEN :r < 85 THEN (SELECT bench_transfer(:from_idx, :to_idx, :amount))
    WHEN :r < 95 THEN (SELECT bench_topup(:user_idx, :amount))
    ELSE (SELECT bench_checkout(:student_idx, :course_idx))
END;
