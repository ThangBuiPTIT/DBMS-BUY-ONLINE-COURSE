# API ENDPOINT MAPPING: Go (main) → FastAPI (fastapi)

## Complete endpoint-by-endpoint mapping with request/response schemas and SQL translation

---

## 1. Authentication

### POST /api/auth/admin-login

| Aspect | Go (main) | FastAPI (fastapi) |
|--------|----------|-------------------|
| **File** | `handler/auth_handler.go:AdminLogin()` | `api/auth.py` |
| **Service** | (inline in repo) | `services/auth.py:authenticate_admin()` |
| **Repo** | `repository/auth_repository.go` | SQLAlchemy ORM + raw session insert |

**Request:**
```json
{
    "username": "admin",
    "password": "secret"
}
```

**Go struct:** `models.LoginRequest{Username, Password}`
**FastAPI schema:** `schemas/auth.py:LoginRequest(username: str, password: str)`

**SQL (Go):**
```sql
-- GetUserByUsername
SELECT u.user_id, u.username, u.password_hash, COALESCE(u.email, ''), u.role_id, r.role_name, u.status, u.is_deleted
FROM users u JOIN roles r ON u.role_id = r.role_id
WHERE u.username = $1 AND u.is_deleted = FALSE;
```
```sql
-- CreateSession
INSERT INTO authentication_sessions (user_id, session_key, expires_at) VALUES ($1, $2, $3);
```

**FastAPI approach:** 
- Use SQLAlchemy ORM: `select(User).join(Role).where(User.username == username, User.is_deleted == False)`
- Use `verify_password()` from `passlib[bcrypt]`
- Manual `INSERT` via `text()` or ORM `session.add(AuthenticationSession(...))`

**Response (200):**
```json
{
    "message": "Đăng nhập thành công",
    "session_key": "<uuid>",
    "user": {
        "user_id": "<uuid>",
        "username": "admin",
        "email": "admin@elearning.com",
        "role_name": "ADMIN"
    }
}
```

**Error cases:** 400 (bad request), 401 (wrong credentials), 403 (frozen/not admin), 500 (DB error)

---

## 2. Admin Endpoints

### GET /api/admin/transactions

| Aspect | Go | FastAPI |
|--------|----|---------|
| **File** | `handler/admin_handler.go:GetTransactions()` | `api/admin.py` |
| **Service** | — | `services/admin.py:get_transactions()` |
| **Query Params** | `limit` (default 10), `offset` (default 0) | `limit: int = Query(10, gt=0)`, `offset: int = Query(0, ge=0)` |

**Go SQL:**
```sql
SELECT COUNT(*) FROM vw_detailed_transaction_history;
SELECT v.transaction_id, v.created_at, v.amount, v.status, v.message, 
       v.sender_name, v.receiver_name, v.related_course,
       u_sender.user_id AS sender_id, u_receiver.user_id AS receiver_id
FROM vw_detailed_transaction_history v
LEFT JOIN user_profiles u_sender ON v.sender_name = u_sender.full_name
LEFT JOIN user_profiles u_receiver ON v.receiver_name = u_receiver.full_name
LIMIT $1 OFFSET $2;
```

**FastAPI approach:** Raw SQL via `text()` hitting the same view `vw_detailed_transaction_history`

**Response (200):**
```json
{
    "transactions": [],
    "total_count": 5,
    "limit": 10,
    "offset": 0
}
```

### GET /api/admin/revenue

**Go SQL:** `SELECT course_id, title, price, total_sales_count, total_revenue FROM vw_revenue_by_course ORDER BY total_revenue DESC`

**FastAPI approach:** Raw SQL via `text()` hitting `vw_revenue_by_course`

**Response (200):** `[{"course_id": "...", "title": "...", "price": 500000, "total_sales_count": 3, "total_revenue": 1500000}, ...]`

### POST /api/admin/users/ban

**Request:**
```json
{"user_id": "<uuid>", "reason": "Violation of terms"}
```

**Go SQL:** `CALL sp_ban_user($1, $2)`
**FastAPI:** `await db.execute(text("CALL sp_ban_user(:user_id, :reason)"), {...})`

**Response (200):** `{"message": "Khóa tài khoản người dùng thành công"}`

---

## 3. Teacher Endpoints

### GET /api/teacher/{teacher_id}/dashboard

**Go path extraction:** Manual `getTeacherID(r)` string splitting
**FastAPI:** `teacher_id: UUID` path parameter

**Go SQL:** 
```sql
SELECT teacher_id, teacher_name, total_courses, total_students, total_generated_revenue
FROM vw_teacher_dashboard WHERE teacher_id = $1
```

**FastAPI:** Raw SQL via `text()` hitting view `vw_teacher_dashboard`

**Response (200):** `TeacherDashboardResponse` schema

### GET /api/teacher/{teacher_id}/courses

**Go SQL:**
```sql
SELECT va.course_id, va.course_title, va.teacher_name, va.total_students, va.avg_progress, va.avg_rating
FROM vw_course_analytics va
JOIN general_courses c ON va.course_id = c.course_id
WHERE c.teacher_id = $1
ORDER BY va.total_students DESC
```

**FastAPI:** Raw SQL, same logic

**Response (200):** `list[CourseAnalyticResponse]`

### GET /api/teacher/{teacher_id}/feedback

**Go SQL:**
```sql
SELECT f.course_or_context, f.total_feedbacks, f.average_rating, f.five_stars, f.one_star
FROM vw_course_feedback_summary f
JOIN general_courses c ON f.course_or_context LIKE '%' || c.title || '%'
WHERE c.teacher_id = $1
ORDER BY f.average_rating DESC
```

**Note:** The LIKE join is fragile (depends on course title being in context). Keep same for compatibility.

**FastAPI:** Raw SQL, same query

**Response (200):** `list[CourseFeedbackSummaryResponse]`

---

## 4. Student Endpoints

### GET /api/students/search?keyword=...

**Go SQL:** `SELECT student_id, username, full_name, grade_level, school_name, created_at FROM fn_search_students($1)`

**FastAPI:** `await db.execute(text("SELECT * FROM fn_search_students(:kw)"), {"kw": keyword})`

**Response (200):** `list[StudentSearchResult]`

### GET /api/students/progress

**Go SQL:** `SELECT student_name, email, school_name, course_title, progress, enrolled_at, learning_status FROM vw_student_progress_report`

**FastAPI:** Raw SQL hitting view

**Response (200):** `list[StudentProgressReport]`

### GET /api/students/inactive

**Go SQL:** `SELECT enrollment_id, student_id, full_name, phone_number, course_title, last_activity_date FROM vw_inactive_students`

**FastAPI:** Raw SQL hitting view

**Response (200):** `list[InactiveStudentResponse]`

---

## 5. Store / Wallet Endpoints

### GET /api/store/courses?student_id=...

**Go SQL:**
```sql
SELECT c.course_id, c.title, COALESCE(c.description, '') as description, 
       COALESCE(c.image_url, '') as image_url, c.price, c.visibility_status, 
       COALESCE(up.full_name, 'Giảng viên') as teacher_name,
       EXISTS(SELECT 1 FROM course_enrollments e WHERE e.course_id = c.course_id AND e.student_id = $1) as is_enrolled
FROM general_courses c
LEFT JOIN user_profiles up ON c.teacher_id = up.user_id
WHERE c.visibility_status = 'PUBLISHED' AND c.is_deleted = FALSE
ORDER BY c.updated_at DESC
```

**FastAPI:** Can use ORM with subquery for `is_enrolled` or raw SQL

**Response (200):** `list[StoreCourseResponse]`

### GET /api/wallet/{user_id}

**Go SQL:** `SELECT user_id, balance, updated_at FROM wallets WHERE user_id = $1`
(Fallback: auto-create wallet with 0 balance if not found)

**FastAPI:** ORM `select(Wallet).where(Wallet.user_id == user_id)` + auto-create fallback

**Response (200):** `WalletInfoResponse`

### POST /api/wallet/topup

**Request:** `{"user_id": "<uuid>", "amount": 100000, "message": "Nạp tiền qua VNPay"}`

**Go SQL:** `CALL sp_topup_wallet($1, $2, $3)`

**FastAPI:** `await db.execute(text("CALL sp_topup_wallet(:uid, :amt, :msg)"), {...})`

**Response (200):** `{"status": "SUCCESS", "message": "Nạp tiền thành công"}`

### POST /api/store/checkout

**Request:** `{"student_id": "<uuid>", "course_id": "<uuid>"}`

**Go SQL:** `CALL sp_buy_course_with_wallet($1, $2)`

**FastAPI:** `await db.execute(text("CALL sp_buy_course_with_wallet(:sid, :cid)"), {...})`

**Error handling (Go):** Checks error string for Vietnamese phrases:
- `"Số dư không đủ"` → 400
- `"Khóa học không tồn tại"` → 400
- Otherwise → 500

**FastAPI:** Wrap in try/except, check exception message for same phrases, raise `HTTPException`

**Response (200):** `{"status": "SUCCESS", "message": "Mua khóa học thành công"}`

---

## 6. Gamification Endpoints

### GET /api/gamification/leaderboard?limit=20

**Go SQL:**
```sql
SELECT full_name, COALESCE(avatar_url, '') as avatar_url, current_streak, highest_streak, total_achievements
FROM vw_top_learners_leaderboard LIMIT $1
```
Rank is calculated in Go loop (rank++ per row).

**FastAPI:** Raw SQL + Python `enumerate(rows, start=1)` for rank

**Response (200):**
```json
{
    "leaderboard": [{"rank": 1, "full_name": "...", ...}],
    "total": 20
}
```

### GET /api/gamification/streak/{student_id}

**Go SQL:** `SELECT student_id, current_streak, highest_streak, last_activity_date FROM student_streaks WHERE student_id = $1`

**FastAPI:** ORM `select(StudentStreak).where(StudentStreak.student_id == student_id)`

**Response (200):** `StudentStreakResponse`

**Edge case:** If not found, return default streak (all zeros) — match Go behavior.

---

## 7. Dictionary Endpoints

### GET /api/dictionary/search?word=...

**Go SQL:**
```sql
SELECT e.entry_id, e.category_id, COALESCE(c.name, '') AS category_name, e.word, e.meaning, e.updated_at
FROM dictionary_entries e
LEFT JOIN dictionary_categories c ON e.category_id = c.category_id
WHERE e.is_deleted = FALSE
  AND ($1 = '' OR e.word ILIKE '%' || $1 || '%' OR e.meaning ILIKE '%' || $1 || '%')
ORDER BY
    CASE WHEN LOWER(e.word) = LOWER($1) THEN 0
         WHEN LOWER(e.word) LIKE LOWER($1) || '%' THEN 1
         ELSE 2 END,
    e.word ASC
LIMIT 30
```
Then batch-fetches variations: `WHERE entry_id IN ($1, $2, ...)` (prevents N+1)

**FastAPI:** Same raw SQL approach with batch variations

**Response (200):**
```json
{
    "entries": [{"entry_id": "...", "word": "AngkorWat", "variations": [...], ...}],
    "total": 5,
    "keyword": "Angkor"
}
```

### GET /api/dictionary/categories

**Go SQL:** `SELECT category_id, name, COALESCE(description, '') FROM dictionary_categories ORDER BY name ASC`

**FastAPI:** ORM `select(DictionaryCategory).order_by(DictionaryCategory.name)`

**Response (200):** `list[DictionaryCategoryResponse]`

### GET /api/dictionary/entries/{entry_id}/variations

**Go path pattern:** `/api/dictionary/entries/{id}/variations` (manually parsed)

**FastAPI path pattern:** Same — `@router.get("/entries/{entry_id}/variations")`

**Go SQL:** `SELECT variation_id, entry_id, COALESCE(region, '') AS region, video_url, COALESCE(description, '') AS description FROM dictionary_variations WHERE entry_id = $1 ORDER BY region ASC`

**Response (200):**
```json
{
    "entry_id": "<uuid>",
    "variations": [{"variation_id": "...", "region": "Siem Reap", "video_url": "...", ...}],
    "total": 2
}
```

---

## 8. Microlearning Endpoints

### GET /api/microlearning/roadmap

This is the most complex query — builds a 4-level nested JSON tree using PostgreSQL `json_agg`:

**Go SQL:**
```sql
SELECT t.topic_id, t.title, COALESCE(t.description, '') AS description,
    COALESCE((
        SELECT json_agg(unit_data ORDER BY unit_data.order_index ASC)
        FROM (
            SELECT u.unit_id, u.topic_id, u.title, u.order_index,
                COALESCE((
                    SELECT json_agg(lesson_data ORDER BY lesson_data.order_index ASC)
                    FROM (
                        SELECT l.lesson_id, l.unit_id, l.title, COALESCE(l.video_url, '') AS video_url, l.order_index
                        FROM microlearning_lessons l WHERE l.unit_id = u.unit_id
                    ) lesson_data
                ), '[]'::json) AS lessons
            FROM microlearning_units u WHERE u.topic_id = t.topic_id
        ) unit_data
    ), '[]'::json) AS units
FROM microlearning_topics t
ORDER BY t.topic_id ASC
```

**FastAPI approach options:**
1. **Keep raw SQL** — fastest, matches Go exactly
2. **ORM with selectinload** — `select(Topic).options(selectinload(Topic.units).selectinload(Unit.lessons))`

**Recommendation:** Use raw SQL (Option 1) for performance and exact compatibility.

**Response (200):** `list[MicrolearningTopicResponse]` (nested: topic → units → lessons)

### GET /api/microlearning/lessons/{lesson_id}/parts

**Go SQL:** `SELECT part_id, lesson_id, COALESCE(title, '') AS title, part_type, COALESCE(content, '') AS content, order_index FROM microlearning_lesson_parts WHERE lesson_id = $1 ORDER BY order_index ASC`

**FastAPI:** ORM `select(MicrolearningLessonPart).where(...).order_by(...)`

**Response (200):** `list[MicrolearningLessonPartResponse]`

### GET /api/microlearning/parts/{part_id}/questions

**Go SQL:** `SELECT question_id, part_id, question_text, question_type, options_json, correct_answer FROM microlearning_questions WHERE part_id = $1`

**FastAPI:** ORM or raw SQL

**Note on JSONB:** Go deserialized `options_json` into `json.RawMessage` and sent raw. FastAPI should keep as JSON array via Pydantic's `Json` type or `list[str]`.

**Response (200):** `list[MicrolearningQuestionResponse]`

---

## 9. Course Builder Endpoints

### GET /api/teacher/courses/{course_id}/content

**Go approach:** 4 sequential queries, then nested in-memory:
1. Get course info from `general_courses`
2. Get modules from `general_course_modules` (for this course)
3. Get lessons from `general_course_lessons` (for all modules of this course)
4. Get materials from `learning_materials` (for all lessons)

In-memory nesting: materials → lessons → modules

**FastAPI approach:**
- **Option A:** Same 4-query + in-memory nesting (match Go)
- **Option B:** Use `selectinload` with ORM relationships (cleaner but may generate many queries)

**Recommendation:** Use Option B (SQLAlchemy `selectinload`) for cleaner code. If performance is concern, fall back to Option A.

**Response (200):** `CourseContentResponse` (nested: course → modules → lessons → materials)

### POST /api/teacher/modules

**Request:** `{"course_id": "<uuid>", "title": "Chương 1: Giới thiệu"}`

**Go logic:**
1. `SELECT COALESCE(MAX(order_index), 0) FROM general_course_modules WHERE course_id = $1`
2. `INSERT INTO general_course_modules (course_id, title, order_index) VALUES ($1, $2, $3) RETURNING module_id`

**FastAPI:** Same logic via ORM or raw SQL

**Response (201):** `{"module_id": "<uuid>", "course_id": "...", "title": "...", "order_index": 3, "lessons": []}`

### POST /api/teacher/lessons

**Request:** `{"module_id": "<uuid>", "title": "Bài 1: ...", "video_url": "https://..."}`

**Go logic:** Same as modules — get max order, insert, return with generated ID

**Response (201):** `{"lesson_id": "<uuid>", "module_id": "...", "title": "...", "video_url": "...", "order_index": 2, "materials": []}`

### PUT /api/teacher/lessons/reorder

**Request:** `{"module_id": "<uuid>", "lesson_ids": ["<id1>", "<id2>", "<id3>"]}`

**Go logic (in a transaction):**
1. Shift all existing lessons to +10000 to avoid UNIQUE constraint conflicts
2. Assign target indices based on array order

**FastAPI:** Same transaction-based approach

**Response (200):** `{"message": "Sắp xếp bài học thành công"}`

### PUT /api/teacher/courses/{course_id}/visibility

**Request:** `{"visibility_status": "PUBLISHED"}` (validated: DRAFT | PUBLISHED | ARCHIVED)

**Go SQL:** `UPDATE general_courses SET visibility_status = $1 WHERE course_id = $2 AND is_deleted = FALSE`

**Response (200):** `{"message": "Cập nhật trạng thái thành công"}`

---

## 10. Notification Endpoints

### GET /api/notifications/{user_id}

**Go SQL:**
```sql
SELECT notification_id, user_id, title, message, is_read, created_at
FROM notification_users
WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY is_read ASC, created_at DESC
```

**Note:** Partitioned table — must include `created_at` filter for partition pruning.

**FastAPI:** Raw SQL via `text()`

**Response (200):** `list[NotificationResponse]` (empty list `[]` if none, NOT null)

### PUT /api/notifications/{notification_id}/read

**Go approach (two-step, partition-aware):**
1. `SELECT created_at FROM notification_users WHERE notification_id = $1 AND created_at >= NOW() - INTERVAL '30 days' LIMIT 1`
2. `UPDATE notification_users SET is_read = TRUE WHERE notification_id = $1 AND created_at = $2`

**FastAPI:** Same two-step approach (partition key required for UPDATE on partitioned table)

**Response (200):** `{"message": "Đã đánh dấu đã đọc"}`

**Error:** 500 if notification not found / expired

### GET /api/admin/audit-logs

**Go SQL:**
```sql
SELECT audit_id, run_id, action, status, COALESCE(error_message, '') as error_message, created_at
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC LIMIT 50
```

**Note:** Also partitioned — partition pruning via date range.

**FastAPI:** Raw SQL via `text()`

**Response (200):** `list[AuditLogResponse]` (empty list if none)

---

## Summary Statistics

| Category | Endpoints | DB Access Pattern |
|----------|-----------|-------------------|
| Auth | 1 | ORM (user lookup) + raw INSERT (session) |
| Admin | 3 | Raw SQL (views + procedure) |
| Teacher | 3 | Raw SQL (views) |
| Student | 3 | Raw SQL (function + views) |
| Store | 4 | ORM + Raw SQL (procedures) |
| Gamification | 2 | Raw SQL (view) + ORM (simple table) |
| Dictionary | 3 | Raw SQL (ILIKE search + batch) |
| Microlearning | 3 | Raw SQL (json_agg) + ORM (simple tables) |
| Course Builder | 5 | Mixed (ORM for CRUD, raw for content tree) |
| Notification | 3 | Raw SQL (partitioned tables) |
| **Total** | **30** | |

### Raw SQL vs ORM Decision Matrix

| Use Raw SQL | Use ORM |
|-------------|---------|
| DB Views (`vw_*`) | Simple single-table CRUD |
| DB Functions (`fn_*`) | Standard joins with eager loading |
| DB Procedures (`CALL sp_*`) | Insert/update with RETURNING |
| Partitioned tables | Non-partitioned tables |
| json_agg hierarchical queries | Simple filters and ordering |
| Complex ILIKE with scoring | |
