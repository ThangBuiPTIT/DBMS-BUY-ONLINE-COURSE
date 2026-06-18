# CHƯƠNG 3: CÁC KỸ THUẬT QUẢN TRỊ CƠ SỞ DỮ LIỆU HIỆN ĐẠI
## Ứng dụng trong Hệ thống E-Learning Ngôn ngữ Ký hiệu

---

> **Tóm tắt chương:** Chương này trình bày chi tiết 07 kỹ thuật Quản trị Cơ sở Dữ liệu (DBMS) nâng cao đã được hiện thực hóa trong hệ thống E-Learning Ngôn ngữ Ký hiệu. Mỗi kỹ thuật được phân tích theo bốn góc độ: (1) Khái niệm lý thuyết, (2) Vai trò & Mục đích trong kiến trúc hệ thống, (3) Phân tích Lợi ích & Đánh đổi, và (4) Hiện thực hóa trong mã nguồn kèm walkthrough chi tiết. Tất cả các kỹ thuật được triển khai trên nền tảng PostgreSQL 15+ và FastAPI (Python 3.11+).

---

## Mục lục

1. [View & Materialized View (Khung nhìn & Khung nhìn vật chất hóa)](#1-view--materialized-view-khung-nhìn--khung-nhìn-vật-chất-hóa)
2. [Database Triggers (Bẫy sự kiện)](#2-database-triggers-bẫy-sự-kiện)
3. [Concurrency Control & Locking (Tối ưu đồng thời & Khóa)](#3-concurrency-control--locking-tối-ưu-đồng-thời--khóa)
4. [Caching with Redis (Bộ nhớ đệm với Redis)](#4-caching-with-redis-bộ-nhớ-đệm-với-redis)
5. [Table Partitioning (Phân vùng dữ liệu)](#5-table-partitioning-phân-vùng-dữ-liệu)
6. [Database Distribution & Replication (Phân tán và Nhân bản)](#6-database-distribution--replication-phân-tán-và-nhân-bản)
7. [Query Execution & Indexing Optimization (Tối ưu Truy vấn & Đánh chỉ mục)](#7-query-execution--indexing-optimization-tối-ưu-truy-vấn--đánh-chỉ-mục)

---

## 1. View & Materialized View (Khung nhìn & Khung nhìn vật chất hóa)

### 1.1 Khái niệm (Concept)

**View (Khung nhìn)** là một bảng ảo (virtual table) được định nghĩa bởi một câu truy vấn SQL. View không lưu trữ dữ liệu vật lý — mỗi khi được truy vấn, PostgreSQL thực thi câu lệnh SQL định nghĩa view và trả về kết quả tại thời điểm đó. View hoạt động như một "cửa sổ" nhìn vào dữ liệu thực của các bảng cơ sở. Ta có thể hình dung View như một **macro SQL** — mỗi lần gọi, câu `SELECT` định nghĩa được thực thi lại từ đầu.

```mermaid
graph LR
    A[Ứng dụng] -->|SELECT * FROM v_published_courses| B[View Engine]
    B -->|Thực thi SQL định nghĩa| C[general_courses]
    B -->|JOIN| D[general_course_categories]
    B -->|JOIN| E[teachers + user_profiles]
    B -->|LEFT JOIN| F[course_enrollments]
    B -->|Trả kết quả| A
```

**Materialized View (MV — Khung nhìn vật chất hóa)** khác biệt ở chỗ nó **lưu trữ kết quả truy vấn một cách vật lý trên đĩa**. Khi được tạo bằng lệnh `CREATE MATERIALIZED VIEW ... WITH DATA`, PostgreSQL thực thi câu truy vấn định nghĩa một lần và lưu toàn bộ tập kết quả như một bảng thực sự. Các lần truy vấn sau đọc trực tiếp từ bản sao đã được tính toán sẵn này, không cần JOIN lại các bảng gốc. Tuy nhiên, dữ liệu trong MV là **tĩnh** — nó không tự động cập nhật khi dữ liệu gốc thay đổi. Để làm mới, ta phải chạy `REFRESH MATERIALIZED VIEW`.

```mermaid
graph TB
    subgraph "Tại thời điểm tạo/refresh"
        S1[students + user_profiles + streaks + achievements] -->|JOIN + GROUP BY + RANK| MV[mv_leaderboard<br/>Dữ liệu đã tính sẵn trên đĩa]
    end
    subgraph "Tại thời điểm truy vấn"
        APP[Ứng dụng] -->|SELECT * FROM mv_leaderboard| MV
        MV -->|Đọc trực tiếp - Không JOIN| APP
    end
```

#### Cơ chế hoạt động của `REFRESH MATERIALIZED VIEW CONCURRENTLY`

Trong PostgreSQL, `REFRESH MATERIALIZED VIEW` có hai chế độ:

| Chế độ | Hành vi | Khóa bảng | Phù hợp |
|--------|---------|-----------|---------|
| **Không CONCURRENTLY** | Xóa toàn bộ dữ liệu cũ, chạy lại truy vấn định nghĩa, chèn dữ liệu mới | **ACCESS EXCLUSIVE** (khóa hoàn toàn — chặn mọi thao tác đọc/ghi) | Môi trường dev, bảng nhỏ |
| **CÓ CONCURRENTLY** | Chạy truy vấn định nghĩa, so sánh từng hàng với dữ liệu cũ, chỉ cập nhật các hàng thay đổi (DELETE + INSERT diff) | **không khóa đọc** — cho phép SELECT song song | **Production** |

**Điều kiện tiên quyết để `CONCURRENTLY` hoạt động**: Materialized View **phải có ít nhất một UNIQUE INDEX**. Nếu không, PostgreSQL không thể xác định hàng nào đã thay đổi và không thể thực hiện so sánh khác biệt (diffing). Đây chính là lý do trong dự án, chúng tôi tạo:

```sql
CREATE UNIQUE INDEX idx_mv_leaderboard_student ON mv_leaderboard (student_id);
```

#### So sánh View và Materialized View

| Tiêu chí | Standard View | Materialized View |
|----------|--------------|-------------------|
| **Lưu trữ** | Không — chỉ lưu định nghĩa SQL | Có — lưu toàn bộ kết quả trên đĩa |
| **Tốc độ đọc** | Chậm với truy vấn phức tạp (phải JOIN lại mỗi lần) | Rất nhanh — đọc trực tiếp từ bảng đã tính sẵn |
| **Độ tươi của dữ liệu** | Luôn mới nhất (real-time) | Có thể cũ (stale) — phụ thuộc chu kỳ REFRESH |
| **Tài nguyên CPU** | Tiêu tốn khi truy vấn | Tiêu tốn khi REFRESH |
| **Ứng dụng điển hình** | Báo cáo đơn giản, lọc dữ liệu, bảo mật cột | Bảng xếp hạng, dashboard tổng hợp, báo cáo nặng |

### 1.2 Vai trò & Mục đích (Role & Purpose)

Trong hệ thống E-Learning, View và Materialized View đóng các vai trò kiến trúc khác nhau:

#### Vai trò của Standard View

1. **Che giấu độ phức tạp của Schema**: View `v_published_courses` đóng gói logic JOIN 4 bảng (`general_courses`, `categories`, `teachers`, `user_profiles`) và điều kiện lọc (`visibility_status = 'PUBLISHED'`, `is_deleted = FALSE`) vào một đối tượng duy nhất. Service layer chỉ cần `SELECT ... FROM v_published_courses` thay vì viết lại JOIN phức tạp mỗi lần.

2. **Bảo mật dữ liệu (Row-Level Security)**: View tự động lọc các khóa học chưa publish và đã bị xóa mềm. Ứng dụng không thể vô tình hiển thị khóa học nháp cho học viên — đây là một lớp bảo vệ bổ sung bên cạnh validation trong application code.

3. **Tái sử dụng logic nghiệp vụ**: View `v_student_dashboard` tổng hợp dữ liệu từ 5 bảng (`students`, `user_profiles`, `student_streaks`, `course_enrollments`, `user_achievements`) — logic này được dùng bởi nhiều endpoint khác nhau mà không cần lặp code.

4. **Độc lập với thay đổi Schema**: Khi cấu trúc bảng thay đổi (thêm cột, đổi tên), chỉ cần cập nhật định nghĩa View — application code không bị ảnh hưởng.

#### Vai trò của Materialized View

1. **Tăng tốc truy vấn nặng**: `mv_leaderboard` tính toán `RANK() OVER (ORDER BY highest_streak DESC, achievement_count DESC)` — một phép tính cửa sổ (window function) trên toàn bộ tập sinh viên. Nếu chạy trực tiếp mỗi lần gọi API, truy vấn này quét toàn bộ bảng `students`, `student_streaks`, và `user_achievements` — cực kỳ tốn kém. MV tính trước kết quả, biến O(N) JOIN + SORT thành O(1) đọc trực tiếp.

2. **Giảm tải cho Database Server trong giờ cao điểm**: Bảng xếp hạng được truy vấn rất thường xuyên (mỗi học viên mở trang chủ). Thay vì để hàng nghìn request đồng thời JOIN và SORT, MV cho phép tất cả đọc từ một bảng đã tính sẵn.

3. **Đồng bộ định kỳ thay vì real-time**: Với bảng xếp hạng, độ trễ 5 phút là chấp nhận được — người dùng không cần biết thứ hạng thay đổi từng giây. Đánh đổi này giúp tiết kiệm tài nguyên đáng kể.

### 1.3 Tại sao nên sử dụng (Benefits & Trade-offs)

#### Lợi ích

| Lợi ích | View | Materialized View |
|---------|------|-------------------|
| Giảm độ phức tạp code ứng dụng | ✅ | ✅ |
| Dữ liệu luôn mới (real-time) | ✅ | ❌ (stale) |
| Tốc độ truy vấn nhanh | ❌ (chậm với JOIN phức tạp) | ✅ (đọc trực tiếp) |
| Giảm tải CPU cho DB | ❌ | ✅ |
| Có thể đánh index bổ sung | ❌ | ✅ |

#### Đánh đổi & Hạn chế

1. **Stale Data (Dữ liệu cũ)**: Materialized View chỉ chính xác tại thời điểm refresh cuối cùng. Trong dự án, `mv_leaderboard` được refresh mỗi 5 phút — đồng nghĩa bảng xếp hạng có thể lệch tối đa 5 phút so với thực tế. Đây là đánh đổi có chủ đích: **chấp nhận độ trễ nhỏ để đổi lấy hiệu năng đọc cực nhanh**.

2. **Chi phí REFRESH**: Mỗi lần refresh, PostgreSQL phải thực thi lại toàn bộ câu truy vấn định nghĩa. Với `CONCURRENTLY`, chi phí còn cao hơn do phải so sánh từng hàng. Nếu MV có 100,000 dòng, việc refresh có thể tiêu tốn vài giây CPU.

3. **Không gian lưu trữ**: MV chiếm dung lượng đĩa (bản sao dữ liệu). MV càng lớn, chi phí lưu trữ càng cao.

4. **Khóa trong quá trình REFRESH**: Nếu dùng `REFRESH` không `CONCURRENTLY`, toàn bộ bảng bị khóa — mọi truy vấn đọc đều bị chặn. Trong production, bắt buộc dùng `CONCURRENTLY`.

#### Tại sao chọn cách tiếp cận này thay vì lựa chọn khác?

| Phương án thay thế | Hạn chế |
|-------------------|---------|
| **Cache application-level (Redis)** | Phải tự code logic invalidate; không đảm bảo nhất quán; thêm độ phức tạp |
| **Truy vấn trực tiếp mỗi lần** | Với 10,000+ sinh viên, `RANK() OVER ...` chạy mỗi request sẽ bão hòa CPU |
| **Bảng tính toán thủ công** | Phải tự duy trì cron job INSERT/UPDATE/DELETE; dễ lỗi; phức tạp |

### 1.4 Hiện thực hóa trong mã nguồn (Code Implementation)

#### 1.4.1 Standard View: `v_published_courses`

**Định nghĩa:** `backend/alembic/versions/7a1b2c3d4e5f_v_published_courses.py` (dòng 21-39)

```sql
CREATE OR REPLACE VIEW v_published_courses AS
SELECT
    c.course_id,
    c.title,
    COALESCE(c.description, '') AS description,
    COALESCE(c.image_url, '') AS image_url,
    c.price,
    cat.name AS category_name,
    tp.full_name AS teacher_name,
    COUNT(e.enrollment_id) AS enrollment_count,
    c.updated_at
FROM general_courses c
JOIN general_course_categories cat ON cat.category_id = c.category_id
JOIN teachers t ON t.user_id = c.teacher_id
JOIN user_profiles tp ON tp.user_id = t.user_id
LEFT JOIN course_enrollments e ON e.course_id = c.course_id
WHERE c.visibility_status = 'PUBLISHED'
  AND c.is_deleted = FALSE
GROUP BY c.course_id, cat.name, tp.full_name;
```

**Walkthrough từng bước thực thi:**

| Bước | Thành phần SQL | Giải thích |
|------|---------------|------------|
| 1 | `FROM general_courses c` | PostgreSQL bắt đầu quét bảng `general_courses` — đây là bảng driving table |
| 2 | `JOIN general_course_categories cat` | Kết nối 1-1 với bảng danh mục để lấy tên danh mục (`category_name`) |
| 3 | `JOIN teachers t` + `JOIN user_profiles tp` | Đi qua bảng `teachers` để đến `user_profiles`, lấy `full_name` của giáo viên |
| 4 | `LEFT JOIN course_enrollments e` | LEFT JOIN (không INNER JOIN) — khóa học không có học viên vẫn hiển thị, `enrollment_count = 0` |
| 5 | `WHERE visibility_status = 'PUBLISHED' AND is_deleted = FALSE` | Lọc chỉ giữ khóa học đã publish và chưa bị xóa mềm |
| 6 | `GROUP BY c.course_id, cat.name, tp.full_name` | Gom nhóm để `COUNT(e.enrollment_id)` đếm số học viên mỗi khóa học |

**Sử dụng trong Service Layer:** `backend/app/services/store.py` (dòng 27-56)

```python
result = await db.execute(
    text("""
        SELECT
            v.course_id::text, v.title, v.description, v.image_url, v.price,
            'PUBLISHED' AS visibility_status, v.category_name, v.teacher_name,
            v.enrollment_count, v.updated_at,
            EXISTS(
                SELECT 1 FROM course_enrollments e
                WHERE e.course_id = v.course_id AND e.student_id = :sid
            ) AS is_enrolled
        FROM v_published_courses v
        ORDER BY v.updated_at DESC
    """),
    {"sid": clean_sid},
)
```

**Điểm đáng chú ý:** Service layer không JOIN lại các bảng — nó chỉ thêm subquery `EXISTS` để kiểm tra học viên hiện tại đã enroll chưa. Logic JOIN phức tạp đã được View che giấu hoàn toàn.

#### 1.4.2 Standard View: `v_student_dashboard`

**Định nghĩa:** `backend/alembic/versions/8b2c3d4e5f6a_v_student_dashboard.py` (dòng 21-35)

```sql
CREATE OR REPLACE VIEW v_student_dashboard AS
SELECT
    s.user_id AS student_id,
    p.full_name,
    ss.current_streak,
    ss.highest_streak,
    COUNT(DISTINCT e.course_id) AS enrolled_courses,
    COUNT(DISTINCT ua.achievement_id) AS achievements,
    ROUND(AVG(e.progress), 2) AS avg_progress
FROM students s
JOIN user_profiles p ON p.user_id = s.user_id
LEFT JOIN student_streaks ss ON ss.student_id = s.user_id
LEFT JOIN course_enrollments e ON e.student_id = s.user_id
LEFT JOIN user_achievements ua ON ua.user_id = s.user_id
GROUP BY s.user_id, p.full_name, ss.current_streak, ss.highest_streak;
```

View này tổng hợp 5 chỉ số quan trọng trên dashboard học viên: tên, streak hiện tại, streak cao nhất, số khóa học đã đăng ký, số achievements, và tiến độ trung bình — tất cả chỉ trong 1 lần gọi `SELECT`.

#### 1.4.3 Materialized View: `mv_leaderboard`

**Định nghĩa (phiên bản đã sửa):** `backend/alembic/versions/9c3d4e5f6a7b_fix_mv_leaderboard.py` (dòng 32-48)

```sql
CREATE MATERIALIZED VIEW mv_leaderboard AS
SELECT
    s.user_id AS student_id,
    p.full_name,
    COALESCE(p.avatar_url, '') AS avatar_url,
    ss.current_streak,
    ss.highest_streak,
    COUNT(ua.achievement_id) AS achievement_count,
    RANK() OVER (
        ORDER BY ss.highest_streak DESC, COUNT(ua.achievement_id) DESC
    ) AS rank
FROM students s
JOIN user_profiles p ON p.user_id = s.user_id
LEFT JOIN student_streaks ss ON ss.student_id = s.user_id
LEFT JOIN user_achievements ua ON ua.user_id = s.user_id
GROUP BY s.user_id, p.full_name, p.avatar_url, ss.current_streak, ss.highest_streak
WITH DATA;
```

**Ý nghĩa của `RANK()` thay vì `ROW_NUMBER()`:**

```sql
-- ROW_NUMBER(): Không có đồng hạng
--  1: Alice (streak=30)
--  2: Bob   (streak=30)  ← Bob luôn đứng sau dù bằng điểm
--  3: Carol (streak=25)

-- RANK(): Cho phép đồng hạng
--  1: Alice (streak=30)
--  1: Bob   (streak=30)  ← Cùng hạng 1
--  3: Carol (streak=25)
```

Trong bối cảnh giáo dục, `RANK()` phù hợp hơn vì nó công nhận những học viên có thành tích ngang nhau — họ đều xứng đáng cùng một thứ hạng.

**Unique Index — Điều kiện tiên quyết cho CONCURRENTLY REFRESH:**

```sql
CREATE UNIQUE INDEX idx_mv_leaderboard_student
ON mv_leaderboard (student_id);
```

Tại sao index trên `student_id` thay vì `(full_name, current_streak)` như phiên bản đầu?

| Tiêu chí | `(full_name, current_streak)` | `(student_id)` |
|----------|------------------------------|----------------|
| **Tính duy nhất** | Không đảm bảo (2 người cùng tên + cùng streak) | Đảm bảo tuyệt đối (mỗi student 1 dòng) |
| **CONCURRENTLY REFRESH** | Có thể lỗi nếu trùng | Luôn hoạt động |
| **JOIN với bảng khác** | Không thể JOIN hiệu quả | JOIN chuẩn trên khóa chính |

#### 1.4.4 Cơ chế Refresh định kỳ

**File:** `backend/app/main.py` (dòng 41-56)

```python
async def _refresh_leaderboard_periodically():
    """Refresh mv_leaderboard every LEADERBOARD_REFRESH_MINUTES."""
    while True:
        await asyncio.sleep(settings.LEADERBOARD_REFRESH_MINUTES * 60)
        try:
            async with async_session() as db:
                await db.execute(
                    text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard")
                )
                await db.commit()
                # Also sync Redis ZSET if enabled
                if settings.REDIS_ENABLED and cache.enabled:
                    from app.services.gamification import refresh_leaderboard
                    await refresh_leaderboard(db)
        except Exception as e:
            print(f"[Leaderboard Refresh] Failed: {e}")
```

**Chuỗi thực thi:**

```mermaid
sequenceDiagram
    participant Cron as asyncio.create_task()
    participant DB as PostgreSQL
    participant Redis as Redis Cache
    participant App as FastAPI App

    Cron->>Cron: Sleep 5 phút
    Cron->>DB: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard
    DB->>DB: So sánh diff giữa dữ liệu cũ & mới
    DB->>DB: DELETE các hàng không còn trong kết quả mới
    DB->>DB: INSERT các hàng mới
    DB-->>Cron: OK
    Cron->>DB: SELECT full_name, current_streak FROM mv_leaderboard
    DB-->>Cron: Kết quả mới nhất
    Cron->>Redis: ZADD leaderboard:streaks (rebuild ZSET)
    Note over App,Redis: Các request sau đọc từ Redis ZSET<br/>(O(log N)) hoặc MV (O(1))
```

**Tại sao dùng asyncio Task thay vì pg_cron?**

| Phương án | Ưu điểm | Nhược điểm |
|-----------|---------|------------|
| **pg_cron** (PostgreSQL extension) | Chạy trong DB, không phụ thuộc ứng dụng | Khó tích hợp với Redis sync; khó debug; cần extension riêng |
| **asyncio Task** (trong FastAPI lifespan) | Code Python dễ debug; đồng bộ Redis ngay sau refresh; không cần extension DB | Nếu app crash, task dừng; cần cơ chế retry |

Dự án chọn asyncio Task vì cần đồng bộ Redis ZSET ngay sau khi refresh MV — điều mà pg_cron không làm được.

#### 1.4.5 Fallback Strategy trong Gamification Service

**File:** `backend/app/services/gamification.py` (dòng 10-48)

```python
async def get_leaderboard(db: AsyncSession, limit: int = 20) -> list[dict]:
    # Lớp 1: Redis ZSET — nhanh nhất
    if cache.enabled:
        redis_entries = await cache.get_top_learners(limit)
        if redis_entries:
            return [{"rank": i + 1, **entry} for i, entry in enumerate(redis_entries)]

    # Lớp 2: Materialized View — nhanh, có thể cũ 5 phút
    try:
        result = await db.execute(
            text("SELECT student_id::text, full_name, ... FROM mv_leaderboard ...")
        )
        return [dict(row) for row in result.mappings()]
    except Exception:
        # Lớp 3: Standard View — chậm nhưng luôn có dữ liệu mới nhất
        result = await db.execute(
            text("SELECT ... FROM vw_top_learners_leaderboard ...")
        )
        ...
```

Chiến lược 3 tầng này đảm bảo:
- **Happy path:** Redis trả về kết quả trong <1ms
- **Redis down:** MV trả về kết quả đã tính sẵn trong ~1ms
- **MV chưa tồn tại:** Standard View tính toán real-time (~10-50ms tùy số lượng sinh viên)

---

## 2. Database Triggers (Bẫy sự kiện)

### 2.1 Khái niệm (Concept)

**Database Trigger** là một hàm được PostgreSQL tự động thực thi khi một sự kiện DML (INSERT, UPDATE, DELETE) xảy ra trên một bảng được chỉ định. Trigger hoạt động như một "bẫy sự kiện" (event hook) ở tầng cơ sở dữ liệu — nó không cần ứng dụng gọi, không phụ thuộc vào ngôn ngữ lập trình, và **luôn được thực thi trong cùng một transaction** với câu lệnh DML kích hoạt nó.

#### Phân loại Trigger trong PostgreSQL

| Tiêu chí | Các loại | Mô tả |
|----------|---------|-------|
| **Thời điểm** | `BEFORE` / `AFTER` / `INSTEAD OF` | Trước, sau, hoặc thay thế sự kiện |
| **Sự kiện** | `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE` | Loại thao tác DML |
| **Phạm vi** | `FOR EACH ROW` / `FOR EACH STATEMENT` | Kích hoạt mỗi dòng hay mỗi câu lệnh |
| **Điều kiện** | `WHEN (condition)` | Chỉ kích hoạt nếu điều kiện đúng |

```mermaid
graph TB
    subgraph "Transaction Boundary"
        A[Ứng dụng: INSERT INTO wallets ...] --> B{Trigger BEFORE INSERT?}
        B -->|Có| C[fn_validate_wallet - Kiểm tra ràng buộc]
        C --> D[PostgreSQL thực thi INSERT]
        D --> E{Trigger AFTER INSERT?}
        E -->|Có| F[fn_audit_wallet_change - Ghi log]
        F --> G[COMMIT]
    end
```

#### Cơ chế `OLD` và `NEW`

Trong `FOR EACH ROW` trigger, PostgreSQL cung cấp hai biến đặc biệt:

- **`NEW`**: Bản ghi sau khi thay đổi (INSERT/UPDATE). Trong `BEFORE` trigger, có thể **sửa đổi** `NEW`.
- **`OLD`**: Bản ghi trước khi thay đổi (UPDATE/DELETE). Chỉ đọc.

```sql
-- Ví dụ: Trigger tự động cập nhật timestamp
CREATE FUNCTION fn_auto_update_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;  -- Gán giá trị mới
    RETURN NEW;                            -- Trả về bản ghi đã sửa
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fn_auto_update_timestamp();
```

### 2.2 Vai trò & Mục đích (Role & Purpose)

Trong hệ thống E-Learning, 10 trigger được triển khai phục vụ 4 nhóm mục đích:

#### Nhóm 1: Tự động hóa dữ liệu phái sinh (Derived Data Automation)

| Trigger | Bảng | Chức năng |
|---------|------|-----------|
| `trg_auto_updated_at` | users, courses, wallets, ... | Tự động cập nhật `updated_at := NOW()` mỗi khi UPDATE |
| `trg_streak_sync` | student_streaks | Tự động nâng `highest_streak` khi `current_streak` vượt qua |
| `trg_provision_user` | users | Tự động tạo ví (wallets) khi user mới được tạo |
| `trg_create_student_streak` | students | Defense-in-depth: đảm bảo luôn có dòng streak cho student |

#### Nhóm 2: Bảo vệ toàn vẹn dữ liệu (Data Integrity Guard)

| Trigger | Bảng | Chức năng |
|---------|------|-----------|
| `trg_prevent_feedback_without_learning` | user_feedbacks | Chặn đánh giá nếu chưa học ít nhất 10% |
| `trg_check_sufficient_balance` | wallets | Ngăn số dư ví âm (double check bên cạnh CHECK constraint) |
| `trg_prevent_self_transfer` | transaction_logs | Chặn giao dịch tự chuyển tiền cho chính mình |

#### Nhóm 3: Phản ứng dây chuyền (Cascading Business Logic)

| Trigger | Bảng | Chức năng |
|---------|------|-----------|
| `trg_auto_hide_teacher_courses` | users | Khi giáo viên bị ban/frozen → tự động ARCHIVE tất cả khóa học |

#### Nhóm 4: Audit & Monitoring

| Trigger | Bảng | Chức năng |
|---------|------|-----------|
| `trg_audit_wallet` | wallets | Ghi log mỗi lần số dư ví thay đổi |
| `trg_alert_large_transaction` | transaction_logs | Gửi notification cho Admin khi có giao dịch > 10 triệu |

### 2.3 Tại sao nên sử dụng (Benefits & Trade-offs)

#### So sánh: Database Triggers vs. Application-level Hooks (FastAPI/ORM)

| Tiêu chí | Database Trigger | Application Hook (SQLAlchemy events / FastAPI middleware) |
|----------|-----------------|----------------------------------------------------------|
| **Độ tin cậy (Reliability)** | ✅ **Tuyệt đối** — Trigger chạy trong cùng transaction, không thể bỏ qua | ❌ Có thể bị bypass nếu có đường dẫn code không gọi hook |
| **Tính đóng gói (Encapsulation)** | ✅ Logic nằm sát dữ liệu — mọi đường dẫn (API, script, migration) đều được bảo vệ | ❌ Mỗi đường dẫn phải tự implement — dễ bỏ sót |
| **Hiệu năng** | ✅ Chạy trong DB engine, không network round-trip | ❌ Phải gửi dữ liệu về app, xử lý, gửi lại DB |
| **Khả năng debug** | ❌ Khó debug — lỗi trigger hiển thị dưới dạng lỗi DB | ✅ Dễ debug với IDE, log, breakpoint |
| **Khả năng kiểm thử** | ❌ Cần test riêng với SQL — khó mock | ✅ Có thể unit test với pytest |
| **Tính linh hoạt** | ❌ Chỉ có PL/pgSQL — hạn chế so với Python | ✅ Đầy đủ sức mạnh của Python + thư viện |
| **Bảo trì** | ❌ Logic phân tán giữa code và DB — khó nắm bắt toàn cảnh | ✅ Tập trung trong codebase, dễ version control |

#### Nguyên tắc lựa chọn trong dự án

```
Dùng Database Trigger KHI:
  ✅ Logic liên quan đến TOÀN VẸN DỮ LIỆU (không thể vi phạm dù bất kỳ lý do gì)
  ✅ Logic cần chạy ĐỒNG BỘ TRONG CÙNG TRANSACTION
  ✅ Logic KHÔNG phụ thuộc vào external service (email, HTTP call)
  ✅ Logic ĐƠN GIẢN (vài dòng SQL)

Dùng Application Hook KHI:
  ❌ Logic phức tạp cần Python xử lý
  ❌ Cần gọi external API (gửi email, push notification)
  ❌ Cần logging chi tiết với context
  ❌ Logic thay đổi thường xuyên theo business requirement
```

#### Đánh đổi cụ thể trong dự án

1. **`trg_check_sufficient_balance`**: Tại sao vừa có CHECK constraint (`balance >= 0`) vừa có trigger? Vì CHECK constraint chỉ kiểm tra giá trị cuối cùng — nếu một transaction có `balance = 100 - 200 = -100`, CHECK sẽ bắt. Nhưng trigger còn cung cấp **thông báo lỗi tiếng Việt có ngữ cảnh** (`'Số dư ví không thể nhỏ hơn 0. Giao dịch bị từ chối.'`) thay vì lỗi PostgreSQL khó hiểu.

2. **`trg_prevent_feedback_without_learning`**: Logic này CÓ THỂ implement ở application layer. Nhưng đặt ở DB đảm bảo: ngay cả khi admin insert trực tiếp vào database, hoặc migration script chạy, hoặc bug trong API — không ai có thể tạo đánh giá giả mạo. Đây là **defense-in-depth**.

3. **`trg_auto_hide_teacher_courses`**: Đây là logic "phản ứng dây chuyền". Nếu implement ở application code, mỗi lần ban user cần nhớ gọi thêm hàm ẩn khóa học. Trigger đảm bảo **không thể quên**.

### 2.4 Hiện thực hóa trong mã nguồn (Code Implementation)

#### 2.4.1 Trigger Tự động Timestamp: `trg_auto_updated_at`

**File:** `backend/alembic/versions/429743bc5cea_auto_updated_at_trigger.py`

Trigger này gắn vào **nhiều bảng** (`users`, `dictionary_entries`, `general_courses`, `wallets`) — mỗi khi có UPDATE, `updated_at` tự động cập nhật. Điều này đảm bảo application code không bao giờ phải tự set `updated_at = NOW()` — tránh lỗi quên cập nhật timestamp.

#### 2.4.2 Trigger Provision User: `trg_provision_user`

**File:** `backend/alembic/versions/c3d4e5f6a7b8_unified_provision_trigger.py`

```sql
CREATE OR REPLACE FUNCTION fn_provision_new_user() RETURNS TRIGGER AS $$
BEGIN
    -- 1. Tự động tạo ví với số dư 0
    INSERT INTO wallets (user_id, balance) VALUES (NEW.user_id, 0.00);
    
    -- 2. Nếu là student, tự động tạo streak
    IF EXISTS (SELECT 1 FROM students WHERE user_id = NEW.user_id) THEN
        INSERT INTO student_streaks (student_id, current_streak, highest_streak)
        VALUES (NEW.user_id, 0, 0);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_provision_user
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION fn_provision_new_user();
```

**Walkthrough:**

| Bước | Hành động | Giải thích |
|------|-----------|------------|
| 1 | `AFTER INSERT ON users` | Trigger kích hoạt sau khi user được INSERT thành công |
| 2 | `INSERT INTO wallets` | Tạo ví — nếu user_id đã tồn tại (race condition), ON CONFLICT DO NOTHING |
| 3 | `IF EXISTS students` | Chỉ student mới có streak — teacher/admin không cần |
| 4 | `INSERT INTO student_streaks` | Khởi tạo streak = 0 |
| 5 | `RETURN NEW` | Trigger AFTER không cần trả về dòng mới, nhưng vẫn phải RETURN |

#### 2.4.3 Trigger Streak Sync: `trg_streak_sync`

**File:** `backend/alembic/versions/a1b2c3d4e5f6_streak_sync_trigger.py`

```sql
CREATE OR REPLACE FUNCTION fn_sync_highest_streak() RETURNS TRIGGER AS $$
BEGIN
    -- Khi current_streak vượt highest_streak, tự động nâng lên
    IF NEW.current_streak > NEW.highest_streak THEN
        NEW.highest_streak := NEW.current_streak;
    END IF;
    
    -- Luôn cập nhật last_activity_date khi current_streak thay đổi
    IF NEW.current_streak <> OLD.current_streak OR OLD.current_streak IS NULL THEN
        NEW.last_activity_date := CURRENT_DATE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_streak_sync
BEFORE INSERT OR UPDATE ON student_streaks
FOR EACH ROW EXECUTE FUNCTION fn_sync_highest_streak();
```

**Logic nghiệp vụ được đóng gói trong trigger:**
- Ứng dụng chỉ cần `UPDATE student_streaks SET current_streak = 5` — không cần biết `highest_streak` hay `last_activity_date`
- Trigger tự động: nếu `current_streak=5 > highest_streak=3` → `highest_streak := 5`
- Trigger tự động: nếu `current_streak` thay đổi → `last_activity_date := TODAY`

**Sử dụng trong service:** `backend/app/services/gamification.py` (dòng 172-246)

```python
# Service chỉ cập nhật current_streak — mọi thứ khác do trigger lo
await db.execute(
    text("UPDATE student_streaks SET current_streak = :cur WHERE student_id = :sid"),
    {"cur": current, "sid": student_id},
)
await db.commit()
# Đọc lại giá trị đã được trigger xử lý
result = await db.execute(
    text("SELECT current_streak, highest_streak, last_activity_date::text ...")
)
```

#### 2.4.4 Trigger Audit Wallet: `trg_audit_wallet`

**File:** `backend/alembic/versions/b2c3d4e5f6a7_audit_wallet_trigger.py`

```sql
CREATE OR REPLACE FUNCTION fn_audit_wallet_change() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO log (action)
    VALUES ('WALLET_CHANGE: user=' || NEW.user_id ||
            ' | ' || OLD.balance::text || ' -> ' || NEW.balance::text ||
            ' | delta=' || (NEW.balance - OLD.balance)::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_wallet
AFTER UPDATE OF balance ON wallets
FOR EACH ROW EXECUTE FUNCTION fn_audit_wallet_change();
```

**Điểm quan trọng:** `UPDATE OF balance` — trigger chỉ kích hoạt khi cột `balance` thay đổi, không phải mọi UPDATE (ví dụ: `updated_at` thay đổi không ghi log). Điều này tránh spam log.

---

## 3. Concurrency Control & Locking (Tối ưu đồng thời & Khóa)

### 3.1 Khái niệm (Concept)

#### 3.1.1 ACID và MVCC trong PostgreSQL

**ACID** là bốn tính chất đảm bảo độ tin cậy của transaction trong cơ sở dữ liệu:

| Tính chất | Ý nghĩa | PostgreSQL thực thi bằng |
|-----------|---------|--------------------------|
| **A**tomicity | "Tất cả hoặc không gì cả" — transaction thành công toàn bộ hoặc rollback toàn bộ | WAL (Write-Ahead Log) + Rollback |
| **C**onsistency | Dữ liệu luôn thỏa mãn mọi ràng buộc (FK, CHECK, UNIQUE) sau transaction | Constraint checking cuối transaction |
| **I**solation | Các transaction đồng thời không can thiệp vào nhau | **MVCC** + Isolation Levels |
| **D**urability | Dữ liệu đã commit không bị mất dù hệ thống crash | WAL + fsync |

**MVCC (Multi-Version Concurrency Control)** là cơ chế cốt lõi giúp PostgreSQL đạt được Isolation mà không cần khóa đọc (read lock). Cơ chế hoạt động:

```
Mỗi hàng trong PostgreSQL có 4 trường ẩn:
  xmin  = transaction ID đã tạo ra phiên bản này
  xmax  = transaction ID đã xóa/ghi đè phiên bản này (0 = vẫn còn hiệu lực)
  cmin  = command ID trong transaction tạo
  cmax  = command ID trong transaction xóa

Khi transaction SELECT:
  - Chỉ thấy các hàng có xmin < txid_current AND (xmax = 0 OR xmax > txid_current)
  - Tức là: hàng đã được tạo trước khi tôi bắt đầu, và chưa bị xóa

Khi transaction UPDATE:
  - KHÔNG ghi đè hàng cũ
  - Đặt xmax của hàng cũ = txid_current (đánh dấu "đã bị thay thế")
  - Tạo hàng MỚI với xmin = txid_current (phiên bản mới)
```

```mermaid
graph TB
    subgraph "MVCC - 3 transaction đồng thời"
        direction LR
        TX1[Tx1: SELECT] -->|Nhìn thấy| V1[Version 1<br/>xmin=100, xmax=0<br/>balance=500]
        TX2[Tx2: UPDATE] -->|Tạo| V2[Version 2<br/>xmin=200, xmax=0<br/>balance=400]
        TX2 -->|Đánh dấu xmax=200| V1
        TX3[Tx3: SELECT] -->|Bắt đầu trước Tx2| V1
    end
```

#### 3.1.2 Các mức Isolation trong PostgreSQL

| Mức Isolation | Dirty Read | Non-repeatable Read | Phantom Read | Serialization Anomaly |
|---------------|------------|---------------------|--------------|----------------------|
| **READ UNCOMMITTED** | ❌ PG không hỗ trợ | Có | Có | Có |
| **READ COMMITTED** (mặc định) | Không | Có | Có | Có |
| **REPEATABLE READ** | Không | Không | Không | Có (hiếm) |
| **SERIALIZABLE** | Không | Không | Không | Không |

#### 3.1.3 Pessimistic Locking: `SELECT ... FOR UPDATE`

`FOR UPDATE` là cơ chế **khóa bi quan** (pessimistic locking): khi một transaction chạy `SELECT ... FOR UPDATE` trên một hàng, nó **khóa hàng đó lại** — mọi transaction khác muốn `FOR UPDATE` cùng hàng phải **chờ** đến khi transaction đầu tiên COMMIT hoặc ROLLBACK.

```mermaid
sequenceDiagram
    participant T1 as Transaction 1 (Mua khóa học)
    participant DB as PostgreSQL
    participant T2 as Transaction 2 (Mua khóa học)

    T1->>DB: BEGIN
    T1->>DB: SELECT balance FROM wallets WHERE user_id=1 FOR UPDATE
    DB-->>T1: balance = 500
    Note over DB: 🔒 Hàng user_id=1 bị khóa bởi T1

    T2->>DB: BEGIN
    T2->>DB: SELECT balance FROM wallets WHERE user_id=1 FOR UPDATE
    Note over T2,DB: ⏳ T2 CHỜ... (bị chặn bởi khóa của T1)

    T1->>DB: UPDATE wallets SET balance = 500 - 300 = 200
    T1->>DB: COMMIT
    Note over DB: 🔓 Khóa được giải phóng

    DB-->>T2: balance = 200 (đọc giá trị mới sau COMMIT của T1)
    T2->>DB: Kiểm tra: 200 < 300 → Từ chối
    T2->>DB: ROLLBACK
```

Nếu **không có `FOR UPDATE`**: T1 và T2 cùng đọc `balance=500`, cùng nghĩ đủ tiền, cùng trừ — dẫn đến **race condition**: số dư âm hoặc mất tiền.

#### 3.1.4 Optimistic Locking: Version/Timestamp Checking

Ngược với Pessimistic, **Optimistic Locking** không khóa hàng mà kiểm tra xem hàng có bị thay đổi từ lúc đọc không:

```sql
-- Đọc dữ liệu
SELECT balance, updated_at FROM wallets WHERE user_id = 1;
-- Giả sử: balance=500, updated_at='2026-06-18 10:00:00'

-- Khi cập nhật, kiểm tra updated_at không thay đổi
UPDATE wallets
SET balance = balance - 300, updated_at = NOW()
WHERE user_id = 1 AND updated_at = '2026-06-18 10:00:00';
-- Nếu rows affected = 0 → có transaction khác đã sửa → RETRY
```

#### 3.1.5 Deadlock và Cách phòng tránh

**Deadlock** xảy ra khi Transaction A giữ khóa tài nguyên X và chờ khóa Y, trong khi Transaction B giữ khóa Y và chờ khóa X — cả hai khóa lẫn nhau vĩnh viễn.

```mermaid
graph LR
    T1[Transaction 1] -->|1. Khóa User A| A[Wallet A]
    T1 -->|3. Chờ khóa User B| B[Wallet B]
    T2[Transaction 2] -->|2. Khóa User B| B
    T2 -->|4. Chờ khóa User A| A
    A -.->|Đã bị T1 giữ| T2
    B -.->|Đã bị T2 giữ| T1
```

**Nguyên lý phòng tránh Deadlock bằng cách sắp xếp thứ tự khóa:**

```
Giả sử có 2 transaction đồng thời:
  Tx1: Chuyển từ User_A (UUID: ...a1) → User_B (UUID: ...b2)
  Tx2: Chuyển từ User_B (UUID: ...b2) → User_A (UUID: ...a1)

KHÔNG sắp xếp (sẽ deadlock):
  Tx1: FOR UPDATE User_A, rồi FOR UPDATE User_B
  Tx2: FOR UPDATE User_B, rồi FOR UPDATE User_A
  → Deadlock! (Tx1 giữ A chờ B, Tx2 giữ B chờ A)

CÓ sắp xếp (không deadlock):
  Vì ...a1 < ...b2 (so sánh UUID như string):
  Tx1: FOR UPDATE User_A, rồi FOR UPDATE User_B
  Tx2: CŨNG FOR UPDATE User_A, rồi FOR UPDATE User_B (dù User_B là from!)
  → Tx2 chờ Tx1 giải phóng User_A → không deadlock
```

**Chứng minh toán học:** Nếu tất cả transaction luôn khóa tài nguyên theo **cùng một thứ tự toàn cục** (ví dụ: sắp xếp theo UUID tăng dần), thì quan hệ "chờ khóa" tạo thành một **đồ thị không chu trình** (DAG). Một đồ thị chờ không chu trình không thể có deadlock — vì deadlock yêu cầu ít nhất một chu trình trong đồ thị chờ.

#### 3.1.6 Advisory Locks và SKIP LOCKED

**Advisory Lock** (`pg_advisory_lock`) là cơ chế khóa do ứng dụng tự định nghĩa — PostgreSQL không liên kết nó với bất kỳ hàng hay bảng nào. Nó giống như một "mutex" trong ứng dụng, nhưng được PostgreSQL quản lý (tự động giải phóng khi transaction kết thúc).

**`SKIP LOCKED`** là tùy chọn của `FOR UPDATE`: thay vì chờ, transaction bỏ qua các hàng đang bị khóa và chỉ xử lý các hàng có sẵn. Cực kỳ hữu ích cho **hàng đợi công việc** (job queue).

### 3.2 Vai trò & Mục đích (Role & Purpose)

Trong hệ thống E-Learning, concurrency control bảo vệ các nghiệp vụ tài chính:

| Nghiệp vụ | Cơ chế | File |
|-----------|--------|------|
| **Nạp tiền ví** | Atomic UPDATE trong `sp_topup_wallet` | `procedures.sql:196-203` |
| **Mua khóa học** | `FOR UPDATE` khóa ví trong `sp_buy_course_with_wallet` | `procedures.sql:207-236` |
| **Chuyển tiền** | Sắp xếp UUID + `FOR UPDATE` + SERIALIZABLE trong `sp_transfer_funds` | `procedures.sql:264-312` |
| **Hoàn tiền** | `pg_advisory_xact_lock` trong `services/store.py` | `store.py:121-140` |
| **Xử lý notification** | `SKIP LOCKED` trong `locking.py` | `locking.py:33-49` |

### 3.3 Tại sao nên sử dụng (Benefits & Trade-offs)

| Cơ chế | Ưu điểm | Nhược điểm | Khi nào dùng |
|--------|---------|------------|--------------|
| **FOR UPDATE (Pessimistic)** | An toàn tuyệt đối; không cần retry | Giảm throughput (chặn transaction khác) | Giao dịch tài chính — mỗi ví một lúc chỉ 1 transaction |
| **Optimistic (version check)** | Không chặn; throughput cao | Cần retry logic; lãng phí nếu conflict nhiều | Cập nhật profile — conflict thấp |
| **SERIALIZABLE** | Cô lập hoàn toàn; không cần FOR UPDATE thủ công | Chi phí cao; có thể fail với "serialization error" → phải retry | Chuyển tiền — cần đảm bảo toàn vẹn |
| **READ COMMITTED** (default) | Nhanh; ít conflict | Không chống được race condition phức tạp | Đọc catalog, search — không cần isolation cao |
| **Advisory Lock** | Linh hoạt; không liên quan đến hàng cụ thể | Phải tự quản lý lock ID | Khóa nghiệp vụ tùy chỉnh (hoàn tiền) |
| **SKIP LOCKED** | Không chặn; lý tưởng cho job queue | Không đảm bảo thứ tự FIFO | Xử lý hàng loạt notification |

### 3.4 Hiện thực hóa trong mã nguồn (Code Implementation)

#### 3.4.1 Deadlock Prevention trong `sp_transfer_funds`

**File:** `backend/app/db/procedures.sql` (dòng 264-312)

```sql
CREATE OR REPLACE PROCEDURE sp_transfer_funds(
    p_from UUID, p_to UUID, p_amount NUMERIC, p_message TEXT DEFAULT 'Chuyển tiền'
) LANGUAGE plpgsql AS $$
DECLARE
    v_first  UUID;
    v_second UUID;
BEGIN
    -- (1) Validate input
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Số tiền phải > 0';
    END IF;
    IF p_from = p_to THEN
        RAISE EXCEPTION 'Không thể tự chuyển tiền cho chính mình';
    END IF;

    -- (2) DEADLOCK PREVENTION: sắp xếp thứ tự khóa
    IF p_from < p_to THEN
        v_first := p_from; v_second := p_to;
    ELSE
        v_first := p_to;   v_second := p_from;
    END IF;

    -- (3) Khóa theo thứ tự đã sắp xếp
    PERFORM 1 FROM wallets WHERE user_id = v_first  FOR UPDATE;
    PERFORM 1 FROM wallets WHERE user_id = v_second FOR UPDATE;

    -- (4) Kiểm tra số dư SAU khi khóa (tránh race condition)
    SELECT balance INTO v_from_balance FROM wallets WHERE user_id = p_from;
    IF v_from_balance < p_amount THEN
        RAISE EXCEPTION 'Số dư không đủ';
    END IF;

    -- (5) Atomic execution
    UPDATE wallets SET balance = balance - p_amount WHERE user_id = p_from;
    UPDATE wallets SET balance = balance + p_amount WHERE user_id = p_to;
    INSERT INTO transaction_logs (...) VALUES (...);
END;
$$;
```

**Walkthrough từng bước:**

| Bước | Dòng code | Cơ chế bảo vệ |
|------|-----------|--------------|
| Validate | 278-283 | `IF p_amount <= 0` và `IF p_from = p_to` — lỗi sớm, tránh lãng phí lock |
| Sắp xếp UUID | 286-290 | `IF p_from < p_to THEN v_first := p_from ELSE v_first := p_to` — **chìa khóa chống deadlock** |
| Khóa tuần tự | 292-293 | `FOR UPDATE` trên `v_first` rồi `v_second` — mọi transaction đều theo thứ tự này |
| Kiểm tra sau khóa | 295-299 | `SELECT balance AFTER lock` — đọc giá trị MỚI NHẤT, không phải giá trị cũ trước khi khóa |
| Atomic write | 301-310 | UPDATE + INSERT trong cùng procedure → tất cả hoặc không gì cả |

Ví dụ minh họa:
```
Tx1: Chuyển 100 từ Alice (uuid: aaa...) → Bob (uuid: bbb...)
  → aaa < bbb → khóa aaa trước, bbb sau

Tx2: Chuyển 50 từ Bob (uuid: bbb...) → Alice (uuid: aaa...)
  → aaa < bbb → CŨNG khóa aaa trước, bbb sau (dù Bob là người gửi!)

Cả hai transaction cùng cố gắng khóa aaa trước → một bên chờ → không deadlock
```

#### 3.4.2 Advisory Lock cho Hoàn tiền

**File:** `backend/app/services/store.py` (dòng 121-140)

```python
async def refund_course(db, student_id, course_id, reason=""):
    # Chuyển course_id thành integer để dùng làm lock ID
    course_int = uuid.UUID(course_id).int % (2**63 - 1)
    
    # Advisory lock — chỉ 1 transaction được hoàn tiền cho khóa học này tại một thời điểm
    await db.execute(
        text("SELECT pg_advisory_xact_lock(:lock_id)"),
        {"lock_id": course_int},
    )
    
    await db.execute(text("CALL sp_refund_course(:sid, :cid)"), ...)
    await db.commit()
```

`pg_advisory_xact_lock` tự động giải phóng khi transaction kết thúc (COMMIT/ROLLBACK) — không cần `pg_advisory_unlock`.

#### 3.4.3 SKIP LOCKED cho Notification Workers

**File:** `backend/app/core/locking.py` (dòng 33-49)

```python
async def fetch_notifications_skip_locked(db, batch_size=100):
    result = await db.execute(text("""
        SELECT notification_id::text, user_id::text, title, message
        FROM notification_users
        WHERE is_read = FALSE
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED    -- ← Mỗi worker lấy batch riêng, không chờ nhau
        LIMIT :limit
    """), {"limit": batch_size})
    return [dict(row) for row in result.mappings()]
```

**Mô hình hoạt động với 3 worker song song:**

```
notification_users: [N1(unread), N2(unread), N3(unread), N4(unread), N5(unread)]

Worker 1: FOR UPDATE SKIP LOCKED LIMIT 2 → lấy N1, N2 (khóa)
Worker 2: FOR UPDATE SKIP LOCKED LIMIT 2 → bỏ qua N1, N2 (đã khóa), lấy N3, N4
Worker 3: FOR UPDATE SKIP LOCKED LIMIT 2 → bỏ qua N1-N4, lấy N5
```

#### 3.4.4 Isolation Levels trong Ứng dụng

**File:** `backend/app/core/isolation.py` — Cung cấp ba context manager:

```python
@asynccontextmanager
async def serializable(db: AsyncSession):
    """Dùng cho: chuyển tiền, mua khóa học — financial tx."""
    await db.execute(text("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"))
    try:
        yield db
        await db.commit()
    except Exception:
        await db.rollback()
        raise
```

**Sử dụng trong store service:** `backend/app/services/store.py` (dòng 152-153)

```python
async def transfer_funds(db, from_user_id, to_user_id, amount, message=""):
    async with serializable(db):  # ← Bọc trong SERIALIZABLE
        await db.execute(text("CALL sp_transfer_funds(...)"))
```

#### 3.4.5 Buffer Pool Warming

**File:** `backend/app/main.py` (dòng 21-37)

```python
async def _prewarm_hot_tables():
    hot_tables = [
        "dictionary_entries", "dictionary_categories", "dictionary_variations",
        "general_courses", "general_course_categories", "mv_leaderboard",
        "user_profiles", "roles",
    ]
    async with engine.connect() as conn:
        for tbl in hot_tables:
            await conn.execute(text(f"SELECT pg_prewarm('{tbl}')"))
```

`pg_prewarm` nạp toàn bộ dữ liệu của bảng vào PostgreSQL shared buffer cache — giúp các truy vấn đầu tiên sau khi restart không bị chậm do phải đọc từ đĩa.

---

## 4. Caching with Redis (Bộ nhớ đệm với Redis)

### 4.1 Khái niệm (Concept)

#### 4.1.1 Redis là gì?

**Redis (REmote DIctionary Server)** là cơ sở dữ liệu **in-memory** (lưu trên RAM) hoạt động dưới dạng key-value store. Khác với PostgreSQL lưu dữ liệu trên đĩa và truy vấn qua SQL, Redis lưu toàn bộ dữ liệu trong RAM — cho tốc độ đọc/ghi cỡ **microseconds** thay vì milliseconds.

| Tiêu chí | PostgreSQL | Redis |
|----------|-----------|-------|
| **Nơi lưu trữ** | Đĩa (với buffer cache trong RAM) | RAM (với persistence tùy chọn) |
| **Mô hình dữ liệu** | Quan hệ (bảng, hàng, cột) | Key-Value, Hash, List, Set, Sorted Set, Stream |
| **Tốc độ đọc** | ~1-10ms (có index) | ~0.01-0.1ms ( RAM) |
| **Dung lượng** | Terabytes | Giới hạn bởi RAM (thường vài GB đến vài chục GB) |
| **Ngôn ngữ truy vấn** | SQL | Redis Commands (GET, SET, ZADD, ...) |

#### 4.1.2 Cache-Aside Pattern

**Cache-Aside** (hay Lazy-Loading) là mẫu kiến trúc cache phổ biến nhất:

```mermaid
sequenceDiagram
    participant App as Ứng dụng
    participant Cache as Redis Cache
    participant DB as PostgreSQL

    Note over App,DB: === ĐỌC DỮ LIỆU (Cache-Aside Read) ===
    App->>Cache: GET catalog:courses:published
    alt Cache HIT
        Cache-->>App: Dữ liệu đã cache
    else Cache MISS
        Cache-->>App: null
        App->>DB: SELECT * FROM v_published_courses
        DB-->>App: Kết quả
        App->>Cache: SET catalog:courses:published <data> TTL 600
        App-->>App: Trả về cho user
    end

    Note over App,DB: === GHI DỮ LIỆU (Cache Invalidation) ===
    App->>DB: UPDATE general_courses SET visibility_status = 'ARCHIVED'
    DB-->>App: OK
    App->>Cache: DELETE catalog:courses:published
    Note over Cache: Khóa học thay đổi → xóa cache<br/>Lần đọc sau sẽ Cache MISS → đọc từ DB → cache lại
```

**Nguyên tắc cốt lõi của Cache-Aside:**
1. **Đọc**: App kiểm tra cache trước. Nếu có (hit) → trả về ngay. Nếu không (miss) → đọc từ DB, ghi vào cache, trả về.
2. **Ghi**: App ghi vào DB trước, sau đó **xóa** (invalidate) cache entry liên quan — KHÔNG cập nhật cache.
3. **Tại sao xóa thay vì cập nhật?** Vì trong hệ thống phân tán, việc cập nhật cache có thể dẫn đến race condition (2 request ghi đồng thời → cache có giá trị cũ hơn DB). Xóa cache đơn giản và an toàn hơn.

#### 4.1.3 Redis Sorted Sets (ZSET)

**Sorted Set** là cấu trúc dữ liệu đặc biệt của Redis: mỗi phần tử có một **score** (điểm số), và Redis tự động sắp xếp các phần tử theo score. Độ phức tạp:

| Thao tác | Độ phức tạp | Giải thích |
|----------|-------------|------------|
| `ZADD key score member` | O(log N) | Thêm/cập nhật phần tử |
| `ZINCRBY key increment member` | O(log N) | Tăng score |
| `ZREVRANGE key start stop WITHSCORES` | O(log N + M) | Lấy top M phần tử |
| `ZRANK key member` | O(log N) | Lấy thứ hạng của một phần tử |

Cấu trúc bên trong: Redis ZSET dùng **Skip List** + **Hash Table**. Skip List là cấu trúc dữ liệu xác suất cho phép tìm kiếm, chèn, xóa trong O(log N) — tương đương cây cân bằng nhưng đơn giản hơn để implement.

### 4.2 Vai trò & Mục đích (Role & Purpose)

Trong hệ thống E-Learning, Redis phục vụ 3 vai trò chính:

| Vai trò | Dữ liệu cache | TTL | Lý do |
|---------|--------------|-----|-------|
| **Cache danh mục khóa học** | `catalog:courses:published` | 600s (10 phút) | Trang chủ store được truy vấn nhiều nhất; dữ liệu ít thay đổi |
| **Cache từ điển** | `dict:search:{keyword}` | 3600s (1 giờ) | Từ điển ít thay đổi; tìm kiếm thường xuyên |
| **Bảng xếp hạng (Leaderboard)** | `leaderboard:streaks` (ZSET) | 3600s | Cần O(log N) ranking; PostgreSQL MV chỉ là fallback |

### 4.3 Tại sao nên sử dụng (Benefits & Trade-offs)

#### So sánh Redis ZSET vs. PostgreSQL `ORDER BY` cho Leaderboard

| Tiêu chí | PostgreSQL `SELECT ... ORDER BY ... LIMIT` | Redis ZSET `ZREVRANGE` |
|----------|-------------------------------------------|------------------------|
| **Độ phức tạp** | O(N log N) với N = tổng số sinh viên (phải SORT toàn bộ) | O(log N) với N = số phần tử trong ZSET |
| **Thời gian với 100K users** | ~200-500ms (phải quét toàn bảng + sort) | ~1-2ms (skip list traversal) |
| **Cập nhật score** | `UPDATE student_streaks SET current_streak = 5` → đợi MV refresh | `ZADD leaderboard:streaks 5 "Alice"` → ngay lập tức |
| **Tốn tài nguyên** | CPU DB để SORT; I/O đĩa để đọc toàn bộ bảng | RAM (Redis lưu trong memory) |
| **Độ chính xác** | Luôn chính xác (dữ liệu gốc) | Phụ thuộc vào đồng bộ Redis ↔ DB |

**Tại sao ZSET vượt trội cho Leaderboard thời gian thực?**

PostgreSQL không có cấu trúc dữ liệu "luôn được sắp xếp sẵn". Khi bạn chạy:
```sql
SELECT * FROM students ORDER BY current_streak DESC LIMIT 20;
```
PostgreSQL phải **đọc tất cả các hàng**, **sắp xếp toàn bộ**, rồi **cắt lấy 20 hàng đầu**. Với 100,000 sinh viên, đây là O(100,000 log 100,000) cho mỗi request. Materialized View cải thiện bằng cách tính sẵn — nhưng vẫn tốn O(N) để refresh định kỳ.

Redis ZSET duy trì **skip list** — một cấu trúc luôn được sắp xếp. Khi gọi `ZREVRANGE ... LIMIT 20`, Redis chỉ cần duyệt 20 nút từ đỉnh skip list — không cần quét toàn bộ.

#### Cache Invalidation — Vấn đề khó nhất trong Caching

> *"There are only two hard things in Computer Science: cache invalidation and naming things."* — Phil Karlton

Trong dự án, cache invalidation được xử lý qua **TTL (Time-To-Live)**:

```python
# Course catalog — 10 phút TTL
await self.set("catalog:courses:published", courses, ttl=600)

# Dictionary search — 1 giờ TTL
await self.set(f"dict:search:{keyword.lower()}", entries, ttl=3600)

# Leaderboard ZSET — 1 giờ TTL
await self._redis.expire("leaderboard:streaks", 3600)
```

**Chiến lược TTL được chọn vì:**
- **Đơn giản** — không cần code invalidation phức tạp mỗi khi dữ liệu thay đổi
- **An toàn** — không lo cache bị stale vĩnh viễn (TTL hết hạn → tự xóa)
- **Phù hợp với E-Learning** — khóa học không thay đổi liên tục; từ điển càng ít thay đổi

**Khi nào cần invalidate chủ động?** Khi admin publish/unpublish khóa học, hoặc giáo viên cập nhật tiêu đề. Trong tương lai, có thể thêm `await cache.delete("catalog:courses:published")` vào các API course mutation.

### 4.4 Hiện thực hóa trong mã nguồn (Code Implementation)

#### 4.4.1 Redis Client Wrapper

**File:** `backend/app/core/cache.py` — Lớp `RedisCache` singleton

```python
class RedisCache:
    def __init__(self):
        self._redis = None
        self._enabled = settings.REDIS_ENABLED  # ← Gate: có thể tắt Redis bằng env var
        self._hits = 0
        self._misses = 0

    async def connect(self):
        if not self._enabled:
            return  # No-op khi Redis bị tắt
        import redis.asyncio as aioredis
        self._redis = aioredis.from_url(settings.REDIS_URL, ...)
        await self._redis.ping()
```

**Đặc điểm kiến trúc quan trọng:**

1. **Feature Flag:** Toàn bộ cache được gated bởi `REDIS_ENABLED` — mọi phương thức đều kiểm tra `if not self.enabled: return None`. Redis down → app vẫn chạy bình thường, chỉ chậm hơn.

2. **Graceful Degradation:** Trong service layer, cache miss không gây lỗi — code fallback xuống PostgreSQL:

```python
# store.py
cached = await cache.get_course_catalog()
if cached is not None:
    return cached  # ← Redis hit: trả về ngay
# Redis miss hoặc disabled → query PostgreSQL
result = await db.execute(text("SELECT ... FROM v_published_courses ..."))
```

3. **Hit Rate Monitoring:**

```python
def stats(self) -> dict:
    total = self._hits + self._misses
    return {
        "hits": self._hits, "misses": self._misses,
        "hit_rate_pct": round(self._hits / total * 100, 2) if total > 0 else 0.0,
        "total_requests": total, "enabled": self._enabled,
    }
```

Endpoint `/api/health/cache` trả về cache hit rate — giúp monitor hiệu quả của cache.

#### 4.4.2 Cache-Aside cho Course Catalog

**File:** `backend/app/services/store.py` (dòng 8-56)

```python
async def get_store_courses(db, student_id):
    # === Bước 1: Kiểm tra cache ===
    if cache.enabled:
        cached = await cache.get_course_catalog()  # Redis GET
        if cached is not None:
            # Cache hit — thêm thông tin enrollment per-user
            for c in cached:
                c["is_enrolled"] = ...
            return cached

    # === Bước 2: Cache miss — đọc từ PostgreSQL ===
    result = await db.execute(text("SELECT ... FROM v_published_courses ..."))
    courses = [dict(row) for row in result.mappings()]

    # === Bước 3: Ghi vào cache ===
    if cache.enabled:
        cacheable = [{k: v for k, v in c.items() if k != "is_enrolled"} for c in courses]
        await cache.set_course_catalog(cacheable)  # Redis SETEX với TTL 600s

    return courses
```

**Lưu ý:** Trước khi cache, code loại bỏ `is_enrolled` (vì enrollment là per-user, không thể cache chung). Khi cache hit, `is_enrolled` được tính lại cho từng user từ dữ liệu `_enrollments` đính kèm.

#### 4.4.3 Redis ZSET cho Leaderboard

**File:** `backend/app/core/cache.py` (dòng 114-133)

```python
async def update_leaderboard(self, entries: list[dict]):
    """Cập nhật ZSET leaderboard (O(N) rebuild)."""
    pipe = self._redis.pipeline()
    key = "leaderboard:streaks"
    pipe.delete(key)               # Xóa ZSET cũ
    for entry in entries:
        pipe.zadd(key, {entry["full_name"]: entry["current_streak"]})
    await pipe.execute()           # Thực thi tất cả lệnh trong 1 round-trip
    await self._redis.expire(key, 3600)

async def get_top_learners(self, limit=20):
    """Lấy top learners từ ZSET (O(log N))."""
    result = await self._redis.zrevrange(
        "leaderboard:streaks", 0, limit - 1, withscores=True
    )
    return [{"full_name": name, "current_streak": int(score)} for name, score in result]
```

**Pipeline** (`pipe`) gom nhiều lệnh Redis thành một network round-trip — với 1000 sinh viên, thay vì 1000 lần gọi `ZADD` riêng lẻ, pipeline gửi tất cả trong 1 lần.

#### 4.4.4 Đồng bộ Leaderboard MV ↔ Redis

**File:** `backend/app/services/gamification.py` (dòng 51-61)

```python
async def refresh_leaderboard(db):
    # 1. Refresh Materialized View
    await db.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard"))
    await db.commit()

    # 2. Đồng bộ dữ liệu mới từ MV sang Redis ZSET
    if cache.enabled:
        result = await db.execute(
            text("SELECT full_name, current_streak FROM mv_leaderboard ORDER BY rank ASC")
        )
        await cache.update_leaderboard([dict(row) for row in result.mappings()])
```

---

## 5. Table Partitioning (Phân vùng dữ liệu)

### 5.1 Khái niệm (Concept)

**Table Partitioning** là kỹ thuật chia một bảng logic lớn thành nhiều bảng vật lý nhỏ hơn (gọi là **partition**), mỗi partition chứa một tập con dữ liệu dựa trên tiêu chí phân vùng. Với ứng dụng, bảng vẫn được truy vấn như một bảng duy nhất — PostgreSQL tự động **định tuyến** (route) truy vấn đến partition phù hợp.

#### Declarative Table Partitioning by Range

PostgreSQL 10+ hỗ trợ **Declarative Partitioning** — khai báo trực tiếp trong lệnh `CREATE TABLE`:

```sql
-- Bảng cha (partitioned table) — định nghĩa schema
CREATE TABLE transaction_logs (
    transaction_id UUID DEFAULT gen_random_uuid(),
    from_wallet_user_id UUID,
    to_wallet_user_id UUID,
    amount NUMERIC(14, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (transaction_id, created_at)  -- ← PK phải chứa partition key
) PARTITION BY RANGE (created_at);

-- Partition tháng 6/2026
CREATE TABLE transaction_logs_2026_06
PARTITION OF transaction_logs
FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Partition tháng 7/2026
CREATE TABLE transaction_logs_2026_07
PARTITION OF transaction_logs
FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

#### Partition Pruning

**Partition Pruning** là tối ưu hóa quan trọng nhất của partitioning: khi truy vấn có điều kiện `WHERE created_at = '2026-06-15'`, PostgreSQL biết dữ liệu chỉ có thể nằm trong partition `transaction_logs_2026_06` — và **bỏ qua tất cả partition khác**.

```mermaid
graph TB
    subgraph "Không phân vùng"
        Q1["SELECT * FROM transaction_logs<br/>WHERE created_at = '2026-06-15'"] --> S1["Seq Scan: 10,000,000 hàng<br/>Thời gian: ~30 giây"]
    end
    subgraph "Có phân vùng"
        Q2["SELECT * FROM transaction_logs<br/>WHERE created_at = '2026-06-15'"] --> P["Partition Pruning"]
        P -->|"Bỏ qua"| P7["log_2026_07<br/>0 hàng quét"]
        P -->|"Bỏ qua"| P8["log_2026_08<br/>0 hàng quét"]
        P -->|"CHỈ QUÉT"| P6["log_2026_06<br/>100,000 hàng<br/>Thời gian: ~0.3 giây"]
    end
```

#### Tại sao Primary Key phải chứa Partition Key?

Đây là ràng buộc kỹ thuật của PostgreSQL partitioning: Mỗi partition là một bảng vật lý riêng biệt. Một unique index trên bảng cha không thể đảm bảo uniqueness **xuyên suốt các partition** — vì mỗi partition có index riêng.

```
Nếu PK chỉ là (transaction_id):
  Partition 06: INSERT (tx_id=123, created_at='2026-06-15') → unique check cục bộ → OK
  Partition 07: INSERT (tx_id=123, created_at='2026-07-15') → unique check cục bộ → OK
  → Kết quả: 2 hàng cùng tx_id=123 trong 2 partition khác nhau → VI PHẠM UNIQUENESS!

Nếu PK là (transaction_id, created_at):
  Partition 06: (tx_id=123, created_at='2026-06-15')
  Partition 07: (tx_id=123, created_at='2026-07-15')
  → Đây là 2 hàng KHÁC NHAU (khác created_at) → hợp lệ
```

### 5.2 Vai trò & Mục đích (Role & Purpose)

Trong hệ thống E-Learning, 5 bảng được phân vùng vì chúng có chung đặc điểm:

| Đặc điểm | Giải thích |
|----------|------------|
| **Append-only** | Dữ liệu chỉ được INSERT, hiếm khi UPDATE/DELETE |
| **Time-series** | Dữ liệu có timestamp rõ ràng |
| **Tăng trưởng nhanh** | Mỗi giao dịch, notification, log → 1 dòng mới |
| **Truy vấn theo thời gian** | Hầu hết truy vấn lọc theo `WHERE created_at BETWEEN ...` |

| Bảng | Loại dữ liệu | Tốc độ tăng trưởng ước tính |
|------|-------------|---------------------------|
| `transaction_logs` | Giao dịch tài chính | ~1000/ngày (khi có nhiều user) |
| `transaction_action_logs` | Hành động giao dịch | ~1000/ngày |
| `log` | Log hệ thống | ~5000/ngày |
| `audit_logs` | Audit trail | ~2000/ngày |
| `notification_users` | Thông báo | ~3000/ngày |

Tổng cộng: ~12,000 dòng/ngày = ~4.3 triệu dòng/năm. Nếu không phân vùng, sau 2 năm bảng `log` có ~3.6 triệu dòng — mỗi lần quét toàn bảng tốn hàng chục giây.

### 5.3 Tại sao nên sử dụng (Benefits & Trade-offs)

#### Lợi ích

| Lợi ích | Cơ chế |
|---------|--------|
| **Tăng tốc truy vấn** | Partition Pruning — chỉ quét partition chứa dữ liệu cần tìm |
| **Dễ dàng xóa dữ liệu cũ** | `DROP TABLE log_2025_01` (milliseconds) thay vì `DELETE FROM log WHERE created_at < '2025-02-01'` (hàng giờ + VACUUM) |
| **Tăng tốc VACUUM** | VACUUM chạy trên từng partition nhỏ thay vì một bảng khổng lồ |
| **Phân bố I/O** | Các partition được lưu ở các vị trí vật lý khác nhau trên đĩa |
| **Quản lý dữ liệu nóng/lạnh** | Partition cũ có thể chuyển sang tablespace trên ổ cứng rẻ hơn |

#### Đánh đổi

| Hạn chế | Giải thích |
|---------|------------|
| **PK phải chứa partition key** | PK trở nên rộng hơn (composite key), FK tham chiếu phức tạp hơn |
| **Không có global unique constraint** | Không thể `UNIQUE (transaction_id)` xuyên suốt tất cả partition (trừ khi thêm `created_at`) |
| **Quản lý partition** | Cần tạo partition mới mỗi tháng (giải quyết bằng pg_partman) |
| **Cross-partition query chậm** | `SELECT COUNT(*) FROM transaction_logs` (không có WHERE) phải quét tất cả partition |

#### Maintenance: `DROP PARTITION` vs `DELETE`

```sql
-- Cách cũ (không partition): Xóa dữ liệu > 12 tháng
DELETE FROM transaction_logs WHERE created_at < '2025-07-01';
-- Tốn: quét toàn bộ 10M hàng, ghi WAL, trigger VACUUM → có thể mất HÀNG GIỜ
-- Trong thời gian đó, bảng bị khóa một phần → ảnh hưởng production

-- Cách mới (có partition): Xóa dữ liệu tháng 6/2025
DROP TABLE transaction_logs_2025_06;
-- Tốn: VÀI MILLISECONDS — PostgreSQL chỉ cần xóa metadata của bảng
-- Hoặc nhẹ nhàng hơn:
ALTER TABLE transaction_logs DETACH PARTITION transaction_logs_2025_06;
-- Partition vẫn tồn tại như bảng độc lập → có thể export/archive trước khi xóa
```

### 5.4 Hiện thực hóa trong mã nguồn (Code Implementation)

#### 5.4.1 Schema Partitioning

**File:** `backend/app/db/erd.sql` (dòng 251-333)

```sql
-- 5 bảng được phân vùng theo tháng
CREATE TABLE transaction_logs (
    transaction_id UUID DEFAULT gen_random_uuid(),
    ...
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (transaction_id, created_at)  -- ← Composite PK
) PARTITION BY RANGE (created_at);

-- Tạo sẵn 2 tháng
CREATE TABLE transaction_logs_2026_06 PARTITION OF transaction_logs
FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE transaction_logs_2026_07 PARTITION OF transaction_logs
FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

#### 5.4.2 Tự động hóa với pg_partman

**File:** `backend/app/db/pg_partman_setup.sql`

```sql
-- Đăng ký 5 bảng với pg_partman
-- p_interval: 1 tháng, p_premake: tạo sẵn 4 partition trong tương lai
SELECT partman.create_parent(
    p_parent_table := 'public.transaction_logs',
    p_control := 'created_at',
    p_type := 'native',
    p_interval := '1 month',
    p_premake := 4,
    p_start_partition := '2026-06-01'
);
-- ... tương tự cho 4 bảng còn lại

-- Retention: tự động detach partition cũ hơn 12 tháng
UPDATE partman.part_config SET retention = '12 months', retention_keep_table = false;
```

**Quy trình tự động của pg_partman:**

```
Ngày 1/7/2026:
  1. pg_partman chạy maintenance job (qua pg_cron hoặc scheduled task)
  2. Tạo partition mới: transaction_logs_2026_08, 2026_09, 2026_10 (premake=4)
  3. Kiểm tra retention: transaction_logs_2025_06 đã > 12 tháng
  4. DETACH (hoặc DROP) partition cũ
```

---

## 6. Database Distribution & Replication (Phân tán và Nhân bản)

### 6.1 Khái niệm (Concept)

#### 6.1.1 Master-Slave (Primary-Replica) Streaming Replication

**Streaming Replication** là cơ chế nhân bản dữ liệu trong PostgreSQL: mọi thay đổi trên máy chủ **Primary** (Master) được gửi liên tục dưới dạng WAL (Write-Ahead Log) stream đến các máy chủ **Replica** (Standby/Slave). Replica áp dụng các thay đổi này vào bản sao dữ liệu của nó, duy trì một bản sao gần như đồng bộ với Primary.

```mermaid
graph TB
    subgraph "Kiến trúc Primary-Replica"
        APP[Ứng dụng FastAPI]
        LB[pgBouncer / HAProxy]

        APP -->|"WRITE: INSERT/UPDATE/DELETE"| LB
        APP -->|"READ: SELECT"| LB

        LB -->|Writes| PRIMARY[(Primary DB<br/>Read/Write)]
        LB -->|Reads| REPLICA1[(Replica 1<br/>Read-Only)]
        LB -->|Reads| REPLICA2[(Replica 2<br/>Read-Only)]

        PRIMARY -->|"WAL Streaming<br/>(async/sync)"| REPLICA1
        PRIMARY -->|"WAL Streaming<br/>(async/sync)"| REPLICA2
    end
```

**Hai chế độ replication:**

| Chế độ | Cơ chế | Độ trễ | Độ an toàn |
|--------|--------|--------|------------|
| **Synchronous** | Primary chờ Replica xác nhận đã ghi WAL trước khi COMMIT | Gần như 0 | Dữ liệu không mất nếu Primary chết |
| **Asynchronous** | Primary gửi WAL và COMMIT ngay, không chờ Replica | Có thể vài ms đến vài giây | Có thể mất transaction cuối nếu Primary chết |

#### 6.1.2 Read/Write Splitting

**Read/Write Splitting** là mẫu kiến trúc: tất cả các thao tác **ghi** (INSERT, UPDATE, DELETE) được định tuyến đến Primary, trong khi các thao tác **đọc** (SELECT) được phân phối đến các Replica.

```mermaid
sequenceDiagram
    participant Client as Client Browser
    participant API as FastAPI Server
    participant Primary as Primary DB (Write)
    participant Replica as Replica DB (Read)

    Client->>API: POST /api/store/checkout (Mua khóa học)
    API->>Primary: CALL sp_buy_course_with_wallet(...)
    Primary-->>API: OK (COMMIT)
    API-->>Client: 200 OK

    Client->>API: GET /api/store/courses (Xem danh sách khóa học)
    API->>Replica: SELECT * FROM v_published_courses
    Replica-->>API: Kết quả (có thể chậm hơn Primary vài ms)
    API-->>Client: 200 OK [danh sách khóa học]
```

#### 6.1.3 Replication Lag

**Replication Lag** là độ trễ giữa thời điểm dữ liệu được commit trên Primary và thời điểm nó có sẵn trên Replica. Trong asynchronous replication, lag có thể từ vài mili giây đến vài giây (thậm chí vài phút nếu Replica bị quá tải).

**Vấn đề "Stale Read":**

```
1. User mua khóa học → INSERT vào course_enrollments trên Primary → COMMIT
2. User reload trang → SELECT * FROM course_enrollments → truy vấn được route đến Replica
3. Nếu Replica chưa nhận được WAL của transaction trên → User KHÔNG thấy khóa học vừa mua
   → User nghĩ giao dịch thất bại → Mua lại → DOUBLE PURCHASE!
```

**Cách xử lý trong dự án:** Code đọc dữ liệu "của chính mình" (read-your-own-writes) luôn đi qua Primary:

```python
# database.py
async def get_db():
    """Primary DB session (writes + read-your-own-writes)."""
    async with PrimarySession() as session:
        yield session

async def get_replica_db():
    """Replica DB session (reads only — for non-critical data)."""
    async with ReplicaSession() as session:
        yield session
```

#### 6.1.4 OLTP vs OLAP Separation

| Tiêu chí | OLTP (Online Transaction Processing) | OLAP (Online Analytical Processing) |
|----------|--------------------------------------|-------------------------------------|
| **Mục đích** | Xử lý giao dịch (mua hàng, đăng ký) | Phân tích dữ liệu (báo cáo, BI) |
| **Loại truy vấn** | Nhiều truy vấn nhỏ, đơn giản | Ít truy vấn lớn, phức tạp (aggregate, window) |
| **Tần suất** | Hàng nghìn/giây | Vài lần/ngày |
| **Tối ưu** | Index B-tree, ít cột, chuẩn hóa cao | Columnstore, nhiều cột, denormalized |
| **Dữ liệu** | Dữ liệu hiện tại (vài ngày gần đây) | Dữ liệu lịch sử (nhiều năm) |

**Logical Replication** cho phép tách OLTP và OLAP: setup một replica **chỉ nhận một số bảng** (ví dụ: `transaction_logs`, `course_enrollments`) để phục vụ analytical queries, không ảnh hưởng đến hiệu năng của Primary OLTP.

### 6.2 Vai trò & Mục đích (Role & Purpose)

| Vai trò | Áp dụng trong hệ thống |
|---------|------------------------|
| **Read/Write Splitting** | Dictionary search, course catalog → đọc từ Replica; Mua hàng, chuyển tiền → ghi vào Primary |
| **High Availability** | Primary chết → Replica được promote thành Primary mới (thời gian downtime: vài giây đến vài phút) |
| **OLAP Offloading** | Báo cáo doanh thu, thống kê học viên → chạy trên Replica riêng, không ảnh hưởng transaction |
| **Disaster Recovery** | Replica ở data center khác → backup địa lý |

### 6.3 Tại sao nên sử dụng (Benefits & Trade-offs)

| Lợi ích | Cơ chế |
|---------|--------|
| **Tăng throughput đọc** | Phân phối SELECT qua nhiều Replica — mỗi Replica thêm vào tăng ~100% khả năng đọc |
| **Giảm tải Primary** | Primary chỉ xử lý writes + read-your-own-writes — CPU/I/O dành cho transaction |
| **High Availability** | Có thể promote Replica thành Primary khi cần |
| **Backup không downtime** | Chạy pg_dump trên Replica thay vì Primary |

| Hạn chế | Giải pháp |
|---------|-----------|
| **Replication Lag** | Read-your-own-writes qua Primary; cache TTL đủ ngắn để che giấu lag |
| **Chi phí hạ tầng** | Thêm server cho mỗi Replica |
| **Phức tạp connection routing** | Dùng pgBouncer hoặc application-level routing |
| **Xung đột nếu write vào Replica** | Replica là read-only — application phải đảm bảo không write vào Replica |

### 6.4 Hiện thực hóa trong mã nguồn (Code Implementation)

#### 6.4.1 Dual Engine Architecture

**File:** `backend/app/core/database.py`

```python
# Primary Engine — cho writes + read-your-own-writes
engine = create_async_engine(
    settings.DATABASE_URL, pool_size=10, max_overflow=20,
)

# Replica Engine — cho reads không critical
if settings.REPLICA_DATABASE_URL and "pytest" not in sys.modules:
    replica_engine = create_async_engine(
        settings.REPLICA_DATABASE_URL, pool_size=10, max_overflow=20,
    )
else:
    replica_engine = engine  # ← Fallback: nếu không có Replica, dùng Primary

PrimarySession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
ReplicaSession = async_sessionmaker(replica_engine, class_=AsyncSession, expire_on_commit=False)
```

#### 6.4.2 Dependency Injection cho Read/Write Splitting

```python
async def get_db():
    """Primary DB session — dùng cho writes."""
    async with PrimarySession() as session:
        yield session

async def get_replica_db():
    """Replica DB session — dùng cho reads."""
    async with ReplicaSession() as session:
        yield session
```

**Cách sử dụng trong API endpoints:**

```python
# Endpoint write → Primary
@router.post("/store/checkout")
async def checkout(data: CheckoutRequest, db: AsyncSession = Depends(get_db)):
    await checkout_course(db, data.student_id, data.course_id)

# Endpoint read → Replica
@router.get("/store/courses")
async def list_courses(db: AsyncSession = Depends(get_replica_db)):
    return await get_store_courses(db, ...)
```

#### 6.4.3 Config cho Replication

**File:** `backend/app/core/config.py` (dòng 28)

```python
# Read Replica (optional)
REPLICA_DATABASE_URL: str | None = None  # Nếu không set → dùng Primary cho reads
```

Trong `.env` production:
```env
DATABASE_URL=postgresql+asyncpg://user:pass@primary-host:5432/elearning_db
REPLICA_DATABASE_URL=postgresql+asyncpg://user:pass@replica-host:5432/elearning_db
```

---

## 7. Query Execution & Indexing Optimization (Tối ưu Truy vấn & Đánh chỉ mục)

### 7.1 Khái niệm (Concept)

#### 7.1.1 `EXPLAIN (ANALYZE, BUFFERS)` — Công cụ chẩn đoán truy vấn

`EXPLAIN` là lệnh PostgreSQL hiển thị **kế hoạch thực thi** (execution plan) của một câu truy vấn — cho biết PostgreSQL sẽ dùng index nào, join kiểu gì, quét bao nhiêu hàng. `ANALYZE` thực thi truy vấn thật và hiển thị thời gian thực tế. `BUFFERS` hiển thị thông tin về buffer cache (bao nhiêu lần đọc từ cache, bao nhiêu lần đọc từ đĩa).

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM v_published_courses WHERE category_name = 'Cơ bản';
```

Kết quả điển hình:
```
Index Scan using idx_courses_published on general_courses c
  (cost=0.42..8.44 rows=1 width=...) (actual time=0.050..0.051 rows=1 loops=1)
  Index Cond: (category_id = 5)
  Filter: (visibility_status = 'PUBLISHED' AND is_deleted = FALSE)
  Buffers: shared hit=4 read=2
Planning Time: 0.150 ms
Execution Time: 0.080 ms
```

| Trường | Ý nghĩa |
|--------|---------|
| `Index Scan` | PostgreSQL dùng index để tìm hàng (tốt) |
| `Seq Scan` | PostgreSQL quét toàn bộ bảng (cần tối ưu nếu bảng lớn) |
| `cost=0.42..8.44` | Chi phí ước tính (đơn vị tùy ý của PostgreSQL) — số càng nhỏ càng nhanh |
| `actual time=0.050` | Thời gian thực tế (ms) |
| `rows=1` | Số hàng thực tế trả về |
| `Buffers: shared hit=4` | 4 blocks đọc từ buffer cache (RAM) — nhanh |
| `Buffers: read=2` | 2 blocks phải đọc từ đĩa — chậm |

#### 7.1.2 Các loại Index trong PostgreSQL

##### B-tree Index (Cây cân bằng)

**B-tree** (Balanced Tree) là loại index mặc định và phổ biến nhất trong PostgreSQL. Cấu trúc: cây cân bằng với các nút lá chứa con trỏ đến hàng dữ liệu (TID - Tuple ID).

```
          [50 | 100]           ← Nút gốc
         /    |     \
    [10|30] [60|80] [120|150]  ← Nút trong
    / |  \   / |  \   /  |  \
   Row data (heap)             ← Nút lá → TID
```

**Độ phức tạp:** O(log N) cho tìm kiếm, chèn, xóa. Phù hợp với: `=`, `>`, `<`, `BETWEEN`, `ORDER BY`, `LIKE 'prefix%'`.

**Các B-tree index trong dự án:** (file `backend/alembic/versions/2b3c4d5e6f7a_missing_fk_indexes.py`)

```sql
-- FK indexes (PostgreSQL KHÔNG tự động tạo index cho FK!)
CREATE INDEX idx_comments_lesson ON comments (lesson_id, created_at DESC);
CREATE INDEX idx_comments_user ON comments (user_id, created_at DESC);
CREATE INDEX idx_feedbacks_user ON user_feedbacks (user_id, created_at DESC);
CREATE INDEX idx_enrollments_course ON course_enrollments (course_id);
CREATE INDEX idx_sessions_expires ON authentication_sessions (expires_at);
CREATE INDEX idx_tx_logs_from_user ON transaction_logs (from_wallet_user_id, status, created_at DESC);
CREATE INDEX idx_tx_logs_to_user ON transaction_logs (to_wallet_user_id, status, created_at DESC);
```

##### Partial Index (Chỉ mục một phần)

**Partial Index** chỉ đánh index trên một tập con của bảng — các hàng thỏa mãn điều kiện `WHERE`. Lợi ích: index nhỏ hơn → nhanh hơn → ít tốn RAM buffer cache hơn.

```sql
-- Chỉ index khóa học đã publish + chưa xóa — bỏ qua DRAFT và ARCHIVED
CREATE INDEX idx_courses_published
ON general_courses (teacher_id, category_id, updated_at DESC)
WHERE is_deleted = FALSE AND visibility_status = 'PUBLISHED';
```

**Tại sao hiệu quả?** Nếu 60% khóa học là DRAFT/ARCHIVED, partial index chỉ bằng 40% kích thước full index — tiết kiệm 60% dung lượng và thời gian duy trì.

Các partial index trong dự án (`backend/alembic/versions/949fdd8f9d12_advanced_indexes.py`):

```sql
CREATE INDEX idx_users_active ON users (username, email) WHERE is_deleted = FALSE;
CREATE INDEX idx_dict_entries_active ON dictionary_entries (category_id, word) WHERE is_deleted = FALSE;
CREATE INDEX idx_notifications_user_unread ON notification_users (user_id, created_at DESC) WHERE is_read = FALSE;
```

##### Covering Index (Chỉ mục bao phủ) với INCLUDE

**Covering Index** là index chứa cả các cột bổ sung (`INCLUDE`) bên cạnh cột khóa — cho phép PostgreSQL thực hiện **Index-Only Scan**: trả về kết quả chỉ từ index, không cần đọc bảng chính (heap).

```sql
-- Không có INCLUDE: Index Scan → phải đọc heap để lấy progress, enrolled_at
-- Có INCLUDE: Index-Only Scan → mọi thứ có trong index
CREATE INDEX idx_enrollments_student_cover
ON course_enrollments (student_id)
INCLUDE (course_id, progress, enrolled_at);
```

```mermaid
graph TB
    subgraph "Không có Covering Index"
        Q1["SELECT course_id, progress<br/>FROM enrollments<br/>WHERE student_id = ?"] --> I1["B-tree Index trên (student_id)"]
        I1 -->|"Tìm thấy TID"| H1["Heap (bảng chính)"]
        H1 -->|"Đọc course_id, progress"| R1["Kết quả"]
    end
    subgraph "Có Covering Index"
        Q2["SELECT course_id, progress<br/>FROM enrollments<br/>WHERE student_id = ?"] --> I2["B-tree Index trên (student_id)<br/>INCLUDE (course_id, progress)"]
        I2 -->|"Mọi thứ đã có trong index"| R2["Kết quả — Index-Only Scan"]
    end
```

**Đánh đổi:** Covering index lớn hơn index thường (chứa thêm cột) → chậm hơn khi INSERT/UPDATE. Chỉ nên dùng cho các truy vấn đọc thường xuyên, ít ghi.

##### GIN Index (Generalized Inverted Index)

**GIN** là index đảo ngược (inverted index): thay vì "từ khóa → hàng", GIN map "phần tử → danh sách hàng chứa phần tử". Được thiết kế cho các kiểu dữ liệu **composite** (JSONB, Array, tsvector, trigram).

```sql
-- GIN cho JSONB — tìm kiếm trong nội dung JSON
CREATE INDEX idx_materials_transcript_gin
ON learning_materials USING GIN (material_transcript);

-- GIN cho Full-Text Search
CREATE INDEX idx_dict_fts
ON dictionary_entries
USING GIN (to_tsvector('simple', COALESCE(word, '') || ' ' || COALESCE(meaning, '')));
```

**Cấu trúc GIN Index:**

```
Bảng: dictionary_entries
  Row 1: word='xin chào', meaning='lời chào hỏi'
  Row 2: word='cảm ơn', meaning='lời cảm ơn'

GIN Index trên to_tsvector:
  'xin'     → [Row1]
  'chào'    → [Row1]
  'lời'     → [Row1, Row2]
  'chào'    → [Row1]
  'hỏi'     → [Row1]
  'cảm'     → [Row2]
  'ơn'      → [Row2]
```

##### Trigram Index (pg_trgm)

**Trigram** là chuỗi 3 ký tự liên tiếp. `pg_trgm` extension chia văn bản thành các trigram và dùng GIN index để tìm kiếm **mờ** (fuzzy search) — tìm được cả khi gõ sai chính tả hoặc gõ một phần.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_dict_word_trgm
ON dictionary_entries USING GIN (word gin_trgm_ops)
WHERE is_deleted = FALSE;
```

**Ví dụ:** Từ "xin chào" → trigram: `'  x'`, `' xi'`, `'xin'`, `'in '`, `'n c'`, `' ch'`, `'cha'`, `'hào'`, `'ào '`

Khi user gõ "xin chao" (thiếu dấu), trigram matching vẫn tìm thấy vì có nhiều trigram chung (`'xin'`, `'in '`, `' ch'`).

So sánh với Full-Text Search (tsvector):

| Tiêu chí | Trigram (pg_trgm) | Full-Text Search (tsvector) |
|----------|-------------------|---------------------------|
| **Khớp chính xác** | Tốt | Rất tốt |
| **Khớp gần đúng (fuzzy)** | ✅ Tốt — chịu được lỗi chính tả | ❌ Kém — yêu cầu từ gần chính xác |
| **Tiếng Việt có dấu** | ✅ Hoạt động (so khớp ký tự) | ⚠️ Cần cấu hình stemming |
| **Tìm prefix** | ✅ `'xin'` khớp `'xin chào'` | ✅ Với `:*` prefix operator |
| **Xếp hạng relevance** | ❌ Không có | ✅ `ts_rank()` |
| **Kích thước index** | Lớn (nhiều trigram) | Nhỏ hơn |

Dự án dùng **cả hai**: Trigram cho tìm kiếm mờ (autocomplete, gõ sai), FTS cho tìm kiếm chính xác có xếp hạng.

##### BRIN Index (Block Range INdex)

**BRIN** không đánh index từng hàng như B-tree — thay vào đó, nó chia bảng thành các **block range** (mỗi range gồm nhiều page, mặc định 128 page) và lưu `MIN`/`MAX` của cột trong mỗi range.

```
Bảng transaction_logs (vật lý: các page 8KB trên đĩa):
  Pages 1-32:   created_at từ '2026-06-01' đến '2026-06-10'  → BRIN: MIN=06-01, MAX=06-10
  Pages 33-64:  created_at từ '2026-06-10' đến '2026-06-18'  → BRIN: MIN=06-10, MAX=06-18
  Pages 65-96:  created_at từ '2026-06-18' đến '2026-06-25'  → BRIN: MIN=06-18, MAX=06-25
  ...

Truy vấn: WHERE created_at = '2026-06-15'
  → BRIN: chỉ cần quét pages 33-64 (1 range) — bỏ qua tất cả range khác
```

```sql
CREATE INDEX idx_transaction_logs_created_brin
ON transaction_logs USING BRIN (created_at) WITH (pages_per_range = 32);
```

**So sánh B-tree vs BRIN cho time-series:**

| Tiêu chí | B-tree trên `created_at` | BRIN trên `created_at` |
|----------|--------------------------|------------------------|
| **Kích thước** | ~30-50% kích thước bảng | ~0.1-1% kích thước bảng |
| **Tốc độ tạo** | Chậm (phải sort toàn bộ dữ liệu) | Nhanh (chỉ quét tuần tự) |
| **Độ chính xác** | Chính xác từng hàng | Xấp xỉ (phải quét cả range) |
| **Phù hợp** | Dữ liệu ngẫu nhiên, truy vấn điểm | **Dữ liệu tuần tự theo thời gian** |
| **RAM buffer** | Cần nhiều RAM để cache index | Cần rất ít RAM |

BRIN lý tưởng cho log/transaction table vì dữ liệu được INSERT tuần tự theo thời gian → `created_at` tăng dần → mỗi block range chứa các giá trị liên tiếp → MIN/MAX hẹp → pruning hiệu quả.

#### 7.1.3 Keyset Pagination vs Offset Pagination

**Offset Pagination:**
```sql
SELECT * FROM comments ORDER BY created_at DESC OFFSET 10000 LIMIT 20;
```

**Keyset Pagination (Cursor-based):**
```sql
SELECT * FROM comments
WHERE created_at < '2026-01-15T00:00:00Z'  -- cursor từ trang trước
ORDER BY created_at DESC LIMIT 20;
```

**Chứng minh toán học tại sao OFFSET phân rã thành O(N):**

```
OFFSET LIMIT 20:
  PostgreSQL phải ĐỌC (đếm) 10000 hàng đầu tiên, BỎ QUA chúng, rồi mới trả về 20 hàng tiếp theo.
  
  Trang 1:  đọc 20 hàng → O(20)
  Trang 2:  đọc 40 hàng → O(40)
  Trang 10: đọc 200 hàng → O(200)
  Trang 500: đọc 10000 hàng → O(10000)
  
  Độ phức tạp: O(offset + limit) → tỉ lệ TUYẾN TÍNH với offset
  Trang 500 chậm gấp 500 lần trang 1!
```

```
Keyset (Cursor):
  PostgreSQL dùng index trên (created_at) để NHẢY trực tiếp đến vị trí cursor
  → Không cần đọc các hàng trước đó.
  
  Trang 1:  đọc 20 hàng → O(20)
  Trang 500: NHẢY đến cursor → đọc 20 hàng → O(20)
  
  Độ phức tạp: O(limit) → HẰNG SỐ, không phụ thuộc vào trang
```

### 7.2 Vai trò & Mục đích (Role & Purpose)

| Kỹ thuật | Áp dụng cho | File |
|----------|-------------|------|
| **B-tree (FK indexes)** | JOIN nhanh, tìm kiếm theo khóa ngoại | `missing_fk_indexes.py` |
| **Partial Index** | Bỏ qua dữ liệu đã xóa mềm, chưa publish | `advanced_indexes.py` (dòng 30-43) |
| **Covering Index** | Tránh heap lookup cho enrollment, wallet | `fix_covering_index.py` |
| **GIN (JSONB)** | Tìm kiếm trong tài liệu học tập, câu hỏi | `advanced_indexes.py` (dòng 22-28) |
| **GIN (FTS)** | Tìm kiếm toàn văn từ điển | `dict_fulltext_search.py` |
| **Trigram (pg_trgm)** | Gợi ý tìm kiếm, fuzzy match tiếng Việt | `fulltext_search.py` |
| **BRIN** | Log time-series, transaction history | `advanced_indexes.py` (dòng 56-60) |
| **Keyset Pagination** | Lịch sử giao dịch, danh sách notification | `pagination.py` + `store.py` |

### 7.3 Tại sao nên sử dụng (Benefits & Trade-offs)

#### Tổng quan các loại Index

| Loại Index | Kích thước | Tốc độ tạo | Tốc độ SELECT | Overhead INSERT | Dùng khi |
|------------|-----------|------------|---------------|-----------------|----------|
| **B-tree** | Trung bình (30-50% bảng) | Trung bình | Rất nhanh với `=` và range | Trung bình | Hầu hết trường hợp |
| **Partial** | Nhỏ hơn B-tree (chỉ tập con) | Nhanh hơn B-tree | Nhanh hơn B-tree (nhỏ hơn) | Thấp hơn B-tree | Có điều kiện lọc cố định |
| **Covering (INCLUDE)** | Lớn hơn B-tree | Chậm hơn B-tree | Rất nhanh (Index-Only Scan) | Cao hơn B-tree | Truy vấn đọc nhiều, ít ghi |
| **GIN** | Lớn | Chậm | Nhanh cho `@>`, `@@`, `LIKE '%x%'` | Cao | JSONB, FTS, Array |
| **Trigram (GIN)** | Rất lớn | Rất chậm | Tốt cho fuzzy search | Rất cao | Autocomplete, spell-check |
| **BRIN** | Rất nhỏ (0.1-1%) | Rất nhanh | Khá (quét range) | Rất thấp | Time-series, log |

### 7.4 Hiện thực hóa trong mã nguồn (Code Implementation)

#### 7.4.1 Keyset Pagination

**File:** `backend/app/core/pagination.py`

```python
def encode_cursor(value: Any) -> str:
    """Encode cursor value to opaque base64 string."""
    return base64.urlsafe_b64encode(str(value).encode()).decode().rstrip("=")

def decode_cursor(cursor: str) -> str:
    """Decode cursor back to original string value."""
    padding = 4 - len(cursor) % 4
    if padding != 4:
        cursor += "=" * padding
    return base64.urlsafe_b64decode(cursor.encode()).decode()

class CursorPage:
    def __init__(self, items: list[dict], next_cursor: str | None, has_more: bool):
        self.items = items
        self.next_cursor = next_cursor
        self.has_more = has_more
```

**Sử dụng trong transaction history:** `backend/app/services/store.py` (dòng 195-244)

```python
async def get_user_transactions_cursor(db, user_id, limit=20, cursor=None):
    cursor_ts = None
    if cursor:
        cursor_ts = decode_cursor(cursor)  # Giải mã cursor → timestamp

    if cursor_ts:
        result = await db.execute(text("""
            SELECT ... FROM transaction_logs
            WHERE (from_wallet_user_id = :uid OR to_wallet_user_id = :uid)
              AND status = 'SUCCESS'
              AND created_at < :cursor_ts       -- ← Keyset condition
            ORDER BY created_at DESC LIMIT :limit
        """), {"uid": user_id, "cursor_ts": cursor_ts, "limit": limit + 1})
    else:
        # Trang đầu — không có cursor
        result = await db.execute(text("""
            SELECT ... FROM transaction_logs
            WHERE ...
            ORDER BY created_at DESC LIMIT :limit
        """), {"uid": user_id, "limit": limit + 1})

    rows = [dict(row) for row in result.mappings()]
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    # Tạo cursor cho trang tiếp theo từ timestamp của hàng cuối cùng
    next_cursor = None
    if has_more and rows:
        last_ts = rows[-1]["created_at"]
        next_cursor = encode_cursor(last_ts.isoformat())

    return CursorPage(rows, next_cursor, has_more)
```

**So sánh hiệu năng Offfset vs Keyset trong dự án:**

```sql
-- explain_queries.sql (dòng 25-33)

-- OFFSET (Deep Page) — quét và bỏ qua 10000 hàng
EXPLAIN (ANALYZE, BUFFERS)
SELECT comment_id, content, created_at FROM comments
ORDER BY created_at DESC OFFSET 10000 LIMIT 20;
-- Kết quả: Execution Time: ~45ms (phải đọc 10020 hàng)

-- Keyset — nhảy trực tiếp đến cursor
EXPLAIN (ANALYZE, BUFFERS)
SELECT comment_id, content, created_at FROM comments
WHERE created_at < '2026-01-15T00:00:00Z'
ORDER BY created_at DESC LIMIT 20;
-- Kết quả: Execution Time: ~0.3ms (chỉ đọc 20 hàng)
```

#### 7.4.2 Full-Text Search với tsvector

**File:** `backend/app/services/dictionary.py` (dòng 78-126)

```python
async def search_entries_fts(db, query, limit=30):
    # Xây dựng tsquery với prefix matching
    words = query.strip().split()
    tsquery_parts = [f"{w}:*" for w in words if w.replace("'", "").replace("\\", "")]
    tsquery = " & ".join(tsquery_parts)  # Ví dụ: "xin & chào"

    result = await db.execute(text("""
        SELECT e.entry_id::text, e.word, e.meaning, e.updated_at,
               ts_rank(
                   to_tsvector('simple', COALESCE(e.word,'') || ' ' || COALESCE(e.meaning,'')),
                   to_tsquery('simple', :query)
               ) AS relevance
        FROM dictionary_entries e
        WHERE e.is_deleted = FALSE
          AND to_tsvector('simple', COALESCE(e.word,'') || ' ' || COALESCE(e.meaning,''))
              @@ to_tsquery('simple', :query)
        ORDER BY relevance DESC
        LIMIT :limit
    """), {"query": tsquery, "limit": limit})
```

`ts_rank()` tính điểm relevance dựa trên tần suất xuất hiện và vị trí của từ khóa — kết quả được sắp xếp theo độ liên quan giảm dần.

#### 7.4.3 Index Verification với EXPLAIN

**File:** `backend/scripts/explain_queries.sql` — Script để xác minh hiệu năng của từng loại index:

```sql
-- (A) FTS Search vs Trigram
EXPLAIN (ANALYZE, BUFFERS)
SELECT word, meaning, ts_rank(...) AS relevance
FROM dictionary_entries
WHERE ... to_tsvector(...) @@ to_tsquery('simple', 'ngon:*')
ORDER BY relevance DESC LIMIT 30;

-- (B) Covering Index — Index-Only Scan
EXPLAIN (ANALYZE, BUFFERS)
SELECT course_id, progress, enrolled_at
FROM course_enrollments WHERE student_id = '...';

-- (D) Materialized View vs direct query
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM mv_leaderboard ORDER BY rank LIMIT 20;
```

---

## Tổng kết Chương

Chương này đã trình bày chi tiết 07 kỹ thuật DBMS nâng cao được áp dụng trong hệ thống E-Learning Ngôn ngữ Ký hiệu:

| # | Kỹ thuật | Bài toán giải quyết | Công nghệ chính |
|---|---------|-------------------|-----------------|
| 1 | **View & Materialized View** | Che giấu phức tạp schema + tăng tốc truy vấn nặng | PostgreSQL Views + `REFRESH MATERIALIZED VIEW CONCURRENTLY` |
| 2 | **Triggers** | Tự động hóa business logic + bảo vệ toàn vẹn dữ liệu | PostgreSQL `FOR EACH ROW` Triggers |
| 3 | **Concurrency Control** | Chống race condition, deadlock trong giao dịch tài chính | `FOR UPDATE`, sorted locking, SERIALIZABLE, Advisory Locks, `SKIP LOCKED` |
| 4 | **Redis Caching** | Giảm tải DB + tăng tốc độ phản hồi | Cache-aside pattern, Redis ZSET, TTL-based invalidation |
| 5 | **Table Partitioning** | Quản lý dữ liệu time-series khổng lồ | Declarative Range Partitioning + pg_partman |
| 6 | **Distribution & Replication** | Read/Write splitting + High Availability | Streaming Replication, Dual-engine DI |
| 7 | **Indexing Optimization** | Tăng tốc mọi loại truy vấn | B-tree, Partial, Covering, GIN, Trigram, BRIN, Keyset Pagination |

Mỗi kỹ thuật được hiện thực hóa cụ thể trong mã nguồn của dự án với các file và dòng code được tham chiếu rõ ràng. Sự kết hợp của 07 kỹ thuật này tạo nên một nền tảng cơ sở dữ liệu vững chắc, đáp ứng được các yêu cầu khắt khe về hiệu năng, tính nhất quán, và khả năng mở rộng của một hệ thống E-Learning thương mại.

---

> **Tài liệu tham khảo:**
> - PostgreSQL 15 Documentation: https://www.postgresql.org/docs/15/
> - Redis Documentation: https://redis.io/docs/
> - Mã nguồn dự án: `backend/app/db/erd.sql`, `backend/app/db/procedures.sql`, `backend/alembic/versions/`
> - Kế hoạch hoàn thiện: `docs/Ke_hoach_hoan_thien_codebase.md`
