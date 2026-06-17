# BACKEND CODEBASE COMPLETE GUIDE

**E-Learning Platform for Sign Language — FastAPI Backend**

> **Audit Date:** 2026-06-18  
> **Branch:** `fastapi`  
> **Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), PostgreSQL 15+, Redis (optional)  
> **Document Version:** 1.0 — Complete file-by-file walkthrough

---

## Table of Contents

1. [Chapter 1: Core Architecture & Framework Configuration](#chapter-1-core-architecture--framework-configuration)
2. [Chapter 2: Database Data Models (SQLAlchemy ORM)](#chapter-2-database-data-models-sqlalchemy-orm)
3. [Chapter 3: Pydantic Schema Validation](#chapter-3-pydantic-schema-validation)
4. [Chapter 4: API Controllers & Services Layout](#chapter-4-api-controllers--services-layout)
5. [Chapter 5: Detailed DBMS Optimization Integration](#chapter-5-detailed-dbms-optimization-integration)
6. [Chapter 6: Testing Suite & Migration Paths](#chapter-6-testing-suite--migration-paths)

---

## Chapter 1: Core Architecture & Framework Configuration

### 1.1 FastAPI Factory & Startup Lifecycle

**File:** `backend/app/main.py` (lines 1–143)

The application entry point bootstraps FastAPI with a custom lifespan context manager. This is the single source of truth for startup/shutdown ordering.

#### Lifespan Context Manager (`@asynccontextmanager`)

```python
# main.py:60-89
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP PHASE
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))          # DB health check (line 63)
    if settings.REDIS_ENABLED:
        await cache.connect()                          # Redis connection (line 67)
    await _prewarm_hot_tables()                        # pg_prewarm (line 71)
    refresh_task = asyncio.create_task(_refresh_leaderboard_periodically())  # line 74

    yield  # <-- App runs here

    # SHUTDOWN PHASE
    refresh_task.cancel()                              # line 79
    if settings.REDIS_ENABLED:
        await cache.disconnect()                       # line 86
    await engine.dispose()                             # line 88
```

**Startup ordering rationale:**
1. **DB connectivity verified first** — if the database is unreachable, the app fails fast before accepting traffic.
2. **Redis connected second** — optional; gated by `settings.REDIS_ENABLED`.
3. **Buffer pool pre-warming** — calls `pg_prewarm()` on hot tables (dictionary entries, courses, leaderboard MV, user profiles, roles).
4. **Periodic leaderboard refresh** — an `asyncio.create_task()` that runs `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard` every `LEADERBOARD_REFRESH_MINUTES` (default: 5 min).

#### CORS Middleware Configuration

```python
# main.py:100-113
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS", "PUT", "DELETE"],
    allow_headers=[
        "Accept", "Content-Type", "Content-Length", "Accept-Encoding",
        "X-CSRF-Token", "Authorization", "Session-Key",
    ],
)
```

**Design note:** The `Session-Key` header is critical — it carries the session token used by `get_current_user` and `get_current_admin` dependencies. CORS is deliberately permissive (matches the Go backend's configuration).

#### Route Registration & Exception Handlers

```python
# main.py:115-119
app.include_router(api_router)                        # Single aggregated router
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(Exception, generic_exception_handler)
```

Two global exception handlers catch unhandled exceptions:
- **IntegrityError** → maps DB constraint violations to HTTP 400/409/500 (see `error_handlers.py`).
- **Generic Exception** → logs with a UUID error ID, returns sanitized 500.

#### Health Check Endpoints

Two inline health endpoints are defined directly on the app (not via routers):

| Route | Handler | Purpose |
|-------|---------|---------|
| `GET /api/health` | `health_check()` (line 122) | Basic liveness: `{"status": "ok"}` |
| `GET /api/health/cache` | `cache_health()` (line 127) | Buffer pool hit ratio + Redis stats |

---

### 1.2 Environment & App Settings

**File:** `backend/app/core/config.py` (lines 1–41)

Uses **Pydantic `BaseSettings`** (from `pydantic_settings`) to load configuration from environment variables and `.env` file.

```python
class Settings(BaseSettings):
    # App
    APP_NAME: str = "E-Learning Sign Language API"
    DEBUG: bool = True

    # PostgreSQL
    DB_HOST: str = "localhost"
    DB_PORT: str = "5432"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_NAME: str = "elearning_db"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/elearning_db"

    # Auth
    SECRET_KEY: str = "change-me-to-a-random-secret"
    SESSION_EXPIRE_HOURS: int = 24

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = False
    SESSION_CACHE_TTL_HOURS: int = 24
    LEADERBOARD_REFRESH_MINUTES: int = 5

    # Read Replica (optional)
    REPLICA_DATABASE_URL: str | None = None

    # CDN / Object Storage
    CDN_BASE_URL: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()  # Singleton instance
```

**Key design points:**
- `REDIS_ENABLED` defaults to `False` — Redis is opt-in; the app works without it.
- `DATABASE_URL` is the full `asyncpg` connection string (used directly by `create_async_engine`).
- `REPLICA_DATABASE_URL` enables read/write splitting when set.
- `CDN_BASE_URL` enables CDN URL resolution for media assets.
- `extra="ignore"` means unknown env vars are silently ignored (not errors).

---

### 1.3 Database Engine & Connection Pool

**File:** `backend/app/core/database.py` (lines 1–44)

#### Engine Creation

```python
if "pytest" in sys.modules:
    engine = create_async_engine(
        settings.DATABASE_URL, echo=settings.DEBUG, poolclass=NullPool,
    )
else:
    engine = create_async_engine(
        settings.DATABASE_URL, echo=settings.DEBUG, pool_size=10, max_overflow=20,
    )
```

**Design decisions:**
- **Test mode detection:** When `pytest` is loaded, `NullPool` is used — each test gets a fresh connection, avoiding cross-test contamination.
- **Production pool:** 10 persistent connections + up to 20 overflow. This is reasonable for a mid-size e-learning platform.
- **`echo=settings.DEBUG`** — SQL query logging is tied to the DEBUG flag.

#### Read Replica Support

```python
if settings.REPLICA_DATABASE_URL and "pytest" not in sys.modules:
    replica_engine = create_async_engine(
        settings.REPLICA_DATABASE_URL, echo=settings.DEBUG, pool_size=10, max_overflow=20,
    )
else:
    replica_engine = engine  # Falls back to primary
```

Two session factories are created:
- `PrimarySession` — for writes.
- `ReplicaSession` — for reads (falls back to primary if no replica configured).
- `async_session` — backward-compatible alias for `PrimarySession`.

#### Session Dependency Generators

```python
async def get_db():       # Primary (writes)
    async with PrimarySession() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_replica_db():  # Replica (reads)
    async with ReplicaSession() as session:
        try:
            yield session
        finally:
            await session.close()
```

Both use `async with` context managers — sessions are guaranteed to close even on exceptions.

---

### 1.4 FastAPI Dependency Injection (`deps.py`)

**File:** `backend/app/core/deps.py` (lines 1–160)

The dependency injection system is the security backbone of the application. All auth goes through `Session-Key` header validation.

#### `get_db()` — Database Session Injection (line 15)

```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
```

Used by nearly every route via `Depends(get_db)`.

#### `get_current_admin()` — Admin Authentication (lines 23–65)

**Flow:**
1. Extract `Session-Key` header (line 25) — `None` if missing.
2. Raise 401 if header is absent (line 29).
3. Query `authentication_sessions` with `joinedload(User.role)` (lines 35–42):
   - Filter by `session_key` AND `expires_at > now()`.
4. Raise 401 if session not found or expired (line 46).
5. Raise 403 if `user.status == "frozen"` (line 54).
6. Raise 403 if `user.role.role_name != "ADMIN"` (line 59).
7. Return the `User` ORM object (line 65).

**Security check ordering:** Expiry → frozen status → role check. This ensures frozen admins can't access even with valid sessions.

#### `get_current_admin_cached()` — Admin Auth with Redis Cache (lines 68–123)

A performance-enhanced variant that:
1. Tries Redis cache first (`cache.get_session(session_key)`) — if hit, fetches user by ID directly, skipping the sessions table join.
2. Falls back to the full DB query on cache miss.
3. Writes to Redis cache on cache miss (line 118) with TTL = `SESSION_CACHE_TTL_HOURS * 3600`.

#### `get_current_user()` — Generic User Authentication (lines 126–159)

Same logic as `get_current_admin()` but **without the role check**. Accepts any role (ADMIN, TEACHER, STUDENT). Used by user-specific endpoints like `/users/me`, `/students/me`, and comment/feedback routes.

#### Dependency Graph

```
Route Handler
  ├── Depends(get_db)           → AsyncSession
  ├── Depends(get_current_user) → User (any role, checks Session-Key)
  └── Depends(get_current_admin) → User (ADMIN only, checks Session-Key)
```

---

### 1.5 Security Helpers

**File:** `backend/app/core/security.py` (lines 1–34)

#### Password Hashing (bcrypt via passlib)

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:  # line 9
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:  # line 13
    return pwd_context.hash(password)
```

Uses the `passlib` library with bcrypt. The `deprecated="auto"` flag means passlib auto-migrates deprecated schemes.

#### Session Key Generation

```python
def create_session_key() -> str:        # line 17
    return uuid.uuid4().hex             # 32-char hex string, no dashes

def get_session_expiry() -> datetime:   # line 21
    return datetime.now(timezone.utc) + timedelta(hours=settings.SESSION_EXPIRE_HOURS)
```

Session keys are 32-character hex UUIDs (no dashes), matching the Go backend's format. Default TTL is 24 hours.

#### UUID Validation Utility

```python
def is_valid_uuid(val: str) -> bool:    # line 26
    try:
        if not val: return False
        uuid.UUID(str(val))
        return True
    except ValueError:
        return False
```

Widely used across services to validate path parameters before passing them to SQL queries — prevents `InvalidTextRepresentation` errors from PostgreSQL.

---

### 1.6 Global Error Handling

**File:** `backend/app/core/error_handlers.py` (lines 1–34)

#### `integrity_error_handler()` (line 12)

Maps PostgreSQL constraint violations to user-friendly HTTP errors:

| Constraint Pattern | HTTP Status | Message |
|--------------------|-------------|---------|
| `uq_*` (unique violation) | 409 Conflict | "Dữ liệu đã tồn tại" |
| `fk_*` / "foreign key" | 400 Bad Request | "Dữ liệu tham chiếu không tồn tại" |
| `ck_*` / "check" | 400 Bad Request | "Dữ liệu không hợp lệ" |
| Other | 500 | Generic with error ID |

#### `generic_exception_handler()` (line 26)

Catch-all handler that:
1. Generates a short UUID error ID (8 chars).
2. Logs the full exception with traceback.
3. Returns `{"detail": "Lỗi hệ thống (ID: <uuid>). Vui lòng liên hệ hỗ trợ."}`.

This prevents leaking stack traces to clients while providing an ID for support lookup.

---

### 1.7 Media URL Resolution

**File:** `backend/app/core/media.py` (lines 1–28)

```python
def cdn_url(db_path: str | None, asset_type: str = "general") -> str:
    if not db_path:
        return ""
    if db_path.startswith("http://") or db_path.startswith("https://"):
        return db_path                                  # Already absolute URL
    cdn_base = getattr(settings, "CDN_BASE_URL", None)
    if cdn_base:
        return f"{cdn_base.rstrip('/')}/{db_path.lstrip('/')}"
    return db_path                                      # Return relative path as-is
```

Convenience wrappers: `video_url()`, `image_url()`, `avatar_url()` — all delegate to `cdn_url()`. The database stores relative paths; this helper resolves them to full CDN URLs when `CDN_BASE_URL` is configured.

---

### 1.8 HTML Sanitization

**File:** `backend/app/core/sanitizer.py` (lines 1–32)

Uses the `nh3` library (Python binding for the `ammonia` Rust HTML sanitizer):

```python
ALLOWED_TAGS_RICH = {'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
                     'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'span'}

def sanitize_rich_text(text: str) -> str:    # Allows formatting, strips scripts
def sanitize_plain_text(text: str) -> str:   # Strips ALL HTML tags
```

**Usage:** Comment/feedback content is sanitized as plain text via Pydantic `@field_validator` in `schemas/course.py` (lines 25–31). This prevents stored XSS in user-generated content.

---

## Chapter 2: Database Data Models (SQLAlchemy ORM)

### 2.0 Model Registry

**File:** `backend/app/models/__init__.py` (lines 1–52)

All models share a single `declarative_base()`:

```python
Base = declarative_base()
```

The file explicitly imports all 27 model classes so that Alembic and SQLAlchemy are aware of them. Models are organized across 8 modules:

| Module | Tables |
|--------|--------|
| `user.py` | `roles`, `users`, `user_profiles`, `students`, `teachers`, `authentication_sessions` |
| `course.py` | `general_course_categories`, `general_courses`, `general_course_modules`, `general_course_lessons`, `learning_materials`, `course_enrollments`, `comments` |
| `dictionary.py` | `dictionary_categories`, `dictionary_entries`, `dictionary_variations` |
| `microlearning.py` | `microlearning_topics`, `microlearning_units`, `microlearning_lessons`, `microlearning_lesson_parts`, `microlearning_questions` |
| `store.py` | `wallets`, `transaction_logs`, `transaction_action_logs` |
| `gamification.py` | `student_streaks`, `achievements`, `user_achievements`, `user_feedbacks` |
| `notification.py` | `log`, `audit_logs`, `notification_users` |
| `certificate.py` | `certificates` |

A helper function `utcnow()` is defined in each module (but duplicated — a future refactor could centralize it):

```python
def utcnow():
    return datetime.now(timezone.utc)
```

---

### 2.1 Authentication & User Models

**File:** `backend/app/models/user.py` (lines 1–145)

#### `Role` (line 25) — `roles` table

| Column | Type | Constraints |
|--------|------|-------------|
| `role_id` | `Integer` | PK, autoincrement |
| `role_name` | `String(50)` | UNIQUE, NOT NULL |

**Relationships:** `users` → back_populates to `User.role`.

Typical values: `ADMIN` (1), `TEACHER` (2), `STUDENT` (3).

#### `User` (line 34) — `users` table

| Column | Type | Constraints |
|--------|------|-------------|
| `user_id` | `UUID` | PK, `default=uuid.uuid4` |
| `username` | `String(50)` | UNIQUE, NOT NULL |
| `password_hash` | `String(255)` | NOT NULL |
| `email` | `String(100)` | UNIQUE, nullable |
| `role_id` | `Integer` | FK → `roles.role_id`, ON DELETE RESTRICT |
| `status` | `String(20)` | CHECK `IN ('active', 'frozen')`, default `active` |
| `created_at` | `DateTime(tz)` | NOT NULL, default `utcnow()` |
| `updated_at` | `DateTime(tz)` | NOT NULL, default `utcnow()` |
| `is_deleted` | `Boolean` | NOT NULL, default `False` |

**Relationships:**
- `role` → `Role` (many-to-one)
- `profile` → `UserProfile` (one-to-one, `uselist=False`)
- `student` → `Student` (one-to-one, `uselist=False`)
- `teacher` → `Teacher` (one-to-one, `uselist=False`)
- `sessions` → `AuthenticationSession` (one-to-many)
- `wallet` → `Wallet` (one-to-one, `uselist=False`)

**Key design:** `is_deleted` implements soft-delete. All queries filter `is_deleted == FALSE`. The FK to `roles` uses `RESTRICT` (cannot delete a role that users reference).

#### `UserProfile` (line 69) — `user_profiles` table

| Column | Type | Constraints |
|--------|------|-------------|
| `profile_id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users.user_id` ON DELETE CASCADE, UNIQUE |
| `full_name` | `String(100)` | NOT NULL |
| `avatar_url` | `String(255)` | nullable |
| `phone_number` | `String(20)` | nullable |
| `date_of_birth` | `Date` | nullable |

**Design note:** `user_id` is UNIQUE — one profile per user. CASCADE delete ensures profile is removed when user is deleted.

#### `Student` (line 89) — `students` table

| Column | Type | Constraints |
|--------|------|-------------|
| `user_id` | `UUID` | PK + FK → `users.user_id` ON DELETE CASCADE |
| `grade_level` | `String(50)` | nullable |
| `school_name` | `String(150)` | nullable |

**Relationships:** `streak` → `StudentStreak` (one-to-one, `uselist=False`)

#### `Teacher` (line 104) — `teachers` table

| Column | Type | Constraints |
|--------|------|-------------|
| `user_id` | `UUID` | PK + FK → `users.user_id` ON DELETE CASCADE |
| `bio` | `Text` | nullable |
| `department` | `String(100)` | nullable |

#### `AuthenticationSession` (line 118) — `authentication_sessions` table

| Column | Type | Constraints |
|--------|------|-------------|
| `session_id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users.user_id` ON DELETE CASCADE |
| `session_key` | `String(255)` | UNIQUE, NOT NULL |
| `otp_code` | `String(10)` | nullable |
| `expires_at` | `DateTime(tz)` | NOT NULL |
| `created_at` | `DateTime(tz)` | NOT NULL |

**CHECK constraint:** `expires_at > created_at` (line 139). Sessions cannot expire before they're created.

---

### 2.2 Course & Learning Models

**File:** `backend/app/models/course.py` (lines 1–210)

#### `GeneralCourseCategory` (line 25)

| Column | Type | Constraints |
|--------|------|-------------|
| `category_id` | `Integer` | PK, autoincrement |
| `name` | `String(100)` | UNIQUE, NOT NULL |

#### `GeneralCourse` (line 36)

| Column | Type | Constraints |
|--------|------|-------------|
| `course_id` | `UUID` | PK |
| `teacher_id` | `UUID` | FK → `teachers.user_id`, RESTRICT |
| `category_id` | `Integer` | FK → `general_course_categories.category_id`, RESTRICT |
| `title` | `String(255)` | NOT NULL |
| `description` | `Text` | nullable |
| `image_url` | `String(255)` | nullable |
| `price` | `Numeric(14,2)` | NOT NULL, default `0.00` |
| `visibility_status` | `String(20)` | CHECK `IN ('DRAFT','PUBLISHED','ARCHIVED')`, default `DRAFT` |
| `updated_at` | `DateTime(tz)` | NOT NULL |
| `is_deleted` | `Boolean` | Soft-delete flag |

**Relationships:**
- `category` → `GeneralCourseCategory`
- `teacher` → `Teacher` (via `backref="courses"`)
- `modules` → `GeneralCourseModule` (ordered by `order_index`)
- `enrollments` → `CourseEnrollment`

#### `GeneralCourseModule` (line 79)

| Column | Type | Constraints |
|--------|------|-------------|
| `module_id` | `UUID` | PK |
| `course_id` | `UUID` | FK → `general_courses.course_id`, CASCADE |
| `title` | `String(255)` | NOT NULL |
| `order_index` | `Integer` | CHECK `> 0`, NOT NULL |

**UNIQUE constraint:** `(course_id, order_index)` — no two modules in the same course can have the same order.

#### `GeneralCourseLesson` (line 107)

| Column | Type | Constraints |
|--------|------|-------------|
| `lesson_id` | `UUID` | PK |
| `module_id` | `UUID` | FK → `general_course_modules.module_id`, CASCADE |
| `title` | `String(255)` | NOT NULL |
| `video_url` | `String(255)` | nullable |
| `order_index` | `Integer` | CHECK `> 0` |

**UNIQUE constraint:** `(module_id, order_index)` — no two lessons in the same module can share order.

#### `LearningMaterial` (line 135)

| Column | Type | Constraints |
|--------|------|-------------|
| `material_id` | `UUID` | PK |
| `lesson_id` | `UUID` | FK → `general_course_lessons.lesson_id`, CASCADE |
| `title` | `String(255)` | NOT NULL |
| `content_url` | `String(255)` | NOT NULL |
| `material_transcript` | `JSONB` | nullable |

#### `CourseEnrollment` (line 153)

| Column | Type | Constraints |
|--------|------|-------------|
| `enrollment_id` | `UUID` | PK |
| `student_id` | `UUID` | FK → `students.user_id`, CASCADE |
| `course_id` | `UUID` | FK → `general_courses.course_id`, CASCADE |
| `progress` | `Numeric(5,2)` | CHECK `0 <= progress <= 100`, default `0.00` |
| `enrolled_at` | `DateTime(tz)` | NOT NULL |

**UNIQUE constraint:** `(student_id, course_id)` — prevents duplicate enrollment.
**CHECK constraint:** Progress is clamped to 0–100.

#### `Comment` (line 188)

| Column | Type | Constraints |
|--------|------|-------------|
| `comment_id` | `UUID` | PK |
| `lesson_id` | `UUID` | FK → `general_course_lessons.lesson_id`, CASCADE |
| `user_id` | `UUID` | FK → `users.user_id`, CASCADE |
| `content` | `Text` | NOT NULL |
| `created_at` | `DateTime(tz)` | NOT NULL |

---

### 2.3 Sign Language Dictionary Models

**File:** `backend/app/models/dictionary.py` (lines 1–87)

#### `DictionaryCategory` (line 23)

| Column | Type | Constraints |
|--------|------|-------------|
| `category_id` | `Integer` | PK, autoincrement |
| `name` | `String(100)` | UNIQUE, NOT NULL |
| `description` | `Text` | nullable |

#### `DictionaryEntry` (line 35)

| Column | Type | Constraints |
|--------|------|-------------|
| `entry_id` | `UUID` | PK |
| `category_id` | `Integer` | FK → `dictionary_categories.category_id`, RESTRICT |
| `word` | `String(100)` | NOT NULL |
| `meaning` | `Text` | NOT NULL |
| `updated_at` | `DateTime(tz)` | NOT NULL |
| `is_deleted` | `Boolean` | Soft-delete |

**UNIQUE constraint:** `(category_id, word)` — a word is unique within a category, but the same word can appear in different categories (e.g., different sign variations for the same word in different contexts).

#### `DictionaryVariation` (line 65)

| Column | Type | Constraints |
|--------|------|-------------|
| `variation_id` | `UUID` | PK |
| `entry_id` | `UUID` | FK → `dictionary_entries.entry_id`, CASCADE |
| `region` | `String(100)` | nullable |
| `video_url` | `String(255)` | NOT NULL |
| `description` | `Text` | nullable |

**UNIQUE constraint:** `(entry_id, video_url)` — no duplicate video URLs for the same entry.

---

### 2.4 Microlearning & Quiz Models

**File:** `backend/app/models/microlearning.py` (lines 1–131)

This is a 5-level hierarchy: **Topic → Unit → Lesson → Part → Question**

#### `MicrolearningTopic` (line 17)

`topic_id` (PK), `title`, `description`. Has many `units`.

#### `MicrolearningUnit` (line 29)

`unit_id` (PK), `topic_id` (FK → CASCADE), `title`, `order_index`. **UNIQUE:** `(topic_id, order_index)`.

#### `MicrolearningLesson` (line 57)

`lesson_id` (PK), `unit_id` (FK → CASCADE), `title`, `video_url`, `order_index`. **UNIQUE:** `(unit_id, order_index)`.

#### `MicrolearningLessonPart` (line 86)

`part_id` (PK), `lesson_id` (FK → CASCADE), `title`, `part_type` (e.g., "video", "quiz", "reading"), `content`, `order_index`. **UNIQUE:** `(lesson_id, order_index)`.

#### `MicrolearningQuestion` (line 114)

`question_id` (PK), `part_id` (FK → CASCADE), `question_text`, `question_type` (e.g., "multiple_choice", "true_false"), `options_json` (JSONB array), `correct_answer`.

---

### 2.5 Store & Transactions Models

**File:** `backend/app/models/store.py` (lines 1–98)

#### `Wallet` (line 23)

| Column | Type | Constraints |
|--------|------|-------------|
| `user_id` | `UUID` | PK + FK → `users.user_id`, CASCADE |
| `balance` | `Numeric(14,2)` | NOT NULL, CHECK `>= 0` |
| `updated_at` | `DateTime(tz)` | NOT NULL |

**Design:** `user_id` is the PK — one wallet per user. Auto-created by trigger or service logic on first access.

#### `TransactionLog` (line 45) — **Partitioned by `created_at`**

| Column | Type | Constraints |
|--------|------|-------------|
| `transaction_id` | `UUID` | Composite PK with `created_at` |
| `from_wallet_user_id` | `UUID` | FK → `wallets.user_id`, RESTRICT |
| `to_wallet_user_id` | `UUID` | FK → `wallets.user_id`, RESTRICT |
| `amount` | `Numeric(14,2)` | CHECK `> 0` |
| `status` | `String(20)` | CHECK `IN ('SUCCESS','FAILED','ROLLED_BACK')` |
| `message` | `Text` | nullable |
| `related_course_id` | `UUID` | FK → `general_courses.course_id`, SET NULL |
| `created_at` | `DateTime(tz)` | **Partition key** |

#### `TransactionActionLog` (line 81) — **Partitioned by `created_at`**

| Column | Type | Constraints |
|--------|------|-------------|
| `action_log_id` | `UUID` | Composite PK with `created_at` |
| `transaction_id` | `UUID` | nullable |
| `action_type` | `String(40)` | NOT NULL |
| `message` | `Text` | NOT NULL |
| `created_at` | `DateTime(tz)` | **Partition key** |

---

### 2.6 Gamification & Feedback Models

**File:** `backend/app/models/gamification.py` (lines 1–110)

#### `StudentStreak` (line 24)

| Column | Type | Constraints |
|--------|------|-------------|
| `streak_id` | `UUID` | PK |
| `student_id` | `UUID` | FK → `students.user_id`, CASCADE, UNIQUE |
| `current_streak` | `Integer` | CHECK `>= 0` |
| `highest_streak` | `Integer` | CHECK `>= 0` AND `>= current_streak` |
| `last_activity_date` | `Date` | nullable |

**CHECK constraints:** `current_streak >= 0`, `highest_streak >= 0`, `highest_streak >= current_streak`.

#### `Achievement` (line 54)

`achievement_id` (PK), `title`, `description`, `icon_url`.

#### `UserAchievement` (line 65)

Composite PK: `(user_id, achievement_id)`. Both FKs use CASCADE delete.

#### `UserFeedback` (line 87)

| Column | Type | Constraints |
|--------|------|-------------|
| `feedback_id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users.user_id`, CASCADE |
| `rating` | `Integer` | CHECK `BETWEEN 1 AND 5` or NULL |
| `feedback_text` | `Text` | nullable |
| `context` | `String(255)` | nullable (format: `course:<id>:<title>`) |
| `created_at` | `DateTime(tz)` | NOT NULL |

---

### 2.7 Audit & Logging Models

**File:** `backend/app/models/notification.py` (lines 1–86)

All three tables are **partitioned by `created_at`**:

#### `Log` (line 23) — `log` table

Composite PK: `(log_id, created_at)`. Columns: `action` (Text).

#### `AuditLog` (line 40) — `audit_logs` table

Composite PK: `(audit_id, created_at)`. CHECK: `status IN ('SUCCESS','FAILED','ROLLED_BACK')`.

| Column | Type |
|--------|------|
| `audit_id` | UUID |
| `run_id` | UUID, NOT NULL |
| `action` | `String(50)`, NOT NULL |
| `status` | `String(20)`, NOT NULL |
| `error_message` | Text, nullable |
| `created_at` | DateTime(tz) — **Partition key** |

#### `NotificationUser` (line 64) — `notification_users` table

Composite PK: `(notification_id, created_at)`. Columns: `user_id` (FK → users), `title`, `message`, `is_read` (Boolean).

---

### 2.8 Certificate Model

**File:** `backend/app/models/certificate.py` (lines 1–59)

#### `Certificate` (line 16) — `certificates` table

| Column | Type | Constraints |
|--------|------|-------------|
| `certificate_id` | `UUID` | PK |
| `student_id` | `UUID` | FK → `users.user_id`, RESTRICT |
| `course_id` | `UUID` | FK → `general_courses.course_id`, RESTRICT |
| `enrollment_id` | `UUID` | FK → `course_enrollments.enrollment_id`, SET NULL |
| `certificate_hash` | `String(64)` | UNIQUE, NOT NULL |
| `status` | `String(20)` | CHECK `IN ('ISSUED','REVOKED')` |
| `metadata_info` | `JSONB` | Column name `metadata` (SQLAlchemy maps to `metadata_info` to avoid reserved word) |
| `certificate_url` | `Text` | nullable |
| `issued_at` | `DateTime(tz)` | NOT NULL |
| `revoked_at` | `DateTime(tz)` | nullable |
| `revoked_reason` | `Text` | nullable |
| `created_at` | `DateTime(tz)` | NOT NULL |

**UNIQUE:** `(student_id, course_id)` — one certificate per student per course.

**Security:** `certificate_hash` is SHA-256(student_id:course_id:issued_at:SECRET_KEY), making forgery infeasible.

---

## Chapter 3: Pydantic Schema Validation

All schemas reside in `backend/app/schemas/`. Every response model uses `model_config = {"from_attributes": True}` (Pydantic v2 equivalent of `orm_mode = True`), enabling direct ORM-to-JSON serialization.

### 3.1 Authentication Schemas

**File:** `backend/app/schemas/auth.py` (lines 1–44)

```
LoginRequest        → username (str, min 1), password (str, min 1)
LoginResponse       → message, session_key, user (UserInfo)
UserInfo            → user_id, username, email, role_name
RegisterRequest     → username (3-50), password (6-100), email?, full_name (1-100),
                      role_id (1-4), grade_level?, school_name?, bio?, department?
RegisterResponse    → message, user_id, username, role_name
LogoutRequest       → session_key
```

`role_id` is validated as `ge=1, le=4` — representing the 4 role types in the system.

### 3.2 User Schemas

**File:** `backend/app/schemas/user.py` (lines 1–58)

```
UserResponse            → Complete user info (profile + student + teacher fields)
UserProfileUpdateRequest → full_name?, avatar_url?, phone_number?, date_of_birth?
StudentUpdateRequest    → grade_level?, school_name?
TeacherUpdateRequest    → bio?, department?
UserListResponse        → users[], total, limit, offset
```

### 3.3 Course Builder Schemas

**File:** `backend/app/schemas/course_builder.py` (lines 1–179)

Nested tree structure for the course content API:

```
CourseContentResponse
  └── modules: list[GeneralCourseModuleResponse]
        └── lessons: list[GeneralCourseLessonResponse]
              └── materials: list[LearningMaterialResponse]
```

Key request/response classes:
- `CourseCreateRequest` / `CourseUpdateRequest` — with `price` validated `ge=0`
- `VisibilityRequest` — regex-validated: `^(DRAFT|PUBLISHED|ARCHIVED)$`
- `LessonReorderRequest` — `lesson_ids: list[str]` with `min_length=1`
- `ProgressUpdateRequest` — `progress` validated `ge=0, le=100`
- `CourseDetailResponse` — flat response with computed `total_modules`, `total_lessons`, `total_enrollments`

### 3.4 Comment & Feedback Schemas (with Sanitization)

**File:** `backend/app/schemas/course.py` (lines 1–73)

**XSS Prevention:** Both `CommentCreateRequest` and `CommentUpdateRequest` use `@field_validator` to strip all HTML:

```python
@field_validator('content')
@classmethod
def sanitize_content(cls, v: str) -> str:
    return sanitize_plain_text(v)  # nh3.clean(text, tags=set())
```

Similarly, `FeedbackCreateRequest` sanitizes `feedback_text`.

### 3.5 Store Schemas

**File:** `backend/app/schemas/store.py` (lines 1–98)

```
StoreCourseResponse    → course_id, title, description, price, teacher_name, is_enrolled
TopupRequest           → user_id, amount (gt=0), message
CheckoutRequest        → student_id, course_id
CheckoutV2Request      → student_id, course_id
RefundRequest          → student_id, course_id, reason
TransferRequest        → from_user_id, to_user_id, amount (gt=0), message
UserTransactionResponse → transaction_id, amount, status, direction (IN/OUT),
                          related_course, counterparty_name
WalletAuditResponse    → wallet_balance, computed_balance, discrepancy, is_consistent
```

### 3.6 Other Schemas

- **`admin.py`** — `TransactionResponse`, `CourseRevenueResponse`, `BanRequest`, `CertificateEligibilityResponse`, `CompletionRateResponse`
- **`teacher.py`** — `TeacherDashboardResponse`, `CourseAnalyticResponse`, `CourseFeedbackSummaryResponse`
- **`student.py`** — `StudentSearchResult`, `StudentProgressReport`, `InactiveStudentResponse`, `StudentDashboardResponse`
- **`gamification.py`** — `LeaderboardEntry`, `StudentStreakResponse`, `AchievementResponse`, `AchievementCreateRequest`, `AwardAchievementRequest`
- **`dictionary.py`** — `DictionaryCategoryResponse`, `DictionaryEntryResponse` (with nested `variations`), `DictionarySearchResponse`
- **`microlearning.py`** — `MicrolearningTopicResponse` → units → lessons tree
- **`notification.py`** — `NotificationResponse`, `AuditLogResponse`

---

## Chapter 4: API Controllers & Services Layout

### Architectural Pattern: Thin Controller / Thick Service

Every endpoint follows this pattern:

```
API Route (api/*.py)          Service (services/*.py)         Database
─────────────────────         ──────────────────────          ────────
Parse request        ──→     Business logic          ──→     SQL queries
Call service                 Validate inputs                 (raw text())
Return response              Call DB procedures
                             Transform results
                             Handle errors
```

**Routes NEVER contain SQL.** All database access goes through services.

### 4.1 Router Aggregation

**File:** `backend/app/api/router.py` (lines 1–35)

A single `APIRouter` aggregates 15 sub-routers:

```python
api_router.include_router(auth.router)           # /api/auth/*
api_router.include_router(admin.router)          # /api/admin/*
api_router.include_router(teacher.router)        # /api/teacher/*
api_router.include_router(student.router)        # /api/students/*
api_router.include_router(store.router)          # /api/store/*, /api/wallet/*, /api/courses/*
api_router.include_router(gamification.router)   # /api/gamification/*
api_router.include_router(dictionary.router)     # /api/dictionary/*
api_router.include_router(microlearning.router)  # /api/microlearning/*
api_router.include_router(course_builder.router) # /api/teacher/* (course CRUD)
api_router.include_router(notification.router)   # /api/notifications/*, /api/admin/audit-logs
api_router.include_router(user.router)           # /api/users/*, /api/students/me, /api/teachers/me
api_router.include_router(comment.router)        # /api/lessons/{id}/comments
api_router.include_router(feedback.router)       # /api/courses/{id}/feedback
api_router.include_router(certificate.router)    # /api/courses/{id}/certificate/*, /api/certificates/verify/*
```

---

### 4.2 Authentication Flow

**API:** `backend/app/api/auth.py` | **Service:** `backend/app/services/auth.py`

#### `POST /api/auth/admin-login` (auth.py:11)

**Flow:**
1. `LoginRequest` validated by Pydantic (username, password min 1 char).
2. `authenticate_admin(db, username, password)` called (services/auth.py:9):
   - Query `users` with `joinedload(User.role)` filtering by username + `is_deleted == False` (line 14).
   - Validate: user exists → check `frozen` status → check `ADMIN` role → verify bcrypt password (lines 20–30).
   - Generate `session_key = uuid.uuid4().hex` (line 32).
   - Insert `AuthenticationSession` row (line 35).
   - Return `(session_key, user_info)`.
3. Route returns `LoginResponse` with session_key in the body (line 20).

#### `POST /api/auth/register` (auth.py:27)

**Flow:** (services/auth.py:53-136)
1. Check username uniqueness via raw SQL (line 59).
2. Check email uniqueness if provided (line 67).
3. Validate `role_id` against `roles` table (line 75).
4. Hash password with bcrypt (line 85).
5. INSERT into `users` returning `user_id` (line 88).
6. INSERT into `user_profiles` (line 99).
7. INSERT into `students` or `teachers` based on role (lines 108-124).
8. DB triggers auto-provision `wallet` and `student_streaks` rows.
9. Returns `RegisterResponse`.

#### `POST /api/auth/logout` (auth.py:39)

Simply deletes the `authentication_sessions` row by `session_key` (services/auth.py:140).

#### `AuthError` (services/auth.py:147)

Custom exception with `message` + `status_code`. Caught by route handlers and re-raised as `HTTPException`.

---

### 4.3 User Profile CRUD

**API:** `backend/app/api/user.py` | **Service:** `backend/app/services/user.py`

| Endpoint | Auth | Service Function | Description |
|----------|------|------------------|-------------|
| `GET /api/users/me` | `get_current_user` | `get_current_user_info()` | Full user info via 5-table JOIN |
| `PUT /api/users/me/profile` | `get_current_user` | `update_profile()` | Dynamic UPDATE on `user_profiles` |
| `PUT /api/students/me` | `get_current_user` (+ role check) | `update_student_info()` | Update grade_level, school_name |
| `PUT /api/teachers/me` | `get_current_user` (+ role check) | `update_teacher_info()` | Update bio, department |
| `GET /api/admin/roles` | `get_current_admin` | `get_roles()` | List all roles |
| `GET /api/admin/users` | `get_current_admin` | `list_users()` | Paginated user list with filters |

**`get_current_user_info()`** (services/user.py:5) performs a rich 5-table join:
```sql
FROM users u
JOIN roles r ON u.role_id = r.role_id
LEFT JOIN user_profiles up ON u.user_id = up.user_id
LEFT JOIN students s ON u.user_id = s.user_id
LEFT JOIN teachers t ON u.user_id = t.user_id
WHERE u.user_id = :uid AND u.is_deleted = FALSE
```

This returns a flat dict with all fields — Python's `dict(row)` maps it to `UserResponse` via Pydantic's `from_attributes=True`.

**Dynamic UPDATE pattern:** Each update method dynamically builds the SET clause based on which fields are provided (non-None), avoiding overwriting unset fields to NULL.

---

### 4.4 Course Builder (Content Management)

**API:** `backend/app/api/course_builder.py` | **Service:** `backend/app/services/course_builder.py`

#### Phase 0 Endpoints (Original 7)

| Endpoint | Service Function | Description |
|----------|------------------|-------------|
| `GET /api/teacher/courses/{id}/content` | `get_course_content()` | Full nested tree (modules→lessons→materials) |
| `POST /api/teacher/modules` | `create_module()` | Create module with auto-incremented order_index |
| `POST /api/teacher/lessons` | `create_lesson()` | Create lesson with auto-incremented order_index |
| `PUT /api/teacher/lessons/reorder` | `update_lesson_order()` | Safe reorder with +10000 offset strategy |
| `PUT /api/teacher/courses/{id}/visibility` | `toggle_course_visibility()` | Update status + invalidate cache |
| `POST /api/teacher/courses` | `create_course()` | Validate teacher + category, insert course |
| `PUT /api/teacher/courses/{id}` | `update_course()` | Dynamic partial update |

#### Reordering Strategy (`update_lesson_order()`, line 146)

```python
# Step 1: Shift ALL lessons in the module up by 10000 (avoids UNIQUE conflicts)
UPDATE general_course_lessons SET order_index = order_index + 10000 WHERE module_id = :mid

# Step 2: Set each lesson to its target index (1, 2, 3, ...)
for idx, lesson_id in enumerate(lesson_ids):
    UPDATE ... SET order_index = :ord WHERE lesson_id = :lid AND module_id = :mid
```

This two-phase approach avoids temporary UNIQUE constraint violations during reordering.

#### Phase 2 CRUD Extensions

Additional endpoints for full CRUD on courses, modules, lessons, and materials:
- `PUT /api/teacher/modules/{id}` → `update_module()`
- `DELETE /api/teacher/modules/{id}` → `delete_module()` (CASCADE + reorder)
- `PUT /api/teacher/lessons/{id}` → `update_lesson()`
- `DELETE /api/teacher/lessons/{id}` → `delete_lesson()` (CASCADE + reorder)
- `POST /api/teacher/materials` → `create_material()`
- `PUT /api/teacher/materials/{id}` → `update_material()`
- `DELETE /api/teacher/materials/{id}` → `delete_material()`
- `GET /api/courses/{id}` → `get_course_detail()` (public, with computed stats)
- `GET /api/courses/categories` → `get_course_categories()`

#### Optimistic Locking (`update_course_with_optimistic_lock()`, line 502)

Prevents lost updates during concurrent course editing:
```sql
UPDATE general_courses
SET title = :title, ...
WHERE course_id = :cid
  AND is_deleted = FALSE
  AND updated_at = :expected_ts  -- Compare with client's version
RETURNING updated_at
```

If `updated_at` changed since the client loaded the form → 0 rows affected → `ConflictError(409)` raised.

---

### 4.5 Student Progress & Search

**API:** `backend/app/api/student.py` | **Service:** `backend/app/services/student.py`

| Endpoint | Service Function | DB Object Used |
|----------|------------------|----------------|
| `GET /api/students/search?keyword=` | `search_students()` | `fn_search_students()` |
| `GET /api/students/progress` | `get_progress_report()` | `vw_student_progress_report` |
| `POST /api/students/progress` | `update_course_progress()` | `sp_update_course_progress()` |
| `GET /api/students/inactive` | `get_inactive_students()` | `vw_inactive_students` |
| `GET /api/students/dashboard` | `get_student_dashboard()` | `v_student_dashboard` |

**`search_students()`** (services/student.py:5) calls the database function:
```sql
SELECT student_id::text, username, full_name, grade_level, school_name, created_at
FROM fn_search_students(:kw)
```

This is a **set-returning function** — PostgreSQL executes it as a table scan with ILIKE filtering inside the function.

**`update_course_progress()`** (services/course_builder.py:554) calls the stored procedure:
```python
await db.execute(
    text("CALL sp_update_course_progress(:sid, :cid, :prog)"),
    {"sid": req.student_id, "cid": req.course_id, "prog": req.progress},
)
await db.commit()
```

On failure, the procedure raises a PostgreSQL exception → caught → rolled back → re-raised as `ValueError`.

---

### 4.6 Teacher Dashboard Analytics

**API:** `backend/app/api/teacher.py` | **Service:** `backend/app/services/teacher.py`

| Endpoint | Service Function | View Used |
|----------|------------------|-----------|
| `GET /api/teacher/{id}/dashboard` | `get_teacher_dashboard()` | `vw_teacher_dashboard` |
| `GET /api/teacher/{id}/courses` | `get_teacher_courses()` | `vw_course_analytics` |
| `GET /api/teacher/{id}/feedback` | `get_teacher_feedback()` | `vw_course_feedback_summary` |

All three endpoints query views directly — no ORM overhead.

**Graceful fallback** in `get_teacher_dashboard()`:
```python
if row is None:
    return {
        "teacher_id": teacher_id,
        "teacher_name": "",
        "total_courses": 0,
        "total_students": 0,
        "total_generated_revenue": 0.0,
    }
```

Instead of returning 404, returns an empty dashboard — pattern inherited from Go backend behavior.

---

### 4.7 Sign Language Dictionary Traversal

**API:** `backend/app/api/dictionary.py` | **Service:** `backend/app/services/dictionary.py`

| Endpoint | Service Function | Description |
|----------|------------------|-------------|
| `GET /api/dictionary/search?word=` | `search_entries()` | ILIKE search with Redis cache |
| `GET /api/dictionary/search/fts?q=` | `search_entries_fts()` | Full-text search (tsvector/tsquery) |
| `GET /api/dictionary/categories` | `get_categories()` | List all categories |
| `GET /api/dictionary/entries/{id}/variations` | `get_variations()` | Video variations by region |

**Batch loading pattern** in `search_entries()` (lines 38–64):
1. Execute the main search query → get N entries.
2. Collect all `entry_id` values.
3. Build a parameterized `IN (:eid0, :eid1, ...)` query.
4. Fetch ALL variations in one round trip.
5. Distribute variations to their parent entries in Python.

This avoids the N+1 query problem — 2 queries regardless of result count.

**Redis cache-aside** (lines 11–14):
```python
if cache.enabled and keyword:
    cached = await cache.get_dict_search(keyword)
    if cached is not None:
        return cached
```
On cache miss, results are stored in Redis with key `dict:search:{keyword.lower()}` and 1-hour TTL.

**Full-Text Search** (`search_entries_fts()`, line 78):
- Splits the query into words, appends `:*` for prefix matching.
- Builds a `tsquery` with `&` (AND) operator.
- Uses `ts_rank()` for relevance scoring.
- Returns results ordered by `relevance DESC`.

---

### 4.8 Microlearning Roadmap & Quizzes

**API:** `backend/app/api/microlearning.py` | **Service:** `backend/app/services/microlearning.py`

| Endpoint | Service Function |
|----------|------------------|
| `GET /api/microlearning/roadmap` | `get_roadmap()` |
| `GET /api/microlearning/lessons/{id}/parts` | `get_lesson_parts()` |
| `GET /api/microlearning/parts/{id}/questions` | `get_part_questions()` |

**`get_roadmap()`** (services/microlearning.py:7) uses PostgreSQL's `json_agg()` for server-side JSON aggregation:

```sql
SELECT t.topic_id, t.title, t.description,
    COALESCE(
        (SELECT json_agg(unit_data ORDER BY unit_data.order_index)
         FROM (
             SELECT u.unit_id, u.title, u.order_index,
                 COALESCE(
                     (SELECT json_agg(lesson_data ORDER BY lesson_data.order_index)
                      FROM (SELECT l.lesson_id, l.title, l.video_url, l.order_index
                            FROM microlearning_lessons l WHERE l.unit_id = u.unit_id) lesson_data
                     ), '[]'::json
                 ) AS lessons
             FROM microlearning_units u WHERE u.topic_id = t.topic_id
         ) unit_data
        ), '[]'::json
    ) AS units
FROM microlearning_topics t
```

A single query produces the full nested Topic→Unit→Lesson tree. The JSON string is parsed client-side in Python:
```python
if isinstance(topic.get("units"), str):
    topic["units"] = json.loads(topic["units"])
```

**`get_part_questions()`** (line 72) handles JSONB deserialization:
```python
if isinstance(q.get("options_json"), str):
    q["options_json"] = json.loads(q["options_json"])
```

---

### 4.9 Store & Wallet Operations

**API:** `backend/app/api/store.py` | **Service:** `backend/app/services/store.py`

#### Course Storefront

`GET /api/store/courses?student_id=` → `get_store_courses()` (line 8)

Uses the `v_published_courses` view with Redis cache-aside pattern:
1. Check Redis `catalog:courses:published` key.
2. On miss: query view + per-student enrollment check via `EXISTS` subquery.
3. Store cacheable subset in Redis (10-min TTL).
4. Return courses with `is_enrolled` flag.

#### Wallet Operations

| Endpoint | Service Function | DB Object |
|----------|------------------|-----------|
| `GET /api/wallet/{user_id}` | `get_wallet()` | Direct SELECT + auto-create |
| `POST /api/wallet/topup` | `topup_wallet()` | `CALL sp_topup_wallet()` |
| `POST /api/store/checkout` | `checkout_course()` | `CALL sp_buy_course_with_wallet()` |
| `POST /api/store/checkout/v2` | `checkout_course_v2()` | `CALL sp_enroll_paid_course()` + SERIALIZABLE |
| `POST /api/store/refund` | `refund_course()` | `CALL sp_refund_course()` + advisory lock |
| `POST /api/wallet/transfer` | `transfer_funds()` | `CALL sp_transfer_funds()` + SERIALIZABLE |

**`checkout_course_v2()`** (line 168) wraps the call in SERIALIZABLE isolation:
```python
async with serializable(db):
    await db.execute(text("CALL sp_enroll_paid_course(:sid, :cid)"), ...)
```

This prevents race conditions where two concurrent purchases could both succeed despite insufficient balance.

**`refund_course()`** (line 121) uses an **advisory lock** on the course UUID (hashed to int64):
```python
course_int = uuid.UUID(course_id).int % (2**63 - 1)
await db.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": course_int})
```

This prevents concurrent refunds on the same course from double-refunding.

#### Transaction History with Keyset Pagination

`GET /api/wallet/{user_id}/transactions/v2` → `get_user_transactions_cursor()` (line 195)

Implements cursor-based (keyset) pagination:
```python
cursor_ts = decode_cursor(cursor)  # Base64 → ISO timestamp
# Query: WHERE created_at < :cursor_ts ORDER BY created_at DESC LIMIT :limit + 1
# has_more = len(rows) > limit
# next_cursor = encode_cursor(last_ts.isoformat())
```

This avoids the performance cliff of `OFFSET` on large partitioned tables.

---

### 4.10 Gamification & Leaderboard

**API:** `backend/app/api/gamification.py` | **Service:** `backend/app/services/gamification.py`

**`get_leaderboard()`** (services/gamification.py:10) uses a multi-tier strategy:
1. **Tier 1:** Redis ZSET (`leaderboard:streaks`) — if cache enabled and populated.
2. **Tier 2:** Materialized View (`mv_leaderboard`) — pre-computed rankings.
3. **Tier 3:** View fallback (`vw_top_learners_leaderboard`) — if MV doesn't exist yet (e.g., before first migration).

**`sync_student_streak()`** (line 172) implements streak logic:
```
- No streak row → create with streak=1
- Last activity = today → no change
- Last activity = yesterday → streak += 1
- Last activity = older → streak reset to 1
```
DB trigger `trg_streak_sync` automatically: raises `highest_streak` when `current_streak` exceeds it, and sets `last_activity_date = today`.

---

### 4.11 Comments & Feedback

**API:** `backend/app/api/comment.py` + `backend/app/api/feedback.py`  
**Services:** `backend/app/services/comment.py` + `backend/app/services/feedback.py`

**Comments** support full CRUD:
- `GET /api/lessons/{id}/comments` — returns paginated list with `username` and `avatar_url`.
- `POST` — creates comment (any authenticated user).
- `PUT` — edits comment (owner only, enforced by `WHERE user_id = :uid`).
- `DELETE` — deletes comment (owner OR admin; admin check skips the `user_id` filter).

**Feedback** uses a DB trigger guard:
- `trg_prevent_feedback_without_learning` blocks inserts where the student's progress < 10%.
- The service catches the PostgreSQL exception and translates it: `"Bạn phải hoàn thành ít nhất 10% tiến trình học mới được phép đánh giá"`.

---

### 4.12 Certificates

**API:** `backend/app/api/certificate.py` | **Service:** `backend/app/services/certificate.py`

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/courses/{id}/certificate/eligibility/{student_id}` | None | Check eligibility |
| `POST /api/courses/{id}/certificate/issue` | `get_current_user` | Issue certificate |
| `GET /api/certificates/verify/{hash}` | None (public) | Verify certificate |
| `POST /api/admin/certificates/{id}/revoke` | `get_current_admin` | Revoke certificate |

**Hash generation** (certificate.py:12):
```python
def _generate_certificate_hash(student_id, course_id, issued_at):
    payload = f"{student_id}:{course_id}:{issued_at.isoformat()}:{settings.SECRET_KEY}"
    return hashlib.sha256(payload.encode()).hexdigest()
```

The hash includes the `SECRET_KEY`, making it impossible to forge without knowing the server secret. The public verify endpoint looks up the hash in the database — no secret needed.

**Issue flow:**
1. Call `fn_check_certificate_eligibility()` → must return TRUE (progress = 100%).
2. Check for existing `ISSUED` certificate → return it if found (idempotent).
3. Generate hash + insert `certificates` row.
4. Return with `verification_url`.

---

### 4.13 Notifications & Audit Logs

**API:** `backend/app/api/notification.py` | **Service:** `backend/app/services/notification.py`

**`mark_notification_as_read()`** uses a **two-step approach for partitioned tables**:
1. Query to get the `created_at` partition key (line 28).
2. Update with both `notification_id` AND `created_at` in the WHERE clause (line 42).

This is necessary because the partition key must be included in the WHERE clause for efficient partition pruning.

**Audit logs** are pruned to the last 30 days (`WHERE created_at >= NOW() - INTERVAL '30 days'`), limiting the query to recent partitions.

---

### 4.14 Admin Operations

**API:** `backend/app/api/admin.py` | **Service:** `backend/app/services/admin.py`

| Endpoint | Service Function | DB Object |
|----------|------------------|-----------|
| `GET /api/admin/transactions` | `get_transactions()` | `vw_detailed_transaction_history` |
| `GET /api/admin/revenue` | `get_revenue()` | `vw_revenue_by_course` |
| `POST /api/admin/users/ban` | `ban_user()` | `CALL sp_ban_user()` |
| `GET /api/admin/wallets/{id}/audit` | `audit_wallet_balance()` | `fn_get_user_real_balance()` |
| `GET /api/admin/courses/{id}/completion-rate` | `get_course_completion_rate()` | `fn_get_course_completion_rate()` |

**`audit_wallet_balance()`** (services/admin.py:71) implements a financial audit:
1. Read `wallets.balance` (the stored balance).
2. Call `fn_get_user_real_balance()` (recomputes from transaction logs).
3. Compare → return `discrepancy` and `is_consistent` flag.

This detects tampering — if someone directly modified the `wallets.balance` value without a corresponding transaction log entry, `discrepancy != 0`.

---

## Chapter 5: Detailed DBMS Optimization Integration

### 5.1 SQL Views Mapping

All 8 views are queried from Python services using `text()`:

| View | Service File | Function | Line |
|------|-------------|----------|------|
| `vw_student_progress_report` | `services/student.py` | `get_progress_report()` | 17 |
| `vw_course_analytics` | `services/teacher.py` | `get_teacher_courses()` | 32 |
| `vw_top_learners_leaderboard` | `services/gamification.py` | `get_leaderboard()` | 32 |
| `vw_revenue_by_course` | `services/admin.py` | `get_revenue()` | 52 |
| `vw_teacher_dashboard` | `services/teacher.py` | `get_teacher_dashboard()` | 9 |
| `vw_inactive_students` | `services/student.py` | `get_inactive_students()` | 25 |
| `vw_course_feedback_summary` | `services/teacher.py` | `get_teacher_feedback()` | 49 |
| `vw_detailed_transaction_history` | `services/admin.py` | `get_transactions()` | 17 |
| `v_published_courses` | `services/store.py` | `get_store_courses()` | 28 |
| `v_student_dashboard` | `services/student.py` | `get_student_dashboard()` | 33 |

Views are defined in `backend/app/db/procedures.sql` (lines 35–118).

---

### 5.2 Stored Procedures Execution

All 8 stored procedures/function calls:

| Procedure/Function | Called In | Line | Mechanism |
|--------------------|-----------|------|-----------|
| `sp_topup_wallet` | `services/store.py` | 87 | `CALL sp_topup_wallet(:uid, :amt, :msg)` |
| `sp_buy_course_with_wallet` | `services/store.py` | 105 | `CALL sp_buy_course_with_wallet(:sid, :cid)` |
| `sp_ban_user` | `services/admin.py` | 63 | `CALL sp_ban_user(:user_id, :reason)` |
| `sp_update_course_progress` | `services/course_builder.py` | 558 | `CALL sp_update_course_progress(:sid, :cid, :prog)` |
| `sp_refund_course` | `services/store.py` | 134 | `CALL sp_refund_course(:sid, :cid)` |
| `sp_transfer_funds` | `services/store.py` | 155 | `CALL sp_transfer_funds(:fid, :tid, :amt, :msg)` |
| `sp_enroll_paid_course` | `services/store.py` | 176 | `CALL sp_enroll_paid_course(:sid, :cid)` |
| `fn_search_students` | `services/student.py` | 8 | `SELECT * FROM fn_search_students(:kw)` |
| `fn_check_certificate_eligibility` | `services/certificate.py` | 28, 54 | `SELECT fn_check_certificate_eligibility(:sid, :cid)` |
| `fn_get_user_real_balance` | `services/admin.py` | 91 | `SELECT fn_get_user_real_balance(:uid)` |
| `fn_get_course_completion_rate` | `services/admin.py` | 119 | `SELECT fn_get_course_completion_rate(:cid)` |

All calls use **named parameters** (`:uid`, `:sid`, etc.) with `text()` — SQLAlchemy's parameter binding prevents SQL injection.

**Transaction management:**
- Financial operations (`transfer_funds`, `checkout_course_v2`) use `serializable` context manager.
- On exception: `await db.rollback()` then re-raise.
- On success: `await db.commit()` is handled by the isolation context manager.

---

### 5.3 Database Triggers

Registered in `procedures.sql` (lines 1–16). The trigger registry documents all 10 triggers:

| # | Trigger | Table | Event | Purpose |
|---|---------|-------|-------|---------|
| 1 | `trg_auto_updated_at` | users, dict_entries, courses, wallets | BEFORE UPDATE | Auto-set `updated_at` |
| 2 | `trg_provision_user` | users | AFTER INSERT | Auto-create wallet (+ streak for students) |
| 3 | `trg_create_student_streak` | students | AFTER INSERT | Ensure streak row exists |
| 4 | `trg_streak_sync` | student_streaks | BEFORE INSERT/UPDATE | Auto-raise `highest_streak` |
| 5 | `trg_prevent_feedback_without_learning` | user_feedbacks | BEFORE INSERT | Block reviews without 10%+ progress |
| 6 | `trg_check_sufficient_balance` | wallets | BEFORE UPDATE | Prevent negative balance |
| 7 | `trg_audit_wallet` | wallets | AFTER UPDATE | Log every balance change |
| 8 | `trg_auto_hide_teacher_courses` | users | AFTER UPDATE OF status | Archive courses when teacher banned |
| 9 | `trg_alert_large_transaction` | transaction_logs | AFTER INSERT | Notify admin of large transactions |
| 10 | `trg_prevent_self_transfer` | transaction_logs | BEFORE INSERT | Block self-transfers |

**Trigger-aware code in services:**
- `services/feedback.py:10` — Comment notes that `trg_prevent_feedback_without_learning` will reject invalid submissions.
- `services/auth.py:116` — Comment notes that `trg_provision_user` (via unified `trg_provision_wallet`) auto-creates wallet + streak after registration.
- `services/gamification.py:174` — Comment notes that `trg_streak_sync` auto-raises `highest_streak` during streak sync.

---

### 5.4 Concurrency & Locking Control

**File:** `backend/app/core/locking.py` (lines 1–50)

#### Pessimistic Row Locking

```python
# lock_wallet_for_update() — line 6
SELECT balance, updated_at FROM wallets WHERE user_id = :uid FOR UPDATE

# lock_course_for_update() — line 18
SELECT course_id, title, price, visibility_status, updated_at
FROM general_courses WHERE course_id = :cid AND is_deleted = FALSE
FOR UPDATE
```

Used internally by stored procedures to prevent concurrent balance modifications.

#### SKIP LOCKED Queue

```python
# fetch_notifications_skip_locked() — line 33
SELECT notification_id, user_id, title, message
FROM notification_users
WHERE is_read = FALSE
ORDER BY created_at
FOR UPDATE SKIP LOCKED
LIMIT :limit
```

**Pattern:** Multiple worker processes can safely dequeue notifications — each worker gets a disjoint batch. `SKIP LOCKED` ensures workers don't block each other.

#### Advisory Locks

**File:** `backend/app/core/cron.py` (lines 16–28)

```python
async def try_acquire_advisory_lock(db, lock_id: int) -> bool:
    result = await db.execute(
        text("SELECT pg_try_advisory_lock(:id)"), {"id": lock_id}
    )
    return result.scalar()
```

Used in two contexts:
1. **Singleton cron tasks** (`cron.py:31-45`): Only one app instance runs leaderboard refresh/streak reset/session cleanup. Lock IDs 42, 43, 44 are well-known constants.
2. **Refund race protection** (`store.py:129`): `pg_advisory_xact_lock(course_id_int)` ensures only one concurrent refund per course.

#### Transaction Isolation Levels

**File:** `backend/app/core/isolation.py` (lines 1–45)

Three async context managers:

| Context | Level | Use Case |
|---------|-------|----------|
| `serializable(db)` | SERIALIZABLE | Wallet transfers, course purchases |
| `repeatable_read(db)` | REPEATABLE READ | Reports needing consistent snapshots |
| `read_committed(db)` | READ COMMITTED | General CRUD, catalog browsing |

Usage example from `store.py:152`:
```python
async with serializable(db):
    await db.execute(text("CALL sp_transfer_funds(:fid, :tid, :amt, :msg)"), ...)
```

The context manager handles `commit()` on success and `rollback()` on exception.

---

### 5.5 Advanced Indexing

Alembic migration `949fdd8f9d12_advanced_indexes.py` creates the index suite:

| Index Type | Table | Purpose |
|------------|-------|---------|
| **GIN (trigram)** | `dictionary_entries` | `ILIKE '%keyword%'` search on `word` |
| **GIN (tsvector)** | `dictionary_entries` | Full-text search on `(word, meaning)` |
| **BRIN** | `transaction_logs` | Efficient range scans on `created_at` (partitioned table) |
| **BRIN** | `audit_logs` | Efficient range scans on `created_at` |
| **BRIN** | `notification_users` | Efficient range scans on `created_at` |
| **Partial** | `general_courses` | `WHERE is_deleted = FALSE` — filters out soft-deleted rows |
| **Partial** | `course_enrollments` | `WHERE progress < 100` — active enrollment lookups |
| **Covering** | `student_streaks` | `(student_id) INCLUDE (current_streak, highest_streak)` — index-only scan |
| **FTS Dictionary** | `dictionary_entries` | `tsvector` column for prefix-matching full-text search |

---

### 5.6 Table Partitioning

5 tables use **range partitioning by month** on `created_at`:

| Table | Partition Key |
|-------|---------------|
| `transaction_logs` | `created_at` (DATE_TRUNC month) |
| `transaction_action_logs` | `created_at` |
| `log` | `created_at` |
| `audit_logs` | `created_at` |
| `notification_users` | `created_at` |

**Partition pruning in code:**
- `services/notification.py:8` — Queries `notification_users WHERE created_at >= NOW() - INTERVAL '30 days'` — PostgreSQL only scans the relevant 1-2 partitions.
- `services/notification.py:56` — Same for `audit_logs`.
- `services/store.py:211` — Transaction queries include `created_at` in the cursor-based filter.

**ORM mapping note:** Partitioned tables have composite primary keys `(id, created_at)` in the ORM model definitions, but all queries use raw `text()` SQL since SQLAlchemy ORM has limited partition support.

---

### 5.7 Buffer Pool Pre-Warming

**File:** `backend/app/main.py` (lines 21–38)

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

Called once at startup (line 71). These 8 tables are chosen because they're accessed on nearly every request (catalog browsing, auth, dictionary search).

**Monitoring** is provided by:

**File:** `backend/app/core/buffer_monitor.py` (lines 1–35)

```python
async def get_cache_hit_ratio(db):
    # Queries pg_statio_user_tables for overall hit ratio
    # Returns {disk_reads, cache_hits, hit_ratio_pct}

async def get_tables_needing_prewarm(db, limit=10):
    # Finds tables with low cache hit ratio — candidates for additional prewarming
```

Exposed at `GET /api/health/cache` (main.py:127).

---

### 5.8 Redis Caching

**File:** `backend/app/core/cache.py` (lines 1–159)

#### Architecture

`RedisCache` is a **singleton** (line 159). All methods are **no-ops** when `REDIS_ENABLED=False` or Redis connection is `None` — the app functions fully without Redis.

#### Cache-aside Pattern

Used for:
1. **Dictionary search** (`dict:search:{keyword}`) — 1-hour TTL. Invalidation: `invalidate_dictionary_cache()`.
2. **Course catalog** (`catalog:courses:published`) — 10-minute TTL. Invalidation: `invalidate_course_catalog()`.
3. **Course detail** (`catalog:course:{id}`) — 10-minute TTL. Invalidation: `invalidate_course_detail(course_id)`.
4. **Session cache** (`session:{key}`) — TTL = `SESSION_CACHE_TTL_HOURS * 3600`.

#### Redis Sorted Sets for Leaderboards

**Leaderboard** (`leaderboard:streaks`):
```python
# Write: pipeline delete + zadd batch
pipe.delete("leaderboard:streaks")
for entry in entries:
    pipe.zadd(key, {entry["full_name"]: entry["current_streak"]})
# Read: zrevrange (O(log N))
result = await self._redis.zrevrange("leaderboard:streaks", 0, limit-1, withscores=True)
```

**Microlearning scores** (`microlearning:scores`):
```python
# Atomic increment
await self._redis.zincrby("microlearning:scores", score, student_name)
```

#### Cache Invalidation Hooks

**File:** `backend/app/core/cache_invalidation.py` (lines 1–27)

Five invalidation functions triggered from service layer:
- `invalidate_course_catalog()` — called after create/delete/visibility change
- `invalidate_course_detail(course_id)` — called after course update
- `invalidate_dictionary_cache(keyword?)` — called after dictionary entry changes
- `invalidate_leaderboard_cache()` — called after streak changes

**Example hook point** in `services/course_builder.py:170-172`:
```python
await toggle_course_visibility(db, course_id, status)
from app.core.cache_invalidation import invalidate_course_catalog, invalidate_course_detail
await invalidate_course_catalog()
await invalidate_course_detail(course_id)
```

#### Hit/Miss Tracking

`cache.stats()` returns `{hits, misses, hit_rate_pct, total_requests, enabled}` — exposed at `/api/health/cache`.

---

### 5.9 Query Optimizations

#### Keyset Pagination

**File:** `backend/app/core/pagination.py` (lines 1–33)

```python
def encode_cursor(value) -> str:       # str → base64 (no padding)
    return base64.urlsafe_b64encode(str(value).encode()).decode().rstrip("=")

def decode_cursor(cursor: str) -> str:  # base64 → str
    # Re-add padding, decode
```

Used in `services/store.py:195-244` for transaction history pagination:
```sql
WHERE created_at < :cursor_ts ORDER BY created_at DESC LIMIT :limit + 1
```

The `+1` extra row enables detecting `has_more` without a COUNT query.

#### Eager Loading

In `deps.py:37-42`, `joinedload()` is used to eagerly fetch related entities:
```python
select(AuthenticationSession)
    .options(joinedload(AuthenticationSession.user).joinedload(User.role))
    .where(...)
```

This avoids N+1 queries: one SQL query fetches session + user + role in a single JOIN.

#### Batch Variation Loading

In `services/dictionary.py:42-64`, variations for all search results are fetched in a single `WHERE entry_id IN (...)` query — avoiding N+1 per-entry queries.

#### Partition Key Filtering

All partitioned table queries include a time-bound filter:
- `created_at >= NOW() - INTERVAL '30 days'` for notifications/audit logs
- Cursor-based keyset pagination for deep transaction history

#### Materialized View for Leaderboard

`mv_leaderboard` replaces the complex view `vw_top_learners_leaderboard` with a periodically-refreshed snapshot. Refresh frequency: `LEADERBOARD_REFRESH_MINUTES` (default 5 min). Uses `REFRESH MATERIALIZED VIEW CONCURRENTLY` to avoid blocking reads during refresh.

#### Read/Write Splitting

**File:** `backend/app/core/database.py` (lines 37-43)

```python
async def get_replica_db():
    async with ReplicaSession() as session:
        yield session
```

When `REPLICA_DATABASE_URL` is configured, read-heavy endpoints can use `Depends(get_replica_db)` to route queries to a read replica, reducing load on the primary.

---

### 5.10 Singleton Cron Tasks

**File:** `backend/app/core/cron.py` (lines 1–79)

Advisory-lock-guarded periodic tasks:

| Task | Lock ID | Implementation |
|------|---------|---------------|
| Refresh leaderboard | 42 | `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard` + Redis sync |
| Reset broken streaks | 43 | `UPDATE student_streaks SET current_streak = 0 WHERE last_activity_date < 7 days` |
| Cleanup expired sessions | 44 | `DELETE FROM authentication_sessions WHERE expires_at < NOW()` |

The `run_singleton_task()` function (line 31) ensures only one app instance executes each task:
```python
async def run_singleton_task(lock_id, task_name, coro):
    acquired = await try_acquire_advisory_lock(db, lock_id)
    if not acquired:
        print(f"[Cron] {task_name}: skipped (another instance is running)")
        return
    try:
        await coro(db)
    finally:
        await release_advisory_lock(db, lock_id)
```

---

## Chapter 6: Testing Suite & Migration Paths

### 6.1 Alembic Migrations Configuration

**File:** `backend/alembic/env.py` (lines 1–64)

#### Async Migration Setup

```python
async def run_async_migrations():
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.DATABASE_URL
    connectable = async_engine_from_config(
        configuration, prefix="sqlalchemy.", poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online():
    asyncio.run(run_async_migrations())  # Bridge: sync → async
```

Uses `NullPool` during migrations (migrations are one-shot, no need for connection pooling). The `model_config` is imported from `app.models.Base.metadata` (line 18, 21) — Alembic auto-detects all 27 ORM models.

#### Migration History

All migration files in `backend/alembic/versions/`:

| Migration ID | Purpose |
|-------------|---------|
| `172d9b20bbc6` | Streak provision trigger |
| `429743bc5cea` | Auto updated_at trigger |
| `6fcb33bef44b` | Wallet provision trigger |
| `a1b2c3d4e5f6` | Streak sync trigger |
| `b2c3d4e5f6a7` | Audit wallet trigger |
| `c3d4e5f6a7b8` | Unified provision trigger |
| `7a1b2c3d4e5f` | `v_published_courses` view |
| `8b2c3d4e5f6a` | `v_student_dashboard` view |
| `9c3d4e5f6a7b` | Fix `mv_leaderboard` |
| `ff27fabf57b0` | Leaderboard materialized view |
| `949fdd8f9d12` | Advanced indexes (GIN, BRIN, partial, covering) |
| `8c88ee18335c` | Full-text search (tsvector column + trigger) |
| `d4e5f6a7b8c9` | Dictionary full-text search index |
| `e5f6a7b8c9d0` | Fix covering index |
| `f6a7b8c9d0e1` | `pg_stat_statements` extension |
| `1a2b3c4d5e6f` | `pg_prewarm` extension |

---

### 6.2 Pytest Testing Architecture

**File:** `backend/tests/conftest.py` (lines 1–19)

```python
@pytest.fixture
def client():
    return TestClient(app)          # FastAPI's synchronous test client

@pytest.fixture
def auth_headers():
    return {"Session-Key": "test-session-key"}
```

**Key characteristic:** Tests use `TestClient` (synchronous wrapper around the async app). The test DB engine is conditionally configured in `database.py:6-9`:
```python
if "pytest" in sys.modules:
    engine = create_async_engine(
        settings.DATABASE_URL, echo=settings.DEBUG, poolclass=NullPool,
    )
```

`NullPool` means each test gets a new connection — no connection pooling overhead in tests.

#### Test Files

| Test File | What It Tests |
|-----------|--------------|
| `test_auth.py` | Login validation, request schema checks |
| `test_user_crud.py` | User profile CRUD operations |
| `test_course_crud.py` | Course/module/lesson/material CRUD |
| `test_progress.py` | Progress updates via stored procedure |
| `test_comments.py` | Comment CRUD + authorization |
| `test_feedback.py` | Feedback submission + trigger validation |
| `test_achievements.py` | Achievement creation, awarding, listing |
| `test_store.py` | Wallet, top-up, checkout, transactions |
| `test_phase4.py` | Phase 4: refund, transfer, audit, certificates |
| `test_phase5.py` | Phase 5: cache, indexes, leaderboard, partitioning |
| `test_triggers.py` | Trigger behavior verification |
| `test_procedures_locking.py` | Procedure calls + locking correctness |
| `test_indexes_query_tuning.py` | Index usage verification, query plan checks |
| `test_views_leaderboard.py` | View and materialized view correctness |
| `test_partitioning.py` | Partition routing verification |
| `test_admin.py` | Admin endpoints (transactions, revenue, ban) |
| `test_general.py` | General health checks and utility tests |

#### Test Patterns

Tests follow a pragmatic approach:
1. **Schema validation:** Verify 422 on missing/invalid inputs.
2. **Status code ranges:** Accept multiple possible status codes (`assert resp.status_code in (200, 401, 403, 500)`) — because tests may run against different DB states.
3. **No database fixtures:** Tests are designed to run against a pre-seeded test database.

---

### 6.3 Seed Data

**File:** `backend/app/db/seed.py`

The seed script populates the database with initial data (admin user, sample roles, dictionary entries, course categories). It uses raw `asyncpg` or SQLAlchemy for insertion — configured to work with Alembic's migration integration.

---

## Appendix A: Complete File Index

### Core Infrastructure (15 files)

| File | Lines | Purpose |
|------|-------|---------|
| `app/main.py` | 143 | FastAPI factory, lifespan, CORS, health routes |
| `app/core/config.py` | 41 | Pydantic BaseSettings, env loading |
| `app/core/database.py` | 44 | Async engine, session factories, replica support |
| `app/core/deps.py` | 160 | Dependency injection: get_db, get_current_user, get_current_admin |
| `app/core/security.py` | 34 | bcrypt hashing, session key generation, UUID validation |
| `app/core/cache.py` | 159 | Redis client wrapper, hit/miss tracking |
| `app/core/cache_invalidation.py` | 27 | Cache invalidation hooks |
| `app/core/locking.py` | 50 | Pessimistic locks, SKIP LOCKED |
| `app/core/isolation.py` | 45 | Transaction isolation context managers |
| `app/core/pagination.py` | 33 | Cursor-based keyset pagination |
| `app/core/sanitizer.py` | 32 | HTML sanitization (nh3) |
| `app/core/error_handlers.py` | 34 | Global IntegrityError + Exception handlers |
| `app/core/buffer_monitor.py` | 35 | pg_statio_user_tables monitoring |
| `app/core/cron.py` | 79 | Advisory-lock singleton cron tasks |
| `app/core/media.py` | 28 | CDN URL resolution |

### Models (8 files)

| File | Lines | Tables |
|------|-------|--------|
| `app/models/__init__.py` | 52 | Base + all model imports |
| `app/models/user.py` | 145 | roles, users, user_profiles, students, teachers, auth_sessions |
| `app/models/course.py` | 210 | categories, courses, modules, lessons, materials, enrollments, comments |
| `app/models/store.py` | 98 | wallets, transaction_logs, transaction_action_logs |
| `app/models/dictionary.py` | 87 | dictionary_categories, dictionary_entries, dictionary_variations |
| `app/models/microlearning.py` | 131 | topics, units, lessons, parts, questions |
| `app/models/gamification.py` | 110 | streaks, achievements, user_achievements, feedbacks |
| `app/models/notification.py` | 86 | log, audit_logs, notification_users |
| `app/models/certificate.py` | 59 | certificates |

### Schemas (11 files)

| File | Lines | Contents |
|------|-------|----------|
| `schemas/auth.py` | 45 | Login, Register, Logout |
| `schemas/user.py` | 58 | User profile, update, list |
| `schemas/admin.py` | 63 | Transactions, revenue, ban, wallet audit, completion rate |
| `schemas/teacher.py` | 33 | Dashboard, course analytics, feedback summary |
| `schemas/student.py` | 50 | Search, progress, inactive, dashboard |
| `schemas/store.py` | 98 | Store courses, wallet, checkout, refund, transfer, transactions |
| `schemas/gamification.py` | 69 | Leaderboard, streak, achievements |
| `schemas/course_builder.py` | 179 | Course/module/lesson/material CRUD, progress |
| `schemas/dictionary.py` | 46 | Categories, entries, variations, search |
| `schemas/microlearning.py` | 53 | Topics, units, lessons, parts, questions |
| `schemas/notification.py` | 26 | Notifications, audit logs |
| `schemas/course.py` | 73 | Comments, feedback (with sanitization) |

### API Routes (15 files)

| File | Prefix | Endpoints |
|------|--------|-----------|
| `api/router.py` | (aggregator) | All 15 sub-routers |
| `api/auth.py` | `/api/auth` | Login, register, logout |
| `api/user.py` | `/api/users`, `/api/students/me`, `/api/teachers/me` | Profile CRUD |
| `api/admin.py` | `/api/admin` | Transactions, revenue, ban, wallet audit, completion rate |
| `api/teacher.py` | `/api/teacher` | Dashboard, courses, feedback |
| `api/student.py` | `/api/students` | Search, progress, inactive, dashboard |
| `api/store.py` | `/api/store`, `/api/wallet` | Storefront, wallet, checkout, refund, transfer |
| `api/gamification.py` | `/api/gamification` | Leaderboard, streak, achievements |
| `api/dictionary.py` | `/api/dictionary` | Search, FTS, categories, variations |
| `api/microlearning.py` | `/api/microlearning` | Roadmap, lesson parts, questions |
| `api/course_builder.py` | `/api/teacher` | Course/module/lesson/material CRUD |
| `api/comment.py` | `/api/lessons/{id}/comments` | Comment CRUD |
| `api/feedback.py` | `/api/courses/{id}/feedback` | Feedback submit, list |
| `api/certificate.py` | `/api/courses/{id}/certificate`, `/api/certificates/verify` | Issue, verify, revoke |
| `api/notification.py` | `/api/notifications`, `/api/admin/audit-logs` | Read, mark-read, audit logs |

### Services (14 files)

| File | Lines | Business Logic |
|------|-------|---------------|
| `services/auth.py` | 151 | Admin auth, user registration, logout |
| `services/user.py` | 166 | Profile CRUD, user listing |
| `services/admin.py` | 129 | Transactions, revenue, ban, wallet audit, completion rate |
| `services/teacher.py` | 57 | Dashboard, course analytics, feedback |
| `services/student.py` | 43 | Search, progress report, inactive, dashboard |
| `services/store.py` | 310 | Storefront, wallet, checkout, refund, transfer, transactions |
| `services/gamification.py` | 247 | Leaderboard (Redis → MV → View), streak sync, achievements |
| `services/dictionary.py` | 154 | ILIKE search, FTS, categories, variations (batch-loaded) |
| `services/microlearning.py` | 91 | Roadmap (json_agg), lesson parts, questions |
| `services/course_builder.py` | 579 | Course/module/lesson/material CRUD, reordering, optimistic locking, progress |
| `services/comment.py` | 93 | Comment CRUD with ownership checks |
| `services/feedback.py` | 97 | Feedback submission (trigger-guarded), listing |
| `services/notification.py` | 71 | Notifications (partition-aware), audit logs |
| `services/certificate.py` | 131 | Eligibility check, issuance, verification, revocation |

---

## Appendix B: Data Flow Diagrams

### Authentication Flow
```
Client                  API (auth.py)              Service (auth.py)             Database
  │                         │                           │                           │
  │ POST /auth/admin-login  │                           │                           │
  │ {username, password}    │                           │                           │
  ├────────────────────────→│                           │                           │
  │                         │ authenticate_admin()      │                           │
  │                         ├──────────────────────────→│                           │
  │                         │                           │ SELECT User + Role        │
  │                         │                           ├──────────────────────────→│
  │                         │                           │←──────────────────────────┤
  │                         │                           │ verify_password()         │
  │                         │                           │ create_session_key()      │
  │                         │                           │ INSERT auth_sessions      │
  │                         │                           ├──────────────────────────→│
  │                         │                           │←──────────────────────────┤
  │                         │←──────────────────────────┤                           │
  │←────────────────────────┤                           │                           │
  │ {session_key, user}     │                           │                           │
```

### Store Checkout Flow (with SERIALIZABLE isolation)
```
Client              API (store.py)         Service (store.py)         Database
  │                     │                       │                        │
  │ POST /store/checkout│                       │                        │
  ├────────────────────→│                       │                        │
  │                     │ checkout_course_v2()   │                        │
  │                     ├──────────────────────→│                        │
  │                     │                       │ async with serializable│
  │                     │                       │ SET TRANSACTION        │
  │                     │                       ├───────────────────────→│
  │                     │                       │ CALL sp_enroll_paid    │
  │                     │                       ├───────────────────────→│
  │                     │                       │  (checks balance,      │
  │                     │                       │   deducts wallet,      │
  │                     │                       │   creates enrollment,  │
  │                     │                       │   logs transaction)    │
  │                     │                       │←───────────────────────┤
  │                     │                       │ COMMIT                 │
  │                     │←──────────────────────┤                        │
  │←────────────────────┤                       │                        │
  │ {status: "SUCCESS"} │                       │                        │
```

### Data Hierarchy
```
Users
 ├── UserProfile (1:1)
 ├── Student (1:1, if role=STUDENT)
 │    └── StudentStreak (1:1)
 ├── Teacher (1:1, if role=TEACHER)
 │    └── GeneralCourse (1:N)
 │         ├── GeneralCourseModule (1:N)
 │         │    └── GeneralCourseLesson (1:N)
 │         │         ├── LearningMaterial (1:N)
 │         │         └── Comment (1:N)
 │         └── CourseEnrollment (1:N)
 ├── Wallet (1:1)
 │    └── TransactionLog (N, from/to)
 ├── AuthenticationSession (1:N)
 ├── UserAchievement (1:N)
 └── UserFeedback (1:N)

DictionaryCategory (1:N) → DictionaryEntry (1:N) → DictionaryVariation
MicrolearningTopic (1:N) → MicrolearningUnit (1:N) → MicrolearningLesson (1:N) → MicrolearningLessonPart (1:N) → MicrolearningQuestion
```

---

*End of Document — `docs/BACKEND_CODEBASE_COMPLETE_GUIDE.md`*
