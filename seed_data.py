import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="elearning_db",
    user="postgres",
    password="postgres"
)
cursor = conn.cursor()

try:
    # Clean up old data to ensure idempotency
    cursor.execute("DELETE FROM user_feedbacks;")
    cursor.execute("DELETE FROM course_enrollments;")
    cursor.execute("DELETE FROM transaction_logs;")
    cursor.execute("DELETE FROM learning_materials;")
    cursor.execute("DELETE FROM general_course_lessons;")
    cursor.execute("DELETE FROM general_course_modules;")
    cursor.execute("DELETE FROM general_courses;")
    cursor.execute("DELETE FROM dictionary_variations;")
    cursor.execute("DELETE FROM dictionary_entries;")
    cursor.execute("DELETE FROM dictionary_categories;")
    cursor.execute("DELETE FROM microlearning_questions;")
    cursor.execute("DELETE FROM microlearning_lesson_parts;")
    cursor.execute("DELETE FROM microlearning_lessons;")
    cursor.execute("DELETE FROM microlearning_units;")
    cursor.execute("DELETE FROM microlearning_topics;")

    # 1. Insert roles
    cursor.execute("INSERT INTO roles (role_name) VALUES ('STUDENT') ON CONFLICT (role_name) DO NOTHING;")
    cursor.execute("INSERT INTO roles (role_name) VALUES ('TEACHER') ON CONFLICT (role_name) DO NOTHING;")
    
    cursor.execute("SELECT role_id FROM roles WHERE role_name = 'STUDENT';")
    student_role_id = cursor.fetchone()[0]

    cursor.execute("SELECT role_id FROM roles WHERE role_name = 'TEACHER';")
    teacher_role_id = cursor.fetchone()[0]

    # 2. Insert users
    # Student user
    cursor.execute("""
        INSERT INTO users (username, password_hash, email, role_id, status)
        VALUES ('student1', 'fake_hash', 'student1@elearning.com', %s, 'active')
        ON CONFLICT (username) DO NOTHING RETURNING user_id;
    """, (student_role_id,))
    res = cursor.fetchone()
    student_id = res[0] if res else None
    
    if not student_id:
        cursor.execute("SELECT user_id FROM users WHERE username = 'student1';")
        student_id = cursor.fetchone()[0]

    # Teacher user
    cursor.execute("""
        INSERT INTO users (username, password_hash, email, role_id, status)
        VALUES ('teacher1', 'fake_hash', 'teacher1@elearning.com', %s, 'active')
        ON CONFLICT (username) DO NOTHING RETURNING user_id;
    """, (teacher_role_id,))
    res = cursor.fetchone()
    teacher_id = res[0] if res else None

    if not teacher_id:
        cursor.execute("SELECT user_id FROM users WHERE username = 'teacher1';")
        teacher_id = cursor.fetchone()[0]

    # 3. Create profiles
    cursor.execute("""
        INSERT INTO user_profiles (user_id, full_name, date_of_birth, phone_number)
        VALUES (%s, 'Nguyen Van A', '2000-01-01', '0123456789')
        ON CONFLICT (user_id) DO NOTHING;
    """, (student_id,))

    cursor.execute("""
        INSERT INTO user_profiles (user_id, full_name, date_of_birth, phone_number)
        VALUES (%s, 'Tran Thi B', '1985-05-12', '0987654321')
        ON CONFLICT (user_id) DO NOTHING;
    """, (teacher_id,))

    # 3.5. Create student and teacher child-table records
    cursor.execute("""
        INSERT INTO students (user_id, grade_level, school_name)
        VALUES (%s, '12', 'PTIT')
        ON CONFLICT (user_id) DO NOTHING;
    """, (student_id,))

    cursor.execute("""
        INSERT INTO teachers (user_id, bio, department)
        VALUES (%s, 'Expert in Sign Language', 'IT')
        ON CONFLICT (user_id) DO NOTHING;
    """, (teacher_id,))

    # 4. Create wallets
    cursor.execute("""
        INSERT INTO wallets (user_id, balance)
        VALUES (%s, 1000000.00)
        ON CONFLICT (user_id) DO NOTHING;
    """, (student_id,))

    cursor.execute("""
        INSERT INTO wallets (user_id, balance)
        VALUES (%s, 500000.00)
        ON CONFLICT (user_id) DO NOTHING;
    """, (teacher_id,))

    # 4.5. Create course category
    cursor.execute("""
        INSERT INTO general_course_categories (name)
        VALUES ('Ngon ngu ky hieu')
        ON CONFLICT (name) DO NOTHING RETURNING category_id;
    """)
    res = cursor.fetchone()
    category_id = res[0] if res else None

    if not category_id:
        cursor.execute("SELECT category_id FROM general_course_categories WHERE name = 'Ngon ngu ky hieu';")
        category_id = cursor.fetchone()[0]

    # 5. Create courses
    cursor.execute("""
        INSERT INTO general_courses (title, price, teacher_id, category_id, visibility_status)
        VALUES ('Khoa hoc Ky nang Giao tiep ngon ngu ky hieu', 500000.00, %s, %s, 'DRAFT')
        RETURNING course_id;
    """, (teacher_id, category_id))
    course1_id = cursor.fetchone()[0]

    cursor.execute("""
        INSERT INTO general_courses (title, price, teacher_id, category_id, visibility_status)
        VALUES ('Tu vung Ngon ngu ky hieu co ban', 250000.00, %s, %s, 'PUBLISHED')
        RETURNING course_id;
    """, (teacher_id, category_id))
    course2_id = cursor.fetchone()[0]

    # Seed Course Modules
    cursor.execute("""
        INSERT INTO general_course_modules (course_id, title, order_index)
        VALUES (%s, 'Chương 1: Giới thiệu về ngôn ngữ ký hiệu', 1)
        RETURNING module_id;
    """, (course1_id,))
    module1_id = cursor.fetchone()[0]

    cursor.execute("""
        INSERT INTO general_course_modules (course_id, title, order_index)
        VALUES (%s, 'Chương 2: Các ký hiệu chữ cái và số cơ bản', 2)
        RETURNING module_id;
    """, (course1_id,))
    module2_id = cursor.fetchone()[0]

    # Seed Course Lessons
    cursor.execute("""
        INSERT INTO general_course_lessons (module_id, title, video_url, order_index)
        VALUES (%s, 'Bài 1: Lịch sử hình thành ngôn ngữ ký hiệu', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 1)
        RETURNING lesson_id;
    """, (module1_id,))
    lesson1_id = cursor.fetchone()[0]

    cursor.execute("""
        INSERT INTO general_course_lessons (module_id, title, video_url, order_index)
        VALUES (%s, 'Bài 2: Các quy tắc giao tiếp cơ bản', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 2)
        RETURNING lesson_id;
    """, (module1_id,))
    lesson2_id = cursor.fetchone()[0]

    cursor.execute("""
        INSERT INTO general_course_lessons (module_id, title, video_url, order_index)
        VALUES (%s, 'Bài 3: Cách chào hỏi bằng ngôn ngữ ký hiệu', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 3)
        RETURNING lesson_id;
    """, (module1_id,))
    lesson3_id = cursor.fetchone()[0]

    cursor.execute("""
        INSERT INTO general_course_lessons (module_id, title, video_url, order_index)
        VALUES (%s, 'Bài 4: Ký hiệu các chữ cái từ A đến Z', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 1)
        RETURNING lesson_id;
    """, (module2_id,))
    lesson4_id = cursor.fetchone()[0]

    # Seed Learning Materials
    cursor.execute("""
        INSERT INTO learning_materials (lesson_id, title, content_url, material_transcript)
        VALUES (%s, 'Tài liệu Lịch sử ngôn ngữ ký hiệu', 'https://example.com/tailieu1.pdf', '{"transcript": "Bản dịch tài liệu lịch sử..."}');
    """, (lesson1_id,))

    # 6. Insert transactions
    # Successful Course 1 Purchase
    cursor.execute("""
        INSERT INTO transaction_logs (from_wallet_user_id, to_wallet_user_id, amount, status, message, related_course_id)
        VALUES (%s, %s, 500000.00, 'SUCCESS', 'Mua khóa học: Khoa hoc Ky nang Giao tiep ngon ngu ky hieu', %s);
    """, (student_id, teacher_id, course1_id))

    # Successful Course 2 Purchase
    cursor.execute("""
        INSERT INTO transaction_logs (from_wallet_user_id, to_wallet_user_id, amount, status, message, related_course_id)
        VALUES (%s, %s, 250000.00, 'SUCCESS', 'Mua khóa học: Tu vung Ngon ngu ky hieu co ban', %s);
    """, (student_id, teacher_id, course2_id))

    # Failed purchase attempt
    cursor.execute("""
        INSERT INTO transaction_logs (from_wallet_user_id, to_wallet_user_id, amount, status, message, related_course_id)
        VALUES (%s, %s, 500000.00, 'FAILED', 'Mua khóa học: Giao dịch thất bại do số dư không đủ', %s);
    """, (student_id, teacher_id, course1_id))

    # 7. Insert course enrollments
    cursor.execute("""
        INSERT INTO course_enrollments (student_id, course_id, progress)
        VALUES (%s, %s, 65.0)
        ON CONFLICT (student_id, course_id) DO NOTHING;
    """, (student_id, course1_id))

    cursor.execute("""
        INSERT INTO course_enrollments (student_id, course_id, progress)
        VALUES (%s, %s, 80.0)
        ON CONFLICT (student_id, course_id) DO NOTHING;
    """, (student_id, course2_id))

    # 8. Insert feedbacks
    # Feedbacks for course 1
    cursor.execute("""
        INSERT INTO user_feedbacks (user_id, rating, feedback_text, context)
        VALUES (%s, 5, 'Khóa học giao tiếp tuyệt vời', 'Khoa hoc Ky nang Giao tiep ngon ngu ky hieu');
    """, (student_id,))
    cursor.execute("""
        INSERT INTO user_feedbacks (user_id, rating, feedback_text, context)
        VALUES (%s, 5, 'Rất dễ hiểu', 'Khoa hoc Ky nang Giao tiep ngon ngu ky hieu');
    """, (student_id,))
    cursor.execute("""
        INSERT INTO user_feedbacks (user_id, rating, feedback_text, context)
        VALUES (%s, 1, 'Video hơi mờ', 'Khoa hoc Ky nang Giao tiep ngon ngu ky hieu');
    """, (student_id,))

    # Feedbacks for course 2
    cursor.execute("""
        INSERT INTO user_feedbacks (user_id, rating, feedback_text, context)
        VALUES (%s, 5, 'Nội dung rất bổ ích', 'Tu vung Ngon ngu ky hieu co ban');
    """, (student_id,))
    cursor.execute("""
        INSERT INTO user_feedbacks (user_id, rating, feedback_text, context)
        VALUES (%s, 4, 'Tương đối đầy đủ', 'Tu vung Ngon ngu ky hieu co ban');
    """, (student_id,))

    # 9. Insert dictionary categories
    cursor.execute("INSERT INTO dictionary_categories (name, description) VALUES ('Từ vựng cơ bản', 'Các từ vựng tiếng Khmer thông dụng hàng ngày') RETURNING category_id;")
    cat_basic_id = cursor.fetchone()[0]
    cursor.execute("INSERT INTO dictionary_categories (name, description) VALUES ('Địa danh', 'Các địa danh lịch sử và du lịch nổi tiếng tại Campuchia') RETURNING category_id;")
    cat_places_id = cursor.fetchone()[0]
    cursor.execute("INSERT INTO dictionary_categories (name, description) VALUES ('Ẩm thực', 'Các món ăn và thuật ngữ ẩm thực truyền thống Khmer') RETURNING category_id;")
    cat_food_id = cursor.fetchone()[0]

    # 10. Insert dictionary entries & variations
    # AngkorWat
    cursor.execute("""
        INSERT INTO dictionary_entries (category_id, word, meaning)
        VALUES (%s, 'AngkorWat', 'Ăng-kor Vát - Quần thể đền đài tại Campuchia và là di tích tôn giáo lớn nhất thế giới.')
        RETURNING entry_id;
    """, (cat_places_id,))
    angkor_id = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO dictionary_variations (entry_id, region, video_url, description)
        VALUES (%s, 'Siem Reap', 'https://www.youtube.com/watch?v=1234567890a', 'Phát âm chuẩn giọng bản địa vùng Siem Reap gần đền Angkor.');
    """, (angkor_id,))
    cursor.execute("""
        INSERT INTO dictionary_variations (entry_id, region, video_url, description)
        VALUES (%s, 'Phnom Penh', 'https://www.youtube.com/watch?v=1234567890b', 'Phát âm theo giọng thủ đô Phnom Penh.');
    """, (angkor_id,))

    # Khmer
    cursor.execute("""
        INSERT INTO dictionary_entries (category_id, word, meaning)
        VALUES (%s, 'Khmer', 'Người Khmer hoặc Tiếng Khmer - Ngôn ngữ chính thức của Campuchia.')
        RETURNING entry_id;
    """, (cat_basic_id,))
    khmer_id = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO dictionary_variations (entry_id, region, video_url, description)
        VALUES (%s, 'Phnom Penh', 'https://www.youtube.com/watch?v=abcdefghij1', 'Phát âm từ ''Khmer'' giọng Phnom Penh chuẩn.');
    """, (khmer_id,))
    cursor.execute("""
        INSERT INTO dictionary_variations (entry_id, region, video_url, description)
        VALUES (%s, 'Battambang', 'https://www.youtube.com/watch?v=abcdefghij2', 'Phát âm từ ''Khmer'' theo giọng vùng Battambang miền Tây.');
    """, (khmer_id,))

    # Phnom Penh
    cursor.execute("""
        INSERT INTO dictionary_entries (category_id, word, meaning)
        VALUES (%s, 'Phnom', 'Thủ đô và thành phố lớn nhất của vương quốc Campuchia (tên ngắn gọn).')
        RETURNING entry_id;
    """, (cat_places_id,))
    phnom_id = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO dictionary_variations (entry_id, region, video_url, description)
        VALUES (%s, 'Phnom Penh', 'https://www.youtube.com/watch?v=xyz98765432', 'Giọng địa phương thủ đô.');
    """, (phnom_id,))

    # Amok
    cursor.execute("""
        INSERT INTO dictionary_entries (category_id, word, meaning)
        VALUES (%s, 'Amok', 'Món cá hấp Amok - món ăn truyền thống đặc trưng của ẩm thực Khmer.')
        RETURNING entry_id;
    """, (cat_food_id,))
    amok_id = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO dictionary_variations (entry_id, region, video_url, description)
        VALUES (%s, 'Siem Reap', 'https://www.youtube.com/watch?v=amok1234567', 'Phát âm chuẩn địa phương Siem Reap.');
    """, (amok_id,))

    # 11. Insert microlearning topics
    cursor.execute("INSERT INTO microlearning_topics (title, description) VALUES ('Bảng chữ cái & Âm tiết', 'Học các nguyên âm, phụ âm và cấu trúc âm tiết trong tiếng Khmer.') RETURNING topic_id;")
    topic1_id = cursor.fetchone()[0]
    cursor.execute("INSERT INTO microlearning_topics (title, description) VALUES ('Giao tiếp cơ bản', 'Các chủ đề hội thoại thông dụng như chào hỏi, giới thiệu bản thân và hỏi đường.') RETURNING topic_id;")
    topic2_id = cursor.fetchone()[0]

    # 12. Insert microlearning units
    # Topic 1 Units
    cursor.execute("""
        INSERT INTO microlearning_units (topic_id, title, order_index)
        VALUES (%s, 'Phụ âm nhóm 1 (O-Group)', 1)
        RETURNING unit_id;
    """, (topic1_id,))
    unit1_1_id = cursor.fetchone()[0]
    
    cursor.execute("""
        INSERT INTO microlearning_units (topic_id, title, order_index)
        VALUES (%s, 'Phụ âm nhóm 2 (A-Group)', 2)
        RETURNING unit_id;
    """, (topic1_id,))
    unit1_2_id = cursor.fetchone()[0]

    # Topic 2 Units
    cursor.execute("""
        INSERT INTO microlearning_units (topic_id, title, order_index)
        VALUES (%s, 'Chào hỏi & Xưng hô', 1)
        RETURNING unit_id;
    """, (topic2_id,))
    unit2_1_id = cursor.fetchone()[0]

    # 13. Insert microlearning lessons
    # Unit 1.1 Lessons
    cursor.execute("""
        INSERT INTO microlearning_lessons (unit_id, title, video_url, order_index)
        VALUES (%s, 'Bài 1: Phụ âm Kô (ក) và Khô (ខ)', 'https://www.youtube.com/watch?v=khmer_lesson1', 1)
        RETURNING lesson_id;
    """, (unit1_1_id,))
    lesson1_id = cursor.fetchone()[0]
    
    cursor.execute("""
        INSERT INTO microlearning_lessons (unit_id, title, video_url, order_index)
        VALUES (%s, 'Bài 2: Phụ âm Ngô (ង) và Chô (ច)', 'https://www.youtube.com/watch?v=khmer_lesson2', 2);
    """, (unit1_1_id,))

    # Unit 1.2 Lessons
    cursor.execute("""
        INSERT INTO microlearning_lessons (unit_id, title, video_url, order_index)
        VALUES (%s, 'Bài 3: Phụ âm Đô (ដ) và Thô (ថ)', 'https://www.youtube.com/watch?v=khmer_lesson3', 1);
    """, (unit1_2_id,))

    # Unit 2.1 Lessons
    cursor.execute("""
        INSERT INTO microlearning_lessons (unit_id, title, video_url, order_index)
        VALUES (%s, 'Bài 4: Cách chào hỏi lịch sự (Chum Reap Sour)', 'https://www.youtube.com/watch?v=khmer_greet1', 1);
    """, (unit2_1_id,))
    
    cursor.execute("""
        INSERT INTO microlearning_lessons (unit_id, title, video_url, order_index)
        VALUES (%s, 'Bài 5: Tự giới thiệu bản thân bằng tiếng Khmer', 'https://www.youtube.com/watch?v=khmer_greet2', 2);
    """, (unit2_1_id,))

    # 14. Insert microlearning lesson parts for Lesson 1
    cursor.execute("""
        INSERT INTO microlearning_lesson_parts (lesson_id, title, part_type, content, order_index)
        VALUES (%s, 'Lý thuyết phụ âm Kô (ក) và Khô (ខ)', 'theory', 'Phụ âm ก (Kô) thuộc nhóm O, phát âm gần giống chữ K. Phụ âm ខ (Khô) thuộc nhóm O, phát âm bật hơi.', 1)
        RETURNING part_id;
    """, (lesson1_id,))
    
    cursor.execute("""
        INSERT INTO microlearning_lesson_parts (lesson_id, title, part_type, content, order_index)
        VALUES (%s, 'Bài tập trắc nghiệm nhanh', 'quiz', 'Hãy hoàn thành các câu trắc nghiệm sau để củng cố bài học.', 2)
        RETURNING part_id;
    """, (lesson1_id,))
    quiz_part_id = cursor.fetchone()[0]

    # 15. Insert microlearning questions for Quiz Part
    cursor.execute("""
        INSERT INTO microlearning_questions (part_id, question_text, question_type, options_json, correct_answer)
        VALUES (
            %s, 
            'Phụ âm ก phát âm chuẩn là gì?', 
            'single_choice', 
            '["Kô", "Khô", "Ngô", "Chô"]'::jsonb, 
            'Kô'
        );
    """, (quiz_part_id,))

    cursor.execute("""
        INSERT INTO microlearning_questions (part_id, question_text, question_type, options_json, correct_answer)
        VALUES (
            %s, 
            'Phụ âm ខ phát âm bật hơi đúng hay sai?', 
            'single_choice', 
            '["Đúng", "Sai"]'::jsonb, 
            'Đúng'
        );
    """, (quiz_part_id,))

    cursor.execute("""
        INSERT INTO microlearning_questions (part_id, question_text, question_type, options_json, correct_answer)
        VALUES (
            %s, 
            'Phụ âm nào sau đây thuộc nhóm O trong tiếng Khmer?', 
            'single_choice', 
            '["ក (Kô)", "ខ (Khô)", "Cả hai phụ âm trên"]'::jsonb, 
            'Cả hai phụ âm trên'
        );
    """, (quiz_part_id,))

    # 16. Insert sample notifications
    cursor.execute("""
        INSERT INTO notification_users (user_id, title, message, is_read, created_at)
        VALUES 
        (%s, 'Hệ thống bảo trì', 'Hệ thống E-Learning sẽ bảo trì định kỳ vào 00:00 ngày mai.', FALSE, '2026-06-15 10:00:00+07'),
        (%s, 'Đăng ký thành công', 'Bạn đã đăng ký thành công khóa học mới.', TRUE, '2026-06-14 08:30:00+07'),
        (%s, 'Điểm số mới', 'Bạn vừa nhận được 100 điểm thưởng do hoàn thành chuỗi ngày học.', FALSE, '2026-06-16 12:00:00+07');
    """, (student_id, student_id, student_id))

    cursor.execute("""
        INSERT INTO notification_users (user_id, title, message, is_read, created_at)
        VALUES 
        (%s, 'Bài nộp mới', 'Học viên student1 đã nộp bài tập Chương 1.', FALSE, '2026-06-16 14:00:00+07'),
        (%s, 'Thu nhập cập nhật', 'Ví của bạn đã nhận được doanh thu khóa học mới.', TRUE, '2026-06-12 17:45:00+07');
    """, (teacher_id, teacher_id))

    # 17. Insert sample audit logs
    cursor.execute("""
        INSERT INTO audit_logs (run_id, action, status, error_message, created_at)
        VALUES 
        (gen_random_uuid(), 'BUY_COURSE', 'SUCCESS', NULL, '2026-06-16 15:10:00+07'),
        (gen_random_uuid(), 'TOPUP_WALLET', 'SUCCESS', NULL, '2026-06-16 15:15:00+07'),
        (gen_random_uuid(), 'CREATE_LESSON', 'FAILED', 'uq_lesson_order_per_module unique constraint violation', '2026-06-16 15:20:00+07'),
        (gen_random_uuid(), 'UPDATE_VISIBILITY', 'SUCCESS', NULL, '2026-06-16 15:22:00+07'),
        (gen_random_uuid(), 'DELETE_MATERIAL', 'FAILED', 'Foreign key constraint violation on learning_materials', '2026-06-16 15:30:00+07');
    """)

    conn.commit()
    print("Seed data loaded successfully!")
except Exception as e:
    conn.rollback()
    print("Seeding error:", e)
finally:
    cursor.close()
    conn.close()
