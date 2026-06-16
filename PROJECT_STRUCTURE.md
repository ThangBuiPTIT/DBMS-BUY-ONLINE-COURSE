# PROJECT STRUCTURE: FastAPI E-Learning Platform

## Directory Layout

```
DBMS-BUY-ONLINE-COURSE/                 # Repository root
│
├── CLAUDE.md                           # Project context for Claude
├── TRANSFORMATION_PLAN.md              # Phase-by-phase Go→FastAPI migration plan
├── API_ENDPOINT_MAPPING.md             # All 30 endpoints mapped with SQL
├── PROJECT_STRUCTURE.md                # THIS FILE — directory documentation
│
├── ERD.sql                             # Database schema (unchanged from main)
├── procedure_trigger_transaction.sql   # Views, functions, procedures, triggers
├── Ke_hoach_ap_dung_HQTCSDL_Elearning.md  # DB techniques reference (Vietnamese)
├── seed_data.py                        # Original seed script (will be refactored)
├── .gitignore                          # Git ignore rules
│
├── backend/                            # ★ NEW: FastAPI application
│   ├── requirements.txt                # Python dependencies
│   ├── pyproject.toml                  # Project metadata & tool config
│   ├── .env.example                    # Environment variable template
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                     # FastAPI app factory, CORS, lifespan, router registration
│   │   │
│   │   ├── core/                       # Cross-cutting concerns
│   │   │   ├── __init__.py
│   │   │   ├── config.py               # Pydantic BaseSettings (env vars)
│   │   │   ├── database.py             # AsyncEngine, async_sessionmaker, get_db()
│   │   │   ├── security.py             # Password hashing, session key generation, verify
│   │   │   └── deps.py                 # FastAPI dependencies (get_db, get_current_admin, etc.)
│   │   │
│   │   ├── models/                     # SQLAlchemy ORM models (DeclarativeBase)
│   │   │   ├── __init__.py             # Base class, re-export all models
│   │   │   ├── user.py                 # Role, User, UserProfile, Student, Teacher, AuthSession
│   │   │   ├── course.py               # CourseCategory, GeneralCourse, CourseModule, CourseLesson,
│   │   │   │                           #   LearningMaterial, CourseEnrollment, Comment
│   │   │   ├── store.py                # Wallet, TransactionLog, TransactionActionLog
│   │   │   ├── dictionary.py           # DictionaryCategory, DictionaryEntry, DictionaryVariation
│   │   │   ├── microlearning.py        # MLTopic, MLUnit, MLLesson, MLLessonPart, MLQuestion
│   │   │   ├── gamification.py         # StudentStreak, Achievement, UserAchievement, UserFeedback
│   │   │   └── notification.py         # Log, AuditLog, NotificationUser
│   │   │
│   │   ├── schemas/                    # Pydantic request/response models
│   │   │   ├── __init__.py
│   │   │   ├── auth.py                 # LoginRequest, LoginResponse, UserInfo
│   │   │   ├── admin.py                # TransactionResponse, CourseRevenueResponse, BanRequest
│   │   │   ├── teacher.py              # TeacherDashboard, CourseAnalytic, CourseFeedbackSummary
│   │   │   ├── student.py              # StudentSearchResult, StudentProgress, InactiveStudent
│   │   │   ├── store.py                # StoreCourse, WalletInfo, TopupRequest, CheckoutRequest
│   │   │   ├── gamification.py         # LeaderboardEntry, StudentStreak
│   │   │   ├── dictionary.py           # DictCategory, DictEntry, DictVariation
│   │   │   ├── microlearning.py        # MLTopic, MLUnit, MLLesson, MLLessonPart, MLQuestion
│   │   │   ├── course_builder.py       # CourseContent, ModuleCreate, LessonCreate, ReorderRequest
│   │   │   └── notification.py         # NotificationUser, AuditLog
│   │   │
│   │   ├── api/                        # Route handlers (thin layer)
│   │   │   ├── __init__.py
│   │   │   ├── router.py               # Aggregates all sub-routers into api_router
│   │   │   ├── auth.py                 # POST /api/auth/admin-login
│   │   │   ├── admin.py                # GET transactions, revenue; POST ban
│   │   │   ├── teacher.py              # GET dashboard, courses, feedback
│   │   │   ├── student.py              # GET search, progress, inactive
│   │   │   ├── store.py                # GET store/courses, wallet/{id}; POST topup, checkout
│   │   │   ├── gamification.py         # GET leaderboard, streak/{id}
│   │   │   ├── dictionary.py           # GET search, categories, entries/{id}/variations
│   │   │   ├── microlearning.py        # GET roadmap, lessons/{id}/parts, parts/{id}/questions
│   │   │   ├── course_builder.py       # GET/POST/PUT course content & management
│   │   │   └── notification.py         # GET notifications, mark-read, audit-logs
│   │   │
│   │   ├── services/                   # Business logic layer
│   │   │   ├── __init__.py
│   │   │   ├── auth.py                 # authenticate_admin()
│   │   │   ├── admin.py                # get_transactions(), get_revenue(), ban_user()
│   │   │   ├── teacher.py              # get_dashboard(), get_courses(), get_feedback()
│   │   │   ├── student.py              # search_students(), get_progress(), get_inactive()
│   │   │   ├── store.py                # get_courses(), get_wallet(), topup(), checkout()
│   │   │   ├── gamification.py         # get_leaderboard(), get_streak()
│   │   │   ├── dictionary.py           # search_entries(), get_categories(), get_variations()
│   │   │   ├── microlearning.py        # get_roadmap(), get_lesson_parts(), get_questions()
│   │   │   ├── course_builder.py       # get_content(), create_module(), etc.
│   │   │   └── notification.py         # get_notifications(), mark_read(), get_audit_logs()
│   │   │
│   │   └── db/                         # Database reference files
│   │       ├── __init__.py
│   │       ├── erd.sql                 # Copy of root ERD.sql
│   │       ├── procedures.sql          # Copy of root procedure_trigger_transaction.sql
│   │       └── seed.py                 # Refactored seed script (async)
│   │
│   ├── alembic/                        # Database migrations
│   │   ├── env.py                      # Alembic environment config (async)
│   │   ├── script.py.mako              # Migration template
│   │   └── versions/                   # Migration files
│   │       └── 001_initial.py          # Initial migration (mirrors ERD.sql)
│   │
│   └── tests/                          # Test suite
│       ├── __init__.py
│       ├── conftest.py                 # Fixtures: async_client, test_db, seed_data
│       ├── test_auth.py
│       ├── test_admin.py
│       ├── test_teacher.py
│       ├── test_student.py
│       ├── test_store.py
│       ├── test_gamification.py
│       ├── test_dictionary.py
│       ├── test_microlearning.py
│       ├── test_course_builder.py
│       └── test_notification.py
│
├── frontend/                           # ★ UNCHANGED from main branch
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   └── public/
│
└── .claude/                            # Claude Code configuration
    └── settings.local.json
```

---

## File Roles & Responsibilities

### `backend/app/main.py`
**Sole responsibility:** Create the FastAPI app, register middleware, include routers.

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(api_router)
```

**Must NOT contain:** Business logic, DB queries, route definitions.

---

### `backend/app/core/config.py`
**Sole responsibility:** Read environment variables into a typed settings object.

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "E-Learning Sign Language API"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/elearning_db"
    SECRET_KEY: str = "change-me"
    SESSION_EXPIRE_HOURS: int = 24
    
    model_config = SettingsConfigDict(env_file=".env")
```

---

### `backend/app/core/database.py`
**Sole responsibility:** Create and manage async database connections.

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
```

---

### `backend/app/core/deps.py`
**Sole responsibility:** FastAPI dependency injection functions.

```python
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.auth import verify_session

async def get_current_admin(
    session_key: str = Header(None, alias="Session-Key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    ...
```

---

### `backend/app/models/*.py`
**Sole responsibility:** SQLAlchemy ORM table definitions.

Rules:
- Each file maps to one domain (user, course, store, etc.)
- Use `Base = declarative_base()` from `models/__init__.py`
- Define columns with types matching PostgreSQL schema exactly
- Use `ForeignKey` for relationships
- Use `relationship()` for ORM navigation (with lazy loading configured)
- Use `__tablename__` matching existing table names (snake_case plural)
- Do NOT put business logic in models
- Do NOT put validation in models (that's Pydantic's job)

---

### `backend/app/schemas/*.py`
**Sole responsibility:** Pydantic models for request validation and response serialization.

Rules:
- Each file matches one domain's models file
- Request schemas: `*Request` suffix
- Response schemas: `*Response` suffix
- Use `model_config = ConfigDict(from_attributes=True)` for ORM mode
- Use `Optional` for nullable fields (match Go's pointer behavior)
- Use `UUID` type for UUID columns
- Use `Decimal` for financial amounts (price, balance)
- Use `datetime` for timestamps
- Nest response schemas for hierarchical data (CourseContent contains Modules, which contain Lessons)

---

### `backend/app/api/*.py`
**Sole responsibility:** Route definitions — parse request, call service, return response.

Rules:
- Each file exports one `router = APIRouter(prefix="...", tags=["..."])`
- Route functions are thin: extract params → call service → return
- Use type annotations on ALL parameters (FastAPI auto-validates)
- Return Pydantic response models (FastAPI auto-serializes)
- Raise `HTTPException` for errors
- Do NOT write SQL or business logic here

---

### `backend/app/services/*.py`
**Sole responsibility:** Business logic — execute queries, enforce rules, transform data.

Rules:
- All functions accept `db: AsyncSession` as first parameter
- Use SQLAlchemy ORM for simple queries
- Use `text()` for raw SQL (views, procedures, complex queries)
- Return ORM objects or Pydantic schemas (prefer schemas)
- Handle DB-specific errors and convert to domain exceptions
- Do NOT import FastAPI classes (no HTTPException here)

---

### `backend/app/db/seed.py`
**Sole responsibility:** Populate database with sample data.

Rules:
- Idempotent — can run multiple times safely (DELETE first, then INSERT)
- Use `asyncio.run(main())` entry point
- Same data structure as original `seed_data.py`
- Can be run standalone: `python -m app.db.seed`

---

### `backend/tests/conftest.py`
**Sole responsibility:** Shared test fixtures.

Rules:
- Provide `async_client` fixture using `httpx.AsyncClient` with ASGI transport
- Provide `test_db` fixture with transaction rollback (or test database)
- Override `get_db` dependency for test isolation
- Provide `seed_test_data` fixture for minimal test data

---

## Naming Conventions Cheat Sheet

| Concept | Convention | Example |
|---------|-----------|---------|
| File names | snake_case | `course_builder.py` |
| Route functions | snake_case | `get_course_content()` |
| Service functions | snake_case | `get_store_courses()` |
| SQLAlchemy models | PascalCase, singular | `GeneralCourse`, `StudentStreak` |
| Table names | snake_case, plural | `general_courses`, `student_streaks` |
| Pydantic request schemas | PascalCase + suffix | `LoginRequest`, `ModuleCreateRequest` |
| Pydantic response schemas | PascalCase + suffix | `LoginResponse`, `StoreCourseResponse` |
| List responses | `list[SchemaName]` | `list[StoreCourseResponse]` |
| FastAPI routers | snake_case | `router = APIRouter(prefix="/api/store")` |
| FastAPI tags | PascalCase string | `tags=["Admin"]` |
| ENV variables | UPPER_SNAKE_CASE | `DATABASE_URL`, `SECRET_KEY` |
| Path parameters | snake_case | `{course_id}`, `{lesson_id}` |
| Query parameters | snake_case | `?student_id=...&limit=...` |

---

## Import Patterns

```python
# Models
from app.models.user import User, Role, Student, Teacher
from app.models.course import GeneralCourse, CourseModule, CourseLesson

# Schemas
from app.schemas.auth import LoginRequest, LoginResponse
from app.schemas.store import StoreCourseResponse, CheckoutRequest

# Services
from app.services.auth import authenticate_admin
from app.services.store import get_store_courses, checkout_course

# Core
from app.core.deps import get_db, get_current_admin
from app.core.database import get_db
from app.core.security import verify_password, create_session_key
```

**Rule:** Never import from `api` into `services` or vice versa. The dependency flows one way:
```
api → services → models
api → schemas
services → models
services → schemas (for response construction)
```

---

## Startup Flow

1. `uvicorn app.main:app` loads `main.py`
2. `main.py` imports `api_router` from `app.api.router`
3. `api_router` imports all sub-routers from `app.api.*`
4. Each sub-router imports schemas (for type annotations) and services (for logic)
5. Services import models and core modules as needed
6. On first request, `get_db()` returns an async session
7. Session is automatically closed when request completes

---

## Comparison: Go vs FastAPI Architecture

| Go Pattern | FastAPI Equivalent |
|-----------|-------------------|
| `handler/auth_handler.go` | `api/auth.py` (routes) + `services/auth.py` (logic) |
| `repository/auth_repository.go` | Inline in service (ORM) or raw SQL |
| `models/models.go` (all structs in 1 file) | `schemas/*.py` (Pydantic) + `models/*.py` (ORM) |
| `config/db.go` | `core/database.py` + `core/config.py` |
| `main.go` (DI wiring) | `api/router.py` + FastAPI's `Depends()` |
| `corsMiddleware()` | `CORSMiddleware` (built-in) |
| `http.NewServeMux()` + manual path strings | `APIRouter` with `{path_params}` and `Query(...)` |
| `sql.DB` + manual scanning | SQLAlchemy async session + ORM |
| `json.NewEncoder(w).Encode(data)` | Return Pydantic model (FastAPI auto-serializes) |
