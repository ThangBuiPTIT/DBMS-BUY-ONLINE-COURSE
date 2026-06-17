-- ============================================================================
-- EXPLAIN ANALYZE — Key Query Performance Verification
-- ============================================================================

-- (A) FTS Search vs Trigram
\echo '=== FTS Search ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT word, meaning, ts_rank(
    to_tsvector('simple', COALESCE(word,'') || ' ' || COALESCE(meaning,'')),
    to_tsquery('simple', 'ngon:*')
) AS relevance
FROM dictionary_entries
WHERE is_deleted = FALSE
  AND to_tsvector('simple', COALESCE(word,'') || ' ' || COALESCE(meaning,''))
      @@ to_tsquery('simple', 'ngon:*')
ORDER BY relevance DESC LIMIT 30;

-- (B) Covering Index — Index-Only Scan
\echo '=== Index-Only Scan Test ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT course_id, progress, enrolled_at
FROM course_enrollments WHERE student_id = '00000000-0000-0000-0000-000000000001';

-- (C) Keyset vs OFFSET
\echo '=== OFFSET (Deep Page) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT comment_id, content, created_at FROM comments
ORDER BY created_at DESC OFFSET 10000 LIMIT 20;

\echo '=== Keyset Pagination ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT comment_id, content, created_at FROM comments
WHERE created_at < '2026-01-15T00:00:00Z'
ORDER BY created_at DESC LIMIT 20;

-- (D) mv_leaderboard vs direct
\echo '=== Materialized View ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM mv_leaderboard ORDER BY rank LIMIT 20;
