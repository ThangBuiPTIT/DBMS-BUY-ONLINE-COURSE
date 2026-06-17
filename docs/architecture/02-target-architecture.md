# Target Architecture — SignLearn v2.0

**Ngày:** 2026-06-17  
**Phạm vi:** Backend Go (refactor) + Frontend React (routing) + DevOps (CI/CD, observability)

---

## 1. Tầm nhìn tổng thể (Vision)

Chuyển từ **monolith "mỏng"** (chỉ có 1 file router, không có middleware) sang **layered monolith có cấu trúc rõ ràng**, sẵn sàng tách thành modular monolith / microservices khi cần (Strangler Fig pattern). Hệ thống phải:

- ✅ Có middleware chain chuẩn (auth, RBAC, rate limit, request_id, recovery)
- ✅ Có domain layer riêng (không trộn SQL vào handler)
- ✅ Có health check, metrics, structured logging
- ✅ Frontend có routing chuẩn, lazy loading, code splitting
- ✅ DB schema có migration tool

---

## 2. Sơ đồ C4 — Container view (Target)

```mermaid
C4Container
    title SignLearn — Target State (Layered Monolith)
    Person(student, "Student", "Học từ vựng, mua khóa học")
    Person(teacher, "Teacher", "Tạo khóa học")
    Person(admin, "Admin", "Giám sát giao dịch")

    System_Boundary(c1, "SignLearn Platform") {
        Container(spa, "React SPA", "Vite, React 19, React Router v7", "Code-split routes, BFF-friendly")
        Container(nginx, "nginx", "v1.27", "TLS, rate limit, static SPA, gzip")
        Container(api, "Go API", "Go 1.22, chi router, slog", "Layered: handler→service→repo")
        ContainerDb(pg, "PostgreSQL", "v15 + golang-migrate", "41 tables, monthly partitions")
        ContainerDb(redis, "Redis", "v7", "Session cache, rate limit, leaderboard")
    }

    Rel(student, nginx, "Uses", "HTTPS")
    Rel(teacher, nginx, "Uses", "HTTPS")
    Rel(admin, nginx, "Uses", "HTTPS")
    Rel(nginx, spa, "Serves static", "gzip")
    Rel(nginx, api, "Proxies /api/*", "HTTP/1.1")
    Rel(spa, nginx, "XHR", "fetch with credentials")
    Rel(api, pg, "SQL", "pgx pool, prepared statements")
    Rel(api, redis, "GET/SET/INCR", "go-redis, 5min TTL sessions")
```

### 2.1 Lợi ích so với hiện tại

| Khía cạnh | Hiện tại | Target |
|-----------|----------|--------|
| Router | `http.NewServeMux` (Go stdlib) + string match | `chi` router với middleware chain |
| Middleware | Chỉ có CORS | request_id → recovery → logging → CORS → auth → RBAC → rate limit |
| DB driver | `lib/pq` (cũ) | `pgx/v5` (nhanh hơn 2-3x, native prepared stmt) |
| Session | Chỉ lưu DB, không verify | DB + Redis cache, verify mỗi request |
| Logging | `log.Println` text | `slog` JSON với request_id, user_id, latency |
| Frontend routing | 16 if-else trong `App.jsx` | React Router v7, lazy load theo role |
| Migrations | SQL init script tĩnh | `golang-migrate` với file `up/down` đánh số |
| Caching | Không có | Redis cho leaderboard, course detail, dictionary |
| Health | Không có | `/healthz` (liveness), `/readyz` (readiness) |

---

## 3. Sơ đồ C4 — Component view (Backend layered)

```mermaid
C4Component
    title Go API — Layered Architecture
    Container(api, "Go API", "Go 1.22", "")

    Component(router, "Router", "chi", "URL matching, middleware chain")
    Component(mw, "Middleware", "go-chi/chi", "request_id, recover, logging, CORS, auth, RBAC, rate limit")
    Component(authH, "AuthHandler", "net/http", "Login, logout, refresh")
    Component(adminH, "AdminHandler", "net/http", "Transactions, revenue, ban user")
    Component(storeH, "StoreHandler", "net/http", "Courses, wallet, checkout")
    Component(teacherH, "TeacherHandler", "net/http", "Dashboard, courses, feedback")
    Component(studentH, "StudentHandler", "net/http", "Search, progress, inactive")
    Component(dictH, "DictionaryHandler", "net/http", "Search, categories, variations")
    Component(microH, "MicrolearningHandler", "net/http", "Roadmap, lessons, quiz")
    Component(builderH, "CourseBuilderHandler", "net/http", "Modules, lessons reorder")
    Component(notifH, "LogNotificationHandler", "net/http", "Notifications, audit logs")
    Component(gamH, "GamificationHandler", "net/http", "Leaderboard, streak")

    Component(authS, "AuthService", "Go", "bcrypt, session create/verify")
    Component(storeS, "StoreService", "Go", "Checkout logic, ACID tx, idempotency")
    Component(adminS, "AdminService", "Go", "Aggregations, ban rules")
    Component(teacherS, "TeacherService", "Go", "Analytics, rating aggregations")
    Component(microS, "MicrolearningService", "Go", "Roadmap tree, quiz scoring")

    Component(repoIface, "Repository Interface", "Go interface", "Contract for all data access")
    Component(repoImpl, "Postgres Repository", "pgx", "All SQL queries")
    Component(redisCache, "Redis Cache", "go-redis", "Sessions, leaderboard, hot keys")

    Rel(router, mw, "Uses")
    Rel(mw, authH, "Forwards to")
    Rel(mw, adminH, "Forwards to")
    Rel(mw, storeH, "Forwards to")
    Rel(authH, authS, "Calls")
    Rel(adminH, adminS, "Calls")
    Rel(storeH, storeS, "Calls")
    Rel(teacherH, teacherS, "Calls")
    Rel(microH, microS, "Calls")
    Rel(authS, repoIface, "Uses")
    Rel(storeS, repoIface, "Uses")
    Rel(authS, redisCache, "Cache session")
    Rel(storeS, redisCache, "Idempotency keys")
    Rel(repoImpl, repoIface, "Implements")
```

### 3.1 Lợi ích của layered approach

1. **Handler chỉ làm 3 việc:** parse input, gọi service, format output. Không có SQL.
2. **Service chứa business logic:** validation, authorization, orchestration. Pure Go, dễ test.
3. **Repository là interface** + implementation Postgres. Sau này muốn cache hay dùng mock cho test đều dễ.
4. **Middleware chain** xử lý cross-cutting concerns (auth, logging, rate limit) 1 lần, dùng ở mọi handler.

---

## 4. Luồng xử lý request chuẩn (Request Lifecycle)

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant N as nginx
    participant M as Middleware Chain
    participant H as Handler
    participant S as Service
    participant R as Repository
    participant DB as PostgreSQL
    participant C as Redis

    U->>N: HTTPS GET /api/students/search?q=an
    N->>N: Rate limit by IP (100 rps)
    N->>M: Forward with X-Forwarded-For
    M->>M: 1. RequestID middleware (gen UUID)
    M->>M: 2. Recover panic → 500
    M->>M: 3. Logger (slog JSON)
    M->>M: 4. CORS preflight
    M->>M: 5. Auth (read Session-Key, verify)
    M->>C: GET session:{key}
    alt session hit + not expired
        C-->>M: {user_id, role}
    else miss
        M->>R: SELECT FROM authentication_sessions
        R->>DB: SQL
        DB-->>R: row
        R-->>M: {user_id, role}
        M->>C: SET session:{key} EX 300
    end
    M->>M: 6. RBAC middleware (require role: ADMIN)
    M->>H: Forward to StudentHandler.SearchStudents
    H->>H: Parse query params (limit, offset, q)
    H->>S: studentService.Search(ctx, query)
    S->>S: Validate input, normalize
    S->>R: studentRepo.Search(ctx, query)
    R->>DB: SELECT ... LIMIT 20
    DB-->>R: rows
    R-->>S: []Student
    S-->>H: Result
    H->>H: JSON encode
    H-->>M: 200 OK {students: [...], total: 123}
    M->>M: Logger (latency=42ms, status=200)
    M-->>N: Response
    N-->>U: HTTP 200 + gzip
```

---

## 5. Tái cấu trúc Frontend Routing

### 5.1 Cấu trúc routing mới

```
/                              → LandingPage (public, lazy)
/admin/login                   → AdminLoginPage (public, lazy)
/admin/dashboard               → AdminDashboardPage (admin, lazy)
/admin/audit-logs              → AdminAuditLogsPage (admin, lazy)
/teacher/dashboard             → TeacherDashboardPage (teacher, lazy)
/teacher/courses/:id/builder   → CourseBuilderPage (teacher, lazy)
/student/dashboard             → StudentDashboardPage (student, lazy)
/students/manage               → StudentManagementPage (admin, lazy)
/store                         → CourseStorePage (student, lazy)
/leaderboard                   → LeaderboardPage (public, lazy)
/dictionary                    → DictionaryPage (public, lazy)
/dictionary?word=:word         → DictionaryPage (with search param)
/microlearning/roadmap         → MicrolearningRoadmapPage (student, lazy)
/microlearning/lessons/:id/quiz → LessonQuizPage (student, lazy)
```

### 5.2 Auth Provider + Protected Route

```jsx
<AuthProvider>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
        <Route path="/students/manage" element={<StudentManagementPage />} />
      </Route>
      <Route element={<ProtectedRoute roles={['TEACHER', 'ADMIN']} />}>
        <Route path="/teacher/dashboard" element={<TeacherDashboardPage />} />
        <Route path="/teacher/courses/:id/builder" element={<CourseBuilderPage />} />
      </Route>
      <Route element={<ProtectedRoute roles={['STUDENT', 'ADMIN']} />}>
        <Route path="/student/dashboard" element={<StudentDashboardPage />} />
        <Route path="/store" element={<CourseStorePage />} />
        <Route path="/microlearning/roadmap" element={<MicrolearningRoadmapPage />} />
        <Route path="/microlearning/lessons/:id/quiz" element={<LessonQuizPage />} />
      </Route>
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/dictionary" element={<DictionaryPage />} />
    </Routes>
  </BrowserRouter>
</AuthProvider>
```

### 5.3 Auth Context (centralized)

```jsx
// src/contexts/AuthContext.jsx
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionKey = localStorage.getItem('session_key');
    const adminUser = localStorage.getItem('admin_user');
    if (sessionKey && adminUser) {
      setUser(JSON.parse(adminUser));
    }
    setLoading(false);
  }, []);

  const login = (user, sessionKey) => {
    localStorage.setItem('session_key', sessionKey);
    localStorage.setItem('admin_user', JSON.stringify(user));
    localStorage.setItem('role_name', user.role_name);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('session_key');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('role_name');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

## 6. Thay đổi Database

### 6.1 Migration tool

Dùng [`golang-migrate`](https://github.com/golang-migrate/migrate) với cấu trúc:

```
backend/
  migrations/
    001_initial_schema.up.sql
    001_initial_schema.down.sql
    002_add_session_index.up.sql
    002_add_session_index.down.sql
    ...
```

### 6.2 Index mới cần thêm (P0)

```sql
-- migrations/003_add_critical_indexes.up.sql
CREATE INDEX CONCURRENTLY idx_users_username ON users (username) WHERE is_deleted = false;
CREATE INDEX CONCURRENTLY idx_sessions_key_expires ON authentication_sessions (session_key, expires_at);
CREATE INDEX CONCURRENTLY idx_transactions_created ON transaction_logs (created_at DESC);
CREATE INDEX CONCURRENTLY idx_enrollments_student_course ON course_enrollments (student_id, course_id);
CREATE INDEX CONCURRENTLY idx_student_streaks_student ON student_streaks (student_id);
```

### 6.3 Bảng mới: `idempotency_keys` (chống double-charge)

```sql
-- migrations/004_add_idempotency.up.sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  response_status INT,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_idempotency_expires ON idempotency_keys (expires_at);
```

---

## 7. Observability

### 7.1 Structured logging (slog)

```go
// internal/middleware/logger.go
func Logger(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    start := time.Now()
    reqID := middleware.GetReqID(r.Context())

    ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
    next.ServeHTTP(ww, r)

    slog.Info("http_request",
      "request_id", reqID,
      "method", r.Method,
      "path", r.URL.Path,
      "status", ww.Status(),
      "latency_ms", time.Since(start).Milliseconds(),
      "user_id", auth.UserIDFromContext(r.Context()),
      "role", auth.RoleFromContext(r.Context()),
      "remote_ip", r.RemoteAddr,
    )
  })
}
```

### 7.2 Health checks

| Endpoint | Mục đích | Trả về |
|----------|----------|--------|
| `GET /healthz` | Liveness (process còn sống) | 200 "ok" |
| `GET /readyz` | Readiness (DB+Redis ready) | 200/503 |
| `GET /metrics` | Prometheus | text format |

---

## 8. Security Layers

```mermaid
flowchart LR
    A[Client] -->|HTTPS| B[nginx<br/>rate-limit IP]
    B -->|X-Forwarded-For| C[API Gateway<br/>CORS + helmet]
    C -->|Session-Key| D[Auth Middleware<br/>verify session]
    D -->|role| E[RBAC Middleware<br/>require role X]
    E -->|valid| F[Handler]
    F -->|sanitize| G[Service]
    G -->|param query| H[Repository]
    H -->|pgx prepared stmt| I[(PostgreSQL)]
```

| Layer | Công cụ | Bảo vệ |
|-------|---------|--------|
| Edge | nginx | TLS, IP rate limit, gzip, static |
| CORS | chi/cors | Origin whitelist |
| Auth | chi middleware | Session verify (DB+Redis) |
| RBAC | chi middleware | Role-based allow list |
| Input | validator/v10 | Schema validation |
| SQL | pgx prepared stmt | SQL injection |
| Output | Go html/template | XSS (nếu render HTML) |
| Audit | log table | SOC-2 trail |

---

## 9. Bảng so sánh Trade-offs

| Quyết định | Alternative | Lý do chọn | Trade-off |
|-----------|-------------|-----------|-----------|
| **chi router** | gorilla/mux, gin, stdlib | Nhẹ, idiomatic Go, middleware chuẩn net/http | Phải tự setup CSRF (nhưng SPA không cần) |
| **pgx/v5** | lib/pq (hiện tại), gorm | Nhanh hơn, prepared stmt, batch query | Không phải ORM → viết SQL thủ công |
| **Redis cache** | In-memory map, Memcached | Phổ biến, hỗ trợ TTL, có pub/sub | Thêm 1 service để quản lý |
| **React Router v7** | TanStack Router, Wouter | Chuẩn, lazy loading tốt, data router | Bundle lớn hơn Wouter ~20KB |
| **golang-migrate** | goose, sqlx, Atlas | CLI đơn giản, có Docker image | Không có GUI quản lý |
| **JWT (cho phase 3)** | Session (hiện tại) | Stateless, scale tốt | Phải có refresh token rotation |
| **Layered monolith** | Microservices ngay | Đơn giản, deploy 1 binary | Scale theo chiều dọc đến giới hạn |

---

## 10. Risk Register

| Risk | Xác suất | Tác động | Mitigation |
|------|----------|----------|------------|
| Refactor mất nhiều thời gian | High | High | Strangler Fig: giữ endpoint cũ, viết service mới bên cạnh, route dần |
| Frontend breaking change | Medium | High | Bật React Router mới ở `/v2/*` song song, fallback về `App.jsx` cũ |
| DB migration gây downtime | Medium | High | Dùng `CREATE INDEX CONCURRENTLY`, chạy ngoài giờ cao điểm |
| Thiếu test khi refactor | High | High | Bắt buộc test cho mỗi service mới, dùng table-driven tests |

---

**Tài liệu tiếp theo:** [03-adrs.md](./03-adrs.md) — các ADR cho quyết định kiến trúc
