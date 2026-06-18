"""
Benchmark Data Generator for E-Learning Platform.
Generates ~1.3M rows of realistic data across all 29 tables.

Usage:
    python -m scripts.generate_benchmark_data --scale 1.0
    python -m scripts.generate_benchmark_data --scale 0.1        # 10% quick test
    python -m scripts.generate_benchmark_data --scale 1.0 --reset # Truncate first

Design:
    - Deterministic: seeded RNG (--seed 42) for reproducible benchmarks
    - Realistic distributions: log-normal prices, beta progress, geometric streaks
    - 12-month temporal spread for partitioned tables (2025-07 → 2026-06)
    - Batch COPY for speed on large tables
    - Creates pgbench helper tables (bench_student_ids, bench_course_ids, etc.)
"""

import argparse
import asyncio
import hashlib
import math
import json
import random
import sys
import time
import uuid as _uuid
from datetime import datetime, timedelta, timezone, date
from pathlib import Path
from typing import Optional

import asyncpg

# ============================================================================
# Configuration
# ============================================================================

SEED = 42
TZ = timezone(timedelta(hours=7))  # ICT

# Will be set by generate() — DO NOT reference directly, use _rng or _SEED
_rng = None
_SEED = None


def deterministic_uuid(idx: int, namespace: str = "", seed: int = None) -> str:
    """Deterministic UUID v5-like, reproducible across runs."""
    s = seed if seed is not None else (_SEED or SEED)
    raw = f"{s}:{namespace}:{idx}"
    h = hashlib.sha256(raw.encode()).hexdigest()[:32]
    return str(_uuid.UUID(h))


TARGETS = {
    "users": 10_000,
    "general_course_categories": 20,
    "general_courses": 5_000,
    "general_course_modules": 15_000,
    "general_course_lessons": 45_000,
    "learning_materials": 45_000,
    "course_enrollments": 50_000,
    "comments": 100_000,
    "user_feedbacks": 20_000,
    "dictionary_categories": 15,
    "dictionary_entries": 10_000,
    "dictionary_variations": 30_000,
    "student_streaks": 8_000,
    "achievements": 20,
    "user_achievements": 40_000,
    "transaction_logs": 500_000,
    "transaction_action_logs": 250_000,
    "audit_logs": 200_000,
    "notification_users": 100_000,
    "log": 100_000,
    "authentication_sessions": 5_000,
    "microlearning_topics": 10,
    "microlearning_units": 50,
    "microlearning_lessons": 200,
    "microlearning_lesson_parts": 600,
    "microlearning_questions": 2_000,
}

DELETE_ORDER = [
    "transaction_action_logs", "transaction_logs",
    "user_achievements", "user_feedbacks", "comments",
    "course_enrollments", "learning_materials",
    "general_course_lessons", "general_course_modules", "general_courses",
    "dictionary_variations", "dictionary_entries", "dictionary_categories",
    "microlearning_questions", "microlearning_lesson_parts",
    "microlearning_lessons", "microlearning_units", "microlearning_topics",
    "student_streaks", "authentication_sessions",
    "notification_users", "audit_logs", "log",
    "students", "teachers", "user_profiles", "wallets", "users",
]

FAMILY_NAMES = [
    "Nguyen", "Tran", "Le", "Pham", "Hoang", "Huynh", "Phan", "Vu", "Vo", "Dang",
    "Bui", "Do", "Ho", "Ngo", "Duong", "Ly", "Trinh", "Mai", "Ha", "Ninh",
]
MIDDLE_NAMES = ["Van", "Thi", "Minh", "Thanh", "Ngoc", "Quang", "Tuan", "Hong", "Duc", "Xuan"]
GIVEN_NAMES = [
    "Anh", "Binh", "Chi", "Dung", "Em", "Giang", "Ha", "Hung", "Linh", "Mai",
    "Nam", "Oanh", "Phuc", "Quynh", "Tam", "Thuy", "Trang", "Viet", "Xuan", "Yen",
    "Hoa", "Lan", "Dao", "Son", "Tung", "Khanh", "Long", "Phong", "Hai", "Diep",
]

COURSE_TITLE_POOL = [
    "Co ban ve Ngon ngu Ky hieu", "Giao tiep hang ngay bang NNKH",
    "Ky hieu cho giao duc", "Ky hieu cho y te", "Ky hieu cho cong so",
    "Ngon ngu Ky hieu nang cao", "Ky hieu van hoc nghe thuat",
    "Ky hieu cho du lich", "Ky hieu cho am nhac", "Ky hieu cho the thao",
    "Giao tiep NNKH voi tre em", "Ngon ngu Ky hieu cho cong nghe",
    "Ky hieu cho an toan giao thong", "Ky hieu cho moi truong",
    "Ky hieu cho phap luat", "Giao tiep NNKH trong gia dinh",
    "Ky hieu cho tinh nguyen", "Ky hieu cho truyen thong",
    "Ky hieu cho nha hang", "Ky hieu cho ngan hang",
    "Ky hieu cho mua sam", "Ky hieu cho giai tri",
    "NNKH cho nguoi moi bat dau", "Ky hieu chuyen nganh Y Duoc",
    "Ky hieu cho cong tac xa hoi", "Giao tiep NNKH nang cao",
    "Ky hieu cho bao chi truyen hinh", "Ky hieu cho linh vuc cong an",
    "Ky hieu cho hoat dong tinh nguyen", "NNKH danh cho phu huynh",
]

DICT_CATEGORIES = [
    ("Tu vung co ban", "Cac tu vung tieng Khmer thong dung hang ngay"),
    ("Dia danh", "Cac dia danh lich su va du lich noi tieng tai Campuchia"),
    ("Am thuc", "Cac mon an va thuat ngu am thuc truyen thong Khmer"),
    ("Gia dinh", "Tu vung ve cac moi quan he gia dinh"),
    ("Nghe nghiep", "Ten cac nghe nghiep va chuc danh"),
    ("Dong vat", "Ten cac loai dong vat thuong gap"),
    ("Thoi gian", "Cach noi ve thoi gian, ngay thang, mua"),
    ("So dem", "Cac con so va cach dem"),
    ("Mau sac", "Ten cac mau sac co ban"),
    ("Trang phuc", "Ten cac loai quan ao va phu kien"),
    ("Giao duc", "Tu vung trong moi truong hoc duong"),
    ("Y te", "Tu vung y te va suc khoe co ban"),
    ("Giao thong", "Phuong tien va bien bao giao thong"),
    ("Thoi tiet", "Cac hien tuong thoi tiet va khi hau"),
    ("Cam xuc", "Tu vung dien ta cam xuc va tam trang"),
]

DICT_WORD_POOL = [
    ("Xin chao", "Loi chao hoi lich su khi gap mat"),
    ("Cam on", "Bieu thi long biet on"),
    ("Xin loi", "Loi xin loi khi mac phai sai sot"),
    ("Tam biet", "Loi chao tam biet khi roi di"),
    ("Vui long", "Loi yeu cau lich su"),
    ("Gia dinh", "Nhung nguoi than thuoc trong gia dinh"),
    ("Nha", "Noi cu tru va sinh hoat"),
    ("Truong hoc", "Noi dien ra hoat dong giao duc"),
    ("Benh vien", "Co so y te cham soc suc khoe"),
    ("Cong vien", "Khu vuc cong cong de vui choi"),
    ("An uong", "Hoat dong an va uong"),
    ("Ngu nghi", "Thoi gian ngu va thu gian"),
    ("Di lai", "Hoat dong di chuyen"),
    ("Lam viec", "Hoat dong lao dong va cong viec"),
    ("Giai tri", "Hoat dong thu gian va giai tri"),
    ("Thoi gian", "Khái niem ve thoi gian troi qua"),
    ("Thoi tiet", "Trang thai khi quyen ben ngoai"),
    ("Mua sam", "Hoat dong mua ban hang hoa"),
    ("Giao thong", "He thong di chuyen va van tai"),
    ("Dien thoai", "Thiet bi lien lac cam tay"),
    ("May tinh", "Thiet bi dien tu xu ly du lieu"),
    ("Internet", "Mang luoi ket noi toan cau"),
    ("Suc khoe", "Trang thai the chat va tinh than"),
    ("Giao duc", "Qua trinh hoc tap va dao tao"),
    ("Hanh phuc", "Trang thai vui ve va hai long"),
    ("Tinh ban", "Moi quan he ban be than thiet"),
    ("Tinh yeu", "Tinh cam yeu thuong giua con nguoi"),
    ("Cong viec", "Nhiem vu va hoat dong nghe nghiep"),
    ("Tien bac", "Phuong tien trao doi va tich luy"),
    ("Tu do", "Trang thai khong bi rang buoc"),
    ("Hoa binh", "Trang thai yen binh khong chien tranh"),
    ("Bao ve", "Hanh dong giu gin va che cho"),
    ("Phat trien", "Qua trinh tien bo va lon manh"),
    ("Van hoa", "Cac gia tri truyen thong va nghe thuat"),
    ("Lich su", "Nhung su kien da xay ra trong qua khu"),
    ("Tuong lai", "Nhung gi se xay ra phia truoc"),
    ("Cong bang", "Su doi xu cong bang va binh dang"),
    ("Tri tue", "Kha nang tu duy va hieu biet"),
    ("Sang tao", "Kha nang tao ra cai moi"),
    ("Doan ket", "Su hop tac va gan bo giua moi nguoi"),
    ("Ton trong", "Thai do quy trong nguoi khac"),
    ("Trach nhiem", "Boon phan va nghia vu phai lam"),
    ("Kien nhan", "Kha nang cho doi va chiu dung"),
    ("Dung cam", "Kha nang doi mat voi kho khan"),
    ("Trung thuc", "Su that tha va ngay thang"),
    ("Khiem ton", "Thai do nhuong nhin va de tinh"),
    ("Nong nghiep", "Hoat dong trong trot va chan nuoi"),
    ("Cong nghiep", "Hoat dong san xuat va che tao"),
    ("Thuong mai", "Hoat dong mua ban va trao doi"),
    ("Du lich", "Hoat dong tham quan va kham pha"),
    ("The thao", "Hoat dong ren luyen the chat"),
    ("Am nhac", "Nghe thuat am thanh va giai dieu"),
    ("Hoi hoa", "Nghe thuat ve tranh va mau sac"),
    ("Van hoc", "Nghe thuat viet và sang tac"),
    ("Khoa hoc", "He thong tri thuc va nghien cuu"),
    ("Cong nghe", "Ung dung khoa hoc vao doi song"),
    ("Moi truong", "The gioi tu nhien xung quanh"),
    ("Nang luong", "Nguon luc de van hanh va hoat dong"),
    ("Thuc pham", "Do an va thuc uong"),
    ("Nuoc uong", "Chat long can thiet cho co the"),
    ("Nha o", "Cong trinh kien truc de o"),
    ("Quan ao", "Trang phuc mac tren nguoi"),
    ("Giao vien", "Nguoi giang day kien thuc"),
    ("Hoc sinh", "Nguoi dang trong qua trinh hoc tap"),
    ("Bac si", "Nguoi chua benh va cham soc suc khoe"),
    ("Ky su", "Nguoi thiet ke va xay dung"),
    ("Nong dan", "Nguoi lam viec trong nong nghiep"),
    ("Cong nhan", "Nguoi lao dong trong nha may"),
    ("Doanh nhan", "Nguoi kinh doanh va buon ban"),
    ("Nghe si", "Nguoi hoat dong trong linh vuc nghe thuat"),
    ("Van dong vien", "Nguoi thi dau the thao"),
    ("Nha bao", "Nguoi dua tin va viet bao"),
    ("Luat su", "Nguoi hanh nghe luat phap"),
    ("Canh sat", "Nguoi bao ve an ninh trat tu"),
    ("Linh", "Nguoi linh trong quan doi"),
    ("Vua", "Nguoi dung dau vuong quoc"),
    ("Hoang hau", "Vo cua nha vua"),
    ("Cong chua", "Con gai cua nha vua"),
    ("Hoang tu", "Con trai cua nha vua"),
    ("Than thoai", "Cau chuyen ve cac vi than"),
    ("Truyen thuyet", "Cau chuyen duoc truyen tu xa xua"),
    ("Co tich", "Cau chuyen dan gian ky ao"),
    ("Ngu ngo", "Cau chuyen mang tinh giao duc"),
    ("Than tuong", "Nguoi duoc ngung mo va ton sung"),
    ("Anh hung", "Nguoi co cong lon voi dat nuoc"),
]

COMMENT_SENTENCES = [
    "Bai hoc rat bo ich va de hieu.",
    "Video chat luong cao, giong day de nghe.",
    "Toi rat thich cach giang day cua giao vien.",
    "Kien thuc duoc trinh bay co he thong.",
    "Minh da ap dung duoc nhung gi da hoc.",
    "Bai tap thuc hanh rat huu ich.",
    "Can them nhieu vi du thuc te hon.",
    "Giao vien giai thich rat can ke va ro rang.",
    "Noi dung kha phu hop voi nguoi moi bat dau.",
    "Rat dang gia tien, se gioi thieu cho ban be.",
    "Hoc xong minh da tu tin giao tiep hon.",
    "Mong co them nhieu khoa hoc nang cao hon.",
    "Phan mem hoc tap rat de su dung.",
    "Video hoi dai, nen chia thanh cac phan ngan hon.",
    "Tu vung duoc lua chon rat thuc te.",
    "Minh da hoc duoc nhieu dieu moi.",
    "Giao trinh rat chi tiet va day du.",
    "Cac bai kiem tra giup cung co kien thuc.",
    "Viec hoc qua video giup de ghi nho hon.",
    "Con mot vai loi chinh ta trong tai lieu.",
    "Bai giang sinh dong va hap dan.",
    "Nhung kien thuc nay ap dung duoc ngay.",
    "Minh thay tien bo ro ret sau moi buoi hoc.",
    "He thong cham diem va theo doi tien do tot.",
    "Giao vien nhiet tinh giai dap thac mac.",
    "Bai hoc co cau truc logic va de theo doi.",
    "Tu lieu tham khao duoc chon loc ky luong.",
    "Hoc truc tuyen rat tien loi va linh hoat.",
    "Khoa hoc giup mo rong vung tu vung dang ke.",
    "Mong co them phien ban tieng Anh cua khoa hoc.",
    "Noi dung duoc cap nhat thuong xuyen.",
    "Cach giai thich cua giao vien rat de hieu.",
    "Da hoc xong va cam thay rat hai long.",
    "Tuong tac giua hoc vien va giao vien tot.",
    "Khoa hoc nay thuc su thay doi cuoc doi toi.",
    "Nhung tinh huong thuc te duoc long ghep hay.",
    "Minh thich cach to chuc cac module hoc tap.",
    "Cong nghe nhan dien ky hieu rat chinh xac.",
    "Phu hop cho moi lua tuoi va trinh do.",
    "Giao dien website dep va de su dung.",
    "Thoi gian hoc linh dong, co the hoc moi luc.",
    "Tai lieu tai ve duoc de xem lai sau.",
    "Cac tro choi tuong tac lam viec hoc thu vi.",
    "Giong noi cua giao vien am ap va gan gui.",
    "Minh hoc duoc them ve van hoa cung voi ngon ngu.",
    "Khoa hoc dang dong tien bac nhat mua nay.",
    "Viec luyen tap hang ngay giup tien bo nhanh.",
    "Phuong phap giang day hien dai va hieu qua.",
    "Ket noi mang on dinh, video khong bi giat.",
    "Danh gia 5 sao cho chat luong khoa hoc.",
]

ACHIEVEMENT_TITLES = [
    ("Nguoi moi bat dau", "Hoan thanh khoa hoc dau tien"),
    ("Hoc vien cham chi", "Duy tri streak 7 ngay lien tiep"),
    ("Hoc vien sieu cham", "Duy tri streak 30 ngay lien tiep"),
    ("Nha vo dich", "Duy tri streak 100 ngay lien tiep"),
    ("Ke chinh phuc", "Hoan thanh 5 khoa hoc"),
    ("Hoc vien tan tam", "Hoan thanh 10 khoa hoc"),
    ("Chuyen gia", "Hoan thanh 20 khoa hoc"),
    ("Nguoi thu thap", "Dat duoc 10 huy hieu"),
    ("Ong hoang streak", "Dat streak cao nhat 365 ngay"),
    ("Nguoi tien phong", "La nguoi dau tien hoan thanh mot khoa hoc"),
    ("Nguoi danh gia", "Viet 10 danh gia cho cac khoa hoc"),
    ("Nguoi giup do", "Tra loi 50 cau hoi cua hoc vien khac"),
    ("Nguoi sang tao", "Tao mot khoa hoc moi"),
    ("Hoc gia", "Hoan thanh tat ca cac khoa hoc cua mot linh vuc"),
    ("Nguoi truyen cam hung", "Nhan duoc 100 luot thich danh gia"),
    ("Tot nghiep xuat sac", "Hoan thanh khoa hoc voi diem 100%"),
    ("Nguoi kien tri", "Dang nhap 100 ngay lien tuc"),
    ("Nha tham hiem", "Kham pha 50 tu vung trong tu dien"),
    ("Bac thay ngon ngu", "Hoc 1000 tu vung trong tu dien"),
    ("Huyen thoai", "Dat tat ca cac thanh tuu tren"),
]


def make_batches(items: list, batch_size: int):
    for i in range(0, len(items), batch_size):
        yield items[i : i + batch_size]


# ============================================================================
# Async entry point
# ============================================================================


async def generate(conn: asyncpg.Connection, scale: float, seed: int = 42) -> dict:
    """Generate all benchmark data. Returns dict of ID lists for pgbench helpers."""
    import sys
    this_module = sys.modules[__name__]
    this_module._SEED = seed
    rng = random.Random(seed)
    ids: dict = {}
    start = time.perf_counter()

    # Disable triggers during bulk load to avoid FK violations from auto-provision
    await conn.execute("SET session_replication_role = 'replica'")

    # ------------------------------------------------------------------
    # 1. ROLES (static, 3 rows)
    # ------------------------------------------------------------------
    await conn.execute("INSERT INTO roles (role_name) VALUES ('ADMIN') ON CONFLICT DO NOTHING")
    await conn.execute("INSERT INTO roles (role_name) VALUES ('TEACHER') ON CONFLICT DO NOTHING")
    await conn.execute("INSERT INTO roles (role_name) VALUES ('STUDENT') ON CONFLICT DO NOTHING")
    role_rows = await conn.fetch("SELECT role_id, role_name FROM roles")
    role_map = {r["role_name"]: r["role_id"] for r in role_rows}
    print(f"  [1/13] Roles: 3 rows")

    # ------------------------------------------------------------------
    # 2. USERS + PROFILES + STUDENTS/TEACHERS + WALLETS
    # ------------------------------------------------------------------
    n_users = int(TARGETS["users"] * scale)
    n_students = int(n_users * 0.80)
    n_teachers = n_users - n_students - 1  # 1 admin

    student_ids = [deterministic_uuid(i, "student") for i in range(n_students)]
    teacher_ids = [deterministic_uuid(i, "teacher") for i in range(n_teachers)]

    user_batch, profile_batch, student_batch, teacher_batch, wallet_batch = [], [], [], [], []
    user_id_to_role = {}

    # Admin
    admin_uid = deterministic_uuid(0, "admin")
    user_batch.append((admin_uid, "admin", "fake_hash", "admin@elearning.vn", role_map["ADMIN"], "active"))
    profile_batch.append((admin_uid, "System Admin", date(1990, 1, 1), "0999999999"))
    wallet_batch.append((admin_uid, 100_000_000.00))
    user_id_to_role[admin_uid] = "ADMIN"

    for i in range(n_students):
        uid = student_ids[i]
        uname = f"student_{i:06d}"
        email = f"student_{i:06d}@elearning.vn"
        full = f"{rng.choice(FAMILY_NAMES)} {rng.choice(MIDDLE_NAMES)} {rng.choice(GIVEN_NAMES)}"
        dob = date(1990 + rng.randint(0, 20), rng.randint(1, 12), rng.randint(1, 28))
        phone = f"09{rng.randint(10000000, 99999999)}"
        grade = str(rng.choice([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))
        school = rng.choice(["PTIT", "HUST", "HCMUT", "UET", "IUH", "FTU", "NEU", "UEH"])

        user_batch.append((uid, uname, "fake_hash", email, role_map["STUDENT"], "active"))
        profile_batch.append((uid, full, dob, phone))
        student_batch.append((uid, grade, school))
        wallet_batch.append((uid, _wallet_balance(rng)))
        user_id_to_role[uid] = "STUDENT"

    for i in range(n_teachers):
        uid = teacher_ids[i]
        uname = f"teacher_{i:06d}"
        email = f"teacher_{i:06d}@elearning.vn"
        full = f"{rng.choice(FAMILY_NAMES)} {rng.choice(MIDDLE_NAMES)} {rng.choice(GIVEN_NAMES)}"
        dob = date(1975 + rng.randint(0, 25), rng.randint(1, 12), rng.randint(1, 28))
        phone = f"09{rng.randint(10000000, 99999999)}"
        dept = rng.choice(["IT", "Linguistics", "Education", "Arts", "Science", "Medicine", "Law", "Business"])
        bio = f"Chuyen gia {dept} voi {rng.randint(3,20)} nam kinh nghiem"

        user_batch.append((uid, uname, "fake_hash", email, role_map["TEACHER"], "active"))
        profile_batch.append((uid, full, dob, phone))
        teacher_batch.append((uid, bio, dept))
        wallet_batch.append((uid, _wallet_balance(rng)))
        user_id_to_role[uid] = "TEACHER"

    await conn.executemany(
        "INSERT INTO users (user_id, username, password_hash, email, role_id, status) VALUES ($1,$2,$3,$4,$5,$6)",
        user_batch,
    )
    await conn.executemany(
        "INSERT INTO user_profiles (user_id, full_name, date_of_birth, phone_number) VALUES ($1,$2,$3,$4)",
        profile_batch,
    )
    await conn.executemany(
        "INSERT INTO students (user_id, grade_level, school_name) VALUES ($1,$2,$3)",
        student_batch,
    )
    await conn.executemany(
        "INSERT INTO teachers (user_id, bio, department) VALUES ($1,$2,$3)",
        teacher_batch,
    )
    await conn.executemany(
        "INSERT INTO wallets (user_id, balance) VALUES ($1,$2)",
        wallet_batch,
    )
    ids["students"] = student_ids
    ids["teachers"] = teacher_ids
    ids["admin"] = [admin_uid]
    ids["all_users"] = student_ids + teacher_ids + [admin_uid]
    ids["user_role"] = user_id_to_role
    print(f"  [2/13] Users: {n_users} ({n_students} students, {n_teachers} teachers, 1 admin)")

    # ------------------------------------------------------------------
    # 3. COURSE CATEGORIES + COURSES + MODULES + LESSONS + MATERIALS
    # ------------------------------------------------------------------
    n_cats = int(TARGETS["general_course_categories"] * scale)
    cat_ids = []
    for i in range(n_cats):
        title = COURSE_TITLE_POOL[i % len(COURSE_TITLE_POOL)]
        slug = title.lower().replace(" ", "_")[:80]
        cat_ids.append(await conn.fetchval(
            "INSERT INTO general_course_categories (name) VALUES ($1) RETURNING category_id", slug
        ))

    n_courses = int(TARGETS["general_courses"] * scale)
    course_ids = []
    course_prices = {}
    course_batch = []
    for i in range(n_courses):
        cid = deterministic_uuid(i, "course")
        course_ids.append(cid)
        teacher = teacher_ids[i % n_teachers] if n_teachers > 0 else teacher_ids[0]
        cat = cat_ids[i % n_cats]
        title = f"{COURSE_TITLE_POOL[i % len(COURSE_TITLE_POOL)]} - Phan {rng.randint(1, 10)}"
        price = _course_price(rng)
        vis = rng.choices(["PUBLISHED", "DRAFT", "ARCHIVED"], weights=[0.65, 0.25, 0.10])[0]
        course_batch.append((cid, teacher, cat, title, price, vis))
        course_prices[cid] = price

    await conn.executemany(
        "INSERT INTO general_courses (course_id, teacher_id, category_id, title, price, visibility_status) VALUES ($1,$2,$3,$4,$5,$6)",
        course_batch,
    )

    # Modules, lessons, materials
    n_modules = int(TARGETS["general_course_modules"] * scale)
    n_lessons = int(TARGETS["general_course_lessons"] * scale)
    n_materials = int(TARGETS["learning_materials"] * scale)

    module_batch, lesson_batch, material_batch = [], [], []
    mod_idx, les_idx = 0, 0

    for ci, cid in enumerate(course_ids):
        nm = rng.randint(2, 5)
        for mi in range(nm):
            if mod_idx >= n_modules:
                break
            mid = deterministic_uuid(mod_idx, "module")
            module_batch.append((mid, cid, f"Chuong {mi+1}: Chu de {rng.randint(1,50)}", mi + 1))
            mod_idx += 1

            nl = rng.randint(2, 5)
            for li in range(nl):
                if les_idx >= n_lessons:
                    break
                lid = deterministic_uuid(les_idx, "lesson")
                lesson_batch.append((lid, mid, f"Bai {li+1}: {rng.choice(DICT_WORD_POOL)[0]}", f"https://video.elearning.vn/{lid}", li + 1))
                les_idx += 1

                if rng.random() < 0.6:
                    mat_idx = len(material_batch)
                    if mat_idx < n_materials:
                        mat_id = deterministic_uuid(mat_idx, "material")
                        material_batch.append((mat_id, lid, f"Tai lieu {li+1}", f"https://cdn.elearning.vn/materials/{mat_id}.pdf"))

    await conn.executemany(
        "INSERT INTO general_course_modules (module_id, course_id, title, order_index) VALUES ($1,$2,$3,$4)",
        module_batch[:n_modules],
    )
    await conn.executemany(
        "INSERT INTO general_course_lessons (lesson_id, module_id, title, video_url, order_index) VALUES ($1,$2,$3,$4,$5)",
        lesson_batch[:n_lessons],
    )
    await conn.executemany(
        "INSERT INTO learning_materials (material_id, lesson_id, title, content_url) VALUES ($1,$2,$3,$4)",
        material_batch[:n_materials],
    )

    ids["courses"] = course_ids
    ids["course_prices"] = course_prices
    print(f"  [3/13] Courses: {n_courses} courses, {n_modules} modules, {n_lessons} lessons, {n_materials} materials")

    # ------------------------------------------------------------------
    # 4. ENROLLMENTS + STREAKS
    # ------------------------------------------------------------------
    n_enrollments = int(TARGETS["course_enrollments"] * scale)
    n_streaks = int(TARGETS["student_streaks"] * scale)
    enroll_batch, streak_batch = [], []

    enrolled_set = set()
    for ei in range(n_enrollments):
        sid = student_ids[rng.randint(0, n_students - 1)]
        cid = course_ids[rng.randint(0, n_courses - 1)]
        key = (sid, cid)
        if key in enrolled_set:
            continue
        enrolled_set.add(key)
        progress = _enrollment_progress(rng)
        enrolled_at = _random_timestamp(rng, 12)
        enroll_batch.append((sid, cid, progress, enrolled_at))

        if len(enroll_batch) >= n_enrollments:
            break

    for si, sid in enumerate(student_ids[:n_streaks]):
        cur = rng.choices([0, 1, 2, 3, 5, 7, 10, 14, 21, 30], weights=[10, 20, 15, 12, 10, 8, 5, 3, 2, 1])[0]
        hi = max(cur, rng.choices([0, 3, 7, 10, 14, 21, 30, 50, 100], weights=[5, 15, 15, 12, 10, 8, 5, 3, 1])[0])
        streak_batch.append((sid, cur, hi, date.today() - timedelta(days=rng.randint(0, min(cur, 7)))))

    await conn.executemany(
        "INSERT INTO course_enrollments (student_id, course_id, progress, enrolled_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        enroll_batch,
    )
    await conn.executemany(
        "INSERT INTO student_streaks (student_id, current_streak, highest_streak, last_activity_date) VALUES ($1,$2,$3,$4)",
        streak_batch,
    )
    ids["enrollments"] = [(e[0], e[1]) for e in enroll_batch]
    print(f"  [4/13] Enrollments: {len(enroll_batch)}, Streaks: {len(streak_batch)}")

    # ------------------------------------------------------------------
    # 5. DICTIONARY CATEGORIES + ENTRIES + VARIATIONS
    # ------------------------------------------------------------------
    n_dcat = min(int(TARGETS["dictionary_categories"] * scale), len(DICT_CATEGORIES))
    n_dentry = int(TARGETS["dictionary_entries"] * scale)
    n_dvar = int(TARGETS["dictionary_variations"] * scale)
    dict_cat_ids = []

    for i in range(n_dcat):
        cname, cdesc = DICT_CATEGORIES[i]
        cid = await conn.fetchval(
            "INSERT INTO dictionary_categories (name, description) VALUES ($1,$2) RETURNING category_id",
            cname, cdesc,
        )
        dict_cat_ids.append(cid)

    entry_batch, var_batch = [], []
    for ei in range(n_dentry):
        widx = ei % len(DICT_WORD_POOL)
        word, meaning = DICT_WORD_POOL[widx]
        word = f"{word} ({ei})" if ei >= len(DICT_WORD_POOL) else word
        eid = deterministic_uuid(ei, "dict_entry")
        cat = dict_cat_ids[ei % len(dict_cat_ids)]
        entry_batch.append((eid, cat, word, meaning))
        for vi in range(rng.randint(1, 4)):
            if len(var_batch) >= n_dvar:
                break
            vid = deterministic_uuid(len(var_batch), "dict_var")
            region = rng.choice(["Ha Noi", "TP HCM", "Da Nang", "Can Tho", "Hue", "Siem Reap", "Phnom Penh", "Battambang"])
            vurl = f"https://video.elearning.vn/dict/{vid}"
            var_batch.append((vid, eid, region, vurl, f"Phat am giong {region}"))

    await conn.executemany(
        "INSERT INTO dictionary_entries (entry_id, category_id, word, meaning) VALUES ($1,$2,$3,$4)",
        entry_batch,
    )
    await conn.executemany(
        "INSERT INTO dictionary_variations (variation_id, entry_id, region, video_url, description) VALUES ($1,$2,$3,$4,$5)",
        var_batch,
    )
    print(f"  [5/13] Dictionary: {n_dcat} cats, {len(entry_batch)} entries, {len(var_batch)} variations")

    # ------------------------------------------------------------------
    # 6. MICROLEARNING
    # ------------------------------------------------------------------
    n_mlt = int(TARGETS["microlearning_topics"] * scale)
    n_mlu = int(TARGETS["microlearning_units"] * scale)
    n_mll = int(TARGETS["microlearning_lessons"] * scale)
    n_mlp = int(TARGETS["microlearning_lesson_parts"] * scale)
    n_mlq = int(TARGETS["microlearning_questions"] * scale)

    mlt_ids, mlu_ids, mll_ids = [], [], []
    for ti in range(n_mlt):
        mlt_ids.append(await conn.fetchval(
            "INSERT INTO microlearning_topics (title, description) VALUES ($1,$2) RETURNING topic_id",
            f"Chu de {ti+1}: {DICT_CATEGORIES[ti % len(DICT_CATEGORIES)][0]}",
            f"Noi dung ve {DICT_CATEGORIES[ti % len(DICT_CATEGORIES)][1]}",
        ))

    mlu_batch, mll_batch, mlp_batch, mlq_batch = [], [], [], []
    for ui in range(n_mlu):
        tid = mlt_ids[ui % len(mlt_ids)]
        uid = deterministic_uuid(ui, "ml_unit")
        mlu_ids.append(uid)
        mlu_batch.append((uid, tid, f"Don vi {ui+1}", (ui % 5) + 1))

    for li in range(n_mll):
        uid = mlu_ids[li % len(mlu_ids)]
        lid = deterministic_uuid(li, "ml_lesson")
        mll_ids.append(lid)
        mll_batch.append((lid, uid, f"Bai hoc {li+1}", f"https://video.elearning.vn/ml/{lid}", (li % 4) + 1))

    for pi in range(n_mlp):
        lid = mll_ids[pi % len(mll_ids)]
        pid = deterministic_uuid(pi, "ml_part")
        mlp_batch.append((pid, lid, f"Phan {pi+1}", rng.choice(["video", "quiz", "reading"]), f"Noi dung phan {pi+1}", (pi % 3) + 1))

    for qi in range(n_mlq):
        pid = mlp_batch[qi % len(mlp_batch)][0]
        qid = deterministic_uuid(qi, "ml_question")
        options = [rng.choice(DICT_WORD_POOL)[0] for _ in range(4)]
        mlq_batch.append((qid, pid, f"Cau hoi {qi+1}", "single_choice", json.dumps(options, ensure_ascii=False), options[0]))

    await conn.executemany(
        "INSERT INTO microlearning_units (unit_id, topic_id, title, order_index) VALUES ($1,$2,$3,$4)",
        mlu_batch,
    )
    await conn.executemany(
        "INSERT INTO microlearning_lessons (lesson_id, unit_id, title, video_url, order_index) VALUES ($1,$2,$3,$4,$5)",
        mll_batch,
    )
    await conn.executemany(
        "INSERT INTO microlearning_lesson_parts (part_id, lesson_id, title, part_type, content, order_index) VALUES ($1,$2,$3,$4,$5,$6)",
        mlp_batch,
    )
    await conn.executemany(
        "INSERT INTO microlearning_questions (question_id, part_id, question_text, question_type, options_json, correct_answer) VALUES ($1,$2,$3,$4,$5::jsonb,$6)",
        mlq_batch,
    )
    print(f"  [6/13] Microlearning: {n_mlt} topics, {n_mlu} units, {n_mll} lessons, {n_mlp} parts, {n_mlq} questions")

    # ------------------------------------------------------------------
    # 7. COMMENTS
    # ------------------------------------------------------------------
    n_comments = int(TARGETS["comments"] * scale)
    comment_batch = []
    all_lesson_ids = [l[0] for l in lesson_batch[:n_lessons]]
    for ci in range(n_comments):
        cid = deterministic_uuid(ci, "comment")
        lid = all_lesson_ids[ci % len(all_lesson_ids)] if all_lesson_ids else deterministic_uuid(0, "lesson")
        uid = ids["all_users"][ci % len(ids["all_users"])]
        content = " ".join(rng.sample(COMMENT_SENTENCES, rng.randint(1, 3)))
        ts = _random_timestamp(rng, 12)
        comment_batch.append((cid, lid, uid, content, ts))

    await conn.executemany(
        "INSERT INTO comments (comment_id, lesson_id, user_id, content, created_at) VALUES ($1,$2,$3,$4,$5)",
        comment_batch,
    )
    print(f"  [7/13] Comments: {len(comment_batch)}")

    # ------------------------------------------------------------------
    # 8. FEEDBACKS
    # ------------------------------------------------------------------
    n_fb = int(TARGETS["user_feedbacks"] * scale)
    fb_batch = []
    for fi in range(n_fb):
        fid = deterministic_uuid(fi, "feedback")
        uid = student_ids[fi % n_students]
        rating = rng.choices([1, 2, 3, 4, 5], weights=[3, 5, 10, 30, 52])[0]
        cid = course_ids[rng.randint(0, n_courses - 1)]
        c_title = f"Course {cid[:8]}"
        fb_batch.append((fid, uid, rating, rng.choice(COMMENT_SENTENCES), c_title))
    await conn.executemany(
        "INSERT INTO user_feedbacks (feedback_id, user_id, rating, feedback_text, context) VALUES ($1,$2,$3,$4,$5)",
        fb_batch,
    )
    print(f"  [8/13] Feedbacks: {len(fb_batch)}")

    # ------------------------------------------------------------------
    # 9. ACHIEVEMENTS + USER_ACHIEVEMENTS
    # ------------------------------------------------------------------
    n_ach = min(int(TARGETS["achievements"] * scale), len(ACHIEVEMENT_TITLES))
    ach_ids = []
    for ai in range(n_ach):
        title, desc = ACHIEVEMENT_TITLES[ai]
        aid = await conn.fetchval(
            "INSERT INTO achievements (title, description) VALUES ($1,$2) RETURNING achievement_id",
            title, desc,
        )
        ach_ids.append(aid)

    n_ua = int(TARGETS["user_achievements"] * scale)
    ua_batch, ua_set = [], set()
    for uai in range(n_ua):
        uid = student_ids[rng.randint(0, n_students - 1)]
        aid = ach_ids[rng.randint(0, n_ach - 1)]
        key = (uid, aid)
        if key in ua_set:
            continue
        ua_set.add(key)
        ua_batch.append((uid, aid))
        if len(ua_batch) >= n_ua:
            break
    await conn.executemany(
        "INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        ua_batch,
    )
    ids["achievements"] = ach_ids
    print(f"  [9/13] Achievements: {n_ach} types, {len(ua_batch)} awarded")

    # ------------------------------------------------------------------
    # 10. TRANSACTION LOGS (partitioned — spread over 12 months)
    # ------------------------------------------------------------------
    n_tx = int(TARGETS["transaction_logs"] * scale)
    n_txa = int(TARGETS["transaction_action_logs"] * scale)

    tx_batch, txa_batch = [], []
    for ti in range(n_tx):
        tid = deterministic_uuid(ti, "tx")
        from_uid = ids["all_users"][rng.randint(0, len(ids["all_users"]) - 1)]
        to_uid = ids["all_users"][rng.randint(0, len(ids["all_users"]) - 1)]
        if from_uid == to_uid:
            to_uid = ids["all_users"][(ids["all_users"].index(to_uid) + 1) % len(ids["all_users"])]
        amount = rng.choices(
            [rng.randint(10_000, 500_000), rng.randint(500_000, 5_000_000), rng.randint(5_000_000, 20_000_000)],
            weights=[60, 35, 5],
        )[0]
        status = rng.choices(["SUCCESS", "FAILED", "ROLLED_BACK"], weights=[85, 10, 5])[0]
        ts = _random_timestamp(rng, 12)
        tx_batch.append((tid, from_uid, to_uid, amount, status, f"Transaction {ti}", ts))

        if ti < n_txa:
            txa_batch.append((deterministic_uuid(ti, "txa"), tid, status, f"Action for tx {ti}", ts))

    # Use copy_records_to_table for large batches
    await _batch_insert(conn, "transaction_logs",
        ["transaction_id", "from_wallet_user_id", "to_wallet_user_id", "amount", "status", "message", "created_at"],
        tx_batch)
    if txa_batch:
        await _batch_insert(conn, "transaction_action_logs",
            ["action_log_id", "transaction_id", "action_type", "message", "created_at"],
            txa_batch)
    print(f"  [10/13] Transactions: {len(tx_batch)} tx, {len(txa_batch)} actions")

    # ------------------------------------------------------------------
    # 11. AUDIT LOGS + NOTIFICATIONS + LOG (partitioned, 12 months)
    # ------------------------------------------------------------------
    n_audit = int(TARGETS["audit_logs"] * scale)
    n_notif = int(TARGETS["notification_users"] * scale)
    n_log = int(TARGETS["log"] * scale)

    audit_batch, notif_batch, log_batch = [], [], []
    for ai in range(n_audit):
        ts = _random_timestamp(rng, 12)
        audit_batch.append((deterministic_uuid(ai, "audit"), deterministic_uuid(ai, "audit_run"), rng.choice(["BUY_COURSE", "TOPUP_WALLET", "REFUND", "BAN_USER", "TRANSFER"]), rng.choices(["SUCCESS", "FAILED"], weights=[90, 10])[0], ts))

    for ni in range(n_notif):
        ts = _random_timestamp(rng, 12)
        uid = ids["all_users"][rng.randint(0, len(ids["all_users"]) - 1)]
        notif_batch.append((deterministic_uuid(ni, "notif"), uid, f"Notification {ni}", rng.choice(COMMENT_SENTENCES), rng.choice([True, False]), ts))

    for li in range(n_log):
        ts = _random_timestamp(rng, 12)
        log_batch.append((deterministic_uuid(li, "log"), rng.choice(["LOGIN", "LOGOUT", "VIEW_COURSE", "SEARCH", "PURCHASE", "TOPUP", "COMPLETE_LESSON"]), ts))

    await _batch_insert(conn, "audit_logs", ["audit_id", "run_id", "action", "status", "created_at"], audit_batch)
    await _batch_insert(conn, "notification_users", ["notification_id", "user_id", "title", "message", "is_read", "created_at"], notif_batch)
    await _batch_insert(conn, "log", ["log_id", "action", "created_at"], log_batch)
    print(f"  [11/13] Logs: {len(audit_batch)} audit, {len(notif_batch)} notif, {len(log_batch)} system log")

    # ------------------------------------------------------------------
    # 12. AUTHENTICATION SESSIONS
    # ------------------------------------------------------------------
    n_sess = int(TARGETS["authentication_sessions"] * scale)
    sess_batch = []
    for si in range(n_sess):
        uid = ids["all_users"][rng.randint(0, len(ids["all_users"]) - 1)]
        skey = hashlib.sha256(f"session:{si}:{uid}".encode()).hexdigest()
        expires = datetime.now(TZ) + timedelta(hours=rng.randint(1, 72))
        sess_batch.append((deterministic_uuid(si, "sess"), uid, skey, expires))
    await conn.executemany(
        "INSERT INTO authentication_sessions (session_id, user_id, session_key, expires_at) VALUES ($1,$2,$3,$4)",
        sess_batch,
    )
    print(f"  [12/13] Sessions: {len(sess_batch)}")

    # ------------------------------------------------------------------
    # 13. PGBENCH HELPER TABLES + FUNCTIONS
    # ------------------------------------------------------------------
    await conn.execute("DROP TABLE IF EXISTS bench_student_ids CASCADE")
    await conn.execute("DROP TABLE IF EXISTS bench_course_ids CASCADE")
    await conn.execute("DROP TABLE IF EXISTS bench_user_ids CASCADE")
    await conn.execute("DROP FUNCTION IF EXISTS bench_checkout(INT,INT)")
    await conn.execute("DROP FUNCTION IF EXISTS bench_transfer(INT,INT,NUMERIC)")
    await conn.execute("DROP FUNCTION IF EXISTS bench_topup(INT,NUMERIC)")

    await conn.execute("""
        CREATE TABLE bench_student_ids (row_num SERIAL PRIMARY KEY, user_id UUID NOT NULL)
    """)
    await conn.execute("""
        CREATE TABLE bench_course_ids (row_num SERIAL PRIMARY KEY, course_id UUID NOT NULL)
    """)
    await conn.execute("""
        CREATE TABLE bench_user_ids (row_num SERIAL PRIMARY KEY, user_id UUID NOT NULL)
    """)

    # Populate lookup tables
    for i, sid in enumerate(ids["students"], 1):
        await conn.execute("INSERT INTO bench_student_ids (row_num, user_id) VALUES ($1,$2)", i, sid)
    for i, cid in enumerate(ids["courses"], 1):
        await conn.execute("INSERT INTO bench_course_ids (row_num, course_id) VALUES ($1,$2)", i, cid)
    for i, uid in enumerate(ids["all_users"], 1):
        await conn.execute("INSERT INTO bench_user_ids (row_num, user_id) VALUES ($1,$2)", i, uid)

    n_student_rows = len(ids["students"])
    n_course_rows = len(ids["courses"])
    n_user_rows = len(ids["all_users"])

    await conn.execute(f"""
        CREATE OR REPLACE FUNCTION bench_checkout(p_student_idx INT, p_course_idx INT)
        RETURNS VOID AS $$
        DECLARE
            v_student UUID;
            v_course UUID;
        BEGIN
            SELECT user_id INTO v_student FROM bench_student_ids WHERE row_num = ((p_student_idx - 1) % {n_student_rows}) + 1;
            SELECT course_id INTO v_course FROM bench_course_ids WHERE row_num = ((p_course_idx - 1) % {n_course_rows}) + 1;
            CALL sp_buy_course_with_wallet(v_student, v_course);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)

    await conn.execute(f"""
        CREATE OR REPLACE FUNCTION bench_transfer(p_from_idx INT, p_to_idx INT, p_amount NUMERIC)
        RETURNS VOID AS $$
        DECLARE
            v_from UUID;
            v_to UUID;
        BEGIN
            SELECT user_id INTO v_from FROM bench_user_ids WHERE row_num = ((p_from_idx - 1) % {n_user_rows}) + 1;
            SELECT user_id INTO v_to FROM bench_user_ids WHERE row_num = ((p_to_idx - 1) % {n_user_rows}) + 1;
            CALL sp_transfer_funds(v_from, v_to, p_amount, 'pgbench transfer');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)

    await conn.execute(f"""
        CREATE OR REPLACE FUNCTION bench_topup(p_user_idx INT, p_amount NUMERIC)
        RETURNS VOID AS $$
        DECLARE
            v_user UUID;
        BEGIN
            SELECT user_id INTO v_user FROM bench_user_ids WHERE row_num = ((p_user_idx - 1) % {n_user_rows}) + 1;
            CALL sp_topup_wallet(v_user, p_amount, 'pgbench topup');
        END;
        $$ LANGUAGE plpgsql;
    """)

    print(f"  [13/13] pgbench helpers: bench_student_ids ({n_student_rows}), bench_course_ids ({n_course_rows}), bench_user_ids ({n_user_rows}) + 3 wrapper functions")

    # Re-enable triggers
    await conn.execute("SET session_replication_role = 'origin'")

    elapsed = time.perf_counter() - start
    print(f"\n  Done in {elapsed:.1f}s.")
    return ids


# ============================================================================
# Helpers
# ============================================================================


def _wallet_balance(rng: random.Random) -> float:
    tier = rng.choices([0, 1, 2, 3], weights=[70, 20, 8, 2])[0]
    if tier == 0:
        return round(rng.uniform(0, 1_000_000), 2)
    elif tier == 1:
        return round(rng.uniform(1_000_000, 5_000_000), 2)
    elif tier == 2:
        return round(rng.uniform(5_000_000, 20_000_000), 2)
    else:
        return round(rng.uniform(20_000_000, 100_000_000), 2)


def _course_price(rng: random.Random) -> float:
    # Log-normal-ish: most courses 50K-2M, median ~300K
    base = 10 ** rng.uniform(4.7, 6.3)
    return round(base / 1000) * 1000  # Round to nearest 1000


def _enrollment_progress(rng: random.Random) -> float:
    tier = rng.choices([0, 1, 2, 3], weights=[40, 20, 15, 25])[0]
    if tier == 0:
        return round(rng.uniform(0, 10), 2)
    elif tier == 1:
        return round(rng.uniform(10, 50), 2)
    elif tier == 2:
        return round(rng.uniform(50, 99), 2)
    else:
        return 100.0


def _random_timestamp(rng: random.Random, months_back: int) -> datetime:
    now = datetime.now(TZ)
    min_ts = datetime(2025, 7, 1, tzinfo=TZ)  # Earliest partition
    days_back = rng.uniform(0, months_back * 30)
    seconds_back = days_back * 86400
    ts = now - timedelta(seconds=seconds_back)
    if ts < min_ts:
        ts = min_ts + timedelta(seconds=rng.uniform(0, 86400))
    # Bias: 40% in last 3 months, 60% in prior
    if rng.random() < 0.4:
        ts = now - timedelta(seconds=rng.uniform(0, 90 * 86400))
    if ts < min_ts:
        ts = min_ts + timedelta(seconds=rng.uniform(0, 86400))
    return ts


async def _batch_insert(conn, table: str, columns: list[str], rows: list[tuple]):
    """Insert rows in batches of 5000."""
    if not rows:
        return
    cols = ", ".join(columns)
    placeholders = ", ".join(f"${i+1}" for i in range(len(columns)))
    sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"
    for batch in make_batches(rows, 5000):
        await conn.executemany(sql, batch)


# ============================================================================
# CLI
# ============================================================================


async def main():
    parser = argparse.ArgumentParser(description="Generate benchmark data for E-Learning Platform")
    parser.add_argument("--scale", type=float, default=1.0, help="Scale factor (0.1 = 10%%, 1.0 = full ~1.3M rows)")
    parser.add_argument("--reset", action="store_true", help="Truncate all data first")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for reproducibility")
    parser.add_argument("--host", default="localhost", help="DB host")
    parser.add_argument("--port", default="5432", help="DB port")
    parser.add_argument("--user", default="postgres", help="DB user")
    parser.add_argument("--password", default="postgres", help="DB password")
    parser.add_argument("--database", default="elearning_db", help="DB name")
    args = parser.parse_args()

    conn = await asyncpg.connect(
        host=args.host, port=args.port, user=args.user,
        password=args.password, database=args.database,
    )

    try:
        if args.reset:
            print("Truncating all tables...")
            for table in DELETE_ORDER:
                try:
                    await conn.execute(f"TRUNCATE TABLE {table} CASCADE")
                except Exception:
                    pass
            # Also truncate identity tables
            for t in ["roles", "general_course_categories", "dictionary_categories", "microlearning_topics", "achievements"]:
                try:
                    await conn.execute(f"TRUNCATE TABLE {t} RESTART IDENTITY CASCADE")
                except Exception:
                    pass
            print("All data reset.\n")

        print(f"Generating benchmark data (scale={args.scale}, seed={args.seed})...")
        await generate(conn, args.scale, seed=args.seed)

        # Verify row counts
        print("\nRow counts:")
        for table in ["users", "general_courses", "general_course_modules",
                       "general_course_lessons", "course_enrollments", "comments",
                       "transaction_logs", "dictionary_entries", "student_streaks",
                       "user_feedbacks", "audit_logs", "notification_users"]:
            cnt = await conn.fetchval(f"SELECT count(*) FROM {table}")
            print(f"  {table}: {cnt}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
