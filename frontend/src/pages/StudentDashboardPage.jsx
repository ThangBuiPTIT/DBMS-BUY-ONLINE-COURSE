import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Trophy, Search, Flame, ArrowRight, Bell } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { Card, Badge } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import { api, getCurrentUser } from '../api/client';
import NotificationBell from '../components/NotificationBell';
import { navigate } from '../lib/router';

const NAV_LINKS = [
  { href: '/dictionary', label: 'Từ điển' },
  { href: '/microlearning/roadmap', label: 'Lộ trình' },
  { href: '/leaderboard', label: 'Xếp hạng' },
  { href: '/store', label: 'Cửa hàng' },
];

const LogoIcon = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 40 40" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="36" rx="10" fill="currentColor" className="text-primary"/>
    <path d="M12 14 L20 10 L28 14 L28 22 L20 26 L12 22 Z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    <circle cx="20" cy="18" r="3" fill="white"/>
  </svg>
);

export default function StudentDashboardPage() {
  const currentUser = getCurrentUser();
  const userId = currentUser?.user_id;
  const [streak, setStreak] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { navigate('/'); return; }
    (async () => {
      try {
        const [streakRes, notifRes] = await Promise.all([
          api.get(`/api/gamification/streak/${userId}`).catch(() => ({ data: { current_streak: 0, highest_streak: 0 } })),
          api.get(`/api/notifications/${userId}`).catch(() => ({ data: [] })),
        ]);
        setStreak(streakRes.data);
        setNotifications((notifRes.data || []).slice(0, 5));
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally { setLoading(false); }
    })();
  }, [userId]);

  const handleLogout = () => {
    localStorage.removeItem('session_key');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('role_name');
    window.dispatchEvent(new Event('auth-change'));
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery) navigate(`/dictionary?word=${encodeURIComponent(searchQuery)}`);
    else navigate('/dictionary');
  };

  return (
    <AppLayout
      role="student"
      currentPath="/student/dashboard"
      title="Chào buổi sáng 👋"
      subtitle="Tiếp tục hành trình học ngôn ngữ ký hiệu của bạn."
      user={currentUser}
      onLogout={handleLogout}
      actions={<NotificationBell userId={userId} />}
    >
      <div className="p-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card padding="p-6">
              <div className="text-[11px] uppercase tracking-[0.15em] text-primary font-bold mb-3">
                Tra cứu nhanh
              </div>
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" strokeWidth={1.8} />
                <input
                  type="text"
                  placeholder="Nhập từ vựng cần tra cứu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface border border-divider rounded-xl pl-12 pr-32 py-3.5 text-sm text-heading placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <PrimarySearchBtn />
              </form>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
                whileHover={{ y: -2 }}
                onClick={() => navigate('/microlearning/roadmap')}
                className="bg-surface border border-divider rounded-2xl p-6 cursor-pointer hover:border-primary transition-all group"
              >
                <div className="flex items-start justify-between mb-10">
                  <div className="w-10 h-10 bg-primary-light text-primary rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <BookOpen size={18} strokeWidth={1.8} />
                  </div>
                  <ArrowRight size={16} className="text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" strokeWidth={1.8} />
                </div>
                <h3 className="text-base font-bold tracking-tight text-heading mb-1">Lộ trình học</h3>
                <p className="text-xs text-muted mb-5">Bài 3: Giao tiếp cơ bản hàng ngày</p>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider text-muted font-bold">Tiến độ</span>
                    <span className="text-xs font-bold text-heading">33%</span>
                  </div>
                  <div className="w-full h-1.5 bg-base rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: '33%' }}></div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
                whileHover={{ y: -2 }}
                onClick={() => navigate('/leaderboard')}
                className="bg-surface border border-divider rounded-2xl p-6 cursor-pointer hover:border-primary transition-all group"
              >
                <div className="flex items-start justify-between mb-10">
                  <div className="w-10 h-10 bg-primary-light text-primary rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <Trophy size={18} strokeWidth={1.8} />
                  </div>
                  <ArrowRight size={16} className="text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" strokeWidth={1.8} />
                </div>
                <h3 className="text-base font-bold tracking-tight text-heading mb-1">Xếp hạng</h3>
                <p className="text-xs text-muted mb-6">Bạn đang đứng thứ 12 trong tuần này</p>
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  Xem bảng xếp hạng <ArrowRight size={14} strokeWidth={1.8} />
                </div>
              </motion.div>
            </div>
          </div>

          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-primary rounded-2xl p-6 text-white relative overflow-hidden"
            >
              <div className="absolute top-3 right-3 opacity-10">
                <Flame size={80} strokeWidth={1} />
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Flame size={16} strokeWidth={1.8} />
                  <span className="text-[11px] uppercase tracking-wider font-bold opacity-90">Chuỗi ngày học</span>
                </div>
                {loading ? (
                  <div className="animate-pulse h-12 bg-white/10 rounded-lg w-1/2 mt-2"></div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold tracking-tight leading-none">{streak?.current_streak || 0}</span>
                    <span className="text-sm opacity-80">ngày</span>
                  </div>
                )}
                <div className="mt-5 pt-5 border-t border-white/20 text-xs opacity-80">
                  Kỷ lục: {streak?.highest_streak || 0} ngày
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-surface border border-divider rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold tracking-tight text-heading">Thông báo</h3>
                <Badge color="muted">{notifications.length}</Badge>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-12 bg-base rounded-xl"></div>)}
                </div>
              ) : notifications.length > 0 ? (
                <div className="space-y-4">
                  {notifications.map((notif) => (
                    <div key={notif.notification_id} className={`flex gap-3 pb-4 border-b border-divider last:border-0 last:pb-0 ${notif.is_read ? 'opacity-60' : ''}`}>
                      <div className={`w-1.5 h-1.5 mt-2 rounded-full shrink-0 ${!notif.is_read ? 'bg-primary' : 'bg-divider'}`}></div>
                      <div className="min-w-0">
                        <p className="text-xs text-heading leading-snug line-clamp-2 font-semibold">{notif.message}</p>
                        <p className="text-[11px] text-muted mt-1">{new Date(notif.created_at).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted text-xs">Không có thông báo nào</div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function PrimarySearchBtn() {
  return (
    <button
      type="submit"
      className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-[0.97]"
    >
      Tìm kiếm
    </button>
  );
}
