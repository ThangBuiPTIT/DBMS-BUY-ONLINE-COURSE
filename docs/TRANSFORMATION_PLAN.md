# TRANSFORMATION PLAN: Go (main) → FastAPI (fastapi)

## Phase-by-Phase Migration Roadmap

This document maps out every step needed to transform the Golang backend from `main` branch into a production-ready FastAPI backend on the `fastapi` branch.

---

## PHASE 1: FastAPI Project Scaffold

**Goal:** Empty FastAPI project that starts, connects to PostgreSQL, and has correct project structure.

### Step 1.1 — Create virtual environment & install dependencies
```
backend/
├── requirements.txt
├── pyproject.toml
└── .env.example
```

**Dependencies needed:**
- `fastapi` — web framework
- `uvicorn[standard]` — ASGI server
- `sqlalchemy[asyncio]` — ORM with async support
- `asyncpg` — PostgreSQL async driver
- `alembic` — migrations
- `pydantic[email]` — validation (bundled with FastAPI)
- `python-jose[cryptography]` — JWT / session tokens
- `passlib[bcrypt]` — password hashing
- `python-dotenv` — env var loading
- `pytest`, `httpx`, `pytest-asyncio` — testing

### Step 1.2 — Core config module
File: `backend/app/core/config.py`
- `Settings` class (Pydantic `BaseSettings`) reading from `.env`
- Variables: `DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SECRET_KEY`, `SESSION_EXPIRE_HOURS`

### Step 1.3 — Database connection
File: `backend/app/core/database.py`
- Create async SQLAlchemy engine + `async_sessionmaker`
- `get_db()` async generator for FastAPI dependency injection
- Test connection on startup

### Step 1.4 — Minimal FastAPI app
File: `backend/app/main.py`
- Create `FastAPI()` instance with title, docs_url
- Add CORS middleware (allow all origins, match main branch behavior)
- Include a health-check route (`GET /api/health`)
- Lifespan handler for startup/shutdown

### Step 1.5 — Alembic setup
- Run `alembic init alembic`
- Configure `alembic/env.py` to use async engine
- Point to the same PostgreSQL database
- Create initial migration (can be empty — schema already exists)

**Verify:** `uvicorn app.main:app --reload` starts without errors, `GET /api/health` returns 200, `GET /docs` shows Swagger UI.

---

## PHASE 2: SQLAlchemy ORM Models

**Goal:** All 27 tables mapped as SQLAlchemy ORM models using `DeclarativeBase`.

### Step 2.1 — Base model
File: `backend/app/models/__init__.py`
- Create `Base` = `declarative_base()`
- Common mixin for `created_at`, `updated_at` where applicable

### Step 2.2 — Model files (one per domain)

| File | Tables |
|------|--------|
| `models/user.py` | `roles`, `users`, `user_profiles`, `students`, `teachers`, `authentication_sessions` |
| `models/course.py` | `general_course_categories`, `general_courses`, `general_course_modules`, `general_course_lessons`, `learning_materials`, `course_enrollments`, `comments` |
| `models/store.py` | `wallets`, `transaction_logs`, `transaction_action_logs` |
| `models/dictionary.py` | `dictionary_categories`, `dictionary_entries`, `dictionary_variations` |
| `models/microlearning.py` | `microlearning_topics`, `microlearning_units`, `microlearning_lessons`, `microlearning_lesson_parts`, `microlearning_questions` |
| `models/gamification.py` | `student_streaks`, `achievements`, `user_achievements`, `user_feedbacks` |
| `models/notification.py` | `log`, `audit_logs`, `notification_users` |

### Step 2.3 — Relationship mappings
- `users.user_id` → `user_profiles.user_id` (1:1)
- `users.user_id` → `students.user_id` (1:0..1)
- `users.user_id` → `teachers.user_id` (1:0..1)
- `general_courses.teacher_id` → `teachers.user_id` (M:1)
- `general_courses.category_id` → `general_course_categories.category_id` (M:1)
- `general_course_modules.course_id` → `general_courses.course_id` (M:1)
- `general_course_lessons.module_id` → `general_course_modules.module_id` (M:1)
- `course_enrollments.student_id` → `students.user_id` (M:1)
- `course_enrollments.course_id` → `general_courses.course_id` (M:1)
- `wallets.user_id` → `users.user_id` (1:1)
- `dictionary_entries.category_id` → `dictionary_categories.category_id` (M:1)
- `dictionary_variations.entry_id` → `dictionary_entries.entry_id` (M:1)
- ... and nested microlearning relationships

**Verify:** Run Alembic `--autogenerate` — should produce an empty migration (schema matches). If not, the diff shows what we missed.

---

## PHASE 3: Pydantic Schemas

**Goal:** All request/response schemas converted from Go `models.go` structs to Pydantic v2 models.

### Step 3.1 — Schema files (one per domain, matching Go structs)

| File | Pydantic Classes |
|------|-----------------|
| `schemas/auth.py` | `LoginRequest`, `LoginResponse`, `UserInfo` |
| `schemas/admin.py` | `TransactionResponse`, `CourseRevenueResponse`, `BanRequest` |
| `schemas/teacher.py` | `TeacherDashboardResponse`, `CourseAnalyticResponse`, `CourseFeedbackSummaryResponse` |
| `schemas/student.py` | `StudentSearchResult`, `StudentProgressReport`, `InactiveStudentResponse` |
| `schemas/store.py` | `StoreCourseResponse`, `WalletInfoResponse`, `TopupRequest`, `CheckoutRequest` |
| `schemas/gamification.py` | `LeaderboardEntry`, `StudentStreakResponse` |
| `schemas/dictionary.py` | `DictionaryCategoryResponse`, `DictionaryEntryResponse`, `DictionaryVariationResponse` |
| `schemas/microlearning.py` | `MicrolearningTopicResponse`, `MicrolearningUnitResponse`, `MicrolearningLessonResponse`, `MicrolearningLessonPartResponse`, `MicrolearningQuestionResponse` |
| `schemas/course_builder.py` | `CourseContentResponse`, `ModuleCreateRequest`, `LessonCreateRequest`, `LessonReorderRequest`, `VisibilityRequest` |
| `schemas/notification.py` | `NotificationResponse`, `AuditLogResponse` |

### Step 3.2 — Configuration
- Use `model_config = ConfigDict(from_attributes=True)` for ORM mode
- Use `Optional` / `Union` for nullable fields (match Go's pointer/null handling)
- Use `alias` for any snake_case → camelCase JSON mapping (though Go used snake_case JSON tags, so no change needed)
- Nested models for hierarchical responses (e.g., `CourseContent.modules` → list of `ModuleResponse`)

**Verify:** Import all schemas, instantiate with sample data — no validation errors.

---

## PHASE 4: API Routes (the big one)

**Goal:** All 30 endpoints re-implemented as FastAPI route handlers with proper path parameters, query parameters, and request bodies.

### Step 4.1 — Route file mapping

Each Go handler file gets a corresponding FastAPI route file:

| Go Handler (`main`) | FastAPI Route File | APIRouter `prefix` |
|---------------------|-------------------|-------------------|
| `auth_handler.go` | `api/auth.py` | `/api/auth` |
| `admin_handler.go` | `api/admin.py` | `/api/admin` |
| `teacher_handler.go` | `api/teacher.py` | `/api/teacher` |
| `student_handler.go` | `api/student.py` | `/api/students` |
| `store_handler.go` | `api/store.py` | `/api` (mixed: `/store`, `/wallet`) |
| `gamification_handler.go` | `api/gamification.py` | `/api/gamification` |
| `dictionary_handler.go` | `api/dictionary.py` | `/api/dictionary` |
| `microlearning_handler.go` | `api/microlearning.py` | `/api/microlearning` |
| `course_builder_handler.go` | `api/course_builder.py` | `/api/teacher` |
| `log_notification_handler.go` | `api/notification.py` | `/api` (mixed: `/notifications`, `/admin`) |

### Step 4.2 — Path parameter conversion

Go's manual string splitting → FastAPI native path params:

| Go pattern | FastAPI |
|-----------|---------|
| `r.URL.Path` splitting for `teacher/{id}` | `@router.get("/{teacher_id}/dashboard")` |
| `strings.Split(TrimPrefix(path, ...))` for `streak/` | `@router.get("/streak/{student_id}")` |
| `strings.Split` for `wallet/` | `@router.get("/wallet/{user_id}")` |
| `r.PathValue("course_id")` | `@router.get("/courses/{course_id}/content")` |

### Step 4.3 — Query parameter conversion

| Go pattern | FastAPI |
|-----------|---------|
| `r.URL.Query().Get("limit")` + manual `strconv.Atoi` | `limit: int = Query(10, gt=0)` |
| `r.URL.Query().Get("offset")` | `offset: int = Query(0, ge=0)` |
| `r.URL.Query().Get("keyword")` | `keyword: str = Query("")` |
| `r.URL.Query().Get("student_id")` | `student_id: UUID | None = Query(None)` |

### Step 4.4 — Error handling conversion

| Go pattern | FastAPI equivalent |
|-----------|-------------------|
| `h.sendError(w, 400, "message")` | `raise HTTPException(status_code=400, detail="message")` |
| `h.sendError(w, 401, "...")` | `raise HTTPException(status_code=401, detail="...")` |
| `h.sendError(w, 403, "...")` | `raise HTTPException(status_code=403, detail="...")` |
| `h.sendError(w, 404, "...")` | `raise HTTPException(status_code=404, detail="...")` |
| `h.sendError(w, 500, "...")` | `raise HTTPException(status_code=500, detail="...")` |
| `json.NewEncoder(w).Encode(data)` | FastAPI auto-serializes returned Pydantic models or dicts |

### Step 4.5 — Router registration
File: `backend/app/api/router.py`
```python
from fastapi import APIRouter
from app.api import auth, admin, teacher, student, store, gamification, dictionary, microlearning, course_builder, notification

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(admin.router)
# ... etc
```

Then in `main.py`:
```python
from app.api.router import api_router
app.include_router(api_router)
```

**Verify:** Each route returns correct status codes and response schema. Test one endpoint per domain.

---

## PHASE 5: Service Layer (Business Logic)

**Goal:** Move data access logic from route handlers into dedicated service modules.

### Step 5.1 — Service files (one per domain)

Each service file contains async functions (or a service class) that:
1. Accept a DB session + request params
2. Execute SQLAlchemy queries or raw SQL
3. Return ORM objects or Pydantic schemas

| File | Key Functions |
|------|--------------|
| `services/auth.py` | `authenticate_admin(db, username, password) → LoginResponse` |
| `services/admin.py` | `get_transactions(db, limit, offset)`, `get_revenue(db)`, `ban_user(db, user_id, reason)` |
| `services/teacher.py` | `get_teacher_dashboard(db, teacher_id)`, `get_teacher_courses(db, teacher_id)`, `get_teacher_feedback(db, teacher_id)` |
| `services/student.py` | `search_students(db, keyword)`, `get_progress_report(db)`, `get_inactive_students(db)` |
| `services/store.py` | `get_store_courses(db, student_id)`, `get_wallet(db, user_id)`, `topup_wallet(db, ...)`, `checkout_course(db, ...)` |
| `services/gamification.py` | `get_leaderboard(db, limit)`, `get_student_streak(db, student_id)` |
| `services/dictionary.py` | `search_entries(db, keyword)`, `get_categories(db)`, `get_variations(db, entry_id)` |
| `services/microlearning.py` | `get_roadmap(db)`, `get_lesson_parts(db, lesson_id)`, `get_part_questions(db, part_id)` |
| `services/course_builder.py` | `get_course_content(db, course_id)`, `create_module(db, ...)`, `create_lesson(db, ...)`, `update_lesson_order(db, ...)`, `toggle_visibility(db, ...)` |
| `services/notification.py` | `get_notifications(db, user_id)`, `mark_as_read(db, notification_id)`, `get_audit_logs(db)` |

### Step 5.2 — SQL Strategy per query type

| Query type | Approach |
|-----------|----------|
| Simple SELECT from single table | SQLAlchemy ORM (`select(Model).where(...)`) |
| JOIN across 2-3 tables | SQLAlchemy ORM with `.join()` |
| Queries hitting DB Views (e.g., `vw_revenue_by_course`) | Raw SQL via `text()` + manual mapping |
| Queries hitting DB Functions (e.g., `fn_search_students`) | Raw SQL via `text("SELECT * FROM fn_search_students(:kw)")` |
| Calling DB Procedures (e.g., `CALL sp_buy_course_with_wallet`) | Raw SQL via `text("CALL sp_buy_course_with_wallet(:sid, :cid)")` |
| Complex aggregation (e.g., course content tree) | ORM with eager loading or raw SQL with json_agg |
| Batch variations lookup (N+1 prevention) | Raw SQL with `WHERE entry_id IN (...)` (keep Go's batch approach) |

### Step 5.3 — Database session dependency
File: `backend/app/core/deps.py`
```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
```

Route handlers inject: `db: AsyncSession = Depends(get_db)`

**Verify:** Test each service function against real DB with seed data.

---

## PHASE 6: Authentication & Security

**Goal:** Replicate Go's session-based admin auth using FastAPI patterns.

### Step 6.1 — Password hashing
File: `backend/app/core/security.py`
- `hash_password(password: str) -> str` using `passlib[bcrypt]`
- `verify_password(plain, hashed) -> bool`
- `create_session_key() -> str` using `secrets.token_urlsafe()` or `uuid4()`

### Step 6.2 — Session management
- Keep Go's approach: generate UUID session_key, store in `authentication_sessions` table with 24h expiry
- Return session_key to client in JSON response
- Client sends it back via `Session-Key` header (matching Go's CORS allow-header)

### Step 6.3 — Auth dependency
File: `backend/app/core/deps.py`
```python
async def get_current_admin(
    session_key: str = Header(None, alias="Session-Key"),
    db: AsyncSession = Depends(get_db)
) -> User:
    # Look up session in authentication_sessions
    # Check not expired
    # Load user, verify role == ADMIN
    # Return user or raise 401
```

### Step 6.4 — Apply auth to protected routes
- `POST /api/admin/users/ban` → requires admin auth
- `POST /api/teacher/modules` → requires teacher auth (to be implemented)
- `GET /api/admin/audit-logs` → requires admin auth
- Public routes: store, dictionary, microlearning, gamification, student search

**Note:** Many Go handlers lack auth checks. For this migration, replicate the EXACT auth behavior of the Go code (even if missing checks). Security hardening is a separate task.

---

## PHASE 7: Seed Data Refactor

**Goal:** Modernize `seed_data.py` — use asyncpg or SQLAlchemy async, add Alembic integration.

### Step 7.1 — Rewrite seed_data.py
File: `backend/app/db/seed.py`
- Use `asyncio.run()` entry point
- Use `asyncpg` directly or SQLAlchemy async session
- Same data insertion order and values as original
- Add `--reset` flag to drop & re-insert seed data
- Add `--minimal` flag for quick test data

### Step 7.2 — Alembic integration
- Option A: Seed data runs as a separate Alembic migration
- Option B: Seed script runs standalone before/after migrations
- Choose Option B for flexibility

**Verify:** Run `python -m app.db.seed` → database populated with same data as original.

---

## PHASE 8: Testing

**Goal:** Pytest-based test suite covering all endpoints at integration level.

### Step 8.1 — Test infrastructure
File: `backend/tests/conftest.py`
- `async_client` fixture (httpx AsyncClient with ASGI transport)
- `test_db` fixture (test database or transaction rollback)
- `seed_data` fixture (populate test DB with minimal data)
- Override `get_db` dependency with test session

### Step 8.2 — Test files (one per domain)

| Test File | Endpoints Covered |
|-----------|------------------|
| `tests/test_auth.py` | POST `/api/auth/admin-login` |
| `tests/test_admin.py` | GET transactions, revenue; POST ban |
| `tests/test_teacher.py` | GET dashboard, courses, feedback |
| `tests/test_student.py` | GET search, progress, inactive |
| `tests/test_store.py` | GET courses, wallet; POST topup, checkout |
| `tests/test_gamification.py` | GET leaderboard, streak |
| `tests/test_dictionary.py` | GET search, categories, variations |
| `tests/test_microlearning.py` | GET roadmap, lesson parts, questions |
| `tests/test_course_builder.py` | GET content; POST module, lesson; PUT reorder, visibility |
| `tests/test_notification.py` | GET notifications, mark read, audit logs |

### Step 8.3 — Test patterns
- Test successful responses (200, 201)
- Test error cases (400, 401, 403, 404)
- Test edge cases (empty results, missing params, invalid UUIDs)
- Test transaction integrity (wallet balance after buy, refund)
- Use `pytest.mark.asyncio` for all async tests

**Verify:** `pytest` passes all tests with seed data loaded.

---

## PHASE 9: Frontend Integration

**Goal:** Ensure existing React frontend works with new FastAPI backend.

### Step 9.1 — Verify API compatibility
- All JSON response fields match Go's JSON tags exactly
- All URL paths match exactly
- CORS headers match Go's configuration
- Error response format matches (`{"error": "message"}` → `{"detail": "message"}`)

### Step 9.2 — Adjust if needed
If frontend expects `{"error": "..."}` format:
- Add custom exception handler that reformats `detail` → `error`
- Or use FastAPI's `HTTPException` headers

### Step 9.3 — Vite proxy config
Update `frontend/vite.config.js` proxy target to point to FastAPI port (8000 instead of 8080).

**Verify:** Start both backend and frontend, test end-to-end flow: login → browse courses → buy → view content.

---

## PHASE 10: Polish & Documentation

### Step 10.1 — OpenAPI docs
- FastAPI auto-generates at `/docs` (Swagger) and `/redoc`
- Add descriptions to route functions (used as OpenAPI summary)
- Add response model annotations for accurate schema

### Step 10.2 — Environment setup
- `.env.example` with all required variables
- `README.md` with setup instructions

### Step 10.3 — Docker (optional)
- `Dockerfile` for backend
- `docker-compose.yml` with PostgreSQL + backend + frontend

---

## Execution Order Summary

| Phase | What | Dependencies | Approx. Files |
|-------|------|-------------|---------------|
| 1 | Scaffold | None | 5 files |
| 2 | ORM Models | Phase 1 | 7 files |
| 3 | Pydantic Schemas | Phase 2 | 10 files |
| 4 | API Routes | Phase 3 | 10 routes + 1 router |
| 5 | Service Layer | Phase 2, 4 | 10 services |
| 6 | Auth & Security | Phase 4, 5 | 2 files (security.py, deps.py) |
| 7 | Seed Data | Phase 2 | 1 file |
| 8 | Testing | Phase 4-7 | ~10 test files |
| 9 | Frontend Check | Phase 4 | Possible vite.config tweak |
| 10 | Polish | All phases | README, .env, Docker |

**Each phase is independently verifiable** — we run the app and test the endpoints added in that phase before moving on.

---

## Risk Areas

| Risk | Mitigation |
|------|-----------|
| **Partitioned tables** (transaction_logs, etc.) — SQLAlchemy doesn't natively handle PostgreSQL partitioning | Use raw SQL for all queries on partitioned tables |
| **Stored procedures** (`CALL sp_buy_course_with_wallet`) — ORM doesn't wrap these | Use `text("CALL ...")` with params |
| **JSONB columns** (`options_json`, `material_transcript`) — need proper serialization | Use SQLAlchemy `JSONB` type, Pydantic `Json` type |
| **N+1 queries** — Go code has N+1 in course content tree | Use `selectinload` / `joinedload` eager loading |
| **Auth gaps** — Go code skips auth on many endpoints | Replicate exactly; document as tech debt |
| **CORS** — Go allows `*`, FastAPI default is restrictive | Configure `CORSMiddleware` to match exactly |
