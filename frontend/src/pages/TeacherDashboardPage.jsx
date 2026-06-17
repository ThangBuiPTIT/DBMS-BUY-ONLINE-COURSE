import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import NotificationBell from '../components/NotificationBell';
import {
  LayoutDashboard, Users, ShoppingBag, Trophy, BookOpen,
  BarChart3, MessageSquare, BookMarked, RefreshCw, AlertCircle,
  GraduationCap, TrendingUp, Wallet, Home, ArrowRight
} from 'lucide-react';

const API_URL = 'http://localhost:8081';
const DEFAULT_TEACHER_ID = 'e94baf4a-57b2-4712-b65a-8f15edf0251a';

const LogoIcon = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 40 40" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="36" rx="10" fill="currentColor" className="text-gray-900"/>
    <path d="M12 14 L20 10 L28 14 L28 22 L20 26 L12 22 Z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    <circle cx="20" cy="18" r="3" fill="white"/>
  </svg>
);

const StarRating = ({ rating }) => (
  <div className="flex">
    {[...Array(5)].map((_, i) => (
      <svg key={i} className={`w-3.5 h-3.5 ${i < Math.round(rating) ? 'text-amber-500 fill-amber-500' : 'text-gray-200 fill-gray-200'}`} viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

function TeacherDashboardPage() {
  const [teacherId] = useState(() => localStorage.getItem('teacher_id') || DEFAULT_TEACHER_ID);
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

  useEffect(() => { fetchDashboardData(); }, [teacherId]);

  async function fetchDashboardData() {
    setLoading(true);
    setError('');
    try {
      const [statsRes, coursesRes, feedbackRes] = await Promise.all([
        axios.get(`${API_URL}/api/teacher/${teacherId}/dashboard`),
        axios.get(`${API_URL}/api/teacher/${teacherId}/courses`),
        axios.get(`${API_URL}/api/teacher/${teacherId}/feedbacks`),
      ]);
      setStats(statsRes.data);
      setCourses(coursesRes.data || []);
      setFeedback(feedbackRes.data || []);
    } catch (err) {
      console.error(err);
      setError('Không thể tải dữ liệu từ máy chủ.');
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('session_key');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('role_name');
    window.location.href = '/admin/login';
  };

  const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

  const navItems = [
    { id: 'overview', name: 'Tổng quan', icon: LayoutDashboard },
    { id: 'analytics', name: 'Hiệu năng', icon: BarChart3 },
    { id: 'feedback', name: 'Đánh giá', icon: MessageSquare },
  ];

  const externalLinks = [
    { name: 'Trang chủ', path: '/', icon: Home },
    { name: 'Học viên', path: '/student/dashboard', icon: Users },
    { name: 'Cửa hàng', path: '/store', icon: ShoppingBag },
    { name: 'Bảng xếp hạng', path: '/leaderboard', icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="h-14 px-5 border-b border-gray-200 flex items-center gap-2.5">
          <LogoIcon className="w-7 h-7" />
          <div>
            <div className="text-[14px] font-semibold tracking-tight leading-none">SignLearn</div>
            <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">Teacher</div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider px-3 mb-2">Quản lý</p>
            <div className="space-y-0.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                    activeTab === item.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <item.icon size={16} strokeWidth={1.5} />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider px-3 mb-2">Lối tắt</p>
            <div className="space-y-0.5">
              {externalLinks.map((item) => (
                <button
                  key={item.path}
                  onClick={() => window.location.href = item.path}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
                >
                  <item.icon size={16} strokeWidth={1.5} />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <div className="h-8 w-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-semibold text-[13px]">
              {stats.teacher_name?.[0] || 'T'}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-[13px] font-medium truncate">{stats.teacher_name || 'Giáo viên'}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Giảng viên</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full text-[12.5px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 py-2 rounded-lg transition-colors cursor-pointer">
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gray-200 px-8 flex items-center justify-between bg-white sticky top-0 z-40">
          <h1 className="text-[15px] font-semibold tracking-tight">
            {activeTab === 'overview' && 'Tổng quan'}
            {activeTab === 'analytics' && 'Hiệu năng khóa học'}
            {activeTab === 'feedback' && 'Đánh giá & Phản hồi'}
          </h1>
          <div className="flex items-center gap-3">
            <button onClick={fetchDashboardData} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 p-1.5 rounded-lg cursor-pointer" title="Làm mới">
              <RefreshCw size={15} strokeWidth={1.5} />
            </button>
            <NotificationBell userId={teacherId} />
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-[13px]">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-80">
              <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin"></div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 max-w-6xl">
                  <div>
                    <h2 className="text-[24px] font-semibold tracking-tight">Chào, {stats.teacher_name}</h2>
                    <p className="text-[14px] text-gray-500 mt-1">Tổng quan hoạt động giảng dạy của bạn.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Khóa học', value: stats.total_courses, icon: BookMarked },
                      { label: 'Học viên', value: stats.total_students, icon: GraduationCap },
                      { label: 'Doanh thu', value: formatCurrency(stats.total_generated_revenue), icon: TrendingUp },
                    ].map((m, i) => (
                      <motion.div
                        key={m.label}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        className="bg-white border border-gray-200 rounded-2xl p-6"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[12px] text-gray-500 font-medium">{m.label}</span>
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            <m.icon size={15} className="text-gray-700" strokeWidth={1.5} />
                          </div>
                        </div>
                        <div className="text-[26px] font-semibold tracking-tight truncate">{m.value}</div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="text-[15px] font-semibold">Khóa học của bạn</h3>
                      <span className="text-[12px] text-gray-500">{courses.length} khóa học</span>
                    </div>
                    {courses.length === 0 ? (
                      <div className="py-16 text-center text-gray-400 text-[13px]">Bạn chưa tạo khóa học nào</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {courses.map((course) => (
                          <div key={course.course_id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                                <BookMarked size={16} className="text-gray-700" strokeWidth={1.5} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-[14px] font-medium text-gray-900 truncate">{course.course_title}</h4>
                                <div className="flex items-center gap-4 mt-1 text-[12px] text-gray-500">
                                  <span>{course.total_students} học viên</span>
                                  <span>·</span>
                                  <span>Tiến độ TB {course.avg_progress}%</span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => window.location.href = `/teacher/courses/${course.course_id}/builder`}
                              className="text-[12.5px] font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              Thiết kế <ArrowRight size={12} strokeWidth={1.5} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'analytics' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4 max-w-6xl">
                  <div>
                    <h2 className="text-[24px] font-semibold tracking-tight">Hiệu năng khóa học</h2>
                    <p className="text-[14px] text-gray-500 mt-1">Phân tích chi tiết theo từng khóa học.</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    {courses.length === 0 ? (
                      <div className="py-16 text-center text-gray-400 text-[13px]">Không có dữ liệu</div>
                    ) : (
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50/50">
                            <th className="px-6 py-3 font-medium">Khóa học</th>
                            <th className="px-6 py-3 font-medium">Học viên</th>
                            <th className="px-6 py-3 font-medium">Tiến độ TB</th>
                            <th className="px-6 py-3 font-medium">Đánh giá</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courses.map((course) => (
                            <tr key={course.course_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                              <td className="px-6 py-4 font-medium text-gray-900">{course.course_title}</td>
                              <td className="px-6 py-4 text-gray-700">{course.total_students}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2 w-48">
                                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gray-900 rounded-full" style={{ width: `${Math.min(100, Math.max(0, course.avg_progress))}%` }} />
                                  </div>
                                  <span className="text-[12px] font-medium w-10 text-right">{course.avg_progress}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[14px] font-medium">{course.avg_rating ?? '--'}</span>
                                  {course.avg_rating && <StarRating rating={course.avg_rating} />}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'feedback' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4 max-w-6xl">
                  <div>
                    <h2 className="text-[24px] font-semibold tracking-tight">Đánh giá từ học viên</h2>
                    <p className="text-[14px] text-gray-500 mt-1">Tổng hợp phản hồi theo khóa học.</p>
                  </div>
                  {feedback.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center text-gray-400 text-[13px]">
                      Chưa có đánh giá nào
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {feedback.map((item, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="bg-white border border-gray-200 rounded-2xl p-6"
                        >
                          <h4 className="text-[15px] font-semibold tracking-tight mb-5">{item.course_or_context}</h4>
                          <div className="flex items-center gap-6">
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Đánh giá</div>
                              <div className="text-[32px] font-semibold tracking-tight leading-none">{item.average_rating}</div>
                              <StarRating rating={item.average_rating} />
                              <div className="text-[11px] text-gray-500 mt-2">{item.total_feedbacks} lượt</div>
                            </div>
                            <div className="flex-1 space-y-2">
                              {[5, 1].map((star) => (
                                <div key={star} className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-500 w-8">{star} sao</span>
                                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${star === 5 ? 'bg-green-600' : 'bg-red-500'}`}
                                      style={{ width: `${item.total_feedbacks > 0 ? (item[`${star === 5 ? 'five' : 'one'}_stars`] / item.total_feedbacks) * 100 : 0}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-medium w-6 text-right">{item[`${star === 5 ? 'five' : 'one'}_stars`]}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default TeacherDashboardPage;
