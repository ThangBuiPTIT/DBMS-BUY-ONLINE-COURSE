# CLAUDE.md — E-Learning Platform for Sign Language (FastAPI Migration)

## Project Overview

**Name:** Nền tảng học trực tuyến Ngôn ngữ Ký hiệu (DBMS E-Learning Platform)
**Goal:** An e-commerce-enabled e-learning platform for sign language (Ngôn ngữ Ký hiệu). Students browse a course store, purchase courses with wallet credit, study through structured modules/lessons, earn streaks and achievements, and rank on leaderboards.

**Current branch:** `fastapi` — target is to rewrite the Golang backend from `main` into **Python FastAPI** with a clean project structure.

**Original branch:** `main` — working Golang backend (Go 1.21 + `net/http` stdlib + `lib/pq` + `bcrypt`) talking directly to PostgreSQL.

---

## Current Status & Implementation Plan

**Phase 0 (COMPLETE):** 30/30 Go API endpoints migrated to FastAPI. All 27 ORM models created. All 8 DB views wired. Basic CRUD for courses (modules, lessons, reorder, visibility).

**Gap Analysis Identified:** The codebase has significant gaps — 3 of 4 DB functions unused, 2 of 5 stored procedures uncalled, ~84 CRUD operations missing, no advanced indexing, no Redis cache, and several DB triggers need creation. See `docs/Ke_hoach_hoan_thien_codebase.md` for the full analysis.

**Active Implementation Plan:** `docs/Ke_hoach_hoan_thien_codebase.md` — 5-phase plan to close all gaps. Step-by-step execution guides at `docs/Phase_1_Step_by_Step.md` through `docs/Phase_5_Step_by_Step.md`.

| Phase | Focus | Endpoints | Status |
|-------|-------|-----------|--------|
| 1 | User & Profile CRUD | 8 new | ✅ Complete |
| 2 | Course Content CRUD & Progress | 13 new | ✅ Complete |
| 3 | Comments, Feedback & Achievements | 11 new | ⬜ Pending |
| 4 | E-Commerce & Auditing | 5 new | ⬜ Pending |
| 5 | Advanced DBMS Optimizations | Migrations + Redis | ⬜ Pending |

**Key Implementation Rules:**
- Each phase gets its own git branch (`phase/N-short-name`) merged to `fastapi`
- All tests must pass before merge
- Never change existing DB schema — only add indexes, triggers, materialized views
- All new code follows existing conventions: `snake_case` files/functions, `PascalCase` classes
- All DB procedures/functions defined in `backend/app/db/procedures.sql` MUST be called by the service layer

---

## Tech Stack (Target on fastapi branch)

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Web Framework** | FastAPI (Python 3.11+) | ASGI, Pydantic v2, OpenAPI auto-docs |
| **ORM / DB** | SQLAlchemy 2.0 (async) + asyncpg | Replace raw SQL + `lib/pq` |
| **Migrations** | Alembic | Schema versioning |
| **Auth** | python-jose (JWT) or session-based | Replace bcrypt session-key approach |
| **DB** | PostgreSQL 15+ | Keep same ERD, views, procedures, triggers |
| **Cache** | Redis (optional) | For session storage, leaderboard |
| **Testing** | pytest + httpx + pytest-asyncio | |
| **Frontend** | React + Vite (unchanged) | Kept in `frontend/` directory |

---

## Database Schema (from ERD.sql)

The database has **27 tables** across two categories:

### Core Tables (no partitioning)
- **Auth & Users:** `roles`, `users`, `user_profiles`, `students`, `teachers`, `authentication_sessions`
- **Content:** `dictionary_categories`, `dictionary_entries`, `dictionary_variations`, `general_course_categories`, `general_courses`, `general_course_modules`, `general_course_lessons`, `learning_materials`
- **Engagement:** `course_enrollments`, `comments`, `user_feedbacks`
- **Gamification:** `student_streaks`, `achievements`, `user_achievements`
- **Commerce:** `wallets`
- **Microlearning:** `microlearning_topics`, `microlearning_units`, `microlearning_lessons`, `microlearning_lesson_parts`, `microlearning_questions`

### Partitioned Tables (by month)
- `transaction_logs` — financial transactions
- `transaction_action_logs` — transaction state changes
- `log` — general system log
- `audit_logs` — audit trail
- `notification_users` — user notifications

### Key DB Objects — USAGE STATUS

| Object | Type | Used in Code? | Service/API |
|--------|------|--------------|-------------|
| `vw_student_progress_report` | View | ✅ | `services/student.py` |
| `vw_course_analytics` | View | ✅ | `services/teacher.py` |
| `vw_top_learners_leaderboard` | View | ✅ | `services/gamification.py` |
| `vw_revenue_by_course` | View | ✅ | `services/admin.py` |
| `vw_teacher_dashboard` | View | ✅ | `services/teacher.py` |
| `vw_inactive_students` | View | ✅ | `services/student.py` |
| `vw_course_feedback_summary` | View | ✅ | `services/teacher.py` |
| `vw_detailed_transaction_history` | View | ✅ | `services/admin.py` |
| `fn_search_students` | Function | ✅ | `services/student.py` |
| `fn_check_certificate_eligibility` | Function | ❌ NOT USED | Phase 4 |
| `fn_get_user_real_balance` | Function | ❌ NOT USED | Phase 4 |
| `fn_get_course_completion_rate` | Function | ❌ NOT USED | Phase 4 |
| `sp_update_course_progress` | Procedure | ❌ NOT USED | Phase 2 |
| `sp_topup_wallet` | Procedure | ✅ | `services/store.py` |
| `sp_buy_course_with_wallet` | Procedure | ✅ | `services/store.py` |
| `sp_refund_course` | Procedure | ❌ NOT USED | Phase 4 |
| `sp_ban_user` | Procedure | ✅ | `services/admin.py` |

---

## Current Go Backend Architecture (main branch — what we're migrating FROM)

```
backend/
├── main.go              # Entry point: DB init, DI, router + CORS middleware
├── go.mod               # Module: admin-login-backend (go 1.21)
├── config/
│   └── db.go            # PostgreSQL connection pool (lib/pq + sql.DB)
├── models/
│   └── models.go        # All 30+ struct definitions + JSON tags
├── handler/             # HTTP handlers (thin — parse request, call repo, return JSON)
│   ├── auth_handler.go           # POST /api/auth/admin-login
│   ├── admin_handler.go          # GET /api/admin/transactions, /revenue, POST /ban
│   ├── teacher_handler.go        # GET /api/teacher/{id}/dashboard, /courses, /feedback
│   ├── student_handler.go        # GET /api/students/search, /progress, /inactive
│   ├── store_handler.go          # GET /store/courses, /wallet/{id}, POST /topup, /checkout
│   ├── gamification_handler.go   # GET /gamification/leaderboard, /streak/
│   ├── dictionary_handler.go     # GET /dictionary/search, /categories, /entries/
│   ├── microlearning_handler.go  # GET /microlearning/roadmap, /lessons/{id}/parts, /parts/{id}/questions
│   ├── course_builder_handler.go # GET /courses/{id}/content, POST /modules, /lessons, PUT /reorder, /visibility
│   └── log_notification_handler.go # GET /notifications/{id}, PUT /read, GET /admin/audit-logs
└── repository/          # Data access (raw SQL via database/sql)
    ├── auth_repository.go
    ├── admin_repository.go
    ├── teacher_repository.go
    ├── student_repository.go
    ├── store_repository.go
    ├── gamification_repository.go
    ├── dictionary_repository.go
    ├── microlearning_repository.go
    ├── course_builder_repository.go
    └── log_notification_repository.go
```

### Go Patterns Observed
- **Manual DI** in `main.go` — repos created, injected into handlers
- **No web framework** — stdlib `net/http` with manual path parsing (string splitting)
- **CORS** — middleware wrapping the mux
- **Raw SQL everywhere** — `db.Query()`, `db.QueryRow()`, `db.Exec()` with manual scanning
- **Plaintext passwords** — bcrypt checked but seed data uses `'fake_hash'` literal
- **Session-based auth** — UUID session key stored in `authentication_sessions` table, checked manually per-handler (but many handlers actually skip auth checks)
- **JSON handling** — `encoding/json` with `json.NewDecoder(r.Body).Decode()`

---

## Target FastAPI Architecture

We follow FastAPI best practices with a layered architecture:

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app, CORS, lifespan, routers
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py            # Pydantic Settings (DB URL, Redis URL, etc.)
│   │   ├── database.py          # Async SQLAlchemy engine + session factory
│   │   ├── security.py          # Password hashing, JWT/session creation
│   │   ├── deps.py              # Dependency injection (get_db, get_current_user, get_current_admin)
│   │   └── cache.py             # Redis cache (Phase 5)
│   ├── models/                  # SQLAlchemy ORM models (declarative_base)
│   │   ├── __init__.py
│   │   ├── user.py              # Role, User, UserProfile, Student, Teacher, AuthenticationSession
│   │   ├── course.py            # GeneralCourseCategory, GeneralCourse, Module, Lesson, Material, Enrollment, Comment
│   │   ├── store.py             # Wallet, TransactionLog, TransactionActionLog
│   │   ├── dictionary.py        # DictionaryCategory, DictionaryEntry, DictionaryVariation
│   │   ├── microlearning.py     # MicrolearningTopic, Unit, Lesson, LessonPart, Question
│   │   ├── gamification.py      # StudentStreak, Achievement, UserAchievement, UserFeedback
│   │   └── notification.py      # Log, AuditLog, NotificationUser
│   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── user.py              # (Phase 1)
│   │   ├── admin.py
│   │   ├── teacher.py
│   │   ├── student.py
│   │   ├── store.py
│   │   ├── course.py            # (Phase 3)
│   │   ├── gamification.py
│   │   ├── dictionary.py
│   │   ├── microlearning.py
│   │   ├── course_builder.py
│   │   └── notification.py
│   ├── api/                     # Route handlers (thin — parse, call service, return)
│   │   ├── __init__.py
│   │   ├── router.py            # Main APIRouter aggregation
│   │   ├── auth.py
│   │   ├── user.py              # (Phase 1)
│   │   ├── admin.py
│   │   ├── teacher.py
│   │   ├── student.py
│   │   ├── store.py
│   │   ├── comment.py           # (Phase 3)
│   │   ├── feedback.py          # (Phase 3)
│   │   ├── certificate.py       # (Phase 4)
│   │   ├── gamification.py
│   │   ├── dictionary.py
│   │   ├── microlearning.py
│   │   ├── course_builder.py
│   │   └── notification.py
│   ├── services/                # Business logic
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── user.py              # (Phase 1)
│   │   ├── admin.py
│   │   ├── teacher.py
│   │   ├── student.py
│   │   ├── store.py
│   │   ├── comment.py           # (Phase 3)
│   │   ├── feedback.py          # (Phase 3)
│   │   ├── certificate.py       # (Phase 4)
│   │   ├── gamification.py
│   │   ├── dictionary.py
│   │   ├── microlearning.py
│   │   ├── course_builder.py
│   │   └── notification.py
│   └── db/                      # Database scripts
│       ├── erd.sql
│       ├── procedures.sql
│       └── seed.py
├── alembic/                     # Alembic migrations
│   ├── env.py
│   └── versions/
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_user_crud.py        # (Phase 1)
│   ├── test_course_crud.py      # (Phase 2)
│   ├── test_progress.py         # (Phase 2)
│   ├── test_comments.py         # (Phase 3)
│   ├── test_feedback.py         # (Phase 3)
│   ├── test_achievements.py     # (Phase 3)
│   ├── test_store.py            # (Phase 4)
│   ├── test_admin_audit.py      # (Phase 4)
│   ├── test_certificate.py      # (Phase 4)
│   ├── test_cache.py            # (Phase 5)
│   └── test_leaderboard_mv.py   # (Phase 5)
├── requirements.txt
├── pyproject.toml
└── .env.example
```

---

## Key Design Decisions
1. **Async-first** — use `asyncpg` driver + `sqlalchemy.ext.asyncio` for non-blocking DB access
2. **Pydantic v2** for all request/response validation
3. **Dependency injection** via FastAPI's `Depends()` — replaces manual struct wiring in Go's `main.go`
4. **Path parameters** via FastAPI's native `{param}` syntax — replaces manual URL string splitting
5. **Keep existing DB schema** — same ERD, views, procedures, triggers (migrated via Alembic)
6. **Refactor seed_data.py** — use SQLAlchemy ORM or asyncpg directly, add Alembic integration
7. **Frontend unchanged** — same React app, just point API URLs to new backend

---

## API Endpoints Summary

### Existing (30 endpoints — all implemented)

| # | Method | Route | Handler |
|---|--------|-------|---------|
| 1 | POST | `/api/auth/admin-login` | Auth |
| 2 | GET | `/api/admin/transactions?limit=&offset=` | Admin |
| 3 | GET | `/api/admin/revenue` | Admin |
| 4 | POST | `/api/admin/users/ban` | Admin |
| 5 | GET | `/api/teacher/{id}/dashboard` | Teacher |
| 6 | GET | `/api/teacher/{id}/courses` | Teacher |
| 7 | GET | `/api/teacher/{id}/feedback` | Teacher |
| 8 | GET | `/api/students/search?keyword=` | Student |
| 9 | GET | `/api/students/progress` | Student |
| 10 | GET | `/api/students/inactive` | Student |
| 11 | GET | `/api/store/courses?student_id=` | Store |
| 12 | GET | `/api/wallet/{user_id}` | Store |
| 13 | POST | `/api/wallet/topup` | Store |
| 14 | POST | `/api/store/checkout` | Store |
| 15 | GET | `/api/gamification/leaderboard?limit=` | Gamification |
| 16 | GET | `/api/gamification/streak/{student_id}` | Gamification |
| 17 | GET | `/api/dictionary/search?word=` | Dictionary |
| 18 | GET | `/api/dictionary/categories` | Dictionary |
| 19 | GET | `/api/dictionary/entries/{id}/variations` | Dictionary |
| 20 | GET | `/api/microlearning/roadmap` | Microlearning |
| 21 | GET | `/api/microlearning/lessons/{lesson_id}/parts` | Microlearning |
| 22 | GET | `/api/microlearning/parts/{part_id}/questions` | Microlearning |
| 23 | GET | `/api/teacher/courses/{course_id}/content` | Course Builder |
| 24 | POST | `/api/teacher/modules` | Course Builder |
| 25 | POST | `/api/teacher/lessons` | Course Builder |
| 26 | PUT | `/api/teacher/lessons/reorder` | Course Builder |
| 27 | PUT | `/api/teacher/courses/{course_id}/visibility` | Course Builder |
| 28 | GET | `/api/notifications/{user_id}` | Notification |
| 29 | PUT | `/api/notifications/{notification_id}/read` | Notification |
| 30 | GET | `/api/admin/audit-logs` | Notification |

### Planned (36 new endpoints — see phase guides)

See individual phase docs in `docs/Phase_N_Step_by_Step.md` for the new endpoint tables.

---

## Conventions for FastAPI Code

### Naming
- **File names:** snake_case (e.g., `course_builder.py`)
- **Route functions:** snake_case (e.g., `get_course_content`)
- **SQLAlchemy models:** PascalCase singular (e.g., `GeneralCourse`)
- **Pydantic schemas:** PascalCase with suffixes (`CourseCreateRequest`, `CourseDetailResponse`)
- **Tables in DB:** snake_case plural (unchanged from ERD)

### Route Organization
- Each route file exports an `APIRouter` with `prefix` and `tags`
- Main `router.py` aggregates all sub-routers
- Use FastAPI path parameters (`{course_id}`) instead of manual string splitting
- Use `Query(...)` for query params with validation
- Return Pydantic models (FastAPI auto-serializes to JSON)

### Database Access
- Prefer SQLAlchemy ORM for simple CRUD
- Use raw SQL (via `text()`) for complex queries that hit Views, Functions, and Procedures
- All DB calls go through service layer, NOT directly in route handlers
- Use `Depends(get_db)` for async session injection

### Error Handling
- Use FastAPI's `HTTPException` — do NOT return manual `{"error": "..."}` dicts
- Consistent error response format: `{"detail": "message"}`
- Catch DB-specific errors (unique violations, FK violations) and re-raise as HTTPException

---

## Files to Keep / Copy from main

| File | Destination | Notes |
|------|-------------|-------|
| `ERD.sql` | `backend/app/db/erd.sql` | Copy verbatim |
| `procedure_trigger_transaction.sql` | `backend/app/db/procedures.sql` | Copy verbatim |
| `seed_data.py` | `backend/app/db/seed.py` | Refactor to use asyncpg or SQLAlchemy |
| `Ke_hoach_ap_dung_HQTCSDL_Elearning.md` | Root | Keep as reference |
| `frontend/` | `frontend/` | Keep entire directory unchanged |

---

## Non-Goals (for now)

1. **Do NOT change the database schema** — keep same ERD, views, procedures, triggers
2. **Do NOT rebuild the frontend** — React app stays as-is
3. **Do NOT add features** — this is a pure 1:1 rewrite + structure refactor
4. **Authentication system stays session-based** initially (can upgrade to JWT later)

---

## Related Documents

- `docs/Ke_hoach_hoan_thien_codebase.md` — **Master implementation plan (5 phases)**
- `docs/Phase_1_Step_by_Step.md` — User & Profile CRUD execution
- `docs/Phase_2_Step_by_Step.md` — Course Content & Progress execution
- `docs/Phase_3_Step_by_Step.md` — Comments, Feedback & Achievements execution
- `docs/Phase_4_Step_by_Step.md` — E-Commerce & Auditing execution
- `docs/Phase_5_Step_by_Step.md` — Advanced DBMS execution
- `docs/API_ENDPOINT_MAPPING.md` — Detailed Go → FastAPI endpoint mappings
- `docs/TRANSFORMATION_PLAN.md` — Step-by-step migration plan
- `ERD.sql` — Full database schema
- `Ke_hoach_ap_dung_HQTCSDL_Elearning.md` — Database techniques reference (Vietnamese)
