-- ====================================================================================
-- PHẦN 1: CÁC BẢNG LƯU TRỮ CHÍNH (KHÔNG PHÂN VÙNG)
-- ====================================================================================

CREATE TABLE roles (
    role_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_users_status CHECK (status IN ('active', 'frozen')),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE RESTRICT
);

CREATE TABLE user_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(255),
    phone_number VARCHAR(20),
    date_of_birth DATE,
    CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE students (
    user_id UUID PRIMARY KEY,
    grade_level VARCHAR(50),
    school_name VARCHAR(150),
    CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE teachers (
    user_id UUID PRIMARY KEY,
    bio TEXT,
    department VARCHAR(100),
    CONSTRAINT fk_teachers_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE authentication_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_key VARCHAR(255) NOT NULL UNIQUE,
    otp_code VARCHAR(10),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_auth_session_expiry CHECK (expires_at > created_at),
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE dictionary_categories (
    category_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE dictionary_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id INTEGER NOT NULL,
    word VARCHAR(100) NOT NULL,
    meaning TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_dict_entry_per_category UNIQUE (category_id, word),
    CONSTRAINT fk_dict_entries_category FOREIGN KEY (category_id) REFERENCES dictionary_categories (category_id) ON DELETE RESTRICT
);

CREATE TABLE dictionary_variations (
    variation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL,
    region VARCHAR(100),
    video_url VARCHAR(255) NOT NULL,
    description TEXT,
    CONSTRAINT uq_dict_variation_video UNIQUE (entry_id, video_url),
    CONSTRAINT fk_dict_variations_entry FOREIGN KEY (entry_id) REFERENCES dictionary_entries (entry_id) ON DELETE CASCADE
);

CREATE TABLE general_course_categories (
    category_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE general_courses (
    course_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL,
    category_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(255), -- Thêm URL hình ảnh
    price NUMERIC(14, 2) NOT NULL DEFAULT 0.00, -- Thêm giá tiền khóa học
    visibility_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_course_visibility CHECK (visibility_status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT fk_courses_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_courses_category FOREIGN KEY (category_id) REFERENCES general_course_categories (category_id) ON DELETE RESTRICT
);

CREATE TABLE general_course_modules (
    module_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL CHECK (order_index > 0),
    CONSTRAINT uq_module_order_per_course UNIQUE (course_id, order_index),
    CONSTRAINT fk_modules_course FOREIGN KEY (course_id) REFERENCES general_courses (course_id) ON DELETE CASCADE
);

CREATE TABLE general_course_lessons (
    lesson_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    video_url VARCHAR(255), -- Thêm URL video
    order_index INTEGER NOT NULL CHECK (order_index > 0),
    CONSTRAINT uq_lesson_order_per_module UNIQUE (module_id, order_index),
    CONSTRAINT fk_lessons_module FOREIGN KEY (module_id) REFERENCES general_course_modules (module_id) ON DELETE CASCADE
);

CREATE TABLE learning_materials (
    material_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    content_url VARCHAR(255) NOT NULL,
    material_transcript JSONB,
    CONSTRAINT fk_materials_lesson FOREIGN KEY (lesson_id) REFERENCES general_course_lessons (lesson_id) ON DELETE CASCADE
);

CREATE TABLE course_enrollments (
    enrollment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    course_id UUID NOT NULL,
    progress NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_course_enrollment UNIQUE (student_id, course_id),
    CONSTRAINT ck_enrollment_progress CHECK (progress >= 0 AND progress <= 100),
    CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES students (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES general_courses (course_id) ON DELETE CASCADE
);

CREATE TABLE comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comments_lesson FOREIGN KEY (lesson_id) REFERENCES general_course_lessons (lesson_id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE microlearning_topics (
    topic_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT
);

CREATE TABLE microlearning_units (
    unit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL CHECK (order_index > 0),
    CONSTRAINT uq_ml_unit_order_per_topic UNIQUE (topic_id, order_index),
    CONSTRAINT fk_ml_units_topic FOREIGN KEY (topic_id) REFERENCES microlearning_topics (topic_id) ON DELETE CASCADE
);

CREATE TABLE microlearning_lessons (
    lesson_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    video_url VARCHAR(255), -- Thêm URL video
    order_index INTEGER NOT NULL CHECK (order_index > 0),
    CONSTRAINT uq_ml_lesson_order_per_unit UNIQUE (unit_id, order_index),
    CONSTRAINT fk_ml_lessons_unit FOREIGN KEY (unit_id) REFERENCES microlearning_units (unit_id) ON DELETE CASCADE
);

CREATE TABLE microlearning_lesson_parts (
    part_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL,
    title VARCHAR(255),
    part_type VARCHAR(50) NOT NULL,
    content TEXT,
    order_index INTEGER NOT NULL CHECK (order_index > 0),
    CONSTRAINT uq_ml_part_order_per_lesson UNIQUE (lesson_id, order_index),
    CONSTRAINT fk_ml_parts_lesson FOREIGN KEY (lesson_id) REFERENCES microlearning_lessons (lesson_id) ON DELETE CASCADE
);

CREATE TABLE microlearning_questions (
    question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL,
    options_json JSONB NOT NULL,
    correct_answer VARCHAR(255) NOT NULL,
    CONSTRAINT fk_ml_questions_part FOREIGN KEY (part_id) REFERENCES microlearning_lesson_parts (part_id) ON DELETE CASCADE
);

CREATE TABLE student_streaks (
    streak_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL UNIQUE,
    current_streak INTEGER NOT NULL DEFAULT 0,
    highest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    CONSTRAINT ck_streak_non_negative CHECK (current_streak >= 0 AND highest_streak >= 0),
    CONSTRAINT ck_streak_highest_gte_current CHECK (highest_streak >= current_streak),
    CONSTRAINT fk_streaks_student FOREIGN KEY (student_id) REFERENCES students (user_id) ON DELETE CASCADE
);

CREATE TABLE achievements (
    achievement_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon_url VARCHAR(255)
);

CREATE TABLE user_achievements (
    user_id UUID NOT NULL,
    achievement_id INTEGER NOT NULL,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id),
    CONSTRAINT fk_ua_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_ua_achievement FOREIGN KEY (achievement_id) REFERENCES achievements (achievement_id) ON DELETE CASCADE
);

CREATE TABLE user_feedbacks (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    rating INTEGER,
    feedback_text TEXT,
    context VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_feedback_rating CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
    CONSTRAINT fk_feedbacks_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE wallets (
    user_id UUID PRIMARY KEY,
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_wallets_balance_non_negative CHECK (balance >= 0),
    CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);


-- ====================================================================================
-- PHẦN 2: CÁC BẢNG LƯU TRỮ LOG (CÓ PARTITIONING THEO THÁNG)
-- Lưu ý: Khóa chính (Primary Key) bắt buộc phải chứa cột được phân vùng (created_at)
-- ====================================================================================

-- 1. Bảng transaction_logs (Giao dịch)
CREATE TABLE transaction_logs (
    transaction_id UUID DEFAULT gen_random_uuid(),
    from_wallet_user_id UUID,
    to_wallet_user_id UUID,
    amount NUMERIC(14, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    related_course_id UUID, -- Thêm khóa ngoại trỏ tới khóa học
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (transaction_id, created_at),
    CONSTRAINT ck_transaction_logs_amount CHECK (amount > 0),
    CONSTRAINT ck_transaction_logs_status CHECK (status IN ('SUCCESS', 'FAILED', 'ROLLED_BACK')),
    CONSTRAINT fk_transaction_logs_from_wallet FOREIGN KEY (from_wallet_user_id) REFERENCES wallets (user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_transaction_logs_to_wallet FOREIGN KEY (to_wallet_user_id) REFERENCES wallets (user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_transaction_logs_course FOREIGN KEY (related_course_id) REFERENCES general_courses(course_id) ON DELETE SET NULL
) PARTITION BY RANGE (created_at);

-- Tạo sẵn vùng (partitions) cho bảng transaction_logs
CREATE TABLE transaction_logs_2026_06 PARTITION OF transaction_logs FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE transaction_logs_2026_07 PARTITION OF transaction_logs FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- 2. Bảng transaction_action_logs (Lịch sử hành động giao dịch)
CREATE TABLE transaction_action_logs (
    action_log_id UUID DEFAULT gen_random_uuid(),
    transaction_id UUID,
    action_type VARCHAR(40) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (action_log_id, created_at)
) PARTITION BY RANGE (created_at);

-- Tạo sẵn vùng (partitions) cho bảng transaction_action_logs
CREATE TABLE tx_action_logs_2026_06 PARTITION OF transaction_action_logs FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE tx_action_logs_2026_07 PARTITION OF transaction_action_logs FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- 3. Bảng log (Log hệ thống chung)
CREATE TABLE log (
    log_id UUID DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (log_id, created_at)
) PARTITION BY RANGE (created_at);

-- Tạo sẵn vùng (partitions) cho bảng log
CREATE TABLE log_2026_06 PARTITION OF log FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE log_2026_07 PARTITION OF log FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- 4. Bảng audit_logs (Lịch sử kiểm toán)
CREATE TABLE audit_logs (
    audit_id UUID DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_id, created_at),
    CONSTRAINT ck_audit_logs_status CHECK (status IN ('SUCCESS', 'FAILED', 'ROLLED_BACK'))
) PARTITION BY RANGE (created_at);

-- Tạo sẵn vùng (partitions) cho bảng audit_logs
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- 5. Bảng notification_users (Thông báo người dùng)
CREATE TABLE notification_users (
    notification_id UUID DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id, created_at),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) PARTITION BY RANGE (created_at);

-- Tạo sẵn vùng (partitions) cho bảng notification_users
CREATE TABLE notification_users_2026_06 PARTITION OF notification_users FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE notification_users_2026_07 PARTITION OF notification_users FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');