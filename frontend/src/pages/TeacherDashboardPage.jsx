import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, BarChart3, MessageSquare, BookMarked,
  GraduationCap, TrendingUp, RefreshCw, AlertCircle, ArrowRight
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { StatCard, Card, PrimaryButton, GhostButton } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import NotificationBell from '../components/NotificationBell';
import { navigate } from '../lib/router';

const DEFAULT_TEACHER_ID = 'e94baf4a-57b2-4712-b65a-8f15edf0251a';

const StarRating = ({ rating }) => (
  <div className="flex">
    {[...Array(5)].map((_, i) => (
      <svg key={i} className={`w-3.5 h-3.5 ${i < Math.round(rating) ? 'text-amber-500 fill-amber-500' : 'text-divider fill-divider'}`} viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

const TAB_HEADERS = {
  overview: { title: 'Tổng quan', subtitle: 'Hoạt động giảng dạy' },
  analytics: { title: 'Hiệu năng khóa học', subtitle: 'Phân tích chi tiết' },
  feedback: { title: 'Đánh giá & Phản hồi', subtitle: 'Tổng hợp từ học viên' },
};

const NAV_ITEMS = [
  { id: 'overview',  name: 'Tổng quan',       icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /> },
  { id: 'analytics', name: 'Hiệu năng',       icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /> },
  { id: 'feedback',  name: 'Đánh giá',        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /> },
];

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
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => { fetchDashboardData(); }, [teacherId]);

  async function fetchDashboardData() {
    setLoading(true); setError('');
    try {
      const [statsRes, coursesRes, feedbackRes] = await Promise.all([
        api.get(`/api/teacher/${teacherId}/dashboard`),
        api.get(`/api/teacher/${teacherId}/courses`),
        api.get(`/api/teacher/${teacherId}/feedbacks`),
      ]);
      setStats(statsRes.data);
      setCourses(coursesRes.data || []);
      setFeedback(feedbackRes.data || []);
    } catch (err) {
      setError('Không thể tải dữ liệu từ máy chủ.');
      setToast({ show: true, message: 'Không thể tải dữ liệu từ máy chủ', type: 'error' });
    } finally { setLoading(false); }
  }

  const handleLogout = () => {
    localStorage.removeItem('session_key');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('role_name');
    window.dispatchEvent(new Event('auth-change'));
    navigate('/');
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

  const primaryItems = NAV_ITEMS.map((item) => ({
    id: item.id, label: item.name, icon: item.icon,
    active: activeTab === item.id,
    onClick: () => setActiveTab(item.id),
  }));

  return (
    <AppLayout
      role="teacher"
      currentPath="/teacher/dashboard"
      title={TAB_HEADERS[activeTab].title}
      subtitle={TAB_HEADERS[activeTab].subtitle}
      primaryItems={primaryItems}
      primaryLabel="Quản lý lớp học"
      user={{ username: stats.teacher_name, role_name: 'TEACHER' }}
      onLogout={handleLogout}
      toast={toast}
      onToastClose={() => setToast({ show: false, message: '', type: 'success' })}
      actions={
        <>
          <GhostButton
            size="sm"
            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            onClick={fetchDashboardData}
          >
            Làm mới
          </GhostButton>
          <NotificationBell userId={teacherId} />
        </>
      }
    >
      <div className="p-8">
        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle size={16} strokeWidth={1.8} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <LoadingSpinner label="Đang tải dashboard..." />
        ) : (
          <>
            {activeTab === 'overview' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 max-w-6xl">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-heading">Chào, {stats.teacher_name}</h2>
                  <p className="text-sm text-muted mt-1">Tổng quan hoạt động giảng dạy của bạn.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard label="Khóa học" value={stats.total_courses} icon={<BookMarked size={16} strokeWidth={1.8} />} />
                  <StatCard label="Học viên" value={stats.total_students} icon={<GraduationCap size={16} strokeWidth={1.8} />} />
                  <StatCard label="Doanh thu" value={formatCurrency(stats.total_generated_revenue)} icon={<TrendingUp size={16} strokeWidth={1.8} />} />
                </div>

                <Card padding="p-0">
                  <div className="px-6 py-5 border-b border-divider flex items-center justify-between">
                    <h3 className="text-base font-bold text-heading">Khóa học của bạn</h3>
                    <span className="text-xs text-muted font-semibold">{courses.length} khóa học</span>
                  </div>
                  {courses.length === 0 ? (
                    <EmptyState title="Bạn chưa tạo khóa học nào" message="Hãy vào Course Builder để tạo khóa học đầu tiên." />
                  ) : (
                    <div>
                      {courses.map((course) => (
                        <div key={course.course_id} className="px-6 py-4 flex items-center justify-between hover:bg-base/60 transition-colors border-b border-divider last:border-0">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center shrink-0 text-primary">
                              <BookMarked size={16} strokeWidth={1.8} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-semibold text-heading truncate">{course.course_title}</h4>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                                <span>{course.total_students} học viên</span>
                                <span>·</span>
                                <span>Tiến độ TB {course.avg_progress}%</span>
                              </div>
                            </div>
                          </div>
                          <GhostButton
                            size="sm"
                            onClick={() => navigate(`/teacher/courses/${course.course_id}/builder`)}
                            icon={<ArrowRight size={12} strokeWidth={1.8} />}
                          >
                            Thiết kế
                          </GhostButton>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4 max-w-6xl">
                <Card padding="p-0">
                  {courses.length === 0 ? (
                    <EmptyState title="Không có dữ liệu" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wider text-muted border-b border-divider bg-base">
                            <th className="px-6 py-3 font-semibold">Khóa học</th>
                            <th className="px-6 py-3 font-semibold">Học viên</th>
                            <th className="px-6 py-3 font-semibold">Tiến độ TB</th>
                            <th className="px-6 py-3 font-semibold">Đánh giá</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courses.map((course) => (
                            <tr key={course.course_id} className="border-b border-divider last:border-0 hover:bg-base/60">
                              <td className="px-6 py-4 font-semibold text-heading">{course.course_title}</td>
                              <td className="px-6 py-4 text-body">{course.total_students}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2 w-48">
                                  <div className="flex-1 h-1.5 bg-base rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, Math.max(0, course.avg_progress))}%` }} />
                                  </div>
                                  <span className="text-xs font-semibold w-10 text-right">{course.avg_progress}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-semibold">{course.avg_rating ?? '—'}</span>
                                  {course.avg_rating && <StarRating rating={course.avg_rating} />}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {activeTab === 'feedback' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4 max-w-6xl">
                {feedback.length === 0 ? (
                  <Card>
                    <EmptyState title="Chưa có đánh giá nào" message="Khi học viên đánh giá khóa học sẽ hiển thị tại đây." />
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {feedback.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <Card>
                          <h4 className="text-base font-bold tracking-tight mb-5 text-heading">{item.course_or_context}</h4>
                          <div className="flex items-center gap-6">
                            <div>
                              <div className="text-[10px] text-muted uppercase tracking-wider mb-1.5 font-bold">Đánh giá</div>
                              <div className="text-3xl font-bold tracking-tight leading-none text-heading">{item.average_rating}</div>
                              <StarRating rating={item.average_rating} />
                              <div className="text-xs text-muted mt-2">{item.total_feedbacks} lượt</div>
                            </div>
                            <div className="flex-1 space-y-2">
                              {[5, 1].map((star) => (
                                <div key={star} className="flex items-center gap-2">
                                  <span className="text-xs text-muted w-8">{star} sao</span>
                                  <div className="flex-1 h-1.5 bg-base rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${star === 5 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                      style={{ width: `${item.total_feedbacks > 0 ? (item[`${star === 5 ? 'five' : 'one'}_stars`] / item.total_feedbacks) * 100 : 0}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-semibold w-6 text-right">{item[`${star === 5 ? 'five' : 'one'}_stars`]}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default TeacherDashboardPage;
