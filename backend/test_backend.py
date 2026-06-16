import http.server
import json
import psycopg2
import bcrypt
import uuid
from datetime import datetime, timedelta
from urllib.parse import urlparse, parse_qs

PORT = 8080

class TestAuthHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        # CORS preflight
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Session-Key")
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)
        path_parts = [p for p in path.split("/") if p]

        # Check student paths
        if path == "/api/students/search":
            keyword = query_params.get("keyword", [""])[0]
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="elearning_db",
                    user="postgres",
                    password="postgres"
                )
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                query = "SELECT student_id, username, full_name, grade_level, school_name, created_at FROM fn_search_students(%s)"
                cursor.execute(query, (keyword,))
                rows = cursor.fetchall()
                results = []
                for r in rows:
                    results.append({
                        "student_id": str(r[0]),
                        "username": r[1],
                        "full_name": r[2],
                        "grade_level": r[3],
                        "school_name": r[4],
                        "created_at": r[5].isoformat() if r[5] else None
                    })
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(results).encode('utf-8'))
            except Exception as e:
                self.send_json_error(500, f"Lỗi truy vấn cơ sở dữ liệu: {e}")
            finally:
                cursor.close()
                conn.close()
            return

        if path == "/api/students/progress":
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="elearning_db",
                    user="postgres",
                    password="postgres"
                )
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                query = "SELECT student_name, email, school_name, course_title, progress, enrolled_at, learning_status FROM vw_student_progress_report"
                cursor.execute(query)
                rows = cursor.fetchall()
                results = []
                for r in rows:
                    results.append({
                        "student_name": r[0],
                        "email": r[1],
                        "school_name": r[2],
                        "course_title": r[3],
                        "progress": float(r[4]) if r[4] is not None else 0.0,
                        "enrolled_at": r[5].isoformat() if r[5] else None,
                        "learning_status": r[6]
                    })
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(results).encode('utf-8'))
            except Exception as e:
                self.send_json_error(500, f"Lỗi truy vấn cơ sở dữ liệu: {e}")
            finally:
                cursor.close()
                conn.close()
            return

        if path == "/api/students/inactive":
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="elearning_db",
                    user="postgres",
                    password="postgres"
                )
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                query = "SELECT enrollment_id, student_id, full_name, phone_number, course_title, last_activity_date FROM vw_inactive_students"
                cursor.execute(query)
                rows = cursor.fetchall()
                results = []
                for r in rows:
                    results.append({
                        "enrollment_id": str(r[0]),
                        "student_id": str(r[1]),
                        "full_name": r[2],
                        "phone_number": r[3],
                        "course_title": r[4],
                        "last_activity_date": r[5].isoformat() if r[5] else None
                    })
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(results).encode('utf-8'))
            except Exception as e:
                self.send_json_error(500, f"Lỗi truy vấn cơ sở dữ liệu: {e}")
            finally:
                cursor.close()
                conn.close()
            return

        if path == "/api/store/courses":
            student_id = query_params.get("student_id", [""])[0]
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="elearning_db",
                    user="postgres",
                    password="postgres"
                )
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                query = """
                    SELECT 
                        c.course_id, 
                        c.title, 
                        COALESCE(c.description, ''), 
                        COALESCE(c.image_url, ''), 
                        c.price, 
                        c.visibility_status, 
                        COALESCE(up.full_name, 'Giảng viên'),
                        EXISTS(SELECT 1 FROM course_enrollments e WHERE e.course_id = c.course_id AND e.student_id = %s)
                    FROM general_courses c
                    LEFT JOIN user_profiles up ON c.teacher_id = up.user_id
                    WHERE c.visibility_status = 'PUBLISHED' AND c.is_deleted = FALSE
                    ORDER BY c.updated_at DESC
                """
                cursor.execute(query, (student_id,))
                rows = cursor.fetchall()
                results = []
                for r in rows:
                    results.append({
                        "course_id": str(r[0]),
                        "title": r[1],
                        "description": r[2],
                        "image_url": r[3],
                        "price": float(r[4]) if r[4] is not None else 0.0,
                        "visibility_status": r[5],
                        "teacher_name": r[6],
                        "is_enrolled": bool(r[7])
                    })
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(results).encode('utf-8'))
            except Exception as e:
                self.send_json_error(500, f"Lỗi truy vấn cơ sở dữ liệu: {e}")
            finally:
                cursor.close()
                conn.close()
            return

        if len(path_parts) == 3 and path_parts[0] == "api" and path_parts[1] == "wallet":
            user_id = path_parts[2]
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="elearning_db",
                    user="postgres",
                    password="postgres"
                )
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                cursor.execute("SELECT user_id, balance, updated_at FROM wallets WHERE user_id = %s", (user_id,))
                row = cursor.fetchone()
                if not row:
                    cursor.execute("INSERT INTO wallets (user_id, balance) VALUES (%s, 0) ON CONFLICT (user_id) DO NOTHING", (user_id,))
                    conn.commit()
                    data = {"user_id": user_id, "balance": 0.0, "updated_at": datetime.now().isoformat()}
                else:
                    data = {
                        "user_id": str(row[0]),
                        "balance": float(row[1]),
                        "updated_at": row[2].isoformat() if row[2] else None
                    }
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(data).encode('utf-8'))
            except Exception as e:
                self.send_json_error(500, f"Lỗi truy vấn cơ sở dữ liệu: {e}")
            finally:
                cursor.close()
                conn.close()
            return

        # Check teacher paths
        if len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "teacher":
            teacher_id = path_parts[2]
            action = path_parts[3]
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="elearning_db",
                    user="postgres",
                    password="postgres"
                )
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                if action == "dashboard":
                    query = """
                        SELECT teacher_id, teacher_name, total_courses, total_students, total_generated_revenue
                        FROM vw_teacher_dashboard
                        WHERE teacher_id = %s
                    """
                    cursor.execute(query, (teacher_id,))
                    row = cursor.fetchone()
                    if row:
                        data = {
                            "teacher_id": row[0],
                            "teacher_name": row[1],
                            "total_courses": int(row[2]),
                            "total_students": int(row[3]),
                            "total_generated_revenue": float(row[4])
                        }
                    else:
                        data = {
                            "teacher_id": teacher_id,
                            "teacher_name": "Giáo viên",
                            "total_courses": 0,
                            "total_students": 0,
                            "total_generated_revenue": 0.0
                        }
                    self.send_response(200)
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(data).encode('utf-8'))

                elif action == "courses":
                    query = """
                        SELECT 
                            va.course_id, 
                            va.course_title, 
                            va.teacher_name, 
                            va.total_students, 
                            va.avg_progress, 
                            va.avg_rating
                        FROM vw_course_analytics va
                        JOIN general_courses c ON va.course_id = c.course_id
                        WHERE c.teacher_id = %s
                        ORDER BY va.total_students DESC
                    """
                    cursor.execute(query, (teacher_id,))
                    rows = cursor.fetchall()
                    
                    courses = []
                    for r in rows:
                        courses.append({
                            "course_id": r[0],
                            "course_title": r[1],
                            "teacher_name": r[2],
                            "total_students": int(r[3]) if r[3] is not None else 0,
                            "avg_progress": float(r[4]) if r[4] is not None else 0.0,
                            "avg_rating": float(r[5]) if r[5] is not None else None
                        })
                    self.send_response(200)
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(courses).encode('utf-8'))

                elif action == "feedback" or action == "feedbacks":
                    query = """
                        SELECT 
                            f.course_or_context, 
                            f.total_feedbacks, 
                            f.average_rating, 
                            f.five_stars, 
                            f.one_star
                        FROM vw_course_feedback_summary f
                        JOIN general_courses c ON f.course_or_context LIKE '%%' || c.title || '%%'
                        WHERE c.teacher_id = %s
                        ORDER BY f.average_rating DESC
                    """
                    cursor.execute(query, (teacher_id,))
                    rows = cursor.fetchall()
                    
                    feedbacks = []
                    for r in rows:
                        feedbacks.append({
                            "course_or_context": r[0],
                            "total_feedbacks": int(r[1]) if r[1] is not None else 0,
                            "average_rating": float(r[2]) if r[2] is not None else 0.0,
                            "five_stars": int(r[3]) if r[3] is not None else 0,
                            "one_star": int(r[4]) if r[4] is not None else 0
                        })
                    self.send_response(200)
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(feedbacks).encode('utf-8'))
                else:
                    self.send_response(404)
                    self.end_headers()
            except Exception as e:
                print("Database query error:", e)
                self.send_json_error(500, f"Lỗi truy vấn cơ sở dữ liệu: {e}")
            finally:
                cursor.close()
                conn.close()
            return

        if path == "/api/admin/transactions":
            # Extract pagination params
            try:
                limit = int(query_params.get("limit", [10])[0])
            except ValueError:
                limit = 10

            try:
                offset = int(query_params.get("offset", [0])[0])
            except ValueError:
                offset = 0

            # Connect to Postgres
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="elearning_db",
                    user="postgres",
                    password="postgres"
                )
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                # Count total
                cursor.execute("SELECT COUNT(*) FROM vw_detailed_transaction_history")
                total_count = cursor.fetchone()[0]

                # Query data and JOIN to find sender_id & receiver_id by name
                query = """
                    SELECT 
                        v.transaction_id, 
                        v.created_at, 
                        v.amount, 
                        v.status, 
                        v.message, 
                        v.sender_name, 
                        v.receiver_name, 
                        v.related_course,
                        u_sender.user_id AS sender_id,
                        u_receiver.user_id AS receiver_id
                    FROM vw_detailed_transaction_history v
                    LEFT JOIN user_profiles u_sender ON v.sender_name = u_sender.full_name
                    LEFT JOIN user_profiles u_receiver ON v.receiver_name = u_receiver.full_name
                    LIMIT %s OFFSET %s
                """
                cursor.execute(query, (limit, offset))
                rows = cursor.fetchall()

                transactions = []
                for r in rows:
                    created_at_val = r[1]
                    if isinstance(created_at_val, datetime):
                        created_at_str = created_at_val.isoformat()
                    else:
                        created_at_str = str(created_at_val)

                    transactions.append({
                        "transaction_id": r[0],
                        "created_at": created_at_str,
                        "amount": float(r[2]) if r[2] is not None else 0.0,
                        "status": r[3],
                        "message": r[4],
                        "sender_name": r[5] or "N/A",
                        "receiver_name": r[6] or "N/A",
                        "related_course": r[7] or "N/A",
                        "sender_id": r[8],
                        "receiver_id": r[9]
                    })

                response_data = {
                    "transactions": transactions,
                    "total_count": total_count,
                    "limit": limit,
                    "offset": offset
                }

                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode('utf-8'))

            except Exception as e:
                print("Database query error:", e)
                self.send_json_error(500, f"Lỗi truy vấn cơ sở dữ liệu: {e}")
            finally:
                cursor.close()
                conn.close()

        elif path == "/api/admin/revenue":
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="elearning_db",
                    user="postgres",
                    password="postgres"
                )
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                query = """
                    SELECT course_id, title, price, total_sales_count, total_revenue 
                    FROM vw_revenue_by_course
                    ORDER BY total_revenue DESC
                """
                cursor.execute(query)
                rows = cursor.fetchall()

                revenues = []
                for r in rows:
                    revenues.append({
                        "course_id": r[0],
                        "title": r[1],
                        "price": float(r[2]) if r[2] is not None else 0.0,
                        "total_sales_count": int(r[3]) if r[3] is not None else 0,
                        "total_revenue": float(r[4]) if r[4] is not None else 0.0
                    })

                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(revenues).encode('utf-8'))

            except Exception as e:
                print("Database query error:", e)
                self.send_json_error(500, f"Lỗi truy vấn cơ sở dữ liệu: {e}")
            finally:
                cursor.close()
                conn.close()

        elif path == "/api/gamification/leaderboard":
            try:
                limit = int(query_params.get("limit", [20])[0])
            except ValueError:
                limit = 20

            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                query = """
                    SELECT full_name, COALESCE(avatar_url, '') as avatar_url,
                           current_streak, highest_streak, total_achievements
                    FROM vw_top_learners_leaderboard
                    LIMIT %s
                """
                cursor.execute(query, (limit,))
                rows = cursor.fetchall()
                leaderboard = []
                for idx, r in enumerate(rows, start=1):
                    leaderboard.append({
                        "rank": idx,
                        "full_name": r[0],
                        "avatar_url": r[1],
                        "current_streak": int(r[2]) if r[2] is not None else 0,
                        "highest_streak": int(r[3]) if r[3] is not None else 0,
                        "total_achievements": int(r[4]) if r[4] is not None else 0,
                    })
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"leaderboard": leaderboard, "total": len(leaderboard)}).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi truy vấn bảng xếp hạng: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif len(path_parts) >= 4 and path_parts[0] == "api" and path_parts[1] == "gamification" and path_parts[2] == "streak":
            student_id = path_parts[3]
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                cursor.execute(
                    "SELECT student_id, current_streak, highest_streak, last_activity_date FROM student_streaks WHERE student_id = %s",
                    (student_id,)
                )
                row = cursor.fetchone()
                if row:
                    result = {
                        "student_id": str(row[0]),
                        "current_streak": int(row[1]) if row[1] is not None else 0,
                        "highest_streak": int(row[2]) if row[2] is not None else 0,
                        "last_activity_date": str(row[3]) if row[3] is not None else None,
                    }
                else:
                    result = {"student_id": student_id, "current_streak": 0, "highest_streak": 0, "last_activity_date": None}
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi truy vấn streak: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif path == "/api/dictionary/categories":
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                cursor.execute("SELECT category_id, name, COALESCE(description, '') FROM dictionary_categories ORDER BY name ASC")
                rows = cursor.fetchall()
                cats = [{"category_id": r[0], "name": r[1], "description": r[2]} for r in rows]
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(cats).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi danh mục: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif path == "/api/dictionary/search":
            keyword = query_params.get("word", [""])[0].strip()
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                if keyword:
                    like_kw = f"%{keyword}%"
                    starts_kw = f"{keyword}%"
                    cursor.execute("""
                        SELECT e.entry_id, e.category_id, COALESCE(c.name,'') AS category_name,
                               e.word, e.meaning, e.updated_at
                        FROM dictionary_entries e
                        LEFT JOIN dictionary_categories c ON e.category_id = c.category_id
                        WHERE e.is_deleted = FALSE
                          AND (e.word ILIKE %s OR e.meaning ILIKE %s)
                        ORDER BY
                            CASE WHEN LOWER(e.word) = LOWER(%s) THEN 0
                                 WHEN LOWER(e.word) LIKE LOWER(%s) THEN 1
                                 ELSE 2 END, e.word ASC
                        LIMIT 30
                    """, (like_kw, like_kw, keyword, starts_kw))
                else:
                    cursor.execute("""
                        SELECT e.entry_id, e.category_id, COALESCE(c.name,'') AS category_name,
                               e.word, e.meaning, e.updated_at
                        FROM dictionary_entries e
                        LEFT JOIN dictionary_categories c ON e.category_id = c.category_id
                        WHERE e.is_deleted = FALSE
                        ORDER BY e.word ASC LIMIT 30
                    """)
                rows = cursor.fetchall()
                entries = []
                entry_ids = []
                entry_map = {}
                for r in rows:
                    eid = str(r[0])
                    entry_ids.append(eid)
                    e = {
                        "entry_id": eid,
                        "category_id": r[1],
                        "category_name": r[2],
                        "word": r[3],
                        "meaning": r[4],
                        "updated_at": r[5].isoformat() if r[5] else None,
                        "variations": []
                    }
                    entry_map[eid] = e
                    entries.append(e)

                if entry_ids:
                    placeholders = ", ".join(["%s"] * len(entry_ids))
                    cursor.execute(f"""
                        SELECT variation_id, entry_id, COALESCE(region,'') AS region,
                               video_url, COALESCE(description,'') AS description
                        FROM dictionary_variations
                        WHERE entry_id IN ({placeholders}) ORDER BY region ASC
                    """, tuple(entry_ids))
                    var_rows = cursor.fetchall()
                    for vr in var_rows:
                        v_id, e_id, region, video_url, desc = vr
                        e_id_str = str(e_id)
                        if e_id_str in entry_map:
                            entry_map[e_id_str]["variations"].append({
                                "variation_id": str(v_id),
                                "entry_id": e_id_str,
                                "region": region,
                                "video_url": video_url,
                                "description": desc
                            })

                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"entries": entries, "total": len(entries), "keyword": keyword}).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi tìm kiếm từ vựng: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif len(path_parts) >= 5 and path_parts[1] == "dictionary" and path_parts[2] == "entries" and path_parts[4] == "variations":
            entry_id = path_parts[3]
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                cursor.execute("""
                    SELECT variation_id, entry_id, COALESCE(region,'') AS region,
                           video_url, COALESCE(description,'') AS description
                    FROM dictionary_variations
                    WHERE entry_id = %s ORDER BY region ASC
                """, (entry_id,))
                rows = cursor.fetchall()
                variations = [{
                    "variation_id": str(r[0]),
                    "entry_id": str(r[1]),
                    "region": r[2],
                    "video_url": r[3],
                    "description": r[4]
                } for r in rows]
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"entry_id": entry_id, "variations": variations, "total": len(variations)}).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi lấy biến thể: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif path == "/api/microlearning/roadmap":
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                cursor.execute("""
                    SELECT 
                        t.topic_id,
                        t.title,
                        COALESCE(t.description, '') AS description,
                        COALESCE(
                            (
                                SELECT json_agg(unit_data ORDER BY unit_data.order_index ASC)
                                FROM (
                                    SELECT 
                                        u.unit_id,
                                        u.topic_id,
                                        u.title,
                                        u.order_index,
                                        COALESCE(
                                            (
                                                SELECT json_agg(lesson_data ORDER BY lesson_data.order_index ASC)
                                                FROM (
                                                    SELECT 
                                                        l.lesson_id,
                                                        l.unit_id,
                                                        l.title,
                                                        COALESCE(l.video_url, '') AS video_url,
                                                        l.order_index
                                                    FROM microlearning_lessons l
                                                    WHERE l.unit_id = u.unit_id
                                                ) lesson_data
                                            ), '[]'::json
                                        ) AS lessons
                                    FROM microlearning_units u
                                    WHERE u.topic_id = t.topic_id
                                ) unit_data
                            ), '[]'::json
                        ) AS units
                    FROM microlearning_topics t
                    ORDER BY t.topic_id ASC;
                """)
                rows = cursor.fetchall()
                roadmap = []
                for r in rows:
                    units_data = r[3]
                    if isinstance(units_data, str):
                        units_data = json.loads(units_data)
                    roadmap.append({
                        "topic_id": r[0],
                        "title": r[1],
                        "description": r[2],
                        "units": units_data if units_data else []
                    })
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(roadmap).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi lấy lộ trình học tập: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif len(path_parts) == 5 and path_parts[0] == "api" and path_parts[1] == "microlearning" and path_parts[2] == "lessons" and path_parts[4] == "parts":
            lesson_id = path_parts[3]
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                cursor.execute("""
                    SELECT part_id, lesson_id, COALESCE(title, '') AS title, part_type, COALESCE(content, '') AS content, order_index
                    FROM microlearning_lesson_parts
                    WHERE lesson_id = %s
                    ORDER BY order_index ASC;
                """, (lesson_id,))
                rows = cursor.fetchall()
                parts = [{
                    "part_id": str(r[0]),
                    "lesson_id": str(r[1]),
                    "title": r[2],
                    "part_type": r[3],
                    "content": r[4],
                    "order_index": int(r[5])
                } for r in rows]
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(parts).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi lấy các phần bài học: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif len(path_parts) == 5 and path_parts[0] == "api" and path_parts[1] == "microlearning" and path_parts[2] == "parts" and path_parts[4] == "questions":
            part_id = path_parts[3]
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                cursor.execute("""
                    SELECT question_id, part_id, question_text, question_type, options_json, correct_answer
                    FROM microlearning_questions
                    WHERE part_id = %s;
                """, (part_id,))
                rows = cursor.fetchall()
                questions = []
                for r in rows:
                    options_val = r[4]
                    if isinstance(options_val, str):
                        options_val = json.loads(options_val)
                    questions.append({
                        "question_id": str(r[0]),
                        "part_id": str(r[1]),
                        "question_text": r[2],
                        "question_type": r[3],
                        "options_json": options_val,
                        "correct_answer": r[5]
                    })
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(questions).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi lấy câu hỏi trắc nghiệm: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif len(path_parts) == 5 and path_parts[0] == "api" and path_parts[1] == "teacher" and path_parts[2] == "courses" and path_parts[4] == "content":
            course_id = path_parts[3]
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                cursor.execute("SELECT course_id, title, visibility_status FROM general_courses WHERE course_id = %s AND is_deleted = FALSE", (course_id,))
                course_row = cursor.fetchone()
                if not course_row:
                    self.send_json_error(404, "Khóa học không tồn tại")
                    return
                
                course_data = {
                    "course_id": str(course_row[0]),
                    "title": course_row[1],
                    "visibility_status": course_row[2],
                    "modules": []
                }

                cursor.execute("SELECT module_id, course_id, title, order_index FROM general_course_modules WHERE course_id = %s ORDER BY order_index ASC", (course_id,))
                module_rows = cursor.fetchall()
                
                modules_map = {}
                for mr in module_rows:
                    m_id = str(mr[0])
                    m_data = {
                        "module_id": m_id,
                        "course_id": str(mr[1]),
                        "title": mr[2],
                        "order_index": int(mr[3]),
                        "lessons": []
                    }
                    course_data["modules"].append(m_data)
                    modules_map[m_id] = m_data

                cursor.execute("""
                    SELECT lesson_id, module_id, title, COALESCE(video_url, '') AS video_url, order_index 
                    FROM general_course_lessons 
                    WHERE module_id IN (SELECT module_id FROM general_course_modules WHERE course_id = %s)
                    ORDER BY order_index ASC
                """, (course_id,))
                lesson_rows = cursor.fetchall()

                lessons_map = {}
                for lr in lesson_rows:
                    l_id = str(lr[0])
                    m_id = str(lr[1])
                    l_data = {
                        "lesson_id": l_id,
                        "module_id": m_id,
                        "title": lr[2],
                        "video_url": lr[3],
                        "order_index": int(lr[4]),
                        "materials": []
                    }
                    if m_id in modules_map:
                        modules_map[m_id]["lessons"].append(l_data)
                    lessons_map[l_id] = l_data

                cursor.execute("""
                    SELECT material_id, lesson_id, title, content_url 
                    FROM learning_materials 
                    WHERE lesson_id IN (
                        SELECT lesson_id FROM general_course_lessons WHERE module_id IN (
                            SELECT module_id FROM general_course_modules WHERE course_id = %s
                        )
                    )
                """, (course_id,))
                material_rows = cursor.fetchall()

                for mat in material_rows:
                    l_id = str(mat[1])
                    mat_data = {
                        "material_id": str(mat[0]),
                        "lesson_id": l_id,
                        "title": mat[2],
                        "content_url": mat[3]
                    }
                    if l_id in lessons_map:
                        lessons_map[l_id]["materials"].append(mat_data)

                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(course_data).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi lấy nội dung khóa học: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif len(path_parts) == 3 and path_parts[0] == "api" and path_parts[1] == "notifications":
            user_id = path_parts[2]
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                cursor.execute("""
                    SELECT notification_id, user_id, title, message, is_read, created_at
                    FROM notification_users
                    WHERE user_id = %s AND created_at >= NOW() - INTERVAL '30 days'
                    ORDER BY is_read ASC, created_at DESC
                """, (user_id,))
                rows = cursor.fetchall()
                results = [{
                    "notification_id": str(r[0]),
                    "user_id": str(r[1]),
                    "title": r[2],
                    "message": r[3],
                    "is_read": bool(r[4]),
                    "created_at": r[5].isoformat() if r[5] else None
                } for r in rows]
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(results).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi lấy thông báo: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif path == "/api/admin/audit-logs":
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                cursor.execute("""
                    SELECT audit_id, run_id, action, status, COALESCE(error_message, '') as error_message, created_at
                    FROM audit_logs
                    WHERE created_at >= NOW() - INTERVAL '30 days'
                    ORDER BY created_at DESC
                    LIMIT 50
                """)
                rows = cursor.fetchall()
                results = [{
                    "audit_id": str(r[0]),
                    "run_id": str(r[1]),
                    "action": r[2],
                    "status": r[3],
                    "error_message": r[4],
                    "created_at": r[5].isoformat() if r[5] else None
                } for r in rows]
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(results).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi lấy audit logs: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/auth/admin-login":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json_error(400, "Dữ liệu yêu cầu không hợp lệ")
                return

            username = data.get("username", "").strip()
            password = data.get("password", "")

            if not username or not password:
                self.send_json_error(400, "Username và password không được để trống")
                return

            # Connect to Postgres
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="elearning_db",
                    user="postgres",
                    password="postgres"
                )
                cursor = conn.cursor()
            except Exception as e:
                print("Database connection error:", e)
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                # 1. Query user and join roles
                query = """
                    SELECT u.user_id, u.username, u.password_hash, COALESCE(u.email, ''), r.role_name, u.status, u.is_deleted
                    FROM users u
                    JOIN roles r ON u.role_id = r.role_id
                    WHERE u.username = %s AND u.is_deleted = FALSE
                """
                cursor.execute(query, (username,))
                row = cursor.fetchone()

                if not row:
                    self.send_json_error(401, "Username hoặc mật khẩu không chính xác")
                    return

                user_id, db_username, password_hash, email, role_name, status, is_deleted = row

                # 2. Check status: frozen -> 403
                if status == 'frozen':
                    self.send_json_error(403, "Tài khoản này đã bị khóa (frozen)")
                    return

                # 3. Check role: ADMIN
                if role_name != 'ADMIN':
                    self.send_json_error(403, "Truy cập bị từ chối: Chỉ dành cho Admin")
                    return

                # 4. Check password using bcrypt
                if not bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
                    self.send_json_error(401, "Username hoặc mật khẩu không chính xác")
                    return

                # 5. Create session
                session_key = str(uuid.uuid4())
                expires_at = datetime.now() + timedelta(hours=24)

                insert_query = """
                    INSERT INTO authentication_sessions (user_id, session_key, expires_at)
                    VALUES (%s, %s, %s)
                """
                cursor.execute(insert_query, (user_id, session_key, expires_at))
                conn.commit()

                # Success response
                response_data = {
                    "message": "Đăng nhập thành công",
                    "session_key": session_key,
                    "user": {
                        "user_id": user_id,
                        "username": db_username,
                        "email": email,
                        "role_name": role_name
                    }
                }
                
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode('utf-8'))

            except Exception as e:
                print("Database query error:", e)
                self.send_json_error(500, "Lỗi truy vấn cơ sở dữ liệu")
            finally:
                cursor.close()
                conn.close()

        elif self.path == "/api/admin/users/ban":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json_error(400, "Dữ liệu yêu cầu không hợp lệ")
                return

            user_id = data.get("user_id", "").strip()
            reason = data.get("reason", "").strip()

            if not user_id:
                self.send_json_error(400, "User ID không được để trống")
                return

            # Connect to Postgres
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="elearning_db",
                    user="postgres",
                    password="postgres"
                )
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                # Call procedure
                cursor.execute("CALL sp_ban_user(%s, %s)", (user_id, reason))
                conn.commit()

                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"message": "Khóa tài khoản người dùng thành công"}).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi thực thi procedure: {e}")
            finally:
                cursor.close()
                conn.close()

        elif self.path == "/api/wallet/topup":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json_error(400, "Dữ liệu yêu cầu không hợp lệ")
                return

            user_id = data.get("user_id", "").strip()
            try:
                amount = float(data.get("amount", 0))
            except Exception:
                amount = 0.0
            message = data.get("message", "Nạp tiền").strip()

            if not user_id or amount <= 0:
                self.send_json_error(400, "Dữ liệu nạp tiền thiếu hoặc không hợp lệ")
                return

            # Connect to Postgres
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="elearning_db",
                    user="postgres",
                    password="postgres"
                )
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                cursor.execute("CALL sp_topup_wallet(%s, %s, %s)", (user_id, amount, message))
                conn.commit()

                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "SUCCESS", "message": "Nạp tiền thành công"}).encode('utf-8'))

            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi thực thi sp_topup_wallet: {e}")
            finally:
                cursor.close()
                conn.close()

        elif self.path == "/api/store/checkout":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json_error(400, "Dữ liệu yêu cầu không hợp lệ")
                return

            student_id = data.get("student_id", "").strip()
            course_id = data.get("course_id", "").strip()

            if not student_id or not course_id:
                self.send_json_error(400, "Thiếu ID Học viên hoặc ID Khóa học")
                return

            # Connect to Postgres
            try:
                conn = psycopg2.connect(
                    host="localhost",
                    port=5432,
                    database="elearning_db",
                    user="postgres",
                    password="postgres"
                )
                cursor = conn.cursor()
            except Exception as e:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return

            try:
                cursor.execute("CALL sp_buy_course_with_wallet(%s, %s)", (student_id, course_id))
                conn.commit()

                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "SUCCESS", "message": "Mua khóa học thành công"}).encode('utf-8'))

            except Exception as e:
                print("Database query error:", repr(e))
                err_str = str(e)
                if "Số dư không đủ" in err_str:
                    self.send_json_error(400, "Số dư không đủ để mua khóa học này")
                elif "Khóa học không tồn tại" in err_str:
                    self.send_json_error(400, "Khóa học không tồn tại")
                else:
                    self.send_json_error(500, f"Lỗi thực thi sp_buy_course_with_wallet: {err_str}")
            finally:
                cursor.close()
                conn.close()
        elif self.path == "/api/teacher/modules":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json_error(400, "Dữ liệu yêu cầu không hợp lệ")
                return
            course_id = data.get("course_id", "")
            title = data.get("title", "")
            if not course_id or not title:
                self.send_json_error(400, "Thiếu course_id hoặc title")
                return
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                cursor.execute("SELECT COALESCE(MAX(order_index), 0) FROM general_course_modules WHERE course_id = %s", (course_id,))
                max_order = cursor.fetchone()[0]
                next_order = max_order + 1
                cursor.execute(
                    "INSERT INTO general_course_modules (course_id, title, order_index) VALUES (%s, %s, %s) RETURNING module_id",
                    (course_id, title, next_order)
                )
                m_id = cursor.fetchone()[0]
                conn.commit()
                self.send_response(201)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "module_id": str(m_id),
                    "course_id": course_id,
                    "title": title,
                    "order_index": next_order,
                    "lessons": []
                }).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi tạo chương: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif self.path == "/api/teacher/lessons":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json_error(400, "Dữ liệu yêu cầu không hợp lệ")
                return
            module_id = data.get("module_id", "")
            title = data.get("title", "")
            video_url = data.get("video_url", "")
            if not module_id or not title:
                self.send_json_error(400, "Thiếu module_id hoặc title")
                return
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                cursor.execute("SELECT COALESCE(MAX(order_index), 0) FROM general_course_lessons WHERE module_id = %s", (module_id,))
                max_order = cursor.fetchone()[0]
                next_order = max_order + 1
                cursor.execute(
                    "INSERT INTO general_course_lessons (module_id, title, video_url, order_index) VALUES (%s, %s, %s, %s) RETURNING lesson_id",
                    (module_id, title, video_url, next_order)
                )
                l_id = cursor.fetchone()[0]
                conn.commit()
                self.send_response(201)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "lesson_id": str(l_id),
                    "module_id": module_id,
                    "title": title,
                    "video_url": video_url,
                    "order_index": next_order,
                    "materials": []
                }).encode('utf-8'))
            except Exception as e:
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi tạo bài học: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        else:
            self.send_response(404)
            self.end_headers()

    def do_PUT(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        path_parts = [p for p in path.split("/") if p]

        # Enable CORS for PUT requests
        if path == "/api/teacher/lessons/reorder":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json_error(400, "Dữ liệu yêu cầu không hợp lệ")
                return
            module_id = data.get("module_id", "")
            lesson_ids = data.get("lesson_ids", [])
            if not module_id or not lesson_ids:
                self.send_json_error(400, "Thiếu module_id hoặc danh sách bài học")
                return
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                # 1. Update to large indexes to prevent unique constraint conflicts
                cursor.execute(
                    "UPDATE general_course_lessons SET order_index = order_index + 10000 WHERE module_id = %s",
                    (module_id,)
                )
                # 2. Re-assign order_index
                for idx, l_id in enumerate(lesson_ids):
                    target_order = idx + 1
                    cursor.execute(
                        "UPDATE general_course_lessons SET order_index = %s WHERE lesson_id = %s AND module_id = %s",
                        (target_order, l_id, module_id)
                    )
                conn.commit()
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"message": "Sắp xếp bài học thành công"}).encode('utf-8'))
            except Exception as e:
                conn.rollback()
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi sắp xếp bài học: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif len(path_parts) == 5 and path_parts[0] == "api" and path_parts[1] == "teacher" and path_parts[2] == "courses" and path_parts[4] == "visibility":
            course_id = path_parts[3]
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json_error(400, "Dữ liệu yêu cầu không hợp lệ")
                return
            status = data.get("visibility_status", "")
            if status not in ["DRAFT", "PUBLISHED", "ARCHIVED"]:
                self.send_json_error(400, "Trạng thái hiển thị không hợp lệ")
                return
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                cursor.execute(
                    "UPDATE general_courses SET visibility_status = %s WHERE course_id = %s AND is_deleted = FALSE",
                    (status, course_id)
                )
                conn.commit()
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"message": "Cập nhật trạng thái thành công"}).encode('utf-8'))
            except Exception as e:
                conn.rollback()
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi cập nhật trạng thái hiển thị: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        elif len(path_parts) == 4 and path_parts[0] == "api" and path_parts[1] == "notifications" and path_parts[3] == "read":
            notification_id = path_parts[2]
            try:
                conn = psycopg2.connect(host="localhost", port=5432, database="elearning_db", user="postgres", password="postgres")
                cursor = conn.cursor()
            except Exception:
                self.send_json_error(500, "Lỗi kết nối cơ sở dữ liệu")
                return
            try:
                # 1. Fetch created_at for partition key
                cursor.execute("""
                    SELECT created_at 
                    FROM notification_users 
                    WHERE notification_id = %s AND created_at >= NOW() - INTERVAL '30 days' 
                    LIMIT 1
                """, (notification_id,))
                row = cursor.fetchone()
                if not row:
                    self.send_json_error(404, "Thông báo không tồn tại hoặc đã quá hạn")
                    return
                created_at = row[0]
                
                # 2. Update within partition
                cursor.execute("""
                    UPDATE notification_users 
                    SET is_read = TRUE 
                    WHERE notification_id = %s AND created_at = %s
                """, (notification_id, created_at))
                conn.commit()
                
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"message": "Đã đánh dấu đã đọc"}).encode('utf-8'))
            except Exception as e:
                conn.rollback()
                print("Database query error:", repr(e))
                self.send_json_error(500, f"Lỗi đánh dấu đã đọc: {repr(e)}")
            finally:
                cursor.close()
                conn.close()

        else:
            self.send_response(404)
            self.end_headers()

    def send_json_error(self, status_code, message):
        self.send_response(status_code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode('utf-8'))

if __name__ == "__main__":
    server = http.server.HTTPServer(("", PORT), TestAuthHandler)
    print(f"Backend Server test is running on port {PORT}...")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    print("Server stopped.")
