# RUN.md — How to Run the E-Learning Sign Language Platform

## Prerequisites

| Software | Version | Required |
|----------|---------|----------|
| Python | 3.11+ | ✅ |
| PostgreSQL | 15+ | ✅ |
| Redis | 7+ | ❌ (optional, only if `REDIS_ENABLED=true`) |
| Git | any | ✅ |

---

## 1. Clone & Setup

```bash
git clone https://github.com/ThangBuiPTIT/DBMS-BUY-ONLINE-COURSE.git
cd DBMS-BUY-ONLINE-COURSE
git checkout fastapi
```

---

## 2. Database Setup

### 2.1 Create the database

Open a PostgreSQL shell (`psql`) and run:

```sql
CREATE DATABASE elearning_db;
```

### 2.2 Apply schema

```bash
# From the project root
psql -U postgres -d elearning_db -f backend/app/db/erd.sql
psql -U postgres -d elearning_db -f backend/app/db/procedures.sql
```

> **Note:** On Windows, if `psql` is not in PATH, use the full path (e.g. `C:\Program Files\PostgreSQL\15\bin\psql.exe`).

---

## 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows (PowerShell):
venv\Scripts\Activate.ps1
# Windows (cmd):
venv\Scripts\activate.bat
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment (already exists, edit if needed)
cp .env.example .env
```

Your `.env` file should look like:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=elearning_db
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/elearning_db
SECRET_KEY=change-me-to-a-random-secret
SESSION_EXPIRE_HOURS=24
APP_NAME=E-Learning Sign Language API
DEBUG=true
```

### 3.1 Seed the database

```bash
python -m app.db.seed              # Full seed (courses, users, lessons, etc.)
python -m app.db.seed --reset      # Delete everything first, then seed
python -m app.db.seed --minimal    # Only roles + users (for testing)
```

This creates:
- 3 roles: STUDENT, TEACHER, ADMIN
- Test users: `student1` / `teacher1` (password: `fake_hash`)
- 2 sign language courses with modules, lessons, materials
- Sample transactions, enrollments, feedback, dictionary data

### 3.2 Run the server

```bash
# From backend/ directory
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 4. Access

| Service | URL |
|---------|-----|
| API base | http://localhost:8000 |
| Swagger docs | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| Healthcheck | http://localhost:8000/api/health |

---

## 5. Tests

```bash
cd backend
pytest
```

To run a specific test file:

```bash
pytest tests/test_auth.py
pytest tests/test_store.py
```

---

## 6. Common Issues

### "Connection refused" on DB

Make sure PostgreSQL is running. Check with:
```bash
psql -U postgres -c "SELECT 1"
```

### Module 'app' not found

Run from the `backend/` directory, not the project root. The Python path needs `app/` as a top-level package.

### Port 8000 already in use

Use a different port:
```bash
uvicorn app.main:app --reload --port 8001
```

---

## 7. Project Architecture

```
backend/
├── app/
│   ├── main.py              # FastAPI app entry point
│   ├── core/                # Config, DB connection, security, deps
│   ├── models/              # SQLAlchemy ORM models (27 tables)
│   ├── schemas/             # Pydantic request/response schemas
│   ├── api/                 # Route handlers (thin layer)
│   ├── services/            # Business logic
│   └── db/                  # erd.sql, procedures.sql, seed.py
├── tests/                   # pytest + httpx test suite
├── alembic/                 # Database migrations
├── requirements.txt
└── pyproject.toml
```

For more details, see `CLAUDE.md` in the project root.
