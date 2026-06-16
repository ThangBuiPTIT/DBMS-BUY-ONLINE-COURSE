import React, { useState, useEffect } from 'react';
import axios from 'axios';
import NotificationBell from '../components/NotificationBell';

const DEFAULT_TEACHER_ID = 'e94baf4a-57b2-4712-b65a-8f15edf0251a';

function TeacherDashboardPage() {
  const [teacherId] = useState(() => {
    return localStorage.getItem('teacher_id') || DEFAULT_TEACHER_ID;
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    teacher_name: 'Giáo viên',
    total_courses: 0,
    total_students: 0,
    total_generated_revenue: 0,
  });
  const [courses, setCourses] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [teacherId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, coursesRes, feedbackRes] = await Promise.all([
        axios.get(`http://localhost:8080/api/teacher/${teacherId}/dashboard`),
        axios.get(`http://localhost:8080/api/teacher/${teacherId}/courses`),
        axios.get(`http://localhost:8080/api/teacher/${teacherId}/feedbacks`),
      ]);
      setStats(statsRes.data);
      setCourses(coursesRes.data || []);
      setFeedback(feedbackRes.data || []);
    } catch (err) {
      console.error(err);
      setError('Không thể tải dữ liệu từ máy chủ. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-6 shrink-0">
        <div>
          {/* Logo / Title */}
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                E-Learning
              </h1>
              <span className="text-xs text-slate-500 font-medium">Teacher Console</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-violet-600/15 to-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
              </svg>
              Tổng quan
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === 'analytics'
                  ? 'bg-gradient-to-r from-violet-600/15 to-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
              Hiệu năng khóa học
            </button>

            <button
              onClick={() => setActiveTab('feedback')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === 'feedback'
                  ? 'bg-gradient-to-r from-violet-600/15 to-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Đánh giá & Phản hồi
            </button>

            <button
              onClick={() => window.location.pathname = '/store'}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Cửa hàng khóa học
            </button>

            <button
              onClick={() => window.location.pathname = '/students/manage'}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Quản lý học viên
            </button>

            <button
              onClick={() => window.location.pathname = '/admin/dashboard'}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Admin Dashboard
            </button>

            <button
              onClick={() => window.location.pathname = '/leaderboard'}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
              🏆 Bảng xếp hạng
            </button>
          </nav>
        </div>

        {/* Footer Profile Info */}
        <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/70 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-base shadow-inner">
            {stats.teacher_name ? stats.teacher_name[0] : 'T'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-slate-200 truncate">{stats.teacher_name || 'Giáo viên'}</p>
            <p className="text-xs text-indigo-400 font-medium">Giảng viên</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 bg-slate-900/60 backdrop-blur-md border-b border-slate-850 px-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {activeTab === 'overview' && 'Tổng quan Chỉ số'}
              {activeTab === 'analytics' && 'Phân tích Hiệu năng Khóa học'}
              {activeTab === 'feedback' && 'Tổng hợp Đánh giá & Phản hồi'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Dữ liệu cập nhật thời gian thực</p>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell userId={teacherId} />
            <button
              onClick={fetchDashboardData}
              className="p-2.5 bg-slate-800 hover:bg-slate-755 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.27 15" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 p-8 overflow-y-auto max-w-[1600px] w-full mx-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-950/40 border border-red-900/50 rounded-2xl flex items-center gap-3 text-red-200">
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-80">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
              </div>
            </div>
          ) : (
            <>
              {/* Tab 1: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-8 animate-fadeIn">
                  {/* Indicators Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Card 1: Total Courses */}
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all duration-300 shadow-md">
                      <div className="absolute top-0 right-0 p-8 opacity-5 -mr-4 -mt-4 text-violet-500 group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                        </svg>
                      </div>
                      <span className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Tổng số khóa học</span>
                      <h3 className="text-3xl font-extrabold text-white mt-2 mb-1">{stats.total_courses}</h3>
                      <p className="text-xs text-indigo-400 font-medium">Khóa học đang hoạt động</p>
                    </div>

                    {/* Card 2: Total Students */}
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all duration-300 shadow-md">
                      <div className="absolute top-0 right-0 p-8 opacity-5 -mr-4 -mt-4 text-indigo-500 group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a7 7 0 00-7 7v1h12v-1a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Tổng học viên</span>
                      <h3 className="text-3xl font-extrabold text-white mt-2 mb-1">{stats.total_students}</h3>
                      <p className="text-xs text-indigo-400 font-medium">Lượt đăng ký học viên</p>
                    </div>

                    {/* Card 3: Total Estimated Revenue */}
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all duration-300 shadow-md">
                      <div className="absolute top-0 right-0 p-8 opacity-5 -mr-4 -mt-4 text-emerald-500 group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8.433 7.418C8.807 7.102 9.387 7 10.007 7c.607 0 1.157.1 1.516.302.355.2.535.485.535.845 0 .35-.2.63-.535.83-.359.201-.909.301-1.516.301-.6 0-1.18-.1-1.55-.301-.371-.2-.571-.48-.571-.83 0-.36.2-.64.571-.845zM10.007 10c.607 0 1.157.1 1.516.302.355.2.535.485.535.846 0 .349-.2.63-.535.83-.359.201-.909.3-1.516.3-.6 0-1.18-.1-1.55-.3-.371-.2-.571-.48-.571-.83 0-.361.2-.646.571-.846z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092A5.012 5.012 0 005 10c0 .984.34 1.884.91 2.593l-.403.403a1 1 0 101.414 1.414l.39-.39A4.986 4.986 0 0010 15v.092a1 1 0 102 0V15c1.936 0 3.593-1.103 4.407-2.707l.394.394a1 1 0 101.414-1.414l-.396-.396A4.986 4.986 0 0015 10c0-1.936-1.103-3.593-2.707-4.407V5z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Doanh thu tạm tính</span>
                      <h3 className="text-3xl font-extrabold text-white mt-2 mb-1">
                        {formatCurrency(stats.total_generated_revenue)}
                      </h3>
                      <p className="text-xs text-emerald-400 font-medium">Doanh thu tích lũy thành công</p>
                    </div>
                  </div>

                  {/* Course List Card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="font-bold text-white text-base">Danh sách khóa học của bạn</h3>
                      <span className="px-3 py-1 bg-slate-850 text-slate-300 rounded-full text-xs font-semibold">
                        {courses.length} Khóa học
                      </span>
                    </div>

                    {courses.length === 0 ? (
                      <div className="p-12 text-center text-slate-500">Giảng viên này chưa tạo khóa học nào.</div>
                    ) : (
                      <div className="divide-y divide-slate-800/60">
                        {courses.map((course) => (
                          <div key={course.course_id} className="p-6 hover:bg-slate-800/10 transition-colors flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-slate-200">{course.course_title}</h4>
                              <p className="text-xs text-slate-500 mt-1">Mã khóa học: {course.course_id}</p>
                            </div>
                            <div className="flex items-center gap-6 text-right">
                              <div>
                                <span className="text-slate-400 text-xs block font-medium">Học viên</span>
                                <span className="text-slate-200 font-semibold">{course.total_students}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-xs block font-medium">Tiến độ TB</span>
                                <span className="text-slate-200 font-semibold">{course.avg_progress}%</span>
                              </div>
                              <button
                                onClick={() => window.location.pathname = `/teacher/courses/${course.course_id}/builder`}
                                className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all duration-200 ml-4 cursor-pointer"
                              >
                                Thiết kế bài học
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Course Analytics */}
              {activeTab === 'analytics' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg animate-fadeIn">
                  <div className="p-6 border-b border-slate-800">
                    <h3 className="font-bold text-white text-base">Phân tích hiệu năng chi tiết</h3>
                  </div>

                  {courses.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">Không có dữ liệu hiệu năng khóa học.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase bg-slate-950/40">
                            <th className="p-5">Tên khóa học</th>
                            <th className="p-5">Tổng học viên</th>
                            <th className="p-5">Tiến độ trung bình</th>
                            <th className="p-5">Điểm đánh giá trung bình</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {courses.map((course) => (
                            <tr key={course.course_id} className="hover:bg-slate-800/10 transition-colors">
                              <td className="p-5 font-semibold text-slate-200 max-w-sm truncate">
                                {course.course_title}
                              </td>
                              <td className="p-5">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a7 7 0 00-7 7v1h12v-1a7 7 0 00-7-7z" />
                                  </svg>
                                  <span className="text-slate-300 font-semibold">{course.total_students}</span>
                                </div>
                              </td>
                              <td className="p-5">
                                <div className="flex items-center gap-3 w-48">
                                  <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                                    <div
                                      className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                      style={{ width: `${Math.min(100, Math.max(0, course.avg_progress))}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-slate-300 text-xs font-bold shrink-0">{course.avg_progress}%</span>
                                </div>
                              </td>
                              <td className="p-5">
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-4 h-4 text-amber-500 fill-current" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  <span className="text-slate-200 font-bold">
                                    {course.avg_rating !== null && course.avg_rating !== undefined
                                      ? course.avg_rating
                                      : 'Chưa có'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Student Feedback */}
              {activeTab === 'feedback' && (
                <div className="space-y-8 animate-fadeIn">
                  {feedback.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                      Không có đánh giá phản hồi nào từ học viên.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {feedback.map((item, index) => (
                        <div key={index} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
                          <h4 className="font-semibold text-slate-100 text-base mb-2 border-b border-slate-800 pb-2">
                            {item.course_or_context}
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                            {/* Stats */}
                            <div className="flex flex-col justify-center">
                              <span className="text-slate-400 text-xs font-semibold">Điểm đánh giá trung bình</span>
                              <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-4xl font-extrabold text-indigo-400">{item.average_rating}</span>
                                <span className="text-slate-500 text-xs">/ 5 sao</span>
                              </div>
                              <span className="text-slate-500 text-xs mt-2 block">
                                Tổng cộng {item.total_feedbacks} lượt đánh giá
                              </span>
                            </div>

                            {/* Stars breakdown */}
                            <div className="space-y-2.5">
                              {/* 5 stars */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 w-10">5 sao</span>
                                <div className="flex-1 bg-slate-850 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-indigo-500 h-full rounded-full"
                                    style={{
                                      width: `${
                                        item.total_feedbacks > 0
                                          ? (item.five_stars / item.total_feedbacks) * 100
                                          : 0
                                      }%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="text-xs text-slate-300 w-6 text-right">{item.five_stars}</span>
                              </div>

                              {/* 1 star */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 w-10">1 sao</span>
                                <div className="flex-1 bg-slate-850 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-red-500/80 h-full rounded-full"
                                    style={{
                                      width: `${
                                        item.total_feedbacks > 0
                                          ? (item.one_star / item.total_feedbacks) * 100
                                          : 0
                                      }%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="text-xs text-slate-300 w-6 text-right">{item.one_star}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default TeacherDashboardPage;
