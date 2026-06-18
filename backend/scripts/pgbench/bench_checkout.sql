-- pgbench workload: Course Checkout (full sp_buy_course_with_wallet flow)
-- Usage: pgbench -c 50 -T 120 -f bench_checkout.sql --log --log-prefix=checkout_ elearning_db
\set student_idx random(1, 8000)
\set course_idx random(1, 5000)
SELECT bench_checkout(:student_idx, :course_idx);
