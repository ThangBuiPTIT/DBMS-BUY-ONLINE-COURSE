# DBMS — E-Learning Sign Language

Hệ thống **E-Learning ngôn ngữ ký hiệu** gồm:

- **Backend**: FastAPI + asyncpg + PostgreSQL (quản lý bằng **pgAdmin4**, không dùng Docker).
- **Frontend**: React 19 + Vite + Tailwind v4 + Framer Motion.
- **Database**: PostgreSQL 5432, schema gồm 18 bảng, procedure, trigger, transaction, materialized view.

## Cấu trúc repo

```
DBMS-BUY-ONLINE-COURSE-fastapi/
├── backend/                                # FastAPI app
│   ├── app/
│   │   ├── api/                            # routers
│   │   ├── core/                           # config, security
│   │   ├── db/                             # async session + seed
│   │   ├── models/                         # ORM
│   │   ├── schemas/                        # Pydantic
│   │   ├── services/                       # business logic
│   │   └── main.py
│   ├── alembic/                            # migration versions
│   ├── tests/
│   ├── .env.example                        # copy thành .env rồi sửa
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/                               # React 19 + Vite + Tailwind v4
│   ├── src/
│   │   ├── api/client.js                   # axios instance + interceptor Session-Key
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env                                # VITE_API_URL=http://localhost:8000
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
├── docs/
├── ERD.sql                                 # schema
├── procedure_trigger_transaction.sql        # procedure / trigger / view
├── seed_data.py
├── Ke_hoach_ap_dung_HQTCSDL_Elearning.md
├── PROJECT_STRUCTURE.md
├── CLAUDE.md
└── README.md                               # file này
```

## Yêu cầu môi trường

| Phần mềm | Phiên bản | Ghi chú |
|----------|-----------|---------|
| Python | 3.11+ | dùng `venv` đi kèm |
| Node.js | 18+ | cho Vite |
| PostgreSQL | 14+ | dùng pgAdmin4 để quản lý |
| pgAdmin4 | 7+ | tạo DB, chạy Query Tool |

> Repo này **không dùng Docker**. Mọi thứ chạy local trên Windows / macOS / Linux.

## Hướng dẫn chạy (một lần)

### Bước 1 — Tạo database trong pgAdmin4

1. Mở **pgAdmin4**, đăng nhập bằng user master của bạn (mặc định `postgres`).
2. Chuột phải **Databases** → **Create** → **Database…**
   - **Database**: `elearning_db`
   - **Owner**: `postgres` (hoặc user pgAdmin4 của bạn)
   - Bấm **Save**.
3. (Tuỳ chọn) Tạo thêm user riêng cho app, cấp quyền trên `elearning_db`.

### Bước 2 — Chạy schema SQL

Trong **Query Tool** của pgAdmin4, mở và Execute từng file (theo thứ tự):

1. `ERD.sql` — tạo 18 bảng, enum, index cơ bản.
2. `procedure_trigger_transaction.sql` — procedure, trigger, materialized view.

> Hoặc nếu đã cài `psql`:
> ```bash
> psql -U postgres -d elearning_db -f ERD.sql
> psql -U postgres -d elearning_db -f procedure_trigger_transaction.sql
> ```

### Bước 3 — Cài backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Copy file môi trường và sửa cho khớp user/mật khẩu Postgres bạn vừa tạo:

```bash
# Windows
copy .env.example .env
# macOS / Linux
cp .env.example .env
```

Mở `backend/.env` và chỉnh:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres         # ← sửa thành mật khẩu pgAdmin4 của bạn
DB_NAME=elearning_db

DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/elearning_db

SECRET_KEY=change-me-to-a-random-secret
SESSION_EXPIRE_HOURS=24
APP_NAME=E-Learning Sign Language API
DEBUG=true
```

### Bước 4 — Alembic migration

```bash
alembic upgrade head
```

Lệnh này chạy các migration trong `backend/alembic/versions/` để tạo index, trigger, materialized view còn lại.

### Bước 5 — Seed dữ liệu mẫu

```bash
python -m app.db.seed
```

> Hoặc chạy file gốc ở root:
> ```bash
> python seed_data.py
> ```

Tài khoản admin mặc định sau khi seed:

- **Username**: `admin`
- **Password**: `admin123`

### Bước 6 — Khởi động API

```bash
uvicorn app.main:app --reload --port 8000
```

API sẽ chạy ở `http://localhost:8000`. Swagger UI: `http://localhost:8000/docs`.

> CORS đã mở `allow_origins=["*"]` trong `backend/app/main.py`, nên Vite dev server (cổng 5173) gọi được không cần cấu hình thêm.

### Bước 7 — Khởi động frontend

Mở terminal mới:

```bash
cd frontend
npm install
npm run dev
```

Mặc định Vite in ra URL `http://localhost:5173`. Mở trình duyệt vào đó.

## Kiến trúc tích hợp Frontend ↔ Backend

Frontend dùng **một axios instance duy nhất** ở `frontend/src/api/client.js`:

- `API_URL` đọc từ `frontend/.env` (mặc định `http://localhost:8000`).
- Mọi request tự động gắn header `Session-Key: <uuid>` nếu `localStorage.session_key` tồn tại.
- Response `401` sẽ tự xóa session, đẩy về `/admin/login`.
- Mọi page/component import `{ api, getCurrentUser }` từ `../api/client` thay cho `axios` mặc định — chỉ có **một** chỗ chứa base URL là file `.env`.

Đăng nhập admin:

1. Vào `http://localhost:5173/admin/login`.
2. Nhập `admin` / `admin123`.
3. Response trả về `session_key` + `user` → lưu `localStorage`.
4. Mọi request tiếp theo tự gắn `Session-Key` qua interceptor.

## Tài liệu tham chiếu

- `PROJECT_STRUCTURE.md` — chi tiết từng module backend + frontend.
- `Ke_hoach_ap_dung_HQTCSDL_Elearning.md` — kế hoạch áp dụng các kỹ thuật HQTCSDL (procedure, trigger, transaction, view).
- `docs/` — tài liệu kỹ thuật bổ sung.
- `CLAUDE.md` — ghi chú dành cho AI assistant làm việc với repo này.
