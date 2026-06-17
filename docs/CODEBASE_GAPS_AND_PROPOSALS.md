# Codebase Gaps & Engineering Proposals

## Nền tảng học trực tuyến Ngôn ngữ Ký hiệu — Product & Architecture Audit

**Date:** 2026-06-18  
**Audit Scope:** Full-stack (Database, Backend, Security, Business Logic)  
**Audit Authors:** Lead Product Manager & Lead System Architect review  
**Reference Baseline:** Coursera, Udemy, Duolingo — production-grade E-Learning standards

---

## Executive Summary

The Sign Language E-Learning platform has a **solid foundation** — 30 API endpoints, 27 ORM models, 8 DB views, 5 stored procedures, proper partitioning-ready schema, Redis caching infrastructure, and comprehensive indexing (partial, covering, GIN, trigram, BRIN). The backend migration from Golang to FastAPI is structurally complete.

However, a deep audit against production E-Learning standards reveals **28 gaps** across four dimensions. The platform currently operates at a **"functional prototype"** level — it can sell courses and track progress, but it lacks the safety, engagement, and operational mechanisms expected of a production E-Learning product.

### Severity Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Business & Features | 2 | 4 | 3 | 1 | 10 |
| Security & Integrity | 3 | 2 | 2 | 1 | 8 |
| Architecture & Performance | 1 | 2 | 2 | 1 | 6 |
| Database Design | 0 | 2 | 2 | 0 | 4 |
| **Total** | **6** | **10** | **9** | **3** | **28** |

### Readiness Assessment

```
Production Readiness: ████████░░ 65%

Ready for: Internal demo, small beta (<50 users)
NOT ready for: Public launch, payment processing at scale, user-generated content moderation
```

---

## Detailed Gap Analysis

---

### SECTION 1: BUSINESS & FEATURES

---

#### GAP-1.1 🔴 CRITICAL — No Certificate Issuance & Verification System

**Current State:**
- `fn_check_certificate_eligibility()` exists in `procedures.sql:127` — returns `TRUE/FALSE` based on progress = 100%
- `backend/app/services/certificate.py:5` calls this function and returns `{eligible: true/false, current_progress, remaining}`
- `GET /api/courses/{course_id}/certificate/eligibility/{student_id}` endpoint exists
- **There is NO database table for issued certificates.** No certificate model, no unique verification hash, no PDF generation, no certificate URL storage.

**The Risk:**
- Without a `certificates` table, there is no record that a certificate was *ever issued*. If a student completes a course and later their enrollment is deleted, all proof of completion is lost.
- No verification mechanism — a student cannot share a certificate link with an employer for validation.
- No PDF generation capability — certificates exist only as an API boolean, not a downloadable asset.
- This is a **core value proposition** of any E-Learning platform. Without certificates, the platform is just a content viewer, not a credentialing platform.

**Proposed Solution:**
1. Create `certificates` table with: `certificate_id UUID PK`, `student_id FK`, `course_id FK`, `issued_at`, `certificate_hash VARCHAR(64) UNIQUE` (SHA-256 of student_id+course_id+issued_at+secret), `certificate_url TEXT`, `metadata JSONB`
2. Create `POST /api/courses/{course_id}/certificate/issue` endpoint — checks eligibility, generates hash, inserts row, returns certificate with verification URL
3. Create `GET /api/certificates/verify/{hash}` — public endpoint, no auth needed, returns certificate details + validity
4. PDF generation via `weasyprint` or `reportlab` with HTML template (sign language themed)
5. Certificate revocation: add `revoked_at` column for invalidating certificates (e.g., course content found plagiarized)

---

#### GAP-1.2 🔴 CRITICAL — No Teacher Payout / Revenue Split System

**Current State:**
- `sp_buy_course_with_wallet` transfers money from student → **admin** (hardcoded)
- `sp_enroll_paid_course` (proposed in Plan 3) would transfer student → **teacher** directly
- **There is NO table for payout requests, revenue splits, or teacher earnings tracking.**
- Teachers have no way to withdraw earnings. The system treats teachers as content creators who never get paid.
- `vw_teacher_dashboard` shows `total_generated_revenue` — but this is just a display number. There's no payout pipeline.

**The Risk:**
- In a real marketplace, teachers must be paid. Without a payout system, teachers have no incentive to create courses.
- Even if the platform uses an admin-mediated payout model (platform collects, manually pays teachers later), there must be a ledger tracking what each teacher is owed vs. what has been paid.
- Currently, the `sp_buy_course_with_wallet` sends all money to admin — this is a single-point accounting black hole. If admin spends the money, there's no record of how much was "platform fee" vs. "teacher earnings."

**Proposed Solution:**
1. Create `teacher_earnings` table: `earning_id UUID PK`, `teacher_id FK`, `course_id FK`, `transaction_id FK`, `amount NUMERIC(14,2)`, `platform_fee NUMERIC(14,2)`, `net_amount NUMERIC(14,2)`, `status VARCHAR(20)` (PENDING, AVAILABLE, PAID), `created_at`
2. Create `payout_requests` table: `payout_id UUID PK`, `teacher_id FK`, `amount NUMERIC(14,2)`, `status VARCHAR(20)` (PENDING, PROCESSING, COMPLETED, REJECTED), `payment_method VARCHAR(50)`, `payment_details JSONB`, `requested_at`, `processed_at`, `admin_notes TEXT`
3. Modify `sp_buy_course_with_wallet` / `sp_enroll_paid_course` to:
   - Split payment: 70% teacher, 30% platform (configurable via `platform_fee_rate` setting)
   - Insert into `teacher_earnings` with `status=PENDING`
   - After 7-day refund window: earnings become `AVAILABLE`
4. Create `POST /api/teachers/payout/request` — teacher requests withdrawal
5. Create `GET /api/admin/payouts` — admin views pending payout requests
6. Create `POST /api/admin/payouts/{id}/process` — admin marks payout as completed

---

#### GAP-1.3 🟡 HIGH — No Streak Freeze / Recovery Mechanics

**Current State:**
- `student_streaks` table tracks `current_streak` and `highest_streak`
- `sync_student_streak()` in `services/gamification.py` implements:
  - Consecutive day → `current_streak += 1`
  - Day missed → `current_streak = 1` (full reset)
- There is **NO streak freeze item**, no "buy back" mechanic, no grace period, no weekend exception.

**The Risk:**
- Streak reset from 365 → 1 because of one missed day is **demotivating and drives churn**. Duolingo's research shows streak freeze items are one of their highest-engagement features.
- Without freeze items, the platform's gamification is punitive rather than encouraging.
- Students who lose a long streak are likely to abandon the platform entirely.

**Proposed Solution:**
1. Add `streak_freeze_count INT DEFAULT 0` to `student_streaks` table
2. Modify streak sync logic:
   - If `last_activity_date == today - 2 days` AND `streak_freeze_count > 0`:
     - Auto-consume 1 freeze → `streak_freeze_count -= 1`
     - Keep streak alive (don't reset to 1)
     - Insert `streak_freeze_usage_log` row
   - If `last_activity_date == today - 2 days` AND `streak_freeze_count == 0`:
     - Reset streak to 1 (current behavior)
3. Create `streak_freeze_usage_log` table for audit
4. Ways to earn freezes:
   - Earn 1 freeze per 7-day streak milestone
   - Purchase freeze from shop (wallet deduction)
   - Freeze as achievement reward
5. Add `POST /api/gamification/streak/buy-freeze` endpoint

---

#### GAP-1.4 🟡 HIGH — No Comment/Review Moderation System

**Current State:**
- `comments` table: `comment_id, lesson_id, user_id, content, created_at` — no moderation columns
- Comments can be created, edited (by owner), deleted (by owner or admin)
- There is **NO flagging mechanism**, no `is_flagged`, `is_hidden`, `moderation_status`, no `reported_comments` table
- `user_feedbacks` table: `feedback_id, user_id, rating, feedback_text, context, created_at` — no moderation either

**The Risk:**
- Any user can post spam, hate speech, or inappropriate content as comments or reviews. There is no reporting mechanism for other users to flag this content.
- Admins have no moderation queue — they'd need to manually browse all lessons to find problematic comments.
- In a Sign Language education platform targeting potentially young learners, content moderation is a **legal and safety requirement**.

**Proposed Solution:**
1. Add moderation columns to `comments`:
   - `is_edited BOOLEAN DEFAULT FALSE`
   - `edited_at TIMESTAMPTZ`
   - `is_hidden BOOLEAN DEFAULT FALSE` (moderator-hidden)
   - `hidden_reason VARCHAR(100)`
2. Create `reported_content` table:
   - `report_id UUID PK`, `content_type VARCHAR(20)` (COMMENT, FEEDBACK), `content_id UUID`, `reported_by UUID FK`, `reason VARCHAR(50)`, `details TEXT`, `status VARCHAR(20)` (PENDING, RESOLVED, DISMISSED), `created_at`, `resolved_by UUID`, `resolved_at`
3. Create `POST /api/comments/{id}/report` — user reports a comment
4. Create `GET /api/admin/moderation/queue` — admin views reported content
5. Create `POST /api/admin/moderation/{report_id}/resolve` — admin hides content or dismisses report
6. Add `edit_history JSONB` to comments for audit trail of edited comments

---

#### GAP-1.5 🟡 HIGH — Course Soft-Delete Does Not Cascade

**Current State:**
- Only `general_courses` has `is_deleted` column (model: `course.py:62`)
- Only `users` has `is_deleted` (model: `user.py:53`)
- Only `dictionary_entries` has `is_deleted` (model: `dictionary.py:51`)
- `general_course_modules`, `general_course_lessons`, `learning_materials` — **NO `is_deleted` column**
- `delete_course()` in `services/course_builder.py:260` only sets `is_deleted = TRUE` on the course row
- When fetching course content (`get_course_content()`), the query does:
  ```sql
  FROM general_courses c WHERE c.course_id = :cid AND c.is_deleted = FALSE
  ```
  But modules/lessons/materials are joined without any `is_deleted` check (they don't have the column).

**The Risk:**
- If a course is soft-deleted, its modules/lessons/materials remain fully accessible through:
  - Direct `GET` requests to lesson/materials endpoints if they have dedicated routes
  - The course content API if the check on course `is_deleted` is bypassed
- When a course is un-deleted (restored), all content is intact — which is the *desired* behavior of soft-delete. But currently, modules/lessons/materials can also be individually hard-deleted via `DELETE` operations, breaking referential integrity for any "restored" course.
- There is no consistency: courses are soft-deleted, but child entities are hard-deleted.

**Proposed Solution:**
1. Add `is_deleted BOOLEAN DEFAULT FALSE` to `general_course_modules`, `general_course_lessons`, `learning_materials`
2. When `delete_course()` sets `is_deleted=TRUE` on a course, also soft-delete all child modules → lessons → materials (cascade via service layer, not DB trigger — we want explicit control)
3. Add `WHERE is_deleted = FALSE` to all content queries that currently don't filter
4. Create `POST /api/courses/{id}/restore` endpoint for admins
5. Ensure `delete_module()`, `delete_lesson()`, `delete_material()` use soft-delete instead of hard `DELETE`
6. Review: `comments` on a soft-deleted lesson should also be hidden

---

#### GAP-1.6 🟡 HIGH — No Course Prerequisites or Learning Paths

**Current State:**
- Courses are standalone entities. No `prerequisites` table or concept.
- A beginner can purchase and start an advanced course without completing foundational content.
- No "learning path" or "curriculum" grouping courses into a recommended sequence.

**The Risk:**
- Poor learning outcomes — students attempt advanced content without foundations, get frustrated, and churn.
- Low course completion rates — without guided paths, students don't know what to take next.
- Missed upsell opportunity — learning paths encourage sequential purchases.

**Proposed Solution:**
1. Create `course_prerequisites` table: `course_id UUID FK`, `prerequisite_course_id UUID FK`, `is_mandatory BOOLEAN DEFAULT TRUE`, PRIMARY KEY (course_id, prerequisite_course_id)
2. Create `learning_paths` table: `path_id INT PK`, `title VARCHAR`, `description TEXT`, `created_at`
3. Create `learning_path_courses` table: `path_id FK`, `course_id FK`, `order_index INT`
4. Add prerequisite check to `POST /api/store/checkout` — block enrollment if mandatory prerequisites not completed
5. Add `GET /api/learning-paths` — list available learning paths
6. API response for course detail includes `prerequisites` and `is_unlocked` fields

---

#### GAP-1.7 🟢 MEDIUM — No Course Preview / "Try Before You Buy"

**Current State:**
- Course content (`get_course_content`) has no auth check for enrollment — but the store endpoint doesn't expose content, just metadata.
- Once purchased, all content is available. There is no "free preview" mechanism (e.g., first lesson free).

**Proposed Solution:**
- Add `is_previewable BOOLEAN DEFAULT FALSE` to `general_course_lessons`
- Teacher can mark specific lessons as free preview
- `GET /api/courses/{id}/preview` returns preview lessons without requiring enrollment

---

#### GAP-1.8 🟢 MEDIUM — No Discussion Forums / Q&A Per Lesson

**Current State:**
- Comments exist per lesson, but they are flat (no threading/replies)
- No way for students to ask questions and have teachers answer them
- No distinction between "comment" and "question"

**Proposed Solution:**
- Add `parent_comment_id UUID` to `comments` table for nested replies
- Add `comment_type VARCHAR(20)` — values: COMMENT, QUESTION, ANSWER
- Teacher can mark a reply as "Instructor Answer" — highlighted in UI

---

#### GAP-1.9 🟢 MEDIUM — No Course Progress Deadlines / Expiry

**Current State:**
- Enrollments are perpetual — once purchased, a student has lifetime access.
- No course expiry, no "complete within N days" requirement.

**Proposed Solution:**
- Add `access_duration_days INT` to `general_courses` (NULL = lifetime access)
- Add `expires_at TIMESTAMPTZ` to `course_enrollments`
- When enrolling: `expires_at = enrolled_at + access_duration_days`
- Cron job: auto-unenroll students after expiry (or mark enrollment `expired`)

---

#### GAP-1.10 🟢 LOW — No Wishlist / Bookmark

**Current State:**
- Students can browse courses but can't save them for later.

**Proposed Solution:**
- Create `wishlists` table: `user_id FK, course_id FK, added_at`, PK (user_id, course_id)
- `POST /api/store/wishlist/{course_id}`, `GET /api/store/wishlist`, `DELETE /api/store/wishlist/{course_id}`

---

### SECTION 2: SECURITY & INTEGRITY

---

#### GAP-2.1 🔴 CRITICAL — No Rate Limiting on Any Endpoint

**Current State:**
- **Zero rate limiting.** No `slowapi`, no custom middleware, no `nginx`-level config in the repo.
- Sensitive endpoints unprotected:
  - `POST /api/auth/admin-login` — brute-force attack surface
  - `POST /api/auth/register` — bot account creation
  - `POST /api/wallet/topup` — potential abuse (though gated by payment gateway in production)
  - `POST /api/store/checkout` — repeated purchase attempts

**The Risk:**
- Brute-force login: attacker can try unlimited passwords against `/api/auth/admin-login`
- Denial of wallet: attacker can flood `/api/wallet/topup` with requests
- Scraping: no limits on `/api/store/courses` or `/api/dictionary/search`
- This is a **blocker for any production deployment**.

**Proposed Solution:**
1. Add `slowapi` to `requirements.txt`: `slowapi>=0.1.9`
2. Configure rate limits in `backend/app/main.py`:
   ```python
   from slowapi import Limiter, _rate_limit_exceeded_handler
   from slowapi.util import get_remote_address
   from slowapi.errors import RateLimitExceeded

   limiter = Limiter(key_func=get_remote_address)
   app.state.limiter = limiter
   app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
   ```
3. Apply limits per endpoint:
   - `/api/auth/admin-login` → `5/minute` per IP
   - `/api/auth/register` → `3/hour` per IP
   - `/api/wallet/topup` → `10/minute` per user
   - `/api/store/checkout` → `5/minute` per user
   - `/api/dictionary/search` → `60/minute` per IP
   - General → `200/minute` per IP

---

#### GAP-2.2 🔴 CRITICAL — No Double-Spending Prevention at API Level

**Current State:**
- `sp_buy_course_with_wallet` uses `SELECT ... FOR UPDATE` on the wallet (DB-level pessimistic lock)
- But the API layer (`checkout_course` in `services/store.py:71`) has:
  ```python
  try:
      await db.execute(text("CALL sp_buy_course_with_wallet(:sid, :cid)"), ...)
      await db.commit()
  except Exception as e:
      await db.rollback()
      ...
  ```
- There is **no idempotency key**. If a client sends the same request twice due to network retry, both could potentially succeed if the first transaction committed before the second started.

**The Risk:**
- The `uq_student_course_enrollment` UNIQUE constraint on `(student_id, course_id)` in `course_enrollments` provides a safety net — the second enrollment insert would fail. But the money transfer (steps 1-3 in the procedure) would already have committed.
- Actually, looking more carefully: the procedure does enrollment insert LAST. If it fails on UNIQUE constraint, the entire procedure rolls back. So the DB-level protection IS in place.
- However: **there is no idempotency key at the API level**. If the response is lost (network error after DB commit), the client retries, and a NEW transaction begins — which would fail on enrollment uniqueness. But the client gets a 500 error instead of a clean "already enrolled" response.
- Also: the procedure does transfer FIRST, then enroll. If another procedure version (like `sp_enroll_paid_course`) is used, the order might change.

**Proposed Solution:**
1. Add `idempotency_key UUID` to `CheckoutRequest` schema
2. Create `idempotency_keys` table: `key UUID PK`, `response JSONB`, `created_at`, `expires_at` (auto-clean after 24h)
3. At API layer, BEFORE calling DB procedure:
   - Check if idempotency_key exists → return cached response
   - If not, insert placeholder, execute transaction, update with response
4. Return `409 Conflict` for "already enrolled" with clear message

---

#### GAP-2.3 🔴 CRITICAL — No Input Sanitization / XSS Prevention

**Current State:**
- `requirements.txt` contains NO HTML sanitization library (`bleach`, `nh3`, or `html-sanitizer`)
- User inputs accepted as raw text:
  - `CommentCreateRequest.content` — stored as-is in `comments.content`
  - `FeedbackCreateRequest.feedback_text` — stored as-is in `user_feedbacks.feedback_text`
  - Course `title`, `description` — stored as-is
  - `LearningMaterial` title, content_url — stored as-is
- No HTML encoding when returning these values to the frontend

**The Risk:**
- If the frontend renders these as HTML (e.g., `dangerouslySetInnerHTML` in React), stored XSS is possible:
  - Attacker posts comment: `<script>fetch('/api/wallet/topup', {method:'POST', body:...})</script>`
  - Other students viewing the lesson execute the script
  - Session keys could be stolen, wallets drained
- Even if the frontend uses React (which escapes by default), `dangerouslySetInnerHTML` or markdown renderers could bypass this
- Course descriptions likely NEED to support rich text (bold, links, images) — which requires a sanitization strategy, not just blanket rejection

**Proposed Solution:**
1. Add `nh3>=0.2.0` (Rust-based HTML sanitizer, fast) or `bleach>=6.0` to `requirements.txt`
2. Create `backend/app/core/sanitizer.py`:
   ```python
   import nh3

   ALLOWED_TAGS = {'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'img', 'h1', 'h2', 'h3'}
   ALLOWED_ATTRIBUTES = {'a': {'href', 'title'}, 'img': {'src', 'alt'}}

   def sanitize_html(text: str) -> str:
       return nh3.clean(text, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES)

   def sanitize_plain_text(text: str) -> str:
       """Strip ALL HTML, keep only text."""
       return nh3.clean(text, tags=set())
   ```
3. Apply sanitization:
   - Comments → `sanitize_plain_text()` (no HTML allowed)
   - Feedback → `sanitize_plain_text()`
   - Course descriptions → `sanitize_html()` (limited rich text)
   - Course titles → `sanitize_plain_text()` (no markup)
4. Add Pydantic validator to relevant schemas that auto-sanitizes on deserialization

---

#### GAP-2.4 🟡 HIGH — Audit Logs Missing Forensic Data

**Current State:**
- `audit_logs` table schema: `audit_id, run_id, action VARCHAR(50), status VARCHAR(20), error_message TEXT, created_at`
- `log` table: `log_id, action TEXT, created_at`
- **Missing columns:** `ip_address`, `user_agent`, `user_id`, `request_path`, `request_method`, `request_payload`

**The Risk:**
- In case of a security incident (e.g., unauthorized wallet access), there is no forensic trail.
- Admin cannot answer: "Which IP address topped up this wallet?" or "What User-Agent was used for this suspicious login?"
- `audit_logs.action` is `VARCHAR(50)` — too short for meaningful audit messages. The blueprint itself calls this out as a design flaw.

**Proposed Solution:**
1. Expand `audit_logs` schema:
   ```sql
   ALTER TABLE audit_logs ADD COLUMN user_id UUID REFERENCES users(user_id);
   ALTER TABLE audit_logs ADD COLUMN ip_address INET;
   ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
   ALTER TABLE audit_logs ADD COLUMN request_path VARCHAR(255);
   ALTER TABLE audit_logs ADD COLUMN request_method VARCHAR(10);
   ALTER TABLE audit_logs ADD COLUMN request_payload JSONB;
   -- Fix the too-short column:
   ALTER TABLE audit_logs ALTER COLUMN action TYPE TEXT;
   ```
2. Create middleware `backend/app/core/audit_middleware.py`:
   ```python
   from fastapi import Request
   from app.core.database import async_session
   import uuid, json

   async def audit_request(request: Request, user_id: str | None, action: str, status: str, error: str | None = None):
       async with async_session() as db:
           await db.execute(text("""
               INSERT INTO audit_logs (run_id, user_id, action, status, error_message,
                                       ip_address, user_agent, request_path, request_method, request_payload)
               VALUES (:run_id, :user_id, :action, :status, :error,
                       :ip, :ua, :path, :method, :payload)
           """), {
               "run_id": uuid.uuid4(),
               "user_id": user_id,
               "action": action,
               "status": status,
               "error": error,
               "ip": request.client.host if request.client else None,
               "ua": request.headers.get("User-Agent", "")[:500],
               "path": str(request.url.path),
               "method": request.method,
               "payload": json.dumps({"query_params": str(request.query_params)}) if request.method == "GET" else None,
           })
           await db.commit()
   ```
3. Inject audit logging into all sensitive operations (login, topup, checkout, refund, ban)

---

#### GAP-2.5 🟡 HIGH — Exposed Database Errors to Clients

**Current State:**
- No global exception handler in `main.py` for `sqlalchemy.exc.IntegrityError` or `asyncpg.exceptions.UniqueViolationError`
- Many endpoints catch generic `Exception` and return `HTTPException(500, str(e))` — exposing raw DB error messages
- Example from `store.py:43`: `raise HTTPException(500, str(e))` — could leak table names, constraint names, SQL fragments

**The Risk:**
- Information disclosure: attackers can learn DB schema by triggering constraint violations
- Bad UX: users see "duplicate key value violates unique constraint uq_student_course_enrollment" instead of "Bạn đã đăng ký khóa học này"
- Inconsistent error format across endpoints

**Proposed Solution:**
1. Create `backend/app/core/error_handlers.py`:
   ```python
   from fastapi import Request, HTTPException
   from fastapi.responses import JSONResponse
   from sqlalchemy.exc import IntegrityError
   from asyncpg.exceptions import UniqueViolationError, ForeignKeyViolationError

   async def integrity_error_handler(request: Request, exc: IntegrityError):
       orig = str(exc.orig) if exc.orig else str(exc)
       if "uq_student_course_enrollment" in orig:
           return JSONResponse(status_code=409, content={"detail": "Bạn đã đăng ký khóa học này"})
       if "uq_" in orig:
           return JSONResponse(status_code=409, content={"detail": "Dữ liệu đã tồn tại"})
       if "fk_" in orig or "foreign key" in orig.lower():
           return JSONResponse(status_code=400, content={"detail": "Dữ liệu tham chiếu không tồn tại"})
       # Log the real error for debugging
       import logging
       logging.getLogger("app").error(f"IntegrityError: {orig}")
       return JSONResponse(status_code=500, content={"detail": "Lỗi hệ thống, vui lòng thử lại"})

   async def generic_exception_handler(request: Request, exc: Exception):
       import logging, uuid
       error_id = str(uuid.uuid4())[:8]
       logging.getLogger("app").error(f"[{error_id}] Unhandled: {exc}", exc_info=True)
       return JSONResponse(
           status_code=500,
           content={"detail": f"Lỗi hệ thống (ID: {error_id}). Vui lòng liên hệ hỗ trợ."}
       )
   ```
2. Register handlers in `main.py`:
   ```python
   from sqlalchemy.exc import IntegrityError
   from app.core.error_handlers import integrity_error_handler, generic_exception_handler
   app.add_exception_handler(IntegrityError, integrity_error_handler)
   app.add_exception_handler(Exception, generic_exception_handler)
   ```

---

#### GAP-2.6 🟢 MEDIUM — No Session Expiry Enforcement on Sensitive Operations

**Current State:**
- Sessions are checked via `get_current_user()` / `get_current_admin()` dependency
- But there's no "re-authenticate for sensitive operations" flow
- `POST /api/wallet/topup`, `POST /api/store/checkout` — no extra confirmation

**Proposed Solution:**
- For wallet operations > 1,000,000 VND: require OTP or password re-entry
- Add `confirmation_token` field to `TopupRequest` and `CheckoutRequest` (generated server-side, short TTL)

---

#### GAP-2.7 🟢 MEDIUM — No CORS Restriction in Production

**Current State:**
- `main.py:41`: `allow_origins=["*"]` — all origins allowed
- This is intentional (matching Go's config) but dangerous for production

**Proposed Solution:**
- Make `allow_origins` configurable via `settings.CORS_ORIGINS` (comma-separated list)
- Default to `["*"]` in dev, `["https://elearning.example.com"]` in production

---

#### GAP-2.8 🟢 LOW — Passwords Have No Minimum Strength Validation

**Current State:**
- `RegisterRequest` schema accepts any non-empty password
- No minimum length, no complexity requirements

**Proposed Solution:**
- Add `min_length=8` and complexity regex to `RegisterRequest.password` field

---

### SECTION 3: ARCHITECTURE & PERFORMANCE

---

#### GAP-3.1 🔴 CRITICAL — No Background Task Queue

**Current State:**
- `requirements.txt` has no task queue library (Celery, arq, RQ, etc.)
- All operations are synchronous request/response
- No background processing for:
  - Sending email notifications to inactive students (detected by `vw_inactive_students`)
  - Processing/transcoding sign language videos after upload
  - Generating PDF certificates
  - Periodic streak reset at midnight
  - Sending push notifications
  - Computing analytics / materialized view refresh

**The Risk:**
- Video uploads block the API response — user waits for upload + processing before getting a response
- Email sending failures block the API response (or emails are silently not sent)
- Certificate PDF generation (potentially 2-5 seconds) blocks the API
- Periodic tasks are run in the FastAPI lifespan asyncio loop — if the app restarts, in-flight tasks are lost
- No retry mechanism for failed jobs

**Proposed Solution:**
1. Add `arq>=0.26.0` to `requirements.txt` (arq = Async Redis Queue, native asyncio, no Celery complexity)
2. Create `backend/app/worker.py` — arq worker entry point:
   ```python
   from arq import create_pool
   from arq.connections import RedisSettings

   async def send_inactive_student_email(ctx, student_id: str, course_title: str):
       # Send email via SMTP / SendGrid
       ...

   async def generate_certificate_pdf(ctx, certificate_id: str):
       # Generate PDF via weasyprint, upload to S3, update DB
       ...

   async def process_video_upload(ctx, video_id: str, source_path: str):
       # Transcode video, generate thumbnails, upload to CDN
       ...

   class WorkerSettings:
       functions = [
           send_inactive_student_email,
           generate_certificate_pdf,
           process_video_upload,
       ]
       redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
   ```
3. Enqueue jobs from API endpoints:
   ```python
   from arq import create_pool
   redis = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
   await redis.enqueue_job('generate_certificate_pdf', certificate_id)
   ```
4. Run worker: `arq backend.app.worker.WorkerSettings`

---

#### GAP-3.2 🟡 HIGH — No Email Notification Pipeline

**Current State:**
- `vw_inactive_students` identifies students who haven't studied in 30+ days
- But there is **no code that sends them an email** — the view is just displayed to admins
- `notification_users` table stores in-app notifications only (must be actively checked by user)
- No SMTP configuration, no email templates, no SendGrid/Mailgun integration

**The Risk:**
- Inactive students churn silently — no re-engagement mechanism
- No welcome email after registration
- No "course completed" / "certificate earned" email
- No transaction receipt email after purchase
- Email is the primary re-engagement channel for E-Learning — without it, retention is purely organic

**Proposed Solution:**
1. Add `aiohttp` (already in deps as transitive) for SendGrid/Mailgun API calls
2. Create `backend/app/core/email.py`:
   ```python
   import aiohttp
   from app.core.config import settings

   async def send_email(to: str, subject: str, html_body: str) -> bool:
       async with aiohttp.ClientSession() as session:
           async with session.post(
               "https://api.sendgrid.com/v3/mail/send",
               headers={"Authorization": f"Bearer {settings.SENDGRID_API_KEY}"},
               json={...}
           ) as resp:
               return resp.status == 202
   ```
3. Create arq job: `send_inactive_student_email` — triggered by cron
4. Email templates: Jinja2 HTML templates in `backend/app/templates/email/`
5. Trigger emails from service layer:
   - Registration → welcome email (queued)
   - Purchase → receipt email (queued)
   - Course completed → certificate email (queued)
   - 7 days inactive → "We miss you" email (queued from cron)

---

#### GAP-3.3 🟡 HIGH — Inconsistent Error Handling Across Endpoints

**Current State:**
- Some endpoints catch exceptions and return structured messages, others let exceptions propagate
- Store endpoints use custom `StoreError` exception → caught in route handler → `HTTPException(e.status_code, e.message)`
- Auth endpoints use `AuthError` → caught in route handler
- But `course_builder` endpoints raise `ValueError` → caught as `HTTPException(404, str(e))` — inconsistent
- `comment.py` catches `ValueError` → `HTTPException(403, str(e))` — 403 is wrong for "comment not found"

**Proposed Solution:**
1. Consistent exception hierarchy:
   ```python
   class AppError(Exception):
       def __init__(self, message: str, status_code: int = 400, error_code: str = "UNKNOWN"):
           self.message = message
           self.status_code = status_code
           self.error_code = error_code

   class NotFoundError(AppError):
       def __init__(self, entity: str, identifier: str):
           super().__init__(f"{entity} không tồn tại: {identifier}", 404, f"{entity.upper()}_NOT_FOUND")

   class ForbiddenError(AppError):
       def __init__(self, message: str = "Bạn không có quyền thực hiện hành động này"):
           super().__init__(message, 403, "FORBIDDEN")

   class ConflictError(AppError):
       def __init__(self, message: str):
           super().__init__(message, 409, "CONFLICT")

   class ValidationError(AppError):
       def __init__(self, message: str):
           super().__init__(message, 400, "VALIDATION_ERROR")
   ```
2. Single global exception handler for `AppError`:
   ```python
   @app.exception_handler(AppError)
   async def app_error_handler(request: Request, exc: AppError):
       return JSONResponse(
           status_code=exc.status_code,
           content={"detail": exc.message, "error_code": exc.error_code}
       )
   ```
3. Replace all `ValueError` raises in services with appropriate `AppError` subclass

---

#### GAP-3.4 🟢 MEDIUM — No Request Correlation ID

**Current State:**
- No `X-Request-ID` header or correlation ID in logs
- Difficult to trace a request across service calls in logs

**Proposed Solution:**
- Middleware that generates `X-Request-ID` (UUID) if not present, injects into request state + response headers
- Log all messages with `[request_id]` prefix

---

#### GAP-3.5 🟢 MEDIUM — Static File Serving Not Configured

**Current State:**
- No `/static/` or `/media/` mount in FastAPI
- Video files, images, certificate PDFs have URLs in DB but no serving mechanism

**Proposed Solution:**
- In development: mount `StaticFiles` for local media
- In production: all media URLs point to CDN (see Plan 5); no local serving needed

---

#### GAP-3.6 🟢 LOW — No Health Check Beyond Simple DB Ping

**Current State:**
- `GET /api/health` returns `{"status": "ok", "message": "..."}`
- No Redis health check, no DB pool check, no memory/CPU metrics

**Proposed Solution:**
- Extend health check (already partially in Plan 6) to include Redis ping, DB connection pool stats, and memory usage

---

### SECTION 4: DATABASE DESIGN

---

#### GAP-4.1 🟡 HIGH — Missing Soft-Delete Columns on Child Tables

**Current State:**
- `is_deleted` exists on: `users`, `general_courses`, `dictionary_entries`
- `is_deleted` MISSING on: `general_course_modules`, `general_course_lessons`, `learning_materials`, `comments`, `user_feedbacks`, `microlearning_topics`, `microlearning_units`, `microlearning_lessons`, `microlearning_lesson_parts`, `microlearning_questions`

**The Risk:**
- Soft-deleting a course leaves orphaned modules/lessons that are still accessible
- Hard-deleting a lesson loses all associated comments permanently — no recovery
- Audit trail is incomplete — can't tell "who deleted this lesson and when"

**Proposed Solution:**
1. Add to ALL content tables:
   ```sql
   is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
   deleted_at TIMESTAMPTZ,
   deleted_by UUID REFERENCES users(user_id)
   ```
2. Update all content queries to include `WHERE is_deleted = FALSE`
3. See GAP-1.5 for cascade soft-delete logic

---

#### GAP-4.2 🟡 HIGH — No Soft-Delete Cleanup Pipeline

**Current State:**
- Soft-deleted records stay in the database forever
- No cron job to hard-delete records soft-deleted > 30 days ago
- No retention policy for audit logs or system logs

**The Risk:**
- Database grows unbounded with deleted data
- GDPR/privacy concern: soft-deleted user data should be hard-deleted after a retention period

**Proposed Solution:**
1. Create `backend/app/core/cleanup.py` with arq cron job:
   ```sql
   -- Hard-delete soft-deleted records older than 30 days
   DELETE FROM general_courses WHERE is_deleted = TRUE AND deleted_at < NOW() - INTERVAL '30 days';
   DELETE FROM users WHERE is_deleted = TRUE AND deleted_at < NOW() - INTERVAL '90 days';  -- Users: 90 days for legal holds
   DELETE FROM comments WHERE is_deleted = TRUE AND deleted_at < NOW() - INTERVAL '30 days';
   ```
2. Schedule via arq cron: `@cron(hour=3, minute=0)` — runs daily at 3 AM

---

#### GAP-4.3 🟢 MEDIUM — Missing Index on Frequently Filtered Columns

**Current State Audit:**
| Query Pattern | Current Index? | Status |
|--------------|----------------|--------|
| `comments WHERE lesson_id` | None (only FK constraint, which is NOT auto-indexed in PostgreSQL) | ❌ |
| `comments WHERE user_id` | None | ❌ |
| `user_feedbacks WHERE user_id` | None (only FK) | ❌ |
| `user_feedbacks WHERE context` (LIKE search) | None | ❌ |
| `course_enrollments WHERE course_id` | None (only FK) | ❌ |
| `notification_users WHERE user_id, is_read` | None (only FK) | ❌ |
| `authentication_sessions WHERE expires_at` | None | ❌ |
| `transaction_logs WHERE from_wallet_user_id, status` | None | ❌ |
| `transaction_logs WHERE to_wallet_user_id, status` | None | ❌ |

**Note from audit:** PostgreSQL does NOT auto-create indexes on Foreign Key columns. FK constraints ensure referential integrity but do NOT speed up queries. Many of these columns are in WHERE clauses of service queries but have no indexes.

**Proposed Solution:**
```sql
-- Content access patterns
CREATE INDEX idx_comments_lesson ON comments (lesson_id, created_at DESC);
CREATE INDEX idx_comments_user ON comments (user_id, created_at DESC);
CREATE INDEX idx_feedbacks_user ON user_feedbacks (user_id, created_at DESC);

-- Enrollment lookups
CREATE INDEX idx_enrollments_course ON course_enrollments (course_id);

-- Notification polling
CREATE INDEX idx_notifications_user_unread
ON notification_users (user_id, created_at DESC)
WHERE is_read = FALSE;

-- Session cleanup
CREATE INDEX idx_sessions_expires ON authentication_sessions (expires_at);

-- Transaction lookups
CREATE INDEX idx_tx_logs_from_user ON transaction_logs (from_wallet_user_id, status, created_at DESC);
CREATE INDEX idx_tx_logs_to_user ON transaction_logs (to_wallet_user_id, status, created_at DESC);
```

---

#### GAP-4.4 🟢 MEDIUM — `comments` Table Missing Edit Tracking

**Current State:**
- `comments` table: `comment_id, lesson_id, user_id, content, created_at`
- `update_comment()` in `services/comment.py:64` updates `content` but doesn't record the edit
- No `updated_at`, no `is_edited` flag, no edit history

**Proposed Solution:**
```sql
ALTER TABLE comments ADD COLUMN updated_at TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE comments ADD COLUMN edit_history JSONB;  -- [{content: "...", edited_at: "..."}]
```

---

## Actionable Blueprints — Top 5 Most Critical Missing Features

These are the 5 gaps that would have the highest impact on making this a production-grade platform.

---

### Blueprint A: Certificate Issuance & Verification System

**Priority:** 🔴 CRITICAL  
**Effort:** 8 hours  
**Dependencies:** Background tasks (arq) for PDF generation

#### Database Changes

```sql
-- Migration: create certificates table
CREATE TABLE certificates (
    certificate_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    course_id        UUID NOT NULL REFERENCES general_courses(course_id) ON DELETE RESTRICT,
    enrollment_id    UUID REFERENCES course_enrollments(enrollment_id),
    certificate_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 for public verification
    status           VARCHAR(20) NOT NULL DEFAULT 'ISSUED'
                     CHECK (status IN ('ISSUED', 'REVOKED')),
    metadata         JSONB,
    certificate_url  TEXT,          -- S3/CDN URL of PDF
    issued_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at       TIMESTAMPTZ,
    revoked_reason   TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_cert_student_course UNIQUE (student_id, course_id)
);

-- Verification lookup index
CREATE INDEX idx_certificates_hash ON certificates (certificate_hash);
CREATE INDEX idx_certificates_student ON certificates (student_id);
```

#### New API Endpoints

```python
# POST /api/courses/{course_id}/certificate/issue
#   Auth: Student
#   Body: {}
#   Logic:
#     1. Check fn_check_certificate_eligibility(student_id, course_id) == TRUE
#     2. Check certificates table — already issued? → return existing
#     3. Generate certificate_hash = SHA256(f"{student_id}:{course_id}:{issued_at}:{SECRET_KEY}")
#     4. INSERT INTO certificates
#     5. Enqueue background job: generate_certificate_pdf
#     6. Return {certificate_id, certificate_hash, verification_url}

# GET /api/certificates/verify/{certificate_hash}
#   Auth: None (public)
#   Logic:
#     1. SELECT * FROM certificates WHERE certificate_hash = :hash AND status = 'ISSUED'
#     2. Return {student_name, course_title, issued_at, status, certificate_url}

# GET /api/certificates/{certificate_id}/download
#   Auth: Student (owner only) or Public (if status=ISSUED)
#   Logic: Redirect to certificate_url (S3 signed URL)

# POST /api/admin/certificates/{certificate_id}/revoke
#   Auth: Admin
#   Body: {reason: "..."}
#   Logic: UPDATE certificates SET status='REVOKED', revoked_at=NOW(), revoked_reason=:reason
```

#### Service Layer

```python
# backend/app/services/certificate.py (extend existing)

import hashlib
from app.core.config import settings

def generate_certificate_hash(student_id: str, course_id: str, issued_at: datetime) -> str:
    """SHA-256 hash for public verification. Includes secret key to prevent forgery."""
    payload = f"{student_id}:{course_id}:{issued_at.isoformat()}:{settings.SECRET_KEY}"
    return hashlib.sha256(payload.encode()).hexdigest()

async def issue_certificate(db: AsyncSession, student_id: str, course_id: str) -> dict:
    # 1. Check eligibility
    eligible = await db.execute(
        text("SELECT fn_check_certificate_eligibility(:sid, :cid)"),
        {"sid": student_id, "cid": course_id}
    )
    if not eligible.scalar():
        raise ConflictError("Bạn chưa hoàn thành khóa học này")

    # 2. Check existing
    existing = await db.execute(
        text("SELECT certificate_id, certificate_hash FROM certificates WHERE student_id = :sid AND course_id = :cid AND status = 'ISSUED'"),
        {"sid": student_id, "cid": course_id}
    )
    existing_row = existing.mappings().first()
    if existing_row:
        return dict(existing_row)

    # 3. Issue new certificate
    issued_at = datetime.now(timezone.utc)
    cert_hash = generate_certificate_hash(student_id, course_id, issued_at)

    # Get enrollment_id
    enrollment = await db.execute(
        text("SELECT enrollment_id FROM course_enrollments WHERE student_id = :sid AND course_id = :cid"),
        {"sid": student_id, "cid": course_id}
    )
    enrollment_id = enrollment.scalar()

    result = await db.execute(
        text("""
            INSERT INTO certificates (student_id, course_id, enrollment_id, certificate_hash, metadata)
            VALUES (:sid, :cid, :eid, :hash, :meta)
            RETURNING certificate_id::text, certificate_hash, issued_at
        """),
        {
            "sid": student_id, "cid": course_id, "eid": enrollment_id,
            "hash": cert_hash,
            "meta": json.dumps({"generated_by": "api", "version": "1.0"})
        }
    )
    cert = dict(result.mappings().first())
    await db.commit()

    # 4. Enqueue PDF generation
    # await redis.enqueue_job('generate_certificate_pdf', cert["certificate_id"])

    cert["verification_url"] = f"/api/certificates/verify/{cert_hash}"
    return cert
```

---

### Blueprint B: Teacher Payout System

**Priority:** 🔴 CRITICAL  
**Effort:** 10 hours  
**Dependencies:** `sp_transfer_funds` (from Plan 3), `sp_enroll_paid_course` (from Plan 3)

#### Database Changes

```sql
-- Teacher earnings ledger
CREATE TABLE teacher_earnings (
    earning_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES teachers(user_id),
    course_id       UUID NOT NULL REFERENCES general_courses(course_id),
    transaction_id  UUID NOT NULL REFERENCES transaction_logs(transaction_id),
    gross_amount    NUMERIC(14,2) NOT NULL,  -- total from student
    platform_fee    NUMERIC(14,2) NOT NULL,  -- platform commission
    net_amount      NUMERIC(14,2) NOT NULL,  -- teacher's cut
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'AVAILABLE', 'PAID', 'FORFEITED')),
    available_at    TIMESTAMPTZ,  -- when refund window expires
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_earnings_positive CHECK (net_amount >= 0)
);

-- Payout requests
CREATE TABLE payout_requests (
    payout_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES teachers(user_id),
    amount          NUMERIC(14,2) NOT NULL,
    fee             NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_payout      NUMERIC(14,2) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED')),
    payment_method  VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER',
    payment_details JSONB,  -- {bank_name, account_number, account_name}
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at    TIMESTAMPTZ,
    processed_by    UUID REFERENCES users(user_id),
    admin_notes     TEXT,

    CONSTRAINT ck_payout_positive CHECK (amount > 0)
);

-- Platform fee configuration
CREATE TABLE platform_config (
    config_key   VARCHAR(50) PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO platform_config VALUES
    ('platform_fee_rate', '0.30'),      -- 30% platform fee
    ('payout_refund_window_days', '7'),  -- earnings available after 7 days
    ('minimum_payout_amount', '100000');  -- 100,000 VND minimum withdrawal
```

#### Modified Purchase Flow

```sql
-- Override sp_buy_course_with_wallet to record teacher earnings
-- (Or add earnings recording to sp_enroll_paid_course from Plan 3)
CREATE OR REPLACE PROCEDURE sp_buy_course_with_wallet_v2(
    p_student UUID, p_course UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_price NUMERIC;
    v_teacher UUID;
    v_admin UUID;
    v_tx_id UUID;
    v_platform_fee_rate NUMERIC;
    v_platform_fee NUMERIC;
    v_teacher_net NUMERIC;
BEGIN
    -- ... existing validation ...

    -- Get platform fee rate
    SELECT config_value::numeric INTO v_platform_fee_rate
    FROM platform_config WHERE config_key = 'platform_fee_rate';

    -- Calculate split
    v_platform_fee := ROUND(v_price * v_platform_fee_rate, 2);
    v_teacher_net := v_price - v_platform_fee;

    -- Transfer: student → admin (platform fee) + teacher (net earnings)
    -- Student pays full price to admin
    UPDATE wallets SET balance = balance - v_price WHERE user_id = p_student;
    UPDATE wallets SET balance = balance + v_price WHERE user_id = v_admin;

    -- Record transaction
    INSERT INTO transaction_logs (from_wallet_user_id, to_wallet_user_id, amount, status, message, related_course_id)
    VALUES (p_student, v_admin, v_price, 'SUCCESS', 'Mua khóa học', p_course)
    RETURNING transaction_id INTO v_tx_id;

    -- Record teacher earnings
    INSERT INTO teacher_earnings (teacher_id, course_id, transaction_id, gross_amount, platform_fee, net_amount)
    VALUES (v_teacher, p_course, v_tx_id, v_price, v_platform_fee, v_teacher_net);

    -- Enroll student
    INSERT INTO course_enrollments (student_id, course_id, progress) VALUES (p_student, p_course, 0.00);
END;
$$;
```

#### New API Endpoints

```
GET    /api/teachers/earnings          — Teacher views their earnings summary
GET    /api/teachers/earnings/detail   — Paginated earning transactions
POST   /api/teachers/payout/request    — Request withdrawal
GET    /api/teachers/payout/history    — View payout history
GET    /api/admin/payouts              — Admin: pending payout queue
POST   /api/admin/payouts/{id}/process — Admin: mark payout completed
POST   /api/admin/payouts/{id}/reject  — Admin: reject payout
```

---

### Blueprint C: Rate Limiting Layer

**Priority:** 🔴 CRITICAL  
**Effort:** 3 hours  
**Dependencies:** None

#### Implementation

```python
# requirements.txt addition
# slowapi>=0.1.9

# backend/app/main.py
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    storage_uri="redis://localhost:6379/1" if settings.REDIS_ENABLED else "memory://",
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# Per-endpoint limits (in route files):
from slowapi import Limiter
from fastapi import Request

# auth.py
@router.post("/admin-login")
@limiter.limit("5/minute")  # 5 attempts per minute per IP
async def admin_login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ...

# store.py
@router.post("/api/wallet/topup")
@limiter.limit("10/minute")  # 10 topups per minute per IP
async def topup_wallet(req: TopupRequest, request: Request, ...):
    ...

@router.post("/api/store/checkout")
@limiter.limit("10/minute")  # 10 purchases per minute per user
async def checkout_course(req: CheckoutRequest, request: Request, ...):
    ...
```

---

### Blueprint D: Input Sanitization Layer

**Priority:** 🔴 CRITICAL  
**Effort:** 3 hours  
**Dependencies:** None

#### Implementation

```python
# requirements.txt addition
# nh3>=0.2.9

# backend/app/core/sanitizer.py
import nh3

# For rich-text fields (course descriptions, material content)
ALLOWED_TAGS_RICH = {
    'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'span'
}
ALLOWED_ATTRIBUTES_RICH = {
    'a': {'href', 'title', 'target', 'rel'},
    'span': {'class'},
}
# Enforce: no javascript:, no onclick, no style
URL_ATTRIBUTES = {'href', 'src'}

def sanitize_rich_text(text: str) -> str:
    """Sanitize rich text — allows formatting, strips scripts and event handlers."""
    if not text:
        return text
    cleaned = nh3.clean(
        text,
        tags=ALLOWED_TAGS_RICH,
        attributes=ALLOWED_ATTRIBUTES_RICH,
        url_schemes={'http', 'https', 'mailto'},  # NO javascript:
    )
    return cleaned

def sanitize_plain_text(text: str) -> str:
    """Strip ALL HTML tags — plain text only."""
    if not text:
        return text
    return nh3.clean(text, tags=set())

# Pydantic validator for schemas:
from pydantic import field_validator

class CommentCreateRequest(BaseModel):
    content: str = Field(min_length=1)

    @field_validator('content')
    @classmethod
    def sanitize_content(cls, v: str) -> str:
        return sanitize_plain_text(v)

class FeedbackCreateRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback_text: str = ""

    @field_validator('feedback_text')
    @classmethod
    def sanitize_feedback(cls, v: str) -> str:
        return sanitize_plain_text(v)
```

---

### Blueprint E: Background Task Queue (arq)

**Priority:** 🔴 CRITICAL  
**Effort:** 6 hours  
**Dependencies:** Redis (already configured)

#### Implementation

```python
# requirements.txt addition
# arq>=0.26.0

# backend/app/worker.py
import asyncio
from arq import create_pool
from arq.connections import RedisSettings, ArqRedis
from dataclasses import dataclass

@dataclass
class WorkerSettings:
    """arq worker configuration."""
    redis_settings: RedisSettings = RedisSettings(
        host="localhost", port=6379, database=0
    )
    max_jobs: int = 20
    job_timeout: int = 300  # 5 minutes
    keep_result: int = 3600  # Keep results for 1 hour
    poll_delay: float = 0.5

    # Register job functions here
    functions: list = None

    def __post_init__(self):
        if self.functions is None:
            from app.worker import (
                send_email_job,
                generate_certificate_pdf_job,
                process_video_job,
                cleanup_soft_deleted_job,
            )
            self.functions = [
                send_email_job,
                generate_certificate_pdf_job,
                process_video_job,
                cleanup_soft_deleted_job,
            ]


# ── Job Functions ──

async def send_email_job(ctx, to: str, subject: str, html_body: str) -> dict:
    """Send transactional email via SendGrid."""
    # ... email sending logic ...
    return {"sent": True, "to": to}

async def generate_certificate_pdf_job(ctx, certificate_id: str) -> dict:
    """Generate PDF certificate and upload to S3."""
    from app.core.database import async_session
    # 1. Fetch certificate data from DB
    # 2. Render HTML template with student/course info
    # 3. Convert HTML to PDF via weasyprint
    # 4. Upload to S3
    # 5. Update certificates SET certificate_url
    return {"certificate_id": certificate_id, "url": "https://..."}

async def process_video_job(ctx, video_id: str, source_path: str) -> dict:
    """Transcode sign language video, generate thumbnails."""
    # ... video processing ...
    return {"video_id": video_id, "status": "processed"}

async def cleanup_soft_deleted_job(ctx) -> dict:
    """Hard-delete records soft-deleted > 30 days ago."""
    from app.core.database import async_session
    from sqlalchemy import text
    async with async_session() as db:
        results = {}
        for table in ['general_courses', 'comments', 'user_feedbacks']:
            result = await db.execute(text(f"""
                DELETE FROM {table}
                WHERE is_deleted = TRUE AND deleted_at < NOW() - INTERVAL '30 days'
            """))
            results[table] = result.rowcount
        await db.commit()
    return results


# ── Client Helper ──

_pool: ArqRedis | None = None

async def get_arq_pool() -> ArqRedis:
    global _pool
    if _pool is None:
        from app.core.config import settings
        _pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    return _pool

async def enqueue_job(job_name: str, *args, **kwargs):
    """Enqueue a background job. Non-blocking."""
    pool = await get_arq_pool()
    return await pool.enqueue_job(job_name, *args, **kwargs)


# ── Cron Jobs (scheduled via arq) ──

async def schedule_cron_jobs():
    """Register recurring jobs. Called at worker startup."""
    pool = await get_arq_pool()

    # Cleanup soft-deleted records every day at 3 AM
    await pool.enqueue_job('cleanup_soft_deleted_job', _defer_by=seconds_until(3, 0))

    # Refresh leaderboard every 5 minutes
    # (Already handled by FastAPI lifespan in Plan 1)

    # Check inactive students every Monday at 8 AM
    # await pool.enqueue_job('send_inactive_student_emails', _defer_by=...)


# Run worker:
# $ arq backend.app.worker.WorkerSettings
```

---

## Implementation Priority Matrix

| Order | Blueprint / Gap | Impact | Effort | Dependencies |
|-------|----------------|--------|--------|--------------|
| 1 | **GAP-2.3** Input Sanitization | Prevents XSS | 3h | None |
| 2 | **GAP-2.1** Rate Limiting | Prevents abuse | 3h | None |
| 3 | **GAP-2.5** Error Handling | Production stability | 2h | None |
| 4 | **GAP-1.5** Soft-Delete Cascade | Data integrity | 4h | None |
| 5 | **GAP-3.1** Background Tasks | Foundation for all async ops | 6h | Redis |
| 6 | **GAP-1.1** Certificate System | Core product value | 8h | Background tasks |
| 7 | **GAP-1.2** Teacher Payouts | Marketplace viability | 10h | sp_transfer_funds |
| 8 | **GAP-2.4** Audit Trail Forensics | Security compliance | 3h | None |
| 9 | **GAP-4.3** Missing FK Indexes | Query performance | 2h | None |
| 10 | **GAP-1.4** Comment Moderation | Content safety | 5h | None |
| 11 | **GAP-1.3** Streak Freeze | Engagement | 4h | None |
| 12 | **GAP-3.2** Email Pipeline | Retention | 5h | Background tasks |
| 13-28 | Remaining gaps | Various | ~20h | Various |

**Total estimated effort for all 28 gaps: ~75 hours (~9 days)**

---

## Files Manifest — All New/Modified Files

### New Files (14)

```
backend/app/core/
├── sanitizer.py              # HTML sanitization (GAP-2.3)
├── error_handlers.py         # Global exception handlers (GAP-2.5)
├── email.py                  # Email sending via SendGrid (GAP-3.2)
├── audit_middleware.py       # Request audit logging (GAP-2.4)
└── cleanup.py                # Soft-delete cleanup (GAP-4.2)

backend/app/
├── worker.py                 # arq background worker (GAP-3.1)

backend/app/models/
├── certificate.py            # Certificate model (GAP-1.1)
├── payout.py                 # TeacherEarning + PayoutRequest models (GAP-1.2)
├── moderation.py             # ReportedContent model (GAP-1.4)
└── learning_path.py          # LearningPath + Prerequisites (GAP-1.6)

backend/alembic/versions/
├── XXXX_create_certificates_table.py
├── XXXX_create_teacher_earnings.py
├── XXXX_create_moderation_tables.py
├── XXXX_add_soft_delete_to_child_tables.py
└── XXXX_add_missing_fk_indexes.py
```

### Modified Files (12)

```
backend/
├── requirements.txt          # Add: slowapi, nh3, arq, weasyprint
├── app/main.py               # Rate limiter, exception handlers, health endpoint
├── app/core/config.py        # Add CORS_ORIGINS, SENDGRID_API_KEY, PLATFORM_FEE_RATE
├── app/schemas/store.py      # Add idempotency_key to CheckoutRequest
├── app/schemas/course.py     # Add field_validator for sanitization
├── app/schemas/auth.py       # Add password min_length=8
├── app/services/store.py     # Idempotency check, teacher earnings recording
├── app/services/certificate.py   # Issue certificate, verification
├── app/services/comment.py   # Add is_edited tracking, sanitization
├── app/services/course_builder.py  # Soft-delete cascade
├── app/api/router.py         # Add new routers
└── app/models/__init__.py    # Import new models
```

---

## Related Documents

- [`MASTER_PLAN_INDEX.md`](MASTER_PLAN_INDEX.md) — Database optimization implementation plans (Plans 1-6)
- [`Ke_hoach_ap_dung_HQTCSDL_Elearning.md`](Ke_hoach_ap_dung_HQTCSDL_Elearning.md) — Original database techniques blueprint
- [`Ke_hoach_hoan_thien_codebase.md`](Ke_hoach_hoan_thien_codebase.md) — 5-phase gap closure plan (completed)
