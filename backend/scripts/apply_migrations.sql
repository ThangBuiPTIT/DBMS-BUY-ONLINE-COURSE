-- Combined critical migration SQL for benchmarks
-- Run: psql -h localhost -U postgres -d elearning_db -f apply_migrations.sql

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Auto-updated_at trigger
CREATE OR REPLACE FUNCTION fn_auto_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN ARRAY['users','dictionary_entries','general_courses','wallets']::TEXT[] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_updated_at ON %I', t);
        EXECUTE format('CREATE TRIGGER trg_auto_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_auto_update_timestamp()', t);
    END LOOP;
END;
$$;

-- 3. Unified provision trigger (wallet + streak)
CREATE OR REPLACE FUNCTION fn_provision_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role_name VARCHAR;
BEGIN
    INSERT INTO wallets (user_id, balance) VALUES (NEW.user_id, 0.00) ON CONFLICT (user_id) DO NOTHING;
    SELECT r.role_name INTO v_role_name FROM roles r WHERE r.role_id = NEW.role_id;
    IF v_role_name = 'STUDENT' THEN
        INSERT INTO student_streaks (student_id, current_streak, highest_streak) VALUES (NEW.user_id, 0, 0) ON CONFLICT (student_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_provision_user ON users;
DROP TRIGGER IF EXISTS trg_provision_wallet ON users;
CREATE TRIGGER trg_provision_user AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION fn_provision_new_user();

-- 4. Streak sync trigger
CREATE OR REPLACE FUNCTION fn_sync_highest_streak()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_streak > NEW.highest_streak THEN NEW.highest_streak := NEW.current_streak; END IF;
    IF TG_OP = 'UPDATE' AND NEW.current_streak IS DISTINCT FROM OLD.current_streak THEN
        NEW.last_activity_date := CURRENT_DATE;
    ELSIF TG_OP = 'INSERT' THEN
        NEW.last_activity_date := COALESCE(NEW.last_activity_date, CURRENT_DATE);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_streak_sync ON student_streaks;
CREATE TRIGGER trg_streak_sync BEFORE INSERT OR UPDATE OF current_streak ON student_streaks FOR EACH ROW EXECUTE FUNCTION fn_sync_highest_streak();

-- 5. Audit wallet trigger
CREATE OR REPLACE FUNCTION fn_audit_wallet_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.balance IS DISTINCT FROM NEW.balance THEN
        INSERT INTO log (action) VALUES (format('WALLET %s: %s -> %s (delta: %s)', NEW.user_id, OLD.balance, NEW.balance, NEW.balance - OLD.balance));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_audit_wallet ON wallets;
CREATE TRIGGER trg_audit_wallet AFTER UPDATE OF balance ON wallets FOR EACH ROW WHEN (OLD.balance IS DISTINCT FROM NEW.balance) EXECUTE FUNCTION fn_audit_wallet_change();

-- 6. Streak auto-create trigger on students
CREATE OR REPLACE FUNCTION fn_create_student_streak()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO student_streaks (student_id, current_streak, highest_streak) VALUES (NEW.user_id, 0, 0) ON CONFLICT (student_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_create_student_streak ON students;
CREATE TRIGGER trg_create_student_streak AFTER INSERT ON students FOR EACH ROW EXECUTE FUNCTION fn_create_student_streak();

-- 7. Full-Text Search index (GIN tsvector)
CREATE INDEX IF NOT EXISTS idx_dict_fts ON dictionary_entries USING GIN (to_tsvector('simple', COALESCE(word, '') || ' ' || COALESCE(meaning, ''))) WHERE is_deleted = FALSE;

-- 8. Trigram indexes
CREATE INDEX IF NOT EXISTS idx_dict_word_trgm ON dictionary_entries USING GIN (word gin_trgm_ops) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_dict_meaning_trgm ON dictionary_entries USING GIN (meaning gin_trgm_ops) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING GIN (username gin_trgm_ops) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_fullname_trgm ON user_profiles USING GIN (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_courses_title_trgm ON general_courses USING GIN (title gin_trgm_ops) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_courses_desc_trgm ON general_courses USING GIN (description gin_trgm_ops) WHERE is_deleted = FALSE;

-- 9. GIN JSONB + Partial + Covering + BRIN indexes
CREATE INDEX IF NOT EXISTS idx_materials_transcript_gin ON learning_materials USING GIN (material_transcript);
CREATE INDEX IF NOT EXISTS idx_ml_questions_options_gin ON microlearning_questions USING GIN (options_json);
CREATE INDEX IF NOT EXISTS idx_users_active ON users (username, email) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_courses_published ON general_courses (teacher_id, category_id, updated_at DESC) WHERE is_deleted = FALSE AND visibility_status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_dict_entries_active ON dictionary_entries (category_id, word) WHERE is_deleted = FALSE;
DROP INDEX IF EXISTS idx_enrollments_progress_covering;
CREATE INDEX IF NOT EXISTS idx_enrollments_student_cover ON course_enrollments (student_id) INCLUDE (course_id, progress, enrolled_at);
CREATE INDEX IF NOT EXISTS idx_wallets_balance_covering ON wallets (user_id) INCLUDE (balance);

DO $$
DECLARE tbl TEXT;
BEGIN
    FOR tbl IN ARRAY['transaction_logs','notification_users','audit_logs','log']::TEXT[] LOOP
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I USING BRIN (created_at) WITH (pages_per_range = 32)', 'idx_'||tbl||'_created_brin', tbl);
    END LOOP;
END;
$$;

-- 10. Missing FK indexes
CREATE INDEX IF NOT EXISTS idx_comments_lesson ON comments (lesson_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedbacks_user ON user_feedbacks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON course_enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notification_users (user_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON authentication_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_tx_logs_from_user ON transaction_logs (from_wallet_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_logs_to_user ON transaction_logs (to_wallet_user_id, status, created_at DESC);

-- 11. v_published_courses view
CREATE OR REPLACE VIEW v_published_courses AS
SELECT c.course_id, c.title, COALESCE(c.description, '') AS description, COALESCE(c.image_url, '') AS image_url, c.price, cat.name AS category_name, tp.full_name AS teacher_name, COUNT(e.enrollment_id) AS enrollment_count, c.updated_at
FROM general_courses c
JOIN general_course_categories cat ON cat.category_id = c.category_id
JOIN teachers t ON t.user_id = c.teacher_id
JOIN user_profiles tp ON tp.user_id = t.user_id
LEFT JOIN course_enrollments e ON e.course_id = c.course_id
WHERE c.visibility_status = 'PUBLISHED' AND c.is_deleted = FALSE
GROUP BY c.course_id, cat.name, tp.full_name;

-- 12. v_student_dashboard view
CREATE OR REPLACE VIEW v_student_dashboard AS
SELECT s.user_id AS student_id, p.full_name, ss.current_streak, ss.highest_streak, COUNT(DISTINCT e.course_id) AS enrolled_courses, COUNT(DISTINCT ua.achievement_id) AS achievements, ROUND(AVG(e.progress), 2) AS avg_progress
FROM students s
JOIN user_profiles p ON p.user_id = s.user_id
LEFT JOIN student_streaks ss ON ss.student_id = s.user_id
LEFT JOIN course_enrollments e ON e.student_id = s.user_id
LEFT JOIN user_achievements ua ON ua.user_id = s.user_id
GROUP BY s.user_id, p.full_name, ss.current_streak, ss.highest_streak;

-- 13. mv_leaderboard (fixed version)
DROP MATERIALIZED VIEW IF EXISTS mv_leaderboard;
CREATE MATERIALIZED VIEW mv_leaderboard AS
SELECT s.user_id AS student_id, p.full_name, COALESCE(p.avatar_url, '') AS avatar_url, ss.current_streak, ss.highest_streak, COUNT(ua.achievement_id) AS achievement_count,
    RANK() OVER (ORDER BY ss.highest_streak DESC, COUNT(ua.achievement_id) DESC) AS rank
FROM students s
JOIN user_profiles p ON p.user_id = s.user_id
LEFT JOIN student_streaks ss ON ss.student_id = s.user_id
LEFT JOIN user_achievements ua ON ua.user_id = s.user_id
GROUP BY s.user_id, p.full_name, p.avatar_url, ss.current_streak, ss.highest_streak
WITH DATA;
CREATE UNIQUE INDEX idx_mv_leaderboard_student ON mv_leaderboard (student_id);

-- Done
SELECT 'All migrations applied successfully!' AS status;
