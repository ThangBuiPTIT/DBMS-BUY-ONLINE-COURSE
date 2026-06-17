# Plan Phase 3: Procedures, Transactions & Locking

**Status:** 📋 Planning  
**Blueprint Reference:** `Ke_hoach_ap_dung_HQTCSDL_Elearning.md` — Phần 4 (Transaction) + Phần 5 (Procedure) + Phần 12 (Concurrency & Locking)  
**Target Branch:** `fastapi`  
**Prerequisites:** Plan 2 (Triggers) complete

---

## 1. Current State Audit

### 1.1 Existing Procedures & Their Usage

| Procedure / Function | Location | Called By | Locking? | Isolation? |
|---------------------|----------|-----------|----------|------------|
| `sp_topup_wallet` | `procedures.sql:179` | `services/store.py:59` | No explicit lock | Default READ COMMITTED |
| `sp_buy_course_with_wallet` | `procedures.sql:190` | `services/store.py:77` | `FOR UPDATE` on wallet | Default READ COMMITTED |
| `sp_refund_course` | `procedures.sql:223` | `services/store.py:106` | Advisory lock in app code | Default READ COMMITTED |
| `sp_ban_user` | `procedures.sql:245` | `services/admin.py:63` | None | Default READ COMMITTED |
| `sp_update_course_progress` | `procedures.sql:169` | `services/course_builder.py:496` | None | Default READ COMMITTED |
| `fn_search_students` | `procedures.sql:117` | `services/student.py:8` | N/A (STABLE) | N/A |
| `fn_check_certificate_eligibility` | `procedures.sql:127` | `services/certificate.py:17` | N/A (STABLE) | N/A |
| `fn_get_user_real_balance` | `procedures.sql:138` | `services/admin.py:91` | N/A (STABLE) | N/A |
| `fn_get_course_completion_rate` | `procedures.sql:150` | `services/admin.py:118` | N/A (STABLE) | N/A |

### 1.2 Gap Analysis

| Blueprint Technique | Current Status | Severity |
|-------------------|---------------|----------|
| `sp_transfer_funds` (deadlock-proof) | ❌ **NOT CREATED** | 🔴 Critical |
| `sp_enroll_paid_course` (composite) | ❌ **NOT CREATED** | 🔴 Critical |
| `SERIALIZABLE` isolation for wallets | ❌ Not used | 🟡 High |
| Pessimistic locking (`SELECT FOR UPDATE`) | ⚠️ Only in `sp_buy_course_with_wallet` | 🟡 High |
| Optimistic locking (`updated_at` checks) | ❌ Not implemented | 🟡 High |
| Deadlock prevention (ordered locking) | ❌ Not implemented | 🔴 Critical |
| `SKIP LOCKED` for worker queues | ❌ Not used | 🟢 Medium |
| Advisory locks for cron tasks | ⚠️ Only in `refund_course` | 🟢 Medium |
| `pg_try_advisory_lock` for singleton tasks | ❌ Not used | 🟢 Medium |
| `sp_transfer_funds` autonomous transaction note | ❌ Not documented | 🟢 Low (thesis value) |

### 1.3 Why These Gaps Are Critical

**`sp_transfer_funds`**: The blueprint's flagship procedure. Without it:
- The `sp_buy_course_with_wallet` hardcodes "pay admin" — can't transfer between students, can't pay teachers directly
- No deadlock prevention: if two transfers A→B and B→A happen concurrently without ordered locking, deadlock
- Missing the ACID showcase for the thesis

**`sp_enroll_paid_course`**: The composite that chains `sp_transfer_funds` + enrollment insert. Without it:
- Business logic is duplicated across `sp_buy_course_with_wallet` and would need to be duplicated for any new purchase flow
- The `sp_buy_course_with_wallet` is monolithic — it does "pay admin" instead of "pay teacher" (which the blueprint specifies)

---

## 2. Implementation Plan

### 2.1 Step 1: Create `sp_transfer_funds` — ACID + Deadlock Prevention

**File:** `backend/app/db/procedures.sql` (append to Phần 3)

```sql
-- ====================================================================================
-- 3.6 Chuyển tiền giữa 2 ví — Full ACID + chống Deadlock
-- Tác dụng: Chuyển tiền an toàn giữa 2 user bất kỳ.
--          Tự động sắp xếp thứ tự khóa để tránh deadlock.
--          Ghi log giao dịch đầy đủ.
-- ====================================================================================
CREATE OR REPLACE PROCEDURE sp_transfer_funds(
    p_from   UUID,
    p_to     UUID,
    p_amount NUMERIC,
    p_message TEXT DEFAULT 'Chuyển tiền'
)
LANGUAGE plpgsql AS $$
DECLARE
    v_from_balance NUMERIC;
    v_tx_id        UUID;
    v_first        UUID;
    v_second       UUID;
BEGIN
    -- (1) Validate input
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Số tiền phải > 0 (received: %)', p_amount;
    END IF;
    IF p_from = p_to THEN
        RAISE EXCEPTION 'Không thể tự chuyển tiền cho chính mình';
    END IF;

    -- (2) DEADLOCK PREVENTION: luôn khóa hàng theo thứ tự user_id cố định
    --     Dù gọi sp_transfer_funds(A, B, X) hay sp_transfer_funds(B, A, X)
    --     thì thứ tự khóa luôn là: user_id nhỏ hơn → user_id lớn hơn
    --     → không bao giờ có circular wait → không deadlock
    IF p_from < p_to THEN
        v_first := p_from;
        v_second := p_to;
    ELSE
        v_first := p_to;
        v_second := p_from;
    END IF;

    -- Khóa cả 2 ví theo thứ tự cố định (pessimistic lock)
    PERFORM 1 FROM wallets WHERE user_id = v_first  FOR UPDATE;
    PERFORM 1 FROM wallets WHERE user_id = v_second FOR UPDATE;

    -- (3) Kiểm tra số dư SAU khi đã khóa (tránh race condition)
    SELECT balance INTO v_from_balance
    FROM wallets
    WHERE user_id = p_from;

    IF v_from_balance < p_amount THEN
        RAISE EXCEPTION 'Số dư không đủ (balance: %, need: %)',
            v_from_balance, p_amount;
    END IF;

    -- (4) Atomic execution — tất cả hoặc không gì cả
    UPDATE wallets
    SET balance = balance - p_amount
    WHERE user_id = p_from;

    UPDATE wallets
    SET balance = balance + p_amount
    WHERE user_id = p_to;

    -- Ghi log giao dịch thành công
    INSERT INTO transaction_logs (
        from_wallet_user_id,
        to_wallet_user_id,
        amount,
        status,
        message
    )
    VALUES (p_from, p_to, p_amount, 'SUCCESS', p_message)
    RETURNING transaction_id INTO v_tx_id;

    -- Ghi action log
    INSERT INTO transaction_action_logs (
        transaction_id,
        action_type,
        message
    )
    VALUES (v_tx_id, 'TRANSFER_COMPLETE', 'OK');

    -- (5) Nếu tới đây không có exception → PostgreSQL tự động COMMIT
    --     Nếu có exception ở bất kỳ bước nào → toàn bộ ROLLBACK (Atomicity)
END;
$$;
```

**Key design decisions (for thesis documentation):**

| ACID Property | How It's Guaranteed |
|--------------|-------------------|
| **Atomicity** | PostgreSQL procedural transaction: any `RAISE EXCEPTION` → full rollback |
| **Consistency** | `ck_wallets_balance_non_negative` + pre-check `v_from_balance < p_amount` |
| **Isolation** | `SELECT ... FOR UPDATE` on BOTH wallets before any mutation |
| **Durability** | PostgreSQL WAL (Write-Ahead Log) — committed data survives crash |

**Deadlock prevention analysis:**
```
Without ordered locking:
  T1: sp_transfer_funds(A→B, 100) → khóa A, chờ khóa B
  T2: sp_transfer_funds(B→A, 50)  → khóa B, chờ khóa A
  → DEADLOCK (circular wait)

With ordered locking (user_id comparison):
  T1: A<B → khóa A, khóa B (thành công)
  T2: A<B → chờ khóa A, ...
  → T2 chờ T1 hoàn thành → KHÔNG deadlock
```

---

### 2.2 Step 2: Create `sp_enroll_paid_course` — Composite Business Transaction

**File:** `backend/app/db/procedures.sql` (append)

```sql
-- ====================================================================================
-- 3.7 Đăng ký khóa học trả phí (Gộp chuyển tiền + ghi danh)
-- Tác dụng: 1 transaction duy nhất: trừ tiền học viên → cộng tiền giáo viên → ghi danh
--          Nếu khóa đã đăng ký → rollback toàn bộ (kể cả chuyển tiền)
-- ====================================================================================
CREATE OR REPLACE PROCEDURE sp_enroll_paid_course(
    p_student UUID,
    p_course  UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_price   NUMERIC;
    v_teacher UUID;
BEGIN
    -- (1) Lấy giá và giáo viên của khóa học
    SELECT c.price, c.teacher_id
    INTO v_price, v_teacher
    FROM general_courses c
    WHERE c.course_id = p_course
      AND c.visibility_status = 'PUBLISHED'
      AND c.is_deleted = FALSE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Khóa học không tồn tại hoặc chưa được publish';
    END IF;

    IF v_price <= 0 THEN
        RAISE EXCEPTION 'Khóa học miễn phí — không cần thanh toán';
    END IF;

    -- (2) Chuyển tiền từ học viên → giáo viên
    --     sp_transfer_funds đã có deadlock prevention + validation
    CALL sp_transfer_funds(
        p_student,
        v_teacher,
        v_price,
        'Mua khóa học: ' || p_course::text
    );

    -- (3) Ghi danh — nếu trùng (đã enroll) → exception → ROLLBACK toàn bộ
    --     uq_student_course_enrollment constraint đảm bảo không trùng
    INSERT INTO course_enrollments (student_id, course_id, progress)
    VALUES (p_student, p_course, 0.00);

    -- (4) Thành công — toàn bộ commit (chuyển tiền + ghi danh)
END;
$$;
```

**Why this is better than the current `sp_buy_course_with_wallet`:**
- Current: pays admin (hardcoded). Blueprint: pays teacher (correct business logic)
- Current: monolithic — can't reuse transfer logic
- New: `sp_enroll_paid_course` calls `sp_transfer_funds` (reusable) + enrollment
- Any failure in enrollment → transfer also rolls back (true atomicity)

**Note on backward compatibility:** `sp_buy_course_with_wallet` is kept but deprecated. The new store checkout API should use `sp_enroll_paid_course`. Admin still receives platform fees via a separate mechanism (not in this phase).

---

### 2.3 Step 3: Transaction Isolation Level Configuration

**File to create:** `backend/app/core/isolation.py`

```python
"""
Transaction isolation level helpers.
Usage:
    from app.core.isolation import serializable, read_committed

    async with serializable(db) as tx:
        await tx.execute(...)
"""

from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@asynccontextmanager
async def serializable(db: AsyncSession):
    """Execute block in SERIALIZABLE isolation.
    Use for: wallet transfers, course purchases, any financial tx."""
    await db.execute(text("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"))
    try:
        yield db
        await db.commit()
    except Exception:
        await db.rollback()
        raise


@asynccontextmanager
async def repeatable_read(db: AsyncSession):
    """Execute block in REPEATABLE READ isolation.
    Use for: reports that need consistent snapshots."""
    await db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))
    try:
        yield db
        await db.commit()
    except Exception:
        await db.rollback()
        raise


@asynccontextmanager
async def read_committed(db: AsyncSession):
    """Execute block in READ COMMITTED (PostgreSQL default).
    Use for: general CRUD, catalog browsing, search."""
    await db.execute(text("SET TRANSACTION ISOLATION LEVEL READ COMMITTED"))
    try:
        yield db
        await db.commit()
    except Exception:
        await db.rollback()
        raise
```

**Usage in `services/store.py` — checkout with SERIALIZABLE:**

```python
from app.core.isolation import serializable

async def checkout_course_v2(db: AsyncSession, student_id: str, course_id: str) -> dict:
    """Buy a course using sp_enroll_paid_course — SERIALIZABLE isolation."""
    if not is_valid_uuid(student_id) or not is_valid_uuid(course_id):
        raise StoreError("ID không hợp lệ", 400)

    async with serializable(db):
        try:
            await db.execute(
                text("CALL sp_enroll_paid_course(:sid, :cid)"),
                {"sid": student_id, "cid": course_id},
            )
            return {"message": "Đăng ký khóa học thành công"}
        except Exception as e:
            err_msg = str(e)
            if "Số dư không đủ" in err_msg:
                raise StoreError("Số dư không đủ", 400)
            if "không tồn tại" in err_msg:
                raise StoreError("Khóa học không tồn tại", 400)
            if "đã đăng ký" in err_msg or "duplicate" in err_msg.lower():
                raise StoreError("Bạn đã đăng ký khóa học này", 409)
            raise StoreError(err_msg, 500)
```

---

### 2.4 Step 4: Pessimistic Locking — `SELECT ... FOR UPDATE` in App Code

**File to create:** `backend/app/core/locking.py`

```python
"""
Database locking helpers for application-level pessimistic locking.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def lock_wallet_for_update(db: AsyncSession, user_id: str) -> dict | None:
    """Khóa ví để đọc + chuẩn bị ghi. Trả về (balance, updated_at)."""
    result = await db.execute(
        text("SELECT balance, updated_at FROM wallets WHERE user_id = :uid FOR UPDATE"),
        {"uid": user_id},
    )
    row = result.mappings().first()
    if row is None:
        return None
    return {"balance": float(row["balance"]), "updated_at": row["updated_at"]}


async def lock_course_for_update(db: AsyncSession, course_id: str) -> dict | None:
    """Khóa khóa học trước khi cập nhật visibility/price."""
    result = await db.execute(
        text("""
            SELECT course_id, title, price, visibility_status, updated_at
            FROM general_courses
            WHERE course_id = :cid AND is_deleted = FALSE
            FOR UPDATE
        """),
        {"cid": course_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def fetch_notifications_skip_locked(
    db: AsyncSession, batch_size: int = 100
) -> list[dict]:
    """Worker queue: lấy notifications chưa gửi mà không chặn worker khác.
    Dùng SKIP LOCKED — mỗi worker lấy batch riêng."""
    result = await db.execute(
        text("""
            SELECT notification_id::text, user_id::text, title, message
            FROM notification_users
            WHERE is_read = FALSE
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT :limit
        """),
        {"limit": batch_size},
    )
    return [dict(row) for row in result.mappings()]
```

---

### 2.5 Step 5: Optimistic Locking Pattern

**File to modify:** `backend/app/services/course_builder.py`

Add optimistic locking to `update_course()`:

```python
async def update_course_with_optimistic_lock(
    db: AsyncSession, course_id: str, req, expected_updated_at: str
) -> dict:
    """
    Cập nhật khóa học với optimistic locking.
    - expected_updated_at: giá trị updated_at lúc client mở form edit
    - Nếu có ai sửa sau đó → 0 rows affected → conflict
    """
    updates = []
    params = {"cid": course_id, "expected_ts": expected_updated_at}

    if req.title is not None:
        updates.append("title = :title")
        params["title"] = req.title
    if req.description is not None:
        updates.append("description = :desc")
        params["desc"] = req.description
    # ... other fields

    if updates:
        result = await db.execute(
            text(f"""
                UPDATE general_courses
                SET {', '.join(updates)}
                WHERE course_id = :cid
                  AND is_deleted = FALSE
                  AND updated_at = :expected_ts
                RETURNING updated_at
            """),
            params,
        )
        row = result.mappings().first()
        await db.commit()

        if row is None:
            raise ConflictError(
                "Khóa học đã được cập nhật bởi người khác. Vui lòng tải lại trang.",
                409,
            )
        return {"course_id": course_id, "updated": True, "new_updated_at": row["updated_at"]}

    return {"course_id": course_id, "updated": False, "message": "Không có thay đổi"}


class ConflictError(Exception):
    def __init__(self, message: str, status_code: int = 409):
        self.message = message
        self.status_code = status_code
```

---

### 2.6 Step 6: Advisory Locks for Singleton Cron Tasks

**File to create:** `backend/app/core/cron.py`

```python
"""
Advisory lock utilities for singleton cron tasks.
Ensures only ONE app instance runs periodic jobs.
"""
import asyncio
import hashlib

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session


# Well-known lock IDs (must be consistent across all instances)
LOCK_ID_REFRESH_LEADERBOARD = 42
LOCK_ID_RESET_STREAKS = 43
LOCK_ID_CLEANUP_SESSIONS = 44


async def try_acquire_advisory_lock(
    db: AsyncSession, lock_id: int
) -> bool:
    """Thử giành advisory lock. Trả về True nếu thành công."""
    result = await db.execute(
        text("SELECT pg_try_advisory_lock(:id)"),
        {"id": lock_id},
    )
    return result.scalar()


async def release_advisory_lock(db: AsyncSession, lock_id: int) -> None:
    """Giải phóng advisory lock."""
    await db.execute(
        text("SELECT pg_advisory_unlock(:id)"),
        {"id": lock_id},
    )


async def run_singleton_task(lock_id: int, task_name: str, coro):
    """
    Chạy task với advisory lock — chỉ 1 instance thực thi.
    Các instance khác bỏ qua (pg_try_advisory_lock returns false).
    """
    async with async_session() as db:
        acquired = await try_acquire_advisory_lock(db, lock_id)
        if not acquired:
            print(f"[Cron] {task_name}: skipped (another instance is running)")
            return

        try:
            print(f"[Cron] {task_name}: starting...")
            await coro(db)
            print(f"[Cron] {task_name}: completed")
        except Exception as e:
            print(f"[Cron] {task_name}: failed — {e}")
        finally:
            await release_advisory_lock(db, lock_id)


# ── Predefined cron tasks ──

async def refresh_leaderboard_task(db: AsyncSession):
    """Refresh mv_leaderboard + Redis ZSET."""
    await db.execute(
        text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard")
    )
    await db.commit()
    # Redis ZSET sync
    from app.core.cache import cache
    if cache.enabled:
        from app.services.gamification import refresh_leaderboard
        await refresh_leaderboard(db)


async def cleanup_expired_sessions(db: AsyncSession):
    """Xóa authentication sessions đã hết hạn."""
    await db.execute(
        text("DELETE FROM authentication_sessions WHERE expires_at < NOW()")
    )
    await db.commit()


async def reset_broken_streaks(db: AsyncSession):
    """Reset streak cho student không hoạt động > 7 ngày."""
    await db.execute(
        text("""
            UPDATE student_streaks
            SET current_streak = 0
            WHERE last_activity_date < CURRENT_DATE - INTERVAL '7 days'
              AND current_streak > 0
        """)
    )
    await db.commit()
```

**Integration into `main.py` lifespan:**

```python
from app.core.cron import (
    LOCK_ID_REFRESH_LEADERBOARD,
    LOCK_ID_CLEANUP_SESSIONS,
    run_singleton_task,
    refresh_leaderboard_task,
    cleanup_expired_sessions,
)

async def _cron_scheduler():
    """Run periodic tasks with advisory locks."""
    while True:
        # Every 5 minutes: refresh leaderboard
        await run_singleton_task(
            LOCK_ID_REFRESH_LEADERBOARD,
            "leaderboard-refresh",
            refresh_leaderboard_task,
        )
        # Every hour: cleanup sessions
        await run_singleton_task(
            LOCK_ID_CLEANUP_SESSIONS,
            "cleanup-sessions",
            cleanup_expired_sessions,
        )
        await asyncio.sleep(300)  # 5-minute tick
```

---

### 2.7 Step 7: `sp_transfer_funds` Service Integration

**File to modify:** `backend/app/services/store.py`

Add a new service function for direct transfers:

```python
async def transfer_funds(
    db: AsyncSession, from_user_id: str, to_user_id: str, amount: float, message: str = ""
) -> dict:
    """Chuyển tiền giữa 2 user. Gọi sp_transfer_funds với SERIALIZABLE."""
    if not is_valid_uuid(from_user_id) or not is_valid_uuid(to_user_id):
        raise StoreError("ID không hợp lệ", 400)

    async with serializable(db):
        try:
            await db.execute(
                text("CALL sp_transfer_funds(:fid, :tid, :amt, :msg)"),
                {
                    "fid": from_user_id,
                    "tid": to_user_id,
                    "amt": amount,
                    "msg": message or f"Chuyển {amount} từ {from_user_id} đến {to_user_id}",
                },
            )
            return {
                "from": from_user_id,
                "to": to_user_id,
                "amount": amount,
                "status": "SUCCESS",
            }
        except Exception as e:
            raise StoreError(str(e), 500)
```

---

## 3. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/app/db/procedures.sql` | **MODIFY** | Add `sp_transfer_funds` + `sp_enroll_paid_course` |
| `backend/app/core/isolation.py` | **CREATE** | Transaction isolation context managers |
| `backend/app/core/locking.py` | **CREATE** | Pessimistic/optimistic locking helpers |
| `backend/app/core/cron.py` | **CREATE** | Advisory-lock-guarded cron tasks |
| `backend/app/main.py` | **MODIFY** | Replace simple refresh task with cron scheduler |
| `backend/app/services/store.py` | **MODIFY** | Add `transfer_funds()`, add SERIALIZABLE checkout |
| `backend/app/services/course_builder.py` | **MODIFY** | Add optimistic locking `update_course` variant |
| `backend/app/api/store.py` | **MODIFY** | Add `POST /api/wallet/transfer` endpoint |
| `backend/app/schemas/store.py` | **MODIFY** | Add `TransferRequest` schema |

---

## 4. Verification Strategy

### 4.1 Unit/Integration Tests (`backend/tests/test_procedures_locking.py`)

```python
import asyncio
import pytest
from sqlalchemy import text

class TestTransferFunds:
    """Test sp_transfer_funds — the flagship ACID procedure."""

    async def test_successful_transfer(self, db_session, seeded_users):
        """Chuyển tiền thành công: from giảm, to tăng, log được ghi."""
        await db_session.execute(text(
            "CALL sp_transfer_funds(:fid, :tid, 100, 'test')"
        ), {"fid": seeded_users["alice"], "tid": seeded_users["bob"]})
        await db_session.commit()

        # Verify balances
        alice_bal = await _get_balance(db_session, seeded_users["alice"])
        bob_bal = await _get_balance(db_session, seeded_users["bob"])
        assert alice_bal == 400  # started with 500
        assert bob_bal == 200    # started with 100

        # Verify transaction log
        ...

    async def test_insufficient_funds_rollback(self, db_session, seeded_users):
        """Chuyển quá số dư → exception → balance không đổi."""
        before_a = await _get_balance(db_session, seeded_users["alice"])
        before_b = await _get_balance(db_session, seeded_users["bob"])

        with pytest.raises(Exception, match="Số dư không đủ"):
            await db_session.execute(text(
                "CALL sp_transfer_funds(:fid, :tid, 99999, 'test')"
            ), {"fid": seeded_users["alice"], "tid": seeded_users["bob"]})
            await db_session.commit()

        # Balances must be unchanged (atomic rollback)
        assert await _get_balance(db_session, seeded_users["alice"]) == before_a
        assert await _get_balance(db_session, seeded_users["bob"]) == before_b

    async def test_self_transfer_blocked(self, db_session, seeded_users):
        """Không thể tự chuyển cho mình."""
        with pytest.raises(Exception, match="tự chuyển"):
            await db_session.execute(text(
                "CALL sp_transfer_funds(:uid, :uid, 100, 'test')"
            ), {"uid": seeded_users["alice"]})


class TestDeadlockPrevention:
    """Verify ordered locking prevents deadlocks."""

    async def test_concurrent_opposite_transfers(self, db_session, seeded_users):
        """100 concurrent A→B and B→A transfers — no deadlocks, sum conserved."""
        alice, bob = seeded_users["alice"], seeded_users["bob"]
        sum_before = await _total_balance(db_session, [alice, bob])

        async def transfer_a_to_b():
            async with async_session() as db:
                await db.execute(text(
                    "CALL sp_transfer_funds(:fid, :tid, 1, 'stress')"
                ), {"fid": alice, "tid": bob})
                await db.commit()

        async def transfer_b_to_a():
            async with async_session() as db:
                await db.execute(text(
                    "CALL sp_transfer_funds(:fid, :tid, 1, 'stress')"
                ), {"fid": bob, "tid": alice})
                await db.commit()

        # Run 50 concurrent transfers in each direction
        tasks = []
        for _ in range(50):
            tasks.append(transfer_a_to_b())
            tasks.append(transfer_b_to_a())

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Count deadlocks — should be ZERO
        deadlocks = [r for r in results if isinstance(r, Exception)]
        assert len(deadlocks) == 0, f"Got {len(deadlocks)} deadlocks!"

        # Conservation of money
        sum_after = await _total_balance(db_session, [alice, bob])
        assert sum_before == sum_after


class TestOptimisticLocking:
    """Verify optimistic locking prevents lost updates."""

    async def test_concurrent_edit_detected(self, db_session, seeded_course):
        """Two editors — second one gets conflict error."""
        # Editor 1 reads
        course = await db_session.execute(text(
            "SELECT updated_at FROM general_courses WHERE course_id = :cid"
        ), {"cid": seeded_course})
        ts1 = course.scalar()

        # Editor 2 updates first
        await db_session.execute(text(
            "UPDATE general_courses SET title = 'v2' WHERE course_id = :cid"
        ), {"cid": seeded_course})
        await db_session.commit()

        # Editor 1 tries to update with stale timestamp → 0 rows
        result = await db_session.execute(text(
            "UPDATE general_courses SET title = 'v1' WHERE course_id = :cid AND updated_at = :ts"
        ), {"cid": seeded_course, "ts": ts1})
        assert result.rowcount == 0  # Conflict detected!


class TestSkipLocked:
    """Verify SKIP LOCKED for worker queue pattern."""

    async def test_workers_get_disjoint_batches(self, db_session):
        """2 workers → each gets different rows, no overlap."""
        ...


class TestAdvisoryLock:
    """Verify pg_try_advisory_lock for singleton tasks."""

    async def test_only_one_acquires(self, db_session):
        """2 concurrent attempts → only 1 succeeds."""
        ...
```

### 4.2 SQL Verification Scripts

```sql
-- Test sp_transfer_funds với số tiền hợp lệ
DO $$
BEGIN
    CALL sp_transfer_funds(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  -- from (cần thay bằng UUID thật)
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',  -- to
        50000,
        'Test transfer'
    );
    RAISE NOTICE 'Transfer OK';
END $$;

-- Kiểm tra isolation level hiện tại
SHOW transaction_isolation;

-- Kiểm tra deadlock detection (mô phỏng)
-- Terminal 1:
BEGIN;
SELECT balance FROM wallets WHERE user_id = 'aaaaaaaa-...' FOR UPDATE;
-- (giữ transaction mở)

-- Terminal 2:
BEGIN;
SELECT balance FROM wallets WHERE user_id = 'aaaaaaaa-...' FOR UPDATE;
-- (sẽ block cho đến khi Terminal 1 COMMIT/ROLLBACK)

-- Kiểm tra advisory lock
SELECT pg_try_advisory_lock(42);  -- → TRUE (acquired)
SELECT pg_try_advisory_lock(42);  -- → FALSE (already held)
SELECT pg_advisory_unlock(42);    -- → TRUE (released)
```

### 4.3 Benchmark Script (`pgbench`)

```sql
-- File: backend/scripts/bench_transfer.sql
\set from_id random(1, 100)
\set to_id   random(1, 100)
\set amount  random(1, 1000)

SELECT sp_transfer_funds(
    (SELECT user_id FROM users ORDER BY created_at LIMIT 1 OFFSET :from_id),
    (SELECT user_id FROM users ORDER BY created_at LIMIT 1 OFFSET :to_id),
    :amount::numeric,
    'pgbench test'
);
```

```bash
# Run benchmark
pgbench -c 50 -j 4 -T 60 -f backend/scripts/bench_transfer.sql -U postgres elearning_db
```

### 4.4 Acceptance Criteria

- [ ] `sp_transfer_funds` transfers money correctly (from--, to++)
- [ ] `sp_transfer_funds` rolls back on insufficient funds (atomic)
- [ ] `sp_transfer_funds` blocks self-transfers
- [ ] 100 concurrent opposite-direction transfers → 0 deadlocks
- [ ] 100 concurrent transfers → total money conserved (sum(balances) unchanged)
- [ ] `sp_enroll_paid_course` pays teacher (not admin)
- [ ] `sp_enroll_paid_course` rolls back transfer if enrollment fails
- [ ] `SERIALIZABLE` isolation prevents write skew in wallet operations
- [ ] Optimistic locking detects stale updates (0 rows → 409 conflict)
- [ ] `SKIP LOCKED` gives disjoint batches to parallel workers
- [ ] `pg_try_advisory_lock` ensures singleton cron execution
- [ ] All existing tests still pass

---

## 5. Rollback Plan

```sql
-- Drop new procedures
DROP PROCEDURE IF EXISTS sp_transfer_funds(UUID, UUID, NUMERIC, TEXT);
DROP PROCEDURE IF EXISTS sp_enroll_paid_course(UUID, UUID);

-- Rollback isolation (revert to default)
-- Application code: remove serializable() context manager usage
```

---

## 6. Estimated Effort

| Step | Hours |
|------|-------|
| `sp_transfer_funds` + `sp_enroll_paid_course` SQL | 2.0h |
| `isolation.py` context managers | 1.0h |
| `locking.py` helpers | 1.5h |
| `cron.py` advisory lock scheduler | 1.5h |
| Service layer integration | 2.0h |
| API endpoints (transfer, v2 checkout) | 1.0h |
| Deadlock + concurrency tests | 3.0h |
| pgbench scripts + benchmark | 1.5h |
| **Total** | **13.5h** |
