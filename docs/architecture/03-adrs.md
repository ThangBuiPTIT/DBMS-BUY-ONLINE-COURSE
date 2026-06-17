# Architecture Decision Records (ADR)

Mỗi ADR ghi lại một quyết định kiến trúc quan trọng: bối cảnh, lựa chọn, hệ quả.

---

## ADR-001: Dùng `chi` router thay cho `http.ServeMux` chuẩn

**Ngày:** 2026-06-17  
**Trạng thái:** Accepted

### Context
Hiện tại backend dùng `http.NewServeMux()` từ stdlib Go, route thủ công bằng `mux.HandleFunc("/api/auth/admin-login", ...)` trong 1 file `main.go` 117 dòng. Vấn đề:
- Không có middleware chaining (CORS bị duplicate ở mỗi handler).
- Path parameter (`{id}`, `{user_id}`) không được hỗ trợ, phải tự `strings.Split` URL (`store_handler.go:20-35`).
- Thứ tự đăng ký route quan trọng và dễ sai.
- Không hỗ trợ route groups (vd: `/api/admin/*` cần prefix chung).

### Decision
Chuyển sang dùng [`go-chi/chi`](https://github.com/go-chi/chi) v5. Lý do:
- Idiomatic Go: dùng `http.Handler` chuẩn, không phải custom context.
- Middleware chain rất mạnh (compose được nhiều layer).
- Hỗ trợ path variables `/{id}` và route groups `r.Route("/api/admin", ...)`.
- ~0 dependency, ~0 overhead (chỉ routing, không phải framework đầy đủ).
- Được dùng bởi nhiều production Go service lớn (Cloudflare, Heroku).

### Alternatives Considered
- **gorilla/mux**: Đã ngừng maintain chính thức (2022), không khuyến khích dùng.
- **gin**: Full framework có cả ORM, validation, render — quá nặng cho nhu cầu.
- **echo**: Tương tự gin, đẹp nhưng nhiều "magic", khó debug.
- **stdlib `http.ServeMux` (Go 1.22+)**: Có path variables và method routing, nhưng vẫn không có middleware chain đúng nghĩa.

### Consequences

**Tích cực:**
- Middleware chain gọn gàng: `r.Use(requestID, logger, recover, cors, auth)`.
- Code routing tách bằng `r.Route("/api/admin", func(r chi.Router) {...})`.
- Path params dùng `chi.URLParam(r, "id")` thay cho `strings.Split` thủ công.
- Cộng đồng lớn, document tốt.

**Tiêu cực:**
- Phải viết thêm boilerplate (so với stdlib). Chấp nhận được.
- Phải wrap response writer để capture status code trong logging middleware.

---

## ADR-002: Chuyển từ `lib/pq` sang `pgx/v5`

**Ngày:** 2026-06-17  
**Trạng thái:** Accepted

### Context
Backend dùng `github.com/lib/pq` — driver cũ (maintenance mode), không hỗ trợ:
- Native PostgreSQL protocol (chỉ là wrapper text protocol).
- Prepared statement caching tự động.
- Batch queries / COPY.
- Type-safe UUID, JSONB, arrays.

### Decision
Dùng [`jackc/pgx/v5`](https://github.com/jackc/pgx) — driver hiện đại nhất cho PostgreSQL trong Go.

### Alternatives Considered
- **gorm**: ORM đầy đủ, performance overhead, abstraction che giấu SQL. Không phù hợp với team muốn kiểm soát SQL.
- **sqlx**: Extension của `database/sql`, tốt nhưng vẫn dùng `database/sql` interface.
- **ent**: ORM Facebook, typed schema — quá nặng cho 41 bảng.

### Consequences

**Tích cực:**
- Nhanh hơn `lib/pq` 2-3x nhờ binary protocol.
- Connection pool built-in với tuning tốt (max conn, min idle, health check period).
- `pgxpool.Pool` an toàn cho concurrent.
- Hỗ trợ `pgx.NamedArgs`, struct scan tự động.
- Tích hợp sẵn với OpenTelemetry tracing.

**Tiêu cực:**
- API khác `database/sql` → phải viết lại code query.
- Cú pháp placeholder là `$1, $2, ...` thay vì `?` (đã quen thuộc với team).

---

## ADR-003: Thêm Redis để cache session và rate limit

**Ngày:** 2026-06-17  
**Trạng thái:** Accepted

### Context
Hiện tại mỗi request cần xác thực sẽ query DB để verify session. Với 18K MAU, lưu lượng ~50 req/s:
- Tốn DB connection (Postgres chỉ chịu ~100 concurrent).
- Tăng latency (round-trip 5-10ms).
- Không có rate limit ở edge.

### Decision
Thêm Redis 7 với 2 use case chính:
1. **Session cache**: `session:{key} → {user_id, role}` với TTL 5 phút. Hit rate kỳ vọng 95%.
2. **Rate limit**: `ratelimit:{ip}:{minute} → count` với TTL 60s. Limit 100 req/phút/IP.

### Alternatives Considered
- **In-memory cache (sync.Map + TTL)**: Không share được giữa nhiều API instance.
- **Memcached**: Cũng được nhưng Redis có pub/sub, sorted set (cho leaderboard), và tool phong phú hơn.
- **Stickiness ở nginx (IP hash)**: Không giải quyết được session cache.

### Consequences

**Tích cực:**
- Giảm ~80% query đến bảng `authentication_sessions`.
- Rate limit chống brute force login (đặc biệt admin endpoint).
- Leaderboard có thể dùng Redis ZSET thay vì query DB mỗi lần (dự phòng).
- Sẵn sàng cho các use case khác (cache dictionary, course detail).

**Tiêu cực:**
- Thêm 1 service phải quản lý (container, backup, monitor).
- Cache invalidation: khi admin ban user, phải invalidate session cache. → Thêm `DEL session:*` script chạy mỗi 30s.
- Phải handle Redis down gracefully (fallback về DB lookup).

---

## ADR-004: Migration tool — `golang-migrate`

**Ngày:** 2026-06-17  
**Trạng thái:** Accepted

### Context
DB schema hiện tại được tạo qua 1 file SQL init ban đầu. Không có cách:
- Áp dụng schema mới một cách versioned.
- Rollback khi deploy lỗi.
- Reproduce local environment.
- Track ai sửa gì khi nào.

### Decision
Dùng [`golang-migrate/migrate`](https://github.com/golang-migrate/migrate) v4. Mỗi migration có 2 file:
- `NNN_description.up.sql`: áp dụng thay đổi.
- `NNN_description.down.sql`: rollback.

Lưu tại `backend/migrations/`, chạy tự động khi container backend start.

### Alternatives Considered
- **goose**: Cũng tốt, có Go API nhưng CLI kém hơn.
- **Atlas**: Schema-as-code, đẹp nhưng learning curve cao.
- **Liquibase / Flyway**: Java tooling, không phù hợp Go stack.
- **Custom scripts**: Tự viết, nhanh nhưng dễ bug.

### Consequences

**Tích cực:**
- CI/CD có thể chạy `migrate up` tự động trước khi deploy.
- Có thể chạy `migrate down 1` để rollback nhanh.
- Lịch sử migration là documentation.
- Hỗ trợ dirty state recovery.

**Tiêu cực:**
- Phải viết `down.sql` cho mỗi migration → tăng effort.
- Không thể modify migration đã commit (phải tạo migration mới).

---

## ADR-005: Frontend routing dùng React Router v7 thay cho if-else

**Ngày:** 2026-06-17  
**Trạng thái:** Accepted

### Context
`App.jsx` hiện dùng `if (path === '/admin/dashboard') return <X />` cho 16 routes:
- Không có lazy loading → bundle lớn (~500KB JS cho 1 lần tải).
- Auth check lặp lại ở mỗi trang (insecure).
- Khó maintain khi thêm route mới.
- Không có URL params, query string chuẩn.

### Decision
Dùng `react-router-dom` v7 với:
- `createBrowserRouter()` + `RouterProvider` (data router API).
- `lazy()` cho từng page component → code split.
- `<ProtectedRoute roles={[...]}>` wrapper cho RBAC.
- `AuthContext` centralized ở root.

### Alternatives Considered
- **TanStack Router**: Mới, type-safe cực tốt, nhưng learning curve cao, cộng đồng nhỏ hơn.
- **Wouter**: Nhẹ (1KB) nhưng thiếu data loading API.
- **Giữ if-else**: Đơn giản nhưng không scale.

### Consequences

**Tích cực:**
- Bundle ban đầu giảm ~60% (chỉ tải trang cần).
- Auth check 1 lần ở `ProtectedRoute`, không lặp.
- URL chuẩn, có thể share link.
- Dễ thêm route mới (1 dòng trong `routes.jsx`).

**Tiêu cực:**
- Phải refactor `App.jsx` thành nhiều file (`routes.jsx`, `ProtectedRoute.jsx`, `AuthContext.jsx`).
- Phải test kỹ redirect logic khi session expired.
- Bundle riêng cho từng page nhưng có thể tăng số lượng HTTP request (giảm nhẹ).

---

## ADR-006: Session-based auth giữ ở phase 1, chuyển JWT ở phase 2

**Ngày:** 2026-06-17  
**Trạng thái:** Accepted (with planned evolution)

### Context
Hệ thống hiện dùng session key lưu trong DB (`authentication_sessions`) và client localStorage. Đây là cách đơn giản nhưng:
- Phải query DB mỗi request (sẽ được cache qua Redis theo ADR-003).
- Không scale tốt khi có nhiều API instance (phải share session store).
- Khó dùng cho mobile app sau này.

JWT là lựa chọn phổ biến nhưng có nhiều cạm bẫy (refresh token rotation, key rotation, không thể revoke dễ).

### Decision
**Phase 1 (hiện tại → 6 tháng):** Giữ session-based, thêm Redis cache.
**Phase 2 (6-12 tháng):** Chuyển sang JWT access token (15 phút) + refresh token (7 ngày) khi:
- Cần ≥ 3 API instances.
- Có mobile app.
- Có WebSocket.

### Alternatives Considered
- **JWT ngay bây giờ**: Phức tạp, chưa cần.
- **OAuth2 / OIDC**: Quá mức cần thiết, nên dùng Auth0/Clerk nếu muốn.

### Consequences

**Tích cực:**
- Phase 1 đơn giản, đáp ứng nhu cầu hiện tại.
- Phase 2 có lộ trình rõ ràng.
- Có thể migrate song song (giữ endpoint cũ, expose endpoint mới).

**Tiêu cực:**
- Phải làm 2 lần. Chấp nhận được vì phase 1 đã đủ dùng.
- Session cookie cần `Secure`, `HttpOnly`, `SameSite=Strict` (đang để trong localStorage — chưa tốt nhưng tạm OK cho phase 1).

---

## ADR-007: Structured logging với `slog` (stdlib)

**Ngày:** 2026-06-17  
**Trạng thái:** Accepted

### Context
Hiện tại dùng `log.Println` cho mọi thứ:
```go
log.Printf("Server is running on port %s...", port)
```
Output là text không cấu trúc, khó query, không có request_id, user_id.

### Decision
Dùng `log/slog` (Go 1.21+, stdlib) với JSON handler. Mỗi log có:
- `request_id`, `user_id`, `role` (từ context)
- `method`, `path`, `status`, `latency_ms`
- `error` nếu có

Output: stdout, được Docker / Promtail / Loki / CloudWatch thu thập.

### Alternatives Considered
- **zerolog / zap**: Nhanh hơn slog ~5x, nhưng cần thêm dependency.
- **logrus**: Đã deprecated maintain.

### Consequences

**Tích cực:**
- 0 dependency mới.
- JSON format chuẩn, query bằng Loki/Datadog/CloudWatch.
- `slog.With()` cho phép gắn context vào logger.

**Tiêu cực:**
- slog hơi chậm so với zap/zerolog. Chấp nhận được vì traffic < 1K rps.

---

## ADR-008: Chuẩn hóa CORS — bỏ duplicate ở mỗi handler

**Ngày:** 2026-06-17  
**Trạng thái:** Accepted

### Context
Mỗi handler có ~15 dòng CORS boilerplate ở đầu:
```go
w.Header().Set("Access-Control-Allow-Origin", "*")
w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, ...")
if r.Method == http.MethodOptions {
    w.WriteHeader(http.StatusOK)
    return
}
```

Điều này lặp ở 11 handlers → ~165 dòng trùng lặp, dễ sai (thiếu header, sai origin).

### Decision
Dùng [`go-chi/cors`](https://github.com/go-chi/cors) middleware:
```go
r.Use(cors.Handler(cors.Options{
    AllowedOrigins:   []string{"https://app.signlearn.com", "http://localhost:5173"},
    AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "Session-Key"},
    AllowCredentials: true,
    MaxAge:           300,
}))
```

Xóa toàn bộ CORS code ở 11 handlers.

### Consequences

**Tích cực:**
- Xóa ~150 dòng boilerplate.
- 1 nơi duy nhất để config CORS policy.
- Whitelist origin thay vì `*` (an toàn hơn).

**Tiêu cực:**
- Origin list phải update khi deploy lên domain mới (có thể đọc từ env).

---

## ADR-009: Không tách Microservices trong giai đoạn này

**Ngày:** 2026-06-17  
**Trạng thái:** Accepted

### Context
Hệ thống hiện là monolith. Microservices giải quyết scaling độc lập, team autonomy, deploy độc lập. Nhưng:
- Tăng complexity (network, serialization, distributed tracing).
- Tăng cost (nhiều container, nhiều DB instance).
- Khó debug khi có lỗi.
- Team hiện chỉ 3-5 người → không đủ để vận hành 5+ service.

### Decision
Giữ **layered monolith** cho đến khi:
- Có ≥ 100K MAU.
- Có ≥ 2 team (frontend, backend) cần deploy độc lập.
- 1 module (vd: gamification) chiếm > 50% CPU.

Khi đó sẽ tách **modular monolith** trước (chia package, giao tiếp qua interface), sau đó mới extract thành service.

### Alternatives Considered
- **Tách ngay**: Quá sớm, tốn effort không tương xứng.
- **Distributed monolith** (nhiều service, cùng DB): Tệ nhất, vừa chậm vừa khó.

### Consequences

**Tích cực:**
- Đơn giản, 1 binary, 1 DB.
- Refactor dễ (cùng process).
- Phù hợp team size hiện tại.

**Tiêu cực:**
- Scale theo chiều dọc (vertical) đến giới hạn. Tạm OK vì 18K MAU.
- 1 bug có thể ảnh hưởng toàn bộ hệ thống (mitigate bằng panic recovery middleware).

---

## Tổng hợp

| ADR | Decision | Status |
|-----|----------|--------|
| 001 | chi router | Accepted |
| 002 | pgx/v5 | Accepted |
| 003 | Redis cache | Accepted |
| 004 | golang-migrate | Accepted |
| 005 | React Router v7 | Accepted |
| 006 | Session → JWT (2 phases) | Accepted |
| 007 | slog | Accepted |
| 008 | CORS middleware | Accepted |
| 009 | Layered monolith | Accepted |
