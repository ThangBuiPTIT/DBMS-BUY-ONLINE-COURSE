-- ====================================================================================
-- TRIGGER REGISTRY (Đăng ký Trigger)
-- ====================================================================================
-- | # | Trigger Name | Table | Event | Function | Purpose |
-- |---|-------------|-------|-------|----------|---------|
-- | 1 | trg_auto_updated_at | users, dict_entries, courses, wallets | BEFORE UPDATE | fn_auto_update_timestamp | Auto-set updated_at |
-- | 2 | trg_provision_user | users | AFTER INSERT | fn_provision_new_user | Auto-create wallet (+ streak for students) |
-- | 3 | trg_create_student_streak | students | AFTER INSERT | fn_create_student_streak | Defense-in-depth: ensure streak row exists |
-- | 4 | trg_streak_sync | student_streaks | BEFORE INSERT/UPDATE | fn_sync_highest_streak | Auto-raise highest_streak |
-- | 5 | trg_prevent_feedback_without_learning | user_feedbacks | BEFORE INSERT | fn_prevent_feedback_without_learning | Block reviews without progress |
-- | 6 | trg_check_sufficient_balance | wallets | BEFORE UPDATE OF balance | fn_check_sufficient_balance | Prevent negative balance |
-- | 7 | trg_audit_wallet | wallets | AFTER UPDATE OF balance | fn_audit_wallet_change | Log every balance change |
-- | 8 | trg_auto_hide_teacher_courses | users | AFTER UPDATE OF status | fn_auto_hide_teacher_courses | Archive courses when teacher banned |
-- | 9 | trg_alert_large_transaction | transaction_logs | AFTER INSERT | fn_alert_large_transaction | Notify admin of large tx |
-- |10 | trg_prevent_self_transfer | transaction_logs | BEFORE INSERT | fn_prevent_self_transfer | Block self-transfers |
-- ====================================================================================

-- ====================================================================================
-- PHẦN 0: CẬP NHẬT CẤU TRÚC BẢNG (Hỗ trợ E-Commerce)
-- ====================================================================================
-- Tác dụng: Thêm giá tiền cho khóa học và liên kết giao dịch với khóa học để dễ thống kê.
ALTER TABLE general_courses 
ADD COLUMN IF NOT EXISTS price NUMERIC(14, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE transaction_logs 
ADD COLUMN IF NOT EXISTS related_course_id UUID REFERENCES general_courses(course_id) ON DELETE SET NULL;


-- ====================================================================================
-- PHẦN 1: VIEWS (Khung nhìn / Báo cáo)
-- Tác dụng: Truy vấn dữ liệu phức tạp, tính toán sẵn để phục vụ hiển thị Dashboard.
-- ====================================================================================

-- 1.1 Báo cáo tiến độ học tập tổng quát
CREATE OR REPLACE VIEW vw_student_progress_report AS
SELECT up.full_name AS student_name, u.email, s.school_name, c.title AS course_title, ce.progress, ce.enrolled_at,
    CASE 
        WHEN ce.progress = 100 THEN 'Hoàn thành'
        WHEN ce.progress > 0 THEN 'Đang học'
        ELSE 'Mới đăng ký'
    END AS learning_status
FROM users u
JOIN user_profiles up ON u.user_id = up.user_id
JOIN students s ON u.user_id = s.user_id
JOIN course_enrollments ce ON s.user_id = ce.student_id
JOIN general_courses c ON ce.course_id = c.course_id
WHERE u.is_deleted = FALSE;

-- 1.2 Báo cáo hiệu năng khóa học
CREATE OR REPLACE VIEW vw_course_analytics AS
SELECT c.course_id, c.title AS course_title, up.full_name AS teacher_name,
    COUNT(ce.enrollment_id) AS total_students, ROUND(AVG(ce.progress), 2) AS avg_progress,
    (SELECT ROUND(AVG(rating), 1) FROM user_feedbacks WHERE context LIKE '%' || c.title || '%') AS avg_rating
FROM general_courses c
JOIN teachers t ON c.teacher_id = t.user_id
JOIN user_profiles up ON t.user_id = up.user_id
LEFT JOIN course_enrollments ce ON c.course_id = ce.course_id
WHERE c.is_deleted = FALSE GROUP BY c.course_id, c.title, up.full_name;

-- 1.3 Bảng xếp hạng học viên
CREATE OR REPLACE VIEW vw_top_learners_leaderboard AS
SELECT up.full_name, up.avatar_url, ss.current_streak, ss.highest_streak,
    (SELECT COUNT(*) FROM user_achievements ua WHERE ua.user_id = s.user_id) AS total_achievements
FROM students s
JOIN user_profiles up ON s.user_id = up.user_id
JOIN student_streaks ss ON s.user_id = ss.student_id
ORDER BY ss.current_streak DESC, total_achievements DESC;

-- 1.4 Doanh thu theo khóa học
-- Tác dụng: Thống kê số tiền thu được từ mỗi khóa học đã bán.
CREATE OR REPLACE VIEW vw_revenue_by_course AS
SELECT c.course_id, c.title, c.price,
       COUNT(tl.transaction_id) AS total_sales_count,
       COALESCE(SUM(tl.amount), 0) AS total_revenue
FROM general_courses c
LEFT JOIN transaction_logs tl ON c.course_id = tl.related_course_id AND tl.status = 'SUCCESS' AND tl.message LIKE 'Mua khóa học%'
WHERE c.is_deleted = FALSE
GROUP BY c.course_id, c.title, c.price;

-- 1.5 Dashboard của Giáo viên
-- Tác dụng: Tổng hợp các chỉ số dành riêng cho giáo viên (khóa học, học viên, doanh thu tạm tính).
CREATE OR REPLACE VIEW vw_teacher_dashboard AS
SELECT t.user_id AS teacher_id, up.full_name AS teacher_name,
       COUNT(DISTINCT c.course_id) AS total_courses,
       COUNT(DISTINCT ce.student_id) AS total_students,
       COALESCE(SUM(tl.amount), 0) AS total_generated_revenue
FROM teachers t
JOIN user_profiles up ON t.user_id = up.user_id
LEFT JOIN general_courses c ON t.user_id = c.teacher_id AND c.is_deleted = FALSE
LEFT JOIN course_enrollments ce ON c.course_id = ce.course_id
LEFT JOIN transaction_logs tl ON c.course_id = tl.related_course_id AND tl.status = 'SUCCESS'
GROUP BY t.user_id, up.full_name;

-- 1.6 Học viên rủi ro bỏ học (Không tương tác > 30 ngày)
-- Tác dụng: Lấy danh sách những học viên đăng ký nhưng không học để gửi mail nhắc nhở.
CREATE OR REPLACE VIEW vw_inactive_students AS
SELECT ce.enrollment_id, ce.student_id, up.full_name, up.phone_number, c.title AS course_title, ss.last_activity_date
FROM course_enrollments ce
JOIN user_profiles up ON ce.student_id = up.user_id
JOIN general_courses c ON ce.course_id = c.course_id
LEFT JOIN student_streaks ss ON ce.student_id = ss.student_id
WHERE ce.progress < 100 AND (ss.last_activity_date < CURRENT_DATE - INTERVAL '30 days' OR ss.last_activity_date IS NULL);

-- 1.7 Thống kê phản hồi đánh giá
-- Tác dụng: Xem nhanh số lượng sao đánh giá của từng khóa học.
CREATE OR REPLACE VIEW vw_course_feedback_summary AS
SELECT context AS course_or_context,
       COUNT(*) AS total_feedbacks,
       ROUND(AVG(rating), 2) AS average_rating,
       SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five_stars,
       SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS one_star
FROM user_feedbacks
GROUP BY context;

-- 1.8 Lịch sử giao dịch chi tiết
-- Tác dụng: Dành cho Admin tra soát luồng tiền từ ai tới ai một cách trực quan.
CREATE OR REPLACE VIEW vw_detailed_transaction_history AS
SELECT tl.transaction_id, tl.created_at, tl.amount, tl.status, tl.message,
       uf.full_name AS sender_name, ut.full_name AS receiver_name,
       c.title AS related_course
FROM transaction_logs tl
LEFT JOIN user_profiles uf ON tl.from_wallet_user_id = uf.user_id
LEFT JOIN user_profiles ut ON tl.to_wallet_user_id = ut.user_id
LEFT JOIN general_courses c ON tl.related_course_id = c.course_id
ORDER BY tl.created_at DESC;


-- ====================================================================================
-- PHẦN 2: FUNCTIONS (Hàm trả về giá trị / bảng)
-- Tác dụng: Tính toán dữ liệu hoặc truy vấn phức tạp dùng lại nhiều lần.
-- ====================================================================================

-- 2.1 Tìm kiếm học viên
CREATE OR REPLACE FUNCTION fn_search_students(p_keyword TEXT DEFAULT NULL)
RETURNS TABLE (student_id UUID, username VARCHAR, full_name VARCHAR, grade_level VARCHAR, school_name VARCHAR, created_at TIMESTAMPTZ) AS $$
SELECT s.user_id, u.username, up.full_name, s.grade_level, s.school_name, u.created_at FROM students s
JOIN users u ON u.user_id = s.user_id LEFT JOIN user_profiles up ON up.user_id = s.user_id
WHERE u.is_deleted = FALSE AND (p_keyword IS NULL OR u.username ILIKE '%'||p_keyword||'%' OR up.full_name ILIKE '%'||p_keyword||'%')
ORDER BY u.created_at DESC;
$$ LANGUAGE sql STABLE;

-- 2.2 Kiểm tra học viên đủ điều kiện nhận chứng chỉ
-- Tác dụng: Trả về TRUE nếu progress = 100, FALSE nếu chưa đủ.
CREATE OR REPLACE FUNCTION fn_check_certificate_eligibility(p_student_id UUID, p_course_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_progress NUMERIC;
BEGIN
    SELECT progress INTO v_progress FROM course_enrollments WHERE student_id = p_student_id AND course_id = p_course_id;
    RETURN COALESCE(v_progress, 0) = 100.00;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2.3 Đối chiếu số dư thực tế
-- Tác dụng: Tính toán số dư bằng tổng Thu - tổng Chi từ logs để Admin check gian lận DB.
CREATE OR REPLACE FUNCTION fn_get_user_real_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE v_in NUMERIC; v_out NUMERIC;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_in FROM transaction_logs WHERE to_wallet_user_id = p_user_id AND status = 'SUCCESS';
    SELECT COALESCE(SUM(amount), 0) INTO v_out FROM transaction_logs WHERE from_wallet_user_id = p_user_id AND status = 'SUCCESS';
    RETURN v_in - v_out;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2.4 Tính tỷ lệ hoàn thành khóa học
-- Tác dụng: Trả về % học viên đã hoàn thành khóa học trên tổng số đăng ký.
CREATE OR REPLACE FUNCTION fn_get_course_completion_rate(p_course_id UUID)
RETURNS NUMERIC AS $$
DECLARE total_enrolls INT; completed INT;
BEGIN
    SELECT COUNT(*) INTO total_enrolls FROM course_enrollments WHERE course_id = p_course_id;
    IF total_enrolls = 0 THEN RETURN 0; END IF;
    SELECT COUNT(*) INTO completed FROM course_enrollments WHERE course_id = p_course_id AND progress = 100;
    RETURN ROUND((completed::NUMERIC / total_enrolls::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql STABLE;


-- ====================================================================================
-- PHẦN 3: PROCEDURES (Thủ tục thực thi thao tác dữ liệu)
-- Tác dụng: Đóng gói các quy trình nghiệp vụ thay đổi (Insert/Update/Delete) dữ liệu.
-- Có thể gọi gộp vào trong 1 Transaction.
-- ====================================================================================

-- 3.1 Cập nhật tiến trình học
CREATE OR REPLACE PROCEDURE sp_update_course_progress(p_student_id UUID, p_course_id UUID, p_progress NUMERIC)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE course_enrollments SET progress = ROUND(p_progress, 2) WHERE student_id = p_student_id AND course_id = p_course_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy enrollment.'; END IF;
END;
$$;

-- 3.2 Nạp tiền vào ví
-- Tác dụng: Tăng số dư ví và lưu log nạp tiền.
CREATE OR REPLACE PROCEDURE sp_topup_wallet(p_user_id UUID, p_amount NUMERIC, p_message TEXT)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE wallets SET balance = balance + p_amount WHERE user_id = p_user_id;
    INSERT INTO transaction_logs (to_wallet_user_id, amount, status, message)
    VALUES (p_user_id, p_amount, 'SUCCESS', 'NẠP TIỀN: ' || p_message);
END;
$$;

-- 3.3 Nghiệp vụ Mua khóa học bằng Ví (Core E-Commerce)
-- Tác dụng: Trừ tiền người mua, cộng tiền admin, insert vào log và đăng ký khóa học.
CREATE OR REPLACE PROCEDURE sp_buy_course_with_wallet(p_student_id UUID, p_course_id UUID)
LANGUAGE plpgsql AS $$
DECLARE 
    v_course_price NUMERIC; 
    v_balance NUMERIC; 
    v_admin_id UUID;
BEGIN
    -- Lấy giá khóa học
    SELECT price INTO v_course_price FROM general_courses WHERE course_id = p_course_id;
    IF v_course_price IS NULL THEN RAISE EXCEPTION 'Khóa học không tồn tại'; END IF;

    -- Kiểm tra ví học viên
    SELECT balance INTO v_balance FROM wallets WHERE user_id = p_student_id FOR UPDATE;
    IF v_balance < v_course_price THEN RAISE EXCEPTION 'Số dư không đủ để mua khóa học này'; END IF;

    -- Lấy ID Admin để nhận tiền
    SELECT u.user_id INTO v_admin_id FROM users u JOIN roles r ON u.role_id = r.role_id WHERE r.role_name = 'ADMIN' LIMIT 1;

    -- Trừ tiền học viên, cộng tiền Admin
    UPDATE wallets SET balance = balance - v_course_price WHERE user_id = p_student_id;
    UPDATE wallets SET balance = balance + v_course_price WHERE user_id = v_admin_id;

    -- Lưu Log giao dịch
    INSERT INTO transaction_logs (from_wallet_user_id, to_wallet_user_id, amount, status, message, related_course_id)
    VALUES (p_student_id, v_admin_id, v_course_price, 'SUCCESS', 'Mua khóa học', p_course_id);

    -- Đăng ký khóa học
    INSERT INTO course_enrollments (student_id, course_id, progress) VALUES (p_student_id, p_course_id, 0.00);
END;
$$;

-- 3.4 Hoàn tiền khóa học
-- Tác dụng: Hủy enroll, trả lại tiền từ Admin cho Học viên.
CREATE OR REPLACE PROCEDURE sp_refund_course(p_student_id UUID, p_course_id UUID)
LANGUAGE plpgsql AS $$
DECLARE v_course_price NUMERIC; v_admin_id UUID;
BEGIN
    SELECT price INTO v_course_price FROM general_courses WHERE course_id = p_course_id;
    SELECT u.user_id INTO v_admin_id FROM users u JOIN roles r ON u.role_id = r.role_id WHERE r.role_name = 'ADMIN' LIMIT 1;

    -- Xóa quyền truy cập (Hủy enroll)
    DELETE FROM course_enrollments WHERE student_id = p_student_id AND course_id = p_course_id;

    -- Trả lại tiền
    UPDATE wallets SET balance = balance + v_course_price WHERE user_id = p_student_id;
    UPDATE wallets SET balance = balance - v_course_price WHERE user_id = v_admin_id;

    -- Lưu Log
    INSERT INTO transaction_logs (from_wallet_user_id, to_wallet_user_id, amount, status, message, related_course_id)
    VALUES (v_admin_id, p_student_id, v_course_price, 'SUCCESS', 'Hoàn tiền khóa học', p_course_id);
END;
$$;

-- 3.5 Ban tài khoản vi phạm
-- Tác dụng: Đóng băng tài khoản và xóa tất cả phiên đăng nhập hiện tại để kick user ra ngoài.
CREATE OR REPLACE PROCEDURE sp_ban_user(p_user_id UUID, p_reason TEXT)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE users SET status = 'frozen' WHERE user_id = p_user_id;
    DELETE FROM authentication_sessions WHERE user_id = p_user_id;
    INSERT INTO log (action) VALUES ('BAN_USER: ' || p_user_id || ' Reason: ' || p_reason);
END;
$$;


-- ====================================================================================
-- PHẦN 4: TRIGGERS (Trình kích hoạt tự động)
-- Tác dụng: Bảo vệ tính toàn vẹn của dữ liệu tự động ở mức Database.
-- ====================================================================================

-- 4.1 Chặn người dùng đánh giá khi chưa học
-- Tác dụng: Bắt lỗi nếu cố chèn dữ liệu đánh giá vào bảng user_feedbacks khi progress = 0 hoặc chưa mua.
CREATE OR REPLACE FUNCTION fn_prevent_feedback_without_learning() RETURNS TRIGGER AS $$
DECLARE v_progress NUMERIC;
BEGIN
    -- Phân tích context để lấy course_id (giả định context lưu tên hoặc ID khóa học, ở đây check theo bảng enroll)
    -- Đơn giản hóa: Chặn nếu chưa enroll khóa nào có progress > 0
    SELECT MAX(progress) INTO v_progress FROM course_enrollments WHERE student_id = NEW.user_id;
    IF v_progress IS NULL OR v_progress < 10.00 THEN
        RAISE EXCEPTION 'Bạn phải hoàn thành ít nhất 10%% tiến trình học mới được phép đánh giá.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_feedback_without_learning ON user_feedbacks;
CREATE TRIGGER trg_prevent_feedback_without_learning
BEFORE INSERT ON user_feedbacks FOR EACH ROW EXECUTE FUNCTION fn_prevent_feedback_without_learning();

-- 4.2 Bảo vệ số dư ví không bị âm (Double check)
CREATE OR REPLACE FUNCTION fn_check_sufficient_balance() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.balance < 0 THEN
        RAISE EXCEPTION 'Số dư ví không thể nhỏ hơn 0. Giao dịch bị từ chối.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_sufficient_balance ON wallets;
CREATE TRIGGER trg_check_sufficient_balance
BEFORE UPDATE OF balance ON wallets FOR EACH ROW EXECUTE FUNCTION fn_check_sufficient_balance();

-- 4.3 Tự động ẩn khóa học khi Giáo viên bị khóa
CREATE OR REPLACE FUNCTION fn_auto_hide_teacher_courses() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'frozen' OR NEW.is_deleted = TRUE THEN
        UPDATE general_courses SET visibility_status = 'ARCHIVED' WHERE teacher_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_hide_teacher_courses ON users;
CREATE TRIGGER trg_auto_hide_teacher_courses
AFTER UPDATE OF status, is_deleted ON users FOR EACH ROW EXECUTE FUNCTION fn_auto_hide_teacher_courses();

-- 4.4 Cảnh báo giao dịch giá trị lớn (> 10 triệu)
CREATE OR REPLACE FUNCTION fn_alert_large_transaction() RETURNS TRIGGER AS $$
DECLARE v_admin_id UUID;
BEGIN
    IF NEW.amount >= 10000000 AND NEW.status = 'SUCCESS' THEN
        SELECT u.user_id INTO v_admin_id FROM users u JOIN roles r ON u.role_id = r.role_id WHERE r.role_name = 'ADMIN' LIMIT 1;
        INSERT INTO notification_users (user_id, title, message)
        VALUES (v_admin_id, 'CẢNH BÁO: Giao dịch lớn', 'Có một giao dịch trị giá ' || NEW.amount || ' vừa được thực hiện (TxID: ' || NEW.transaction_id || ')');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alert_large_transaction ON transaction_logs;
CREATE TRIGGER trg_alert_large_transaction
AFTER INSERT ON transaction_logs FOR EACH ROW EXECUTE FUNCTION fn_alert_large_transaction();


-- ====================================================================================
-- PHẦN 5: TRANSACTIONS (Quy trình nghiệp vụ thực tế)
-- Tác dụng: Sử dụng các Procedure để tạo thành 1 chuỗi xử lý ACID đảm bảo an toàn.
-- (Các đoạn mã dưới đây được bọc trong khối DO $$ BEGIN để bạn có thể chạy trực tiếp giả lập)
-- ====================================================================================

/*
-- 5.1 KỊCH BẢN: Học viên nạp tiền và mua khóa học thành công
-- Giải thích: Gom nhóm nạp tiền và mua khóa học. Nếu mua lỗi (vd khóa học ko tồn tại), tiền nạp cũng sẽ bị ROLLBACK.
DO $$ 
DECLARE
    v_student_id UUID := '11111111-1111-1111-1111-111111111111'; -- Thay bằng ID học viên thật
    v_course_id UUID := '22222222-2222-2222-2222-222222222222';  -- Thay bằng ID khóa học thật
BEGIN
    -- 1. Nạp 500,000 VND vào ví
    CALL sp_topup_wallet(v_student_id, 500000, 'Nạp tiền qua VNPay');
    
    -- 2. Dùng tiền ví mua khóa học
    CALL sp_buy_course_with_wallet(v_student_id, v_course_id);

    -- Nếu tới đây không có Exception nào, toàn bộ sẽ được lưu.
END $$;


-- 5.2 KỊCH BẢN: Chăm sóc khách hàng - Hoàn tiền & Gửi thông báo
-- Giải thích: Hoàn tiền trả lại học viên, rút quyền học, lưu log, gửi notification. Tất cả hoàn thành hoặc không có gì xảy ra.
DO $$ 
DECLARE
    v_student_id UUID := '11111111-1111-1111-1111-111111111111';
    v_course_id UUID := '22222222-2222-2222-2222-222222222222';
BEGIN
    -- 1. Xử lý nghiệp vụ hoàn tiền
    CALL sp_refund_course(v_student_id, v_course_id);

    -- 2. Bắn thông báo hệ thống cho học viên
    INSERT INTO notification_users (user_id, title, message)
    VALUES (v_student_id, 'Hoàn tiền thành công', 'Bạn đã được hoàn tiền cho khóa học vừa hủy.');
END $$;


-- 5.3 KỊCH BẢN: Admin BAN một user vi phạm và thu hồi tiền (phạt)
-- Giải thích: Khóa account, ngắt session, trừ sạch tiền trong ví về 0.
DO $$
DECLARE
    v_bad_user_id UUID := '33333333-3333-3333-3333-333333333333';
    v_balance_to_confiscate NUMERIC;
BEGIN
    -- 1. Gọi Procedure Khóa user
    CALL sp_ban_user(v_bad_user_id, 'Phát hiện hành vi hack hệ thống');

    -- 2. Tịch thu số dư
    SELECT balance INTO v_balance_to_confiscate FROM wallets WHERE user_id = v_bad_user_id FOR UPDATE;
    IF v_balance_to_confiscate > 0 THEN
        UPDATE wallets SET balance = 0 WHERE user_id = v_bad_user_id;
        INSERT INTO log(action) VALUES ('Tịch thu ' || v_balance_to_confiscate || ' từ tài khoản bị ban ' || v_bad_user_id);
    END IF;
END $$;
*/


-- ====================================================================================
-- 4.5 Chặn tự chuyển tiền cho chính mình (Self-Transfer Prevention)
-- Tác dụng: Bảo vệ ở mức DB — không cho phép from = to trong transaction_logs.
--           Bổ sung cho validation trong sp_transfer_funds.
-- ====================================================================================
CREATE OR REPLACE FUNCTION fn_prevent_self_transfer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.from_wallet_user_id IS NOT NULL
       AND NEW.from_wallet_user_id = NEW.to_wallet_user_id THEN
        RAISE EXCEPTION 'Không thể tự chuyển tiền cho chính mình (self-transfer)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_self_transfer ON transaction_logs;
CREATE TRIGGER trg_prevent_self_transfer
BEFORE INSERT ON transaction_logs
FOR EACH ROW EXECUTE FUNCTION fn_prevent_self_transfer();