# Plan Phase 2: Triggers & Data Integrity

**Status:** 📋 Planning  
**Blueprint Reference:** `Ke_hoach_ap_dung_HQTCSDL_Elearning.md` — Phần 3 (Triggers)  
**Target Branch:** `fastapi`  
**Prerequisites:** Plan 1 complete (Views), PostgreSQL 15+

---

## 1. Current State Audit

### 1.1 Existing Triggers

| Trigger | Table | Function | Location | Status |
|---------|-------|----------|----------|--------|
| `trg_auto_updated_at` | users, dictionary_entries, general_courses, wallets | `fn_auto_update_timestamp` | `alembic/versions/429743bc5cea` | ✅ |
| `trg_provision_wallet` | users (AFTER INSERT) | `fn_provision_wallet` | `alembic/versions/6fcb33bef44b` | ✅ |
| `trg_create_student_streak` | students (AFTER INSERT) | `fn_create_student_streak` | `alembic/versions/172d9b20bbc6` | ✅ |
| `trg_prevent_feedback_without_learning` | user_feedbacks (BEFORE INSERT) | `fn_prevent_feedback_without_learning` | `procedures.sql:276` | ✅ |
| `trg_check_sufficient_balance` | wallets (BEFORE UPDATE OF balance) | `fn_check_sufficient_balance` | `procedures.sql:290` | ✅ |
| `trg_auto_hide_teacher_courses` | users (AFTER UPDATE OF status, is_deleted) | `fn_auto_hide_teacher_courses` | `procedures.sql:303` | ✅ |
| `trg_alert_large_transaction` | transaction_logs (AFTER INSERT) | `fn_alert_large_transaction` | `procedures.sql:321` | ✅ |

### 1.2 Blueprint vs Reality — Gap Map

| Blueprint Trigger | Current Status | Gap Description |
|-------------------|---------------|-----------------|
| `trg_users_updated_at` (Section 3.1) | ✅ Exists | But only on 4 tables — blueprint says "every table with `updated_at`" |
| `trg_streak_sync` (Section 3.2) | ❌ **NOT IN DB** | Logic lives in `services/gamification.py:sync_student_streak()` — blueprint requires a **DB trigger** `fn_sync_highest_streak` |
| `trg_provision_user` (Section 3.3) | ⚠️ **Partial** | Blueprint wants ONE trigger that creates wallet + streak. Currently TWO separate triggers. Missing: the `students` record isn't created by trigger (it's done in app code `auth.py:108-115`) |
| `trg_audit_wallet` (Section 3.4) | ❌ **MISSING** | Blueprint requires logging every wallet balance change to the `log` table. Not implemented. |

### 1.3 Critical Analysis

**1. `trg_streak_sync` — Why DB trigger matters:**

The application code `sync_student_streak()` in `services/gamification.py` handles streak logic. However:
- If any code path updates `student_streaks.current_streak` without calling this function, the CHECK constraint `ck_streak_highest_gte_current` could be violated
- A DB trigger is **the last line of defense** — it cannot be bypassed by any code path, migration, or direct DB manipulation
- Current approach: app-level logic (brittle). Required: DB-level trigger (guaranteed)

**2. `trg_audit_wallet` — Why it matters:**

Financial systems MUST have an immutable audit trail. Currently:
- `sp_topup_wallet` and `sp_buy_course_with_wallet` insert into `transaction_logs` — but this is explicit, not automatic
- If a developer writes `UPDATE wallets SET balance = X` without logging, there's NO trace
- A trigger on `wallets` that auto-logs every balance change is the standard financial-system pattern

**3. Updated-at trigger coverage:**

The blueprint specifies "every table with `updated_at`". Checking the schema:

| Table | Has `updated_at`? | Trigger? |
|-------|-------------------|----------|
| `users` | Yes | ✅ |
| `dictionary_entries` | Yes | ✅ |
| `general_courses` | Yes | ✅ |
| `wallets` | Yes | ✅ |

Only 4 tables have `updated_at`. The existing trigger already covers all of them. ✅ No gap here.

---

## 2. Implementation Plan

### 2.1 Step 1: Create `trg_streak_sync` — Auto-Sync `highest_streak`

**Rationale:** Move the streak-ceiling logic from application code to a DB trigger so it's guaranteed regardless of which code path updates the streak.

**Action:** Create Alembic migration `backend/alembic/versions/XXXX_streak_sync_trigger.py`

```sql
-- UPGRADE
CREATE OR REPLACE FUNCTION fn_sync_highest_streak()
RETURNS TRIGGER AS $$
BEGIN
    -- Tự động nâng kỷ lục highest_streak khi current_streak vượt qua
    IF NEW.current_streak > NEW.highest_streak THEN
        NEW.highest_streak := NEW.current_streak;
    END IF;

    -- Cập nhật last_activity_date khi current_streak thay đổi
    IF TG_OP = 'UPDATE' AND NEW.current_streak <> OLD.current_streak THEN
        NEW.last_activity_date := CURRENT_DATE;
    ELSIF TG_OP = 'INSERT' THEN
        NEW.last_activity_date := COALESCE(NEW.last_activity_date, CURRENT_DATE);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gắn trigger vào student_streaks
DROP TRIGGER IF EXISTS trg_streak_sync ON student_streaks;
CREATE TRIGGER trg_streak_sync
BEFORE INSERT OR UPDATE OF current_streak ON student_streaks
FOR EACH ROW EXECUTE FUNCTION fn_sync_highest_streak();

-- DOWNGRADE
DROP TRIGGER IF EXISTS trg_streak_sync ON student_streaks;
DROP FUNCTION IF EXISTS fn_sync_highest_streak();
```

**App code simplification — `backend/app/services/gamification.py`:**

After adding the DB trigger, simplify `sync_student_streak()` — the trigger now handles `highest_streak` auto-raise and `last_activity_date` update:

```python
async def sync_student_streak(db: AsyncSession, student_id: str) -> dict:
    """Đồng bộ streak khi student có hoạt động học.
    Logic: app tính current_streak, DB trigger auto-syncs highest_streak."""
    if not is_valid_uuid(student_id):
        return {"student_id": student_id, "current_streak": 0, ...}

    today = date.today()
    result = await db.execute(
        text("SELECT current_streak, highest_streak, last_activity_date FROM student_streaks WHERE student_id = :sid"),
        {"sid": student_id},
    )
    streak = result.mappings().first()

    if not streak:
        # Trigger trg_create_student_streak chưa chạy → tạo mới
        await db.execute(
            text("INSERT INTO student_streaks (student_id, current_streak, highest_streak) VALUES (:sid, 1, 1) ON CONFLICT (student_id) DO NOTHING"),
            {"sid": student_id},
        )
        await db.commit()
        return {"student_id": student_id, "current_streak": 1, "highest_streak": 1, ...}

    current, highest, last_date = streak["current_streak"], streak["highest_streak"], streak["last_activity_date"]

    if last_date is None:
        new_current = 1
    elif last_date == today:
        new_current = current  # unchanged
    elif last_date == today - timedelta(days=1):
        new_current = current + 1  # consecutive → increase
    else:
        new_current = 1  # broken streak → reset

    if new_current != current:
        # DB trigger trg_streak_sync tự động nâng highest_streak nếu cần
        # DB trigger cũng tự cập nhật last_activity_date
        await db.execute(
            text("UPDATE student_streaks SET current_streak = :cur WHERE student_id = :sid"),
            {"cur": new_current, "sid": student_id},
        )
        await db.commit()

    # Đọc lại giá trị cuối cùng (đã được trigger xử lý)
    result = await db.execute(
        text("SELECT current_streak, highest_streak, last_activity_date::text FROM student_streaks WHERE student_id = :sid"),
        {"sid": student_id},
    )
    final = result.mappings().first()
    return {
        "student_id": student_id,
        "current_streak": final["current_streak"],
        "highest_streak": final["highest_streak"],
        "last_activity_date": str(final["last_activity_date"]),
        "streak_updated": True,
    }
```

---

### 2.2 Step 2: Create `trg_audit_wallet` — Auto-Log Wallet Changes

**Rationale:** Every balance change must be auditable without relying on developers remembering to log.

**Action:** Add migration `backend/alembic/versions/XXXX_audit_wallet_trigger.py`

```sql
-- UPGRADE
CREATE OR REPLACE FUNCTION fn_audit_wallet_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Chỉ log khi balance thực sự thay đổi
    IF OLD.balance IS DISTINCT FROM NEW.balance THEN
        INSERT INTO log (action)
        VALUES (
            format(
                'WALLET %s: %s → %s (delta: %s)',
                NEW.user_id,
                OLD.balance,
                NEW.balance,
                NEW.balance - OLD.balance
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_wallet ON wallets;
CREATE TRIGGER trg_audit_wallet
AFTER UPDATE OF balance ON wallets
FOR EACH ROW
WHEN (OLD.balance IS DISTINCT FROM NEW.balance)
EXECUTE FUNCTION fn_audit_wallet_change();

-- DOWNGRADE
DROP TRIGGER IF EXISTS trg_audit_wallet ON wallets;
DROP FUNCTION IF EXISTS fn_audit_wallet_change();
```

**Important design note (for the thesis):** The blueprint (Section 3.4, line 180) calls out that `log.action` uses `TEXT` type — unlike `audit_logs.action` which is `VARCHAR(50)`. This trigger correctly writes to `log` (TEXT column) for detailed messages. The `audit_logs` table (VARCHAR(50)) is for structured short status codes. This is the kind of schema-awareness that a thesis committee looks for.

---

### 2.3 Step 3: Consolidate Provisioning — `trg_provision_new_user`

**Rationale:** The blueprint (Section 3.3) specifies ONE trigger that provisions ALL resources for a new user. Currently, wallet and streak are provisioned by separate triggers. This step creates a unified trigger that replaces both.

**Action:** Create migration `backend/alembic/versions/XXXX_unified_provision_trigger.py`

```sql
-- UPGRADE
-- Bước 1: Xóa trigger cũ
DROP TRIGGER IF EXISTS trg_provision_wallet ON users;
DROP FUNCTION IF EXISTS fn_provision_wallet();

-- Bước 2: Tạo function thống nhất
CREATE OR REPLACE FUNCTION fn_provision_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role_name VARCHAR;
BEGIN
    -- 1. Tạo ví cho MỌI user mới
    INSERT INTO wallets (user_id, balance)
    VALUES (NEW.user_id, 0.00)
    ON CONFLICT (user_id) DO NOTHING;

    -- 2. Lấy role_name để quyết định provision thêm gì
    SELECT r.role_name INTO v_role_name
    FROM roles r WHERE r.role_id = NEW.role_id;

    -- 3. Nếu là STUDENT → tự động tạo streak record
    IF v_role_name = 'STUDENT' THEN
        INSERT INTO student_streaks (student_id, current_streak, highest_streak)
        VALUES (NEW.user_id, 0, 0)
        ON CONFLICT (student_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bước 3: Gắn trigger mới
DROP TRIGGER IF EXISTS trg_provision_user ON users;
CREATE TRIGGER trg_provision_user
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION fn_provision_new_user();

-- DOWNGRADE
DROP TRIGGER IF EXISTS trg_provision_user ON users;
DROP FUNCTION IF EXISTS fn_provision_new_user();

-- Khôi phục trigger cũ
CREATE OR REPLACE FUNCTION fn_provision_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallets (user_id, balance) VALUES (NEW.user_id, 0.00);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_provision_wallet
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION fn_provision_wallet();
```

**Impact on existing code:**
- `backend/app/services/auth.py:117` — The comment `# Trigger trg_provision_wallet tự động tạo wallet row` should be updated to reference `trg_provision_user`
- `backend/app/services/auth.py:116` — The comment `# Trigger trg_create_student_streak tự động tạo streak row` should be updated (streak is now created by the unified trigger too, but the existing `trg_create_student_streak` on the `students` table still fires as a secondary safety net — we keep it for the case where a `students` row is inserted manually)

**Decision:** Keep `trg_create_student_streak` on `students` table as-is (defense in depth). The unified `trg_provision_user` covers the `users INSERT` path; the existing `trg_create_student_streak` covers the edge case of direct `students` INSERT.

---

### 2.4 Step 4: Add Missing `trg_prevent_self_transfer`

**Rationale:** The `sp_transfer_funds` procedure (Plan 3) checks `p_from != p_to` in application logic, but a DB trigger on `transaction_logs` provides an additional safety net.

**Action:** Add to `procedures.sql`:

```sql
CREATE OR REPLACE FUNCTION fn_prevent_self_transfer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.from_wallet_user_id IS NOT NULL
       AND NEW.from_wallet_user_id = NEW.to_wallet_user_id THEN
        RAISE EXCEPTION 'Không thể tự chuyển tiền cho chính mình (self-transfer)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_self_transfer ON transaction_logs;
CREATE TRIGGER trg_prevent_self_transfer
BEFORE INSERT ON transaction_logs
FOR EACH ROW EXECUTE FUNCTION fn_prevent_self_transfer();
```

---

### 2.5 Step 5: Document All Triggers in `procedures.sql`

Add a consolidated trigger registry comment at the top of `backend/app/db/procedures.sql`:

```sql
-- ====================================================================================
-- TRIGGER REGISTRY (Đăng ký Trigger)
-- ====================================================================================
-- | # | Trigger Name | Table | Event | Function | Purpose |
-- |---|-------------|-------|-------|----------|---------|
-- | 1 | trg_auto_updated_at | users, dict_entries, courses, wallets | BEFORE UPDATE | fn_auto_update_timestamp | Auto-set updated_at |
-- | 2 | trg_provision_user | users | AFTER INSERT | fn_provision_new_user | Auto-create wallet (+ streak for students) |
-- | 3 | trg_create_student_streak | students | AFTER INSERT | fn_create_student_streak | Defense-in-depth: ensure streak row exists |
-- | 4 | trg_streak_sync | student_streaks | BEFORE INSERT/UPDATE | fn_sync_highest_streak | Auto-raise highest_streak |
-- | 5 | trg_prevent_feedback_without_learning | user_feedbacks | BEFORE INSERT | fn_prevent_feedback_without_learning | Block reviews without progress |
-- | 6 | trg_check_sufficient_balance | wallets | BEFORE UPDATE OF balance | fn_check_sufficient_balance | Prevent negative balance |
-- | 7 | trg_audit_wallet | wallets | AFTER UPDATE OF balance | fn_audit_wallet_change | Log every balance change |
-- | 8 | trg_auto_hide_teacher_courses | users | AFTER UPDATE OF status | fn_auto_hide_teacher_courses | Archive courses when teacher banned |
-- | 9 | trg_alert_large_transaction | transaction_logs | AFTER INSERT | fn_alert_large_transaction | Notify admin of large tx |
-- |10 | trg_prevent_self_transfer | transaction_logs | BEFORE INSERT | fn_prevent_self_transfer | Block self-transfers |
-- ====================================================================================
```

---

## 3. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/alembic/versions/XXXX_streak_sync_trigger.py` | **CREATE** | `trg_streak_sync` migration |
| `backend/alembic/versions/XXXX_audit_wallet_trigger.py` | **CREATE** | `trg_audit_wallet` migration |
| `backend/alembic/versions/XXXX_unified_provision_trigger.py` | **CREATE** | Consolidate provision triggers |
| `backend/app/db/procedures.sql` | **MODIFY** | Add `trg_prevent_self_transfer` + trigger registry comment |
| `backend/app/services/gamification.py` | **MODIFY** | Simplify `sync_student_streak()` — remove manual `highest_streak` logic |
| `backend/app/services/auth.py` | **MODIFY** | Update trigger reference comments |

---

## 4. Verification Strategy

### 4.1 Python Tests (`backend/tests/test_triggers.py`)

```python
import pytest
from sqlalchemy import text

class TestStreakSyncTrigger:
    """Verify trg_streak_sync auto-raises highest_streak."""

    async def test_highest_streak_auto_raised(self, db_session):
        """Khi current_streak vượt highest_streak, trigger tự nâng."""
        # Insert student with streak 3/3
        await db_session.execute(text("""
            INSERT INTO student_streaks (student_id, current_streak, highest_streak)
            VALUES (:sid, 3, 3)
        """))
        await db_session.commit()

        # Update to 5 — trigger should raise highest_streak to 5
        await db_session.execute(text("""
            UPDATE student_streaks SET current_streak = 5 WHERE student_id = :sid
        """))
        await db_session.commit()

        result = await db_session.execute(text(
            "SELECT highest_streak FROM student_streaks WHERE student_id = :sid"
        ))
        assert result.scalar() == 5

    async def test_highest_streak_not_lowered(self, db_session):
        """Khi current_streak giảm, highest_streak không đổi."""
        # Highest = 10, current drops to 1 (broken streak)
        # Trigger must NOT lower highest from 10
        ...

class TestAuditWalletTrigger:
    """Verify trg_audit_wallet logs every balance change."""

    async def test_balance_change_logged(self, db_session):
        """Mỗi lần balance đổi → 1 dòng trong log."""
        # Update balance
        await db_session.execute(text("UPDATE wallets SET balance = 100 WHERE user_id = :uid"))
        await db_session.commit()

        # Check log table
        result = await db_session.execute(text(
            "SELECT action FROM log WHERE action LIKE 'WALLET %' ORDER BY created_at DESC LIMIT 1"
        ))
        log_entry = result.scalar()
        assert "100" in log_entry

    async def test_no_change_no_log(self, db_session):
        """UPDATE không đổi balance → KHÔNG log."""
        before = await db_session.execute(text("SELECT COUNT(*) FROM log"))
        before_count = before.scalar()

        # Update with same balance
        await db_session.execute(text(
            "UPDATE wallets SET balance = balance WHERE user_id = :uid"
        ))
        await db_session.commit()

        after = await db_session.execute(text("SELECT COUNT(*) FROM log"))
        assert after.scalar() == before_count

class TestProvisionTrigger:
    """Verify trg_provision_user creates wallet for new users."""

    async def test_new_user_gets_wallet(self, db_session):
        """Sau INSERT users, wallet phải tồn tại."""
        ...

    async def test_new_student_gets_streak(self, db_session):
        """Student mới phải có student_streaks record."""
        ...

class TestPreventSelfTransfer:
    """Verify trg_prevent_self_transfer blocks self-transfers."""

    async def test_self_transfer_blocked(self, db_session):
        """INSERT với from = to phải fail."""
        with pytest.raises(Exception, match="tự chuyển"):
            await db_session.execute(text("""
                INSERT INTO transaction_logs (from_wallet_user_id, to_wallet_user_id, amount, status, created_at)
                VALUES (:uid, :uid, 100, 'SUCCESS', NOW())
            """))
```

### 4.2 SQL Verification Scripts

```sql
-- Liệt kê tất cả trigger đang active
SELECT
    tgname AS trigger_name,
    relname AS table_name,
    proname AS function_name,
    CASE WHEN tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
    CASE WHEN tgtype & 4 = 4 THEN 'INSERT'
         WHEN tgtype & 8 = 8 THEN 'DELETE'
         WHEN tgtype & 16 = 16 THEN 'UPDATE'
    END AS event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE NOT t.tgisinternal
ORDER BY relname, tgname;

-- Test trigger: insert rồi update student_streaks
DO $$
DECLARE
    v_sid UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    INSERT INTO student_streaks (student_id, current_streak, highest_streak)
    VALUES (v_sid, 5, 3);
    -- Trigger phải sửa highest_streak thành 5
    ASSERT (SELECT highest_streak FROM student_streaks WHERE student_id = v_sid) = 5,
        'Trigger streak_sync failed!';
END $$;

-- Test trigger: wallet audit
DO $$
DECLARE
    v_log_count_before INT;
    v_log_count_after INT;
BEGIN
    SELECT COUNT(*) INTO v_log_count_before FROM log;
    UPDATE wallets SET balance = balance + 1 WHERE user_id = (SELECT user_id FROM wallets LIMIT 1);
    SELECT COUNT(*) INTO v_log_count_after FROM log;
    ASSERT v_log_count_after > v_log_count_before, 'Trigger audit_wallet failed!';
END $$;
```

### 4.3 Acceptance Criteria

- [ ] `trg_streak_sync` auto-raises `highest_streak` when `current_streak` exceeds it — verified by test
- [ ] `trg_streak_sync` does NOT lower `highest_streak` when `current_streak` drops
- [ ] `trg_audit_wallet` inserts a `log` row for every `balance` change
- [ ] `trg_audit_wallet` does NOT log when `balance` unchanged
- [ ] `trg_provision_user` creates `wallets` row for every new `users` row
- [ ] `trg_provision_user` creates `student_streaks` row for STUDENT-role users
- [ ] `trg_prevent_self_transfer` blocks `from = to` in `transaction_logs`
- [ ] All existing tests still pass after trigger changes
- [ ] `sync_student_streak()` still works correctly with trigger-based highest_streak

---

## 5. Rollback Plan

```sql
-- Disable specific triggers (for emergency rollback)
ALTER TABLE student_streaks DISABLE TRIGGER trg_streak_sync;
ALTER TABLE wallets DISABLE TRIGGER trg_audit_wallet;
ALTER TABLE users DISABLE TRIGGER trg_provision_user;

-- Re-enable
ALTER TABLE student_streaks ENABLE TRIGGER trg_streak_sync;
ALTER TABLE wallets ENABLE TRIGGER trg_audit_wallet;
ALTER TABLE users ENABLE TRIGGER trg_provision_user;
```

Rollback the Alembic migration: `alembic downgrade -1`

---

## 6. Estimated Effort

| Step | Hours |
|------|-------|
| `trg_streak_sync` migration + tests | 1.5h |
| `trg_audit_wallet` migration + tests | 1.0h |
| Unified provision trigger | 1.0h |
| `trg_prevent_self_transfer` | 0.5h |
| App code simplification (gamification.py) | 1.0h |
| Trigger registry documentation | 0.5h |
| **Total** | **5.5h** |
