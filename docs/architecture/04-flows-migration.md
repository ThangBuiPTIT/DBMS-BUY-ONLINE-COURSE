# System Flows & Migration Plan

**Ngày:** 2026-06-17  
**Mục tiêu:** Sơ đồ luồng nghiệp vụ chính + kế hoạch migration Strangler Fig

---

## 1. Luồng nghiệp vụ chính (Core Business Flows)

### 1.1 Đăng ký / Đăng nhập (Unified)

```mermaid
sequenceDiagram
    autonumber
    actor U as User (any role)
    participant F as SPA
    participant API as Go API
    participant R as Redis
    participant DB as PostgreSQL

    U->>F: Submit login form
    F->>API: POST /api/auth/login {username, password}
    API->>DB: SELECT * FROM users WHERE username=? AND is_deleted=false
    DB-->>API: user row
    API->>API: bcrypt.Compare(password, hash)
    alt Invalid credentials
        API->>API: ratelimit.incr(ip)
        API-->>F: 401
    else Valid
        API->>API: Check role + status
        API->>DB: INSERT INTO authentication_sessions (24h)
        API->>R: SET session:{key} {user_id, role} EX 300
        API-->>F: 200 {session_key, user}
        F->>F: localStorage.set
    end

    Note over F,API: Subsequent requests:
    F->>API: GET /api/* (Session-Key header)
    API->>R: GET session:{key}
    alt Cache hit
        R-->>API: {user_id, role}
    else Cache miss
        API->>DB: SELECT FROM authentication_sessions WHERE key=? AND expires_at>now()
        API->>R: SET ...
    end
```

### 1.2 Mua khóa học (Checkout với Idempotency)

```mermaid
sequenceDiagram
    autonumber
    actor S as Student
    participant F as SPA
    participant API as Go API
    participant R as Redis
    participant DB as PostgreSQL

    S->>F: Click "Mua khóa học"
    F->>F: Generate idempotency key (uuid v4)
    F->>API: POST /api/store/checkout<br/>{course_id, idempotency_key}
    API->>R: GET idem:{key}
    alt Cached response
        R-->>API: previous {status, body}
        API-->>F: Return cached response
    else First request
        API->>API: Auth check (role=STUDENT, session valid)
        API->>API: Validate course_id exists, published
        API->>DB: BEGIN TRANSACTION
        API->>DB: SELECT wallet.balance FROM wallets WHERE user_id=? FOR UPDATE
        alt balance < course.price
            API->>DB: ROLLBACK
            API-->>F: 402 {error: insufficient_funds}
        else OK
            API->>DB: UPDATE wallets SET balance=balance-price
            API->>DB: INSERT INTO course_enrollments
            API->>DB: INSERT INTO transaction_logs (partition)
            API->>DB: INSERT INTO tx_action_logs
            API->>DB: INSERT INTO audit_logs (who, what, when)
            API->>DB: COMMIT
            API->>R: SET idem:{key} {200, response} EX 86400
            API->>R: DEL user:{user_id}:cart (nếu có)
            API-->>F: 200 {enrollment_id, new_balance}
            F-->>S: "Mua thành công"
            F->>F: Invalidate React Query cache
        end
    end
```

### 1.3 Học từ vựng + Quiz

```mermaid
sequenceDiagram
    autonumber
    actor S as Student
    participant F as SPA
    participant API as Go API
    participant DB as PostgreSQL

    S->>F: Mở /microlearning/roadmap
    F->>API: GET /api/microlearning/roadmap
    API->>DB: SELECT topics → units → lessons tree
    API-->>F: Roadmap JSON
    F->>F: Render dạng timeline
    S->>F: Click lesson
    F->>API: GET /api/microlearning/lessons/{id}/parts
    API->>DB: Query parts, mark as viewed → UPDATE student_progress
    API-->>F: Parts JSON
    S->>F: Hoàn thành tất cả parts
    F->>F: Show quiz button
    S->>F: Click "Làm quiz"
    F->>API: GET /api/microlearning/parts/{id}/questions
    API->>DB: Shuffle questions, get correct answer key (server-side)
    API-->>F: Questions (không có correct answer)
    S->>F: Submit answers
    F->>API: POST /api/microlearning/submit<br/>{lesson_id, answers, duration_sec}
    API->>API: Server-side scoring
    API->>DB: INSERT INTO user_feedbacks
    API->>DB: UPDATE student_progress (passed, score, completed_at)
    API->>DB: Trigger streak update
    API-->>F: 200 {score, passed, streak}
    F-->>S: "Bạn đạt 8/10, streak +1"
```

### 1.4 Admin giám sát & khóa user

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant F as Admin Dashboard
    participant API as Go API
    participant DB as PostgreSQL

    A->>F: View /admin/dashboard
    F->>API: GET /api/admin/transactions?limit=10&offset=0
    F->>API: GET /api/admin/revenue
    API->>DB: Aggregate queries (3 SQL)
    API-->>F: Stats + recent transactions
    A->>F: Click "Khóa" trên user X
    F->>F: Open modal, nhập lý do
    A->>F: Confirm
    F->>API: POST /api/admin/users/ban<br/>{user_id, reason}
    API->>API: Auth check (role=ADMIN)
    API->>API: Validate user_id exists, not self
    API->>DB: BEGIN
    API->>DB: UPDATE users SET status='frozen' WHERE user_id=?
    API->>DB: UPDATE authentication_sessions SET expires_at=now()<br/>(invalidate all sessions)
    API->>DB: INSERT INTO audit_logs (actor=admin, action=ban, target=user, reason)
    API->>DB: COMMIT
    API-->>F: 200 {message: success}
    F-->>A: "Đã khóa user X"
    Note over F,API: User X bị đăng xuất ở request kế tiếp<br/>(session expired)
```

### 1.5 Giáo viên tạo khóa học

```mermaid
sequenceDiagram
    autonumber
    actor T as Teacher
    participant F as Course Builder
    participant API as Go API
    participant DB as PostgreSQL

    T->>F: Mở /teacher/courses/{id}/builder
    F->>API: GET /api/teacher/courses/{id}/content
    API->>DB: SELECT modules, lessons, materials
    API-->>F: Course content tree
    F->>F: Render drag-and-drop UI (react-dnd)
    T->>F: Add module
    F->>API: POST /api/teacher/modules {course_id, title, order}
    API->>DB: INSERT INTO general_course_modules
    API-->>F: 200 {module_id}
    F->>T: Module xuất hiện trong tree
    T->>F: Add lesson
    F->>API: POST /api/teacher/lessons {module_id, title, order}
    API->>DB: INSERT INTO general_course_lessons
    API-->>F: 200 {lesson_id}
    T->>F: Drag lesson lên xuống (reorder)
    F->>API: POST /api/teacher/lessons/reorder<br/>{lesson_id, new_order}
    API->>DB: UPDATE order của affected lessons (transaction)
    API-->>F: 200
    T->>F: Publish course
    F->>API: PATCH /api/teacher/courses/{id}/visibility {is_published: true}
    API->>DB: UPDATE general_courses SET is_published=true
    API->>DB: INSERT INTO audit_logs
    API-->>F: 200
    F-->>T: "Khóa học đã xuất bản"
```

### 1.6 Gamification — Streak & Leaderboard

```mermaid
sequenceDiagram
    autonumber
    actor S as Student
    participant API as Go API
    participant R as Redis
    participant DB as PostgreSQL

    Note over S,DB: Streak update (background job mỗi đêm)
    API->>DB: SELECT student_id, last_active_date FROM student_streaks
    loop For each active student
        API->>API: If last_active=yesterday → streak++
        API->>API: If last_active < yesterday → streak=0
        API->>DB: UPDATE student_streaks
        API->>R: ZADD leaderboard:weekly {score} {user_id}
    end

    Note over S,DB: Leaderboard read (lazy)
    S->>API: GET /api/gamification/leaderboard?period=weekly
    API->>R: ZREVRANGE leaderboard:weekly 0 99 WITHSCORES
    alt Cache hit
        R-->>API: top 100 {user, score}
    else Cache miss
        API->>DB: SELECT u.username, sum(score) ... GROUP BY u
        API->>R: ZADD + EXPIRE
        R-->>API: top 100
    end
    API-->>S: 200 {rankings: [...]}
```

---

## 2. Migration Plan (Strangler Fig Pattern)

### 2.1 Nguyên tắc
- **Mỗi tuần**, thay thế **1 module nhỏ** của monolith cũ.
- **Song song** chạy cả code cũ + code mới 2 tuần, route 10% traffic sang code mới trước.
- **Rollback dễ** — chỉ cần tắt route mới.
- **Big-bang rewrite cấm**.

### 2.2 Roadmap 12 tuần

| Tuần | Công việc | Rollback plan |
|------|----------|---------------|
| **1** | Setup `chi` router + middleware chain. Tạo file `cmd/api/main.go` mới. | Code cũ vẫn chạy, file mới chưa được import. |
| **2** | Tách `auth_handler.go` + thêm middleware Auth (verify session). Unit test cho Auth. | Tắt middleware → fallback như cũ. |
| **3** | Tách `admin_handler.go` + RBAC middleware. Thêm `/healthz`, `/readyz`. | Fallback: gọi trực tiếp handler cũ. |
| **4** | Tách `store_handler.go` (CheckoutService riêng). Thêm idempotency table. | Feature flag `USE_NEW_CHECKOUT=0`. |
| **5** | Setup `golang-migrate`. Tạo 3 migration đầu (indexes, idempotency). | Dùng `migrate down` để revert. |
| **6** | Thêm Redis. Wire session cache + rate limit. | `REDIS_ENABLED=0` → fallback DB. |
| **7** | Tái cấu trúc `pgx/v5` cho repository. | Driver cũ vẫn dùng được song song 1 tuần. |
| **8** | Frontend: setup React Router v7 + AuthContext. Giữ `App.jsx` cũ backup. | ENV `USE_NEW_ROUTER=false`. |
| **9** | Frontend: migrate 4 trang (Landing, Login, StudentDash, AdminDash) sang React Router. | Từng trang dùng feature flag. |
| **10** | Migrate 4 trang tiếp (Teacher, Store, Dictionary, Micro). | Như tuần 9. |
| **11** | Thêm `/metrics` Prometheus + structured logging. | Tắt middleware. |
| **12** | Xóa code cũ, document hóa. | Git revert commit. |

### 2.3 Feature flag pattern

```go
// internal/feature/flag.go
package feature

import "os"

func IsEnabled(name string) bool {
  val := os.Getenv("FEATURE_" + name)
  return val == "1" || val == "true"
}

// Usage
if feature.IsEnabled("NEW_CHECKOUT") {
  return newCheckoutHandler.Checkout(w, r)
}
return legacyCheckoutHandler.Checkout(w, r)
```

### 2.4 Testing Strategy

| Layer | Test type | Tool | Coverage target |
|-------|----------|------|-----------------|
| Repository | Integration (real Postgres in Docker) | `dockertest` | 80% |
| Service | Unit (mock repository) | stdlib `testing` + `testify` | 90% |
| Handler | HTTP integration (real router) | `httptest` | 70% |
| Middleware | Unit | `httptest` | 100% |
| E2E | Playwright (UI) | `@playwright/test` | Critical paths |

### 2.5 CI/CD Pipeline (sau migration)

```mermaid
flowchart LR
    A[Push to GitHub] --> B[GitHub Actions: lint + test]
    B --> C{Tests pass?}
    C -->|No| D[Notify dev]
    C -->|Yes| E[Build Docker image]
    E --> F[Push to Registry]
    F --> G[Deploy to Staging]
    G --> H[Run E2E tests]
    H --> I{E2E pass?}
    I -->|No| D
    I -->|Yes| J[Manual approval]
    J --> K[Deploy to Production]
    K --> L[Health check + smoke test]
    L --> M{Healthy?}
    M -->|No| N[Auto rollback]
    M -->|Yes| O[Done]
```

---

## 3. Database Migration Examples

### 3.1 File `001_initial_schema.up.sql` (extract từ init hiện tại)

```sql
-- 001_initial_schema.up.sql
-- Bảng users
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role_id INT NOT NULL REFERENCES roles(role_id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

-- Bảng sessions
CREATE TABLE IF NOT EXISTS authentication_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  session_key VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 File `003_add_critical_indexes.up.sql`

```sql
-- 003_add_critical_indexes.up.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_active
  ON users (username) WHERE is_deleted = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_key_expires
  ON authentication_sessions (session_key, expires_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_created
  ON transaction_logs (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_student_course
  ON course_enrollments (student_id, course_id);
```

### 3.3 File `004_add_idempotency.up.sql`

```sql
-- 004_add_idempotency.up.sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id),
  endpoint TEXT NOT NULL,
  response_status INT,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys (expires_at);

-- Cleanup job (chạy mỗi giờ)
-- DELETE FROM idempotency_keys WHERE expires_at < now();
```

---

## 4. Luồng triển khai (Deployment Flow)

### 4.1 Môi trường hiện tại (Docker Compose)

```yaml
# docker-compose.yml
version: '3.9'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: elearning_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/migrations/seed.sql:/docker-entrypoint-initdb.d/seed.sql
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"

  api:
    build: ./backend
    depends_on: [db, redis]
    environment:
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: postgres
      DB_PASSWORD: postgres
      DB_NAME: elearning_db
      REDIS_HOST: redis
      REDIS_PORT: 6379
      SESSION_TTL: 86400
      REDIS_ENABLED: "1"
      FEATURE_NEW_CHECKOUT: "0"  # toggle khi sẵn sàng
      LOG_LEVEL: info
      LOG_FORMAT: json
    command: ["./wait-for", "db:5432", "redis:6379", "--", "./migrate", "up", "&&", "./api"]
    ports:
      - "8080:8080"

  spa:
    build: ./frontend
    environment:
      VITE_API_URL: http://localhost:8080
    ports:
      - "5173:5173"

volumes:
  pgdata:
```

### 4.2 Health check scripts

```bash
# health-check.sh
#!/bin/bash
# Gọi sau khi deploy
sleep 10
curl -fsS http://localhost:8080/healthz || exit 1
curl -fsS http://localhost:8080/readyz || exit 1
echo "Health check passed"
```

---

## 5. Monitoring & Alerting

### 5.1 Metrics (Prometheus format ở `/metrics`)

| Metric | Type | Labels | Mục đích |
|--------|------|--------|---------|
| `http_requests_total` | counter | method, path, status | Traffic |
| `http_request_duration_seconds` | histogram | method, path | Latency (p95) |
| `http_requests_in_flight` | gauge | - | Concurrency |
| `db_pool_acquired_conns` | gauge | - | DB pool usage |
| `db_query_duration_seconds` | histogram | query_name | DB slow queries |
| `cache_hits_total` / `cache_misses_total` | counter | key_prefix | Cache efficiency |
| `auth_sessions_active` | gauge | - | Active sessions |
| `login_attempts_total` | counter | result | Brute force detection |

### 5.2 Alerts (qua Alertmanager)

```yaml
groups:
  - name: signlearn
    rules:
      - alert: HighP95Latency
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.3
        for: 5m
        labels: { severity: warning }

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels: { severity: critical }

      - alert: DBConnectionsExhausted
        expr: db_pool_acquired_conns / db_pool_total_conns > 0.9
        for: 1m
        labels: { severity: critical }
```

---

## 6. Tổng kết

Tài liệu này cùng với 3 file trước (`01-problem-framing.md`, `02-target-architecture.md`, `03-adrs.md`) tạo thành bộ **architecture documentation đầy đủ** cho dự án SignLearn:

```
docs/architecture/
├── 00-README.md                  ← (file này có thể thêm)
├── 01-problem-framing.md         ← Drivers, constraints, current state
├── 02-target-architecture.md     ← C4 diagrams, layered design, security
├── 03-adrs.md                    ← 9 quyết định có lý do
└── 04-flows-migration.md         ← Luồng nghiệp vụ + 12-week migration plan (file này)
```

**Nguyên tắc review:** Mỗi PR thay đổi kiến trúc phải cập nhật ít nhất 1 trong 4 file trên. ADR mới phải tạo thêm file `05-NNN-title.md`.

---

**Liên hệ:** Kiến trúc sư phụ trách — team Lead Backend
