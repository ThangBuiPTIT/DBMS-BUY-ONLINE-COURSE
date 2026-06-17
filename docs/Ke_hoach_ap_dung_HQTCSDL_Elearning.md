# KẾ HOẠCH ÁP DỤNG KĨ THUẬT HỆ QUẢN TRỊ CƠ SỞ DỮ LIỆU
## Nền tảng học trực tuyến Ngôn ngữ Ký hiệu (PostgreSQL)
*Tài liệu phục vụ Báo cáo Đồ án Tốt nghiệp — Vai trò: Software Engineer / Database Engineer*

---

## PHẦN 1. PHÂN TÍCH BÀI TOÁN & PHÂN LOẠI TẢI DỮ LIỆU

Trước khi áp dụng bất kỳ kĩ thuật nào, cần phân loại các bảng theo *tính chất truy cập* (access pattern). Đây là cơ sở khoa học để quyết định kĩ thuật nào đặt ở đâu — và là phần "phương pháp luận" giúp báo cáo có chiều sâu thay vì liệt kê kĩ thuật rời rạc.

| Nhóm | Bảng tiêu biểu | Đặc trưng tải | Kĩ thuật ưu tiên |
|------|----------------|---------------|------------------|
| **Read-heavy (tra cứu)** | `dictionary_entries`, `dictionary_variations`, `dictionary_categories` | Đọc rất nhiều, ghi hiếm, dữ liệu ổn định | Index (FTS, trigram), Cache (Redis), Materialized View, Read Replica |
| **Read-heavy (catalog)** | `general_courses`, `general_course_modules/lessons`, `learning_materials`, `microlearning_*` | Đọc theo cây phân cấp | Partial Index, Covering Index, Cache cây nội dung |
| **Time-series (append-only)** | `transaction_logs`, `transaction_action_logs`, `log`, `audit_logs`, `notification_users` | Ghi liên tục, phình vô hạn, truy vấn theo thời gian | **Partitioning (RANGE theo tháng)**, BRIN Index, retention/detach |
| **Critical consistency** | `wallets`, `transaction_logs` | Tiền bạc — không được sai/mất | **Transaction + Locking (FOR UPDATE) + Isolation Level cao** |
| **Hot-update giá trị nhỏ** | `course_enrollments.progress`, `student_streaks` | Cập nhật liên tục một vài cột | Trigger, Optimistic Locking |
| **Phiên/ngắn hạn** | `authentication_sessions` | TTL ngắn, đọc/ghi nhanh | Đẩy sang Redis (TTL), Index trên `expires_at` |

> **Luận điểm cho báo cáo:** Một hệ thống không thể tối ưu "đồng đều" mọi bảng. Việc *đo trước — phân loại — áp đúng kĩ thuật* chính là điểm khác biệt giữa thiết kế của kỹ sư có kinh nghiệm và thiết kế lý thuyết.

---

## PHẦN 2. VIEW (Khung nhìn)

VIEW giúp **đóng gói logic truy vấn phức tạp**, kiểm soát quyền truy cập (chỉ lộ cột cần thiết), và là nơi lý tưởng để áp dụng `is_deleted = FALSE` một cách nhất quán (soft-delete).

### 2.1. View thường — Catalog khóa học đã xuất bản
Dùng cho trang chủ học viên. Ẩn khóa nháp/đã xóa, ghép sẵn tên giáo viên + danh mục + số lượt đăng ký.

```sql
CREATE OR REPLACE VIEW v_published_courses AS
SELECT
    c.course_id,
    c.title,
    c.description,
    cat.name              AS category_name,
    tp.full_name          AS teacher_name,
    COUNT(e.enrollment_id) AS enrollment_count,
    c.updated_at
FROM general_courses c
JOIN general_course_categories cat ON cat.category_id = c.category_id
JOIN teachers t                    ON t.user_id      = c.teacher_id
JOIN user_profiles tp              ON tp.user_id     = t.user_id
LEFT JOIN course_enrollments e     ON e.course_id    = c.course_id
WHERE c.visibility_status = 'PUBLISHED'
  AND c.is_deleted = FALSE
GROUP BY c.course_id, cat.name, tp.full_name;
```

### 2.2. View bảng điều khiển học viên (Student Dashboard)
Gộp tiến độ học, streak và số huy hiệu — tránh client phải gọi nhiều API.

```sql
CREATE OR REPLACE VIEW v_student_dashboard AS
SELECT
    s.user_id,
    p.full_name,
    ss.current_streak,
    ss.highest_streak,
    COUNT(DISTINCT e.course_id)      AS enrolled_courses,
    COUNT(DISTINCT ua.achievement_id) AS achievements,
    ROUND(AVG(e.progress), 2)         AS avg_progress
FROM students s
JOIN user_profiles p          ON p.user_id = s.user_id
LEFT JOIN student_streaks ss  ON ss.student_id = s.user_id
LEFT JOIN course_enrollments e ON e.student_id = s.user_id
LEFT JOIN user_achievements ua ON ua.user_id = s.user_id
GROUP BY s.user_id, p.full_name, ss.current_streak, ss.highest_streak;
```

### 2.3. Materialized View — Bảng xếp hạng (Leaderboard)
Leaderboard là truy vấn nặng (RANK toàn bộ học viên) nhưng *không cần real-time tuyệt đối* → vật hóa và refresh định kỳ. Đây là dạng **cache ở tầng CSDL**.

```sql
CREATE MATERIALIZED VIEW mv_leaderboard AS
SELECT
    s.user_id AS student_id,
    p.full_name,
    ss.highest_streak,
    COUNT(ua.achievement_id) AS achievement_count,
    RANK() OVER (ORDER BY ss.highest_streak DESC,
                          COUNT(ua.achievement_id) DESC) AS rank
FROM students s
JOIN user_profiles p          ON p.user_id = s.user_id
LEFT JOIN student_streaks ss  ON ss.student_id = s.user_id
LEFT JOIN user_achievements ua ON ua.user_id = s.user_id
GROUP BY s.user_id, p.full_name, ss.highest_streak
WITH DATA;

-- Bắt buộc có UNIQUE index để dùng REFRESH ... CONCURRENTLY (không khóa đọc)
CREATE UNIQUE INDEX idx_mv_leaderboard_student ON mv_leaderboard(student_id);

-- Làm mới mỗi 5 phút bằng cron/pg_cron, không chặn người đọc:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard;
```

> **Điểm nhấn báo cáo:** so sánh thời gian truy vấn leaderboard *trực tiếp* vs *materialized view* (EXPLAIN ANALYZE) để chứng minh hiệu quả.

---

## PHẦN 3. TRIGGER (Bẫy sự kiện)

Trigger đảm bảo **toàn vẹn nghiệp vụ tự động** mà tầng ứng dụng không thể "quên".

### 3.1. Tự động cập nhật `updated_at` (dùng chung)
Áp cho mọi bảng có cột này: `users`, `dictionary_entries`, `general_courses`, `wallets`.

```sql
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
-- Lặp lại cho general_courses, dictionary_entries, wallets...
```

### 3.2. Tự đồng bộ `highest_streak` (bảo vệ CHECK constraint)
Schema có ràng buộc `ck_streak_highest_gte_current`. Trigger này tự nâng kỷ lục, vừa giữ ràng buộc vừa bỏ logic khỏi tầng app.

```sql
CREATE OR REPLACE FUNCTION fn_sync_highest_streak()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_streak > NEW.highest_streak THEN
        NEW.highest_streak := NEW.current_streak;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_streak_sync
BEFORE INSERT OR UPDATE ON student_streaks
FOR EACH ROW EXECUTE FUNCTION fn_sync_highest_streak();
```

### 3.3. Tự khởi tạo tài nguyên khi tạo người dùng (Provisioning)
Mỗi user mới cần một ví (`wallets`). Học viên cần thêm bản ghi streak.

```sql
CREATE OR REPLACE FUNCTION fn_provision_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallets(user_id) VALUES (NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_provision_user
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION fn_provision_new_user();
```

### 3.4. Trigger ghi nhật ký kiểm toán (Audit) khi đổi số dư ví
Mọi thay đổi `balance` đều để lại dấu vết — yêu cầu bắt buộc với hệ thống tài chính.

```sql
CREATE OR REPLACE FUNCTION fn_audit_wallet_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.balance <> OLD.balance THEN
        INSERT INTO log(action)   -- dùng bảng log (cột action kiểu TEXT)
        VALUES (format('WALLET %s: %s -> %s', NEW.user_id, OLD.balance, NEW.balance));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_wallet
AFTER UPDATE ON wallets
FOR EACH ROW EXECUTE FUNCTION fn_audit_wallet_change();
```

> **Lưu ý kĩ thuật (đưa vào báo cáo):** dùng `log.action` (kiểu `TEXT`) thay vì `audit_logs.action` vì cột này chỉ `VARCHAR(50)` — không đủ chứa thông điệp chi tiết. Đây là kiểu phân tích "đọc schema kĩ" mà hội đồng đánh giá cao.

---

## PHẦN 4. TRANSACTION (Giao dịch) + PHẦN 5. PROCEDURE — Tâm điểm ACID

Nghiệp vụ **chuyển tiền** và **đăng ký khóa học trả phí** là minh chứng kinh điển cho ACID. Tôi gộp Transaction + Procedure + Locking vào một thủ tục hoàn chỉnh.

### 4.1. Thủ tục chuyển tiền — ACID + chống deadlock

```sql
CREATE OR REPLACE PROCEDURE sp_transfer_funds(
    p_from   UUID,
    p_to     UUID,
    p_amount NUMERIC
)
LANGUAGE plpgsql AS $$
DECLARE
    v_from_balance NUMERIC;
    v_tx_id        UUID;
    v_first        UUID;
    v_second       UUID;
BEGIN
    -- (1) Kiểm tra đầu vào
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Số tiền phải > 0'; END IF;
    IF p_from = p_to THEN RAISE EXCEPTION 'Không thể tự chuyển'; END IF;

    -- (2) CHỐNG DEADLOCK: luôn khóa theo thứ tự cố định của user_id
    IF p_from < p_to THEN v_first := p_from; v_second := p_to;
    ELSE                  v_first := p_to;   v_second := p_from;
    END IF;

    PERFORM 1 FROM wallets WHERE user_id = v_first  FOR UPDATE;
    PERFORM 1 FROM wallets WHERE user_id = v_second FOR UPDATE;

    -- (3) Kiểm tra số dư SAU khi đã khóa (tránh race condition)
    SELECT balance INTO v_from_balance FROM wallets WHERE user_id = p_from;
    IF v_from_balance < p_amount THEN
        RAISE EXCEPTION 'Số dư không đủ (có: %, cần: %)', v_from_balance, p_amount;
    END IF;

    -- (4) Thực hiện — tất cả trong cùng 1 transaction (atomic)
    UPDATE wallets SET balance = balance - p_amount WHERE user_id = p_from;
    UPDATE wallets SET balance = balance + p_amount WHERE user_id = p_to;

    INSERT INTO transaction_logs(from_wallet_user_id, to_wallet_user_id,
                                 amount, status, message)
    VALUES (p_from, p_to, p_amount, 'SUCCESS', 'Chuyển tiền thành công')
    RETURNING transaction_id INTO v_tx_id;

    INSERT INTO transaction_action_logs(transaction_id, action_type, message)
    VALUES (v_tx_id, 'TRANSFER_COMPLETE', 'OK');
END;
$$;
```

**Phân tích ACID để viết báo cáo:**
- **Atomicity:** nếu bước (4) lỗi → toàn bộ rollback, không bao giờ trừ tiền mà không cộng.
- **Consistency:** ràng buộc `ck_wallets_balance_non_negative` + kiểm tra số dư đảm bảo bất biến "tổng tiền không đổi".
- **Isolation:** `FOR UPDATE` khóa hàng, hai giao dịch song song không đọc số dư cũ.
- **Durability:** WAL (Write-Ahead Log) của PostgreSQL đảm bảo dữ liệu đã commit không mất khi sập điện.

> **Bẫy nâng cao cần nêu:** Muốn lưu log `'FAILED'` *kèm* việc rollback giao dịch chính, PostgreSQL không có *autonomous transaction* gốc. Giải pháp: thủ tục trả về status thay vì RAISE, để tầng app ghi log; hoặc dùng `dblink`/`pg_background`. Nêu được điểm này thể hiện hiểu biết sâu.

### 4.2. Thủ tục đăng ký khóa học trả phí (gộp chuyển tiền + ghi danh)

```sql
CREATE OR REPLACE PROCEDURE sp_enroll_paid_course(
    p_student UUID, p_course UUID, p_price NUMERIC, p_teacher UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Toàn bộ là 1 transaction: trừ tiền HV, cộng tiền GV, ghi danh
    CALL sp_transfer_funds(p_student, p_teacher, p_price);

    INSERT INTO course_enrollments(student_id, course_id)
    VALUES (p_student, p_course);
    -- uq_student_course_enrollment tự chặn ghi danh trùng → rollback nếu trùng
END;
$$;
```

---

## PHẦN 6. INDEXING (Đánh chỉ mục)

Schema đã có index B-tree cơ bản. Phần này trình bày các **loại index nâng cao** đúng với từng access pattern.

### 6.1. Partial Index — chỉ index phần dữ liệu "sống"
Hệ thống dùng soft-delete (`is_deleted`) và trạng thái (`visibility_status`). Index toàn phần lãng phí — chỉ nên index hàng thực sự được truy vấn.

```sql
-- Catalog chỉ quan tâm khóa PUBLISHED, chưa xóa → index nhỏ hơn nhiều
CREATE INDEX idx_courses_published
ON general_courses(category_id, updated_at DESC)
WHERE visibility_status = 'PUBLISHED' AND is_deleted = FALSE;

CREATE INDEX idx_users_active
ON users(role_id)
WHERE is_deleted = FALSE AND status = 'active';
```

### 6.2. Covering Index (INCLUDE) — Index-Only Scan
Trang "khóa học của tôi" chỉ cần vài cột → đặt vào `INCLUDE` để đọc thẳng từ index, không cần chạm bảng (heap).

```sql
CREATE INDEX idx_enrollments_student_cover
ON course_enrollments(student_id)
INCLUDE (course_id, progress, enrolled_at);
```

### 6.3. GIN Index cho JSONB
Hai cột `options_json` và `material_transcript` là JSONB.

```sql
CREATE INDEX idx_ml_questions_options_gin
ON microlearning_questions USING GIN (options_json);
```

### 6.4. Full-Text Search & Trigram cho từ điển ký hiệu
Đây là tính năng lõi: tra cứu từ. Với tiếng Việt nên dùng `pg_trgm` (chịu lỗi gõ, không dấu) song song FTS.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tìm gần đúng / gợi ý khi gõ (autocomplete)
CREATE INDEX idx_dict_word_trgm
ON dictionary_entries USING GIN (word gin_trgm_ops)
WHERE is_deleted = FALSE;

-- Tìm toàn văn theo cả nghĩa
CREATE INDEX idx_dict_fts
ON dictionary_entries
USING GIN (to_tsvector('simple', word || ' ' || meaning))
WHERE is_deleted = FALSE;
```

### 6.5. BRIN Index cho bảng time-series
Với bảng chỉ thêm-mới theo thời gian, BRIN nhỏ hơn B-tree hàng trăm lần mà vẫn lọc khoảng thời gian tốt.

```sql
CREATE INDEX idx_tx_logs_created_brin
ON transaction_logs USING BRIN (created_at);
```

> **Cảnh báo cho báo cáo:** Index không miễn phí — mỗi index làm chậm INSERT/UPDATE và tốn dung lượng. Dùng `pg_stat_user_indexes` để phát hiện và *xóa index không bao giờ được dùng* (`idx_scan = 0`). Đây là phần "đánh đổi" quan trọng.

---

## PHẦN 7. PARTITIONING (Phân vùng)

Các bảng log phình vô hạn → phân vùng **RANGE theo tháng** giúp truy vấn chỉ quét vùng liên quan (*partition pruning*) và **xóa dữ liệu cũ tức thì** bằng `DETACH`/`DROP` (thay vì `DELETE` chậm).

```sql
-- Bảng cha (lưu ý: PK phải chứa khóa phân vùng created_at)
CREATE TABLE transaction_logs (
    transaction_id      UUID DEFAULT gen_random_uuid(),
    from_wallet_user_id UUID,
    to_wallet_user_id   UUID,
    amount              NUMERIC(14,2) NOT NULL,
    status              VARCHAR(20)   NOT NULL,
    message             TEXT,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (transaction_id, created_at)
) PARTITION BY RANGE (created_at);

-- Vùng theo tháng
CREATE TABLE transaction_logs_2026_06 PARTITION OF transaction_logs
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE transaction_logs_2026_07 PARTITION OF transaction_logs
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

- **Tự động hóa:** dùng extension **`pg_partman`** để tự tạo vùng tương lai + retention.
- **Áp dụng tương tự:** `audit_logs`, `log`, `transaction_action_logs`, `notification_users`.
- **Lưu ý thiết kế (quan trọng):** PostgreSQL bắt buộc khóa phân vùng phải nằm trong mọi UNIQUE/PRIMARY KEY → PK của `transaction_logs` phải đổi thành `(transaction_id, created_at)`. Nêu rõ sự thay đổi schema này trong báo cáo.

---

## PHẦN 8. PHÂN TÁN & NHÂN BẢN (Distribution / Replication)

| Kĩ thuật | Áp dụng cho hệ thống này |
|----------|--------------------------|
| **Streaming Replication** (1 Primary + N Replica) | Tách *đọc* (catalog, từ điển, leaderboard) ra replica; *ghi* (ví, ghi danh) vào primary. Mở rộng năng lực đọc tuyến tính. |
| **Read/Write Splitting** | Tầng app/route: SELECT → replica, INSERT/UPDATE/transaction → primary. Lưu ý độ trễ nhân bản (*replication lag*) với dữ liệu vừa ghi. |
| **Logical Replication** | Đẩy các bảng phân tích (`transaction_logs`, `course_enrollments`) sang một CSDL Data Warehouse riêng, tránh truy vấn báo cáo nặng làm chậm hệ thống chính (tách OLTP/OLAP). |
| **Sharding (Citus)** | Khi quy mô lớn: shard theo `user_id` (hash) cho dữ liệu người dùng/ví; `dictionary_*` đặt làm **reference table** nhân bản về mọi node (vì đọc nhiều, đổi ít). |
| **CDN + Object Storage** | `video_url`, `content_url`, `avatar_url` **không lưu trong DB** — chỉ lưu URL, file đặt trên S3/MinIO + CDN. Giảm tải DB triệt để cho nội dung video ký hiệu. |

---

## PHẦN 9. TỐI ƯU CÂU LỆNH TRUY VẤN (Query Optimization)

1. **Công cụ phân tích:** `EXPLAIN (ANALYZE, BUFFERS)` để xem kế hoạch thực thi thật (Seq Scan vs Index Scan, số block đọc).
2. **`pg_stat_statements`:** bật extension này để xác định Top-N câu lệnh chậm/tốn tài nguyên nhất — đây là *bằng chứng định lượng* cho báo cáo.
3. **Keyset Pagination thay OFFSET:** danh sách bình luận/khóa học phân trang sâu. `OFFSET 100000` phải quét bỏ 100.000 hàng; keyset thì không:

```sql
-- Chậm:  ... ORDER BY created_at DESC OFFSET 100000 LIMIT 20;
-- Nhanh (keyset/cursor):
SELECT * FROM comments
WHERE lesson_id = $1 AND created_at < $2   -- $2 = mốc trang trước
ORDER BY created_at DESC
LIMIT 20;
```

4. **Tránh N+1:** lấy cây module→lesson trong **một** truy vấn JOIN thay vì lặp gọi từng lesson.
5. **Tránh `SELECT *`:** chỉ lấy cột cần để tận dụng covering index (Mục 6.2).

---

## PHẦN 10. BUFFER POOL (Bộ đệm trang)

PostgreSQL đệm trang dữ liệu nóng trong RAM (`shared_buffers`). Mục tiêu: **cache hit ratio > 99%**.

```sql
-- Cấu hình (postgresql.conf), VD máy 16GB RAM:
-- shared_buffers      = 4GB      (~25% RAM)
-- effective_cache_size = 12GB    (~75% RAM, gợi ý cho planner)
-- work_mem            = 64MB     (cho sort/hash mỗi truy vấn)

-- Đo tỉ lệ trúng cache:
SELECT sum(heap_blks_hit) /
       NULLIF(sum(heap_blks_hit + heap_blks_read), 0) AS cache_hit_ratio
FROM pg_statio_user_tables;

-- Nạp sẵn bảng nóng vào buffer sau khi restart (làm ấm cache):
CREATE EXTENSION IF NOT EXISTS pg_prewarm;
SELECT pg_prewarm('dictionary_entries');
SELECT pg_prewarm('mv_leaderboard');
```

> Dùng `pg_buffercache` để liệt kê bảng nào đang chiếm buffer — minh họa rằng `dictionary_*` (đọc nhiều) nên thường trú trong cache.

---

## PHẦN 11. CACHING (Bộ nhớ đệm ngoài — Redis)

Caching tầng CSDL (materialized view) + tầng ứng dụng (Redis) bổ sung cho nhau.

| Dữ liệu | Chiến lược cache | Lý do |
|---------|------------------|-------|
| `authentication_sessions` | **Chuyển hẳn sang Redis** với TTL = `expires_at` | Phiên đăng nhập đọc/ghi cực nhiều, vòng đời ngắn — Redis là nơi đúng, giảm tải DB |
| Tra cứu từ điển | **Cache-aside** (key `dict:<word>`) | Đọc rất nhiều, đổi rất ít → tỉ lệ trúng cao |
| Catalog khóa học | Cache-aside, invalidate khi publish/cập nhật | Trang chủ truy cập dày |
| Leaderboard | Redis **Sorted Set** (`ZADD streak`) | ZSET xếp hạng O(log n), hợp hoàn hảo với streak ranking |

**Mẫu Cache-Aside (đọc):** kiểm tra Redis → trượt thì truy vấn DB → ghi lại Redis.
**Chiến lược vô hiệu hóa (invalidation):** khi `general_courses` đổi `visibility_status` → xóa key catalog liên quan (có thể kích hoạt bằng trigger + `pg_notify`).

> **Luận điểm:** "Vấn đề khó nhất của cache không phải lưu, mà là *làm mất hiệu lực đúng lúc* (cache invalidation)." — phân tích đánh đổi giữa độ mới và hiệu năng.

---

## PHẦN 12. TỐI ƯU CONCURRENCY & LOCKING

### 12.1. MVCC & Isolation Level
PostgreSQL dùng **MVCC**: đọc không chặn ghi và ngược lại. Cần chọn mức cô lập phù hợp:
- `READ COMMITTED` (mặc định): đủ cho hầu hết (xem khóa học, bình luận).
- `REPEATABLE READ` / `SERIALIZABLE`: cho giao dịch ví khi cần chống *write-skew*.

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
  -- nghiệp vụ ví nhạy cảm
COMMIT;
```

### 12.2. Khóa bi quan (Pessimistic) — `SELECT FOR UPDATE`
Đã dùng ở thủ tục chuyển tiền (Mục 4.1). Phù hợp khi xung đột *thường xuyên* và tốn kém nếu sai (tiền).

### 12.3. Khóa lạc quan (Optimistic) — version qua `updated_at`
Phù hợp khi xung đột *hiếm* (giáo viên sửa khóa học). Không khóa hàng, chỉ kiểm tra lúc ghi:

```sql
UPDATE general_courses
SET title = $1, updated_at = CURRENT_TIMESTAMP
WHERE course_id = $2
  AND updated_at = $3;     -- $3 = updated_at đã đọc lúc mở form
-- Nếu 0 hàng bị ảnh hưởng → có người khác đã sửa → báo xung đột, yêu cầu tải lại
```

### 12.4. Chống Deadlock — khóa theo thứ tự nhất quán
Đã minh họa trong `sp_transfer_funds`: luôn khóa ví theo thứ tự `user_id` tăng dần → hai giao dịch ngược chiều A→B và B→A không thể chờ chéo nhau.

### 12.5. `SKIP LOCKED` — hàng đợi xử lý
Gửi thông báo / xử lý lại giao dịch theo kiểu nhiều worker song song mà không tranh chấp:

```sql
SELECT * FROM notification_users
WHERE is_read = FALSE
ORDER BY created_at
FOR UPDATE SKIP LOCKED
LIMIT 100;   -- mỗi worker lấy 100 dòng khác nhau, không chờ nhau
```

### 12.6. Advisory Lock — tác vụ định kỳ chạy đơn lẻ
Reset streak lúc nửa đêm, refresh leaderboard… cần đảm bảo chỉ một tiến trình chạy:

```sql
SELECT pg_try_advisory_lock(42);  -- chỉ 1 worker giành được khóa, các worker khác bỏ qua
```

---

## PHẦN 13. LỘ TRÌNH TRIỂN KHAI THEO GIAI ĐOẠN

| Giai đoạn | Nội dung | Đầu ra để đưa vào báo cáo |
|-----------|----------|---------------------------|
| **GĐ0 — Đo nền (Baseline)** | Bật `pg_stat_statements`, viết kịch bản `pgbench`, đo TPS/độ trễ ban đầu | Số liệu "trước tối ưu" |
| **GĐ1 — Logic CSDL** | View, Trigger, Procedure, Transaction | Mã nguồn + kiểm thử ACID |
| **GĐ2 — Index & Query** | Partial/Covering/GIN/BRIN, viết lại truy vấn, keyset | EXPLAIN ANALYZE trước/sau |
| **GĐ3 — Cache & Buffer** | Redis cache-aside + sorted set, tinh chỉnh `shared_buffers`, prewarm | Tỉ lệ cache hit, độ trễ giảm |
| **GĐ4 — Partition & Retention** | Phân vùng bảng log, `pg_partman` | Chứng minh partition pruning |
| **GĐ5 — Phân tán & Concurrency** | Read replica, isolation level, kiểm thử khóa/deadlock | Kịch bản 100 user chuyển tiền song song |
| **GĐ6 — Đánh giá** | Benchmark cuối, tổng hợp | Bảng so sánh "trước–sau" |

---

## PHẦN 14. KỊCH BẢN ĐÁNH GIÁ (Benchmark)

**Công cụ:** `pgbench` (kịch bản tùy biến) + `pg_stat_statements` + `EXPLAIN (ANALYZE, BUFFERS)`.

**Chỉ số đo (Metrics) — bảng "trước/sau" cho mỗi kĩ thuật:**
- Độ trễ p50 / p95 / p99 (ms)
- Thông lượng (TPS — transactions per second)
- Cache hit ratio (%)
- Số block đọc từ đĩa (giảm sau khi đánh index/cache)
- Tỉ lệ index được dùng (`pg_stat_user_indexes`)
- Số deadlock / xung đột serialization khi tải song song

**Kịch bản tải song song (chứng minh Locking):** 100 client đồng thời gọi `sp_transfer_funds` trên cùng tập ví → kiểm tra: tổng tiền bảo toàn, không số dư âm, đo số lần retry/deadlock.

---

## PHẦN 15. ÁNH XẠ SANG CHƯƠNG BÁO CÁO ĐỒ ÁN

| Chương | Nội dung gợi ý |
|--------|----------------|
| **Chương 1 — Tổng quan** | Bài toán e-learning ngôn ngữ ký hiệu, mục tiêu áp dụng kĩ thuật HQTCSDL |
| **Chương 2 — Cơ sở lý thuyết** | Khái niệm: ACID, MVCC, Index, Partitioning, Replication, Caching, Locking |
| **Chương 3 — Phân tích & Thiết kế CSDL** | Phần 1 (phân loại tải) + ERD + lý do thiết kế schema |
| **Chương 4 — Triển khai kĩ thuật** | Phần 2–12: View/Trigger/Procedure/Index/Partition/Concurrency kèm mã nguồn |
| **Chương 5 — Thực nghiệm & Đánh giá** | Phần 13–14: lộ trình + bảng benchmark trước/sau |
| **Chương 6 — Kết luận** | Đánh đổi giữa các kĩ thuật, hướng phát triển (sharding, AI gợi ý nội dung) |

---

### Ghi chú đánh đổi (Trade-offs) — phần giúp báo cáo "chín"
- Index tăng tốc đọc nhưng làm chậm ghi và tốn dung lượng.
- Cache tăng tốc nhưng tạo bài toán *invalidation* và *dữ liệu cũ*.
- Materialized view nhanh nhưng không real-time.
- Isolation level cao an toàn hơn nhưng giảm throughput.
- Phân tán mở rộng được nhưng thêm độ trễ và độ phức tạp vận hành.

> Một thiết kế tốt **không tối đa hóa mọi kĩ thuật**, mà chọn đúng đánh đổi cho từng nhóm dữ liệu — đó là thông điệp cốt lõi nên xuyên suốt báo cáo.
