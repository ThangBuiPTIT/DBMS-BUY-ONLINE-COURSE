import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { BookOpen, Trophy, Search, Flame, Bell, ArrowRight, LogOut } from 'lucide-react';

const API_URL = 'http://localhost:8081';
const STUDENT_ID = '74cc1ba2-509e-4348-8722-a0a84f8ee266';

const LogoIcon = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 40 40" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="36" rx="10" fill="currentColor" className="text-gray-900"/>
    <path d="M12 14 L20 10 L28 14 L28 22 L20 26 L12 22 Z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    <circle cx="20" cy="18" r="3" fill="white"/>
  </svg>
);

export default function StudentDashboardPage() {
  const [streak, setStreak] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [streakRes, notifRes] = await Promise.all([
          axios.get(`${API_URL}/api/gamification/streak/${STUDENT_ID}`).catch(() => ({ data: { current_streak: 0, highest_streak: 0 } })),
          axios.get(`${API_URL}/api/notifications/${STUDENT_ID}`).catch(() => ({ data: [] }))
        ]);
        setStreak(streakRes.data);
        setNotifications((notifRes.data || []).slice(0, 5));
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('session_key');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('role_name');
    window.location.href = '/admin/login';
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery) {
      window.location.href = `/dictionary?word=${encodeURIComponent(searchQuery)}`;
    } else {
      window.location.href = '/dictionary';
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans text-gray-900">
      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200/80">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.location.href = '/'}>
            <LogoIcon />
            <span className="text-[15px] font-semibold tracking-tight">SignLearn</span>
          </div>
          <nav className="hidden md:flex items-center gap-7">
            <a href="/dictionary" className="text-[13px] text-gray-600 hover:text-gray-900 transition-colors">Từ điển</a>
            <a href="/microlearning/roadmap" className="text-[13px] text-gray-600 hover:text-gray-900 transition-colors">Lộ trình</a>
            <a href="/leaderboard" className="text-[13px] text-gray-600 hover:text-gray-900 transition-colors">Xếp hạng</a>
            <a href="/store" className="text-[13px] text-gray-600 hover:text-gray-900 transition-colors">Cửa hàng</a>
          </nav>
          <div className="flex items-center gap-3">
            <button className="hidden md:flex w-9 h-9 rounded-full bg-gray-100 items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer">
              <Bell className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 overflow-hidden ring-1 ring-gray-200">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Student" alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer" title="Đăng xuất">
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10"
        >
          <h1 className="text-[32px] font-semibold tracking-[-0.02em] leading-tight">
            Chào buổi sáng 👋
          </h1>
          <p className="text-[14px] text-gray-500 mt-1.5">
            Tiếp tục hành trình học ngôn ngữ ký hiệu của bạn.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT */}
          <div className="lg:col-span-2 space-y-5">
            {/* Search */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="bg-white border border-gray-200 rounded-3xl p-6"
            >
              <div className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-medium mb-3">
                Tra cứu nhanh
              </div>
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Nhập từ vựng cần tra cứu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-full pl-12 pr-28 py-3.5 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
                />
                <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer active:scale-[0.97]">
                  Tìm kiếm
                </button>
              </form>
            </motion.div>

            {/* Modules */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                whileHover={{ y: -2 }}
                onClick={() => window.location.href = '/microlearning/roadmap'}
                className="bg-white border border-gray-200 rounded-3xl p-6 cursor-pointer hover:border-gray-300 transition-all group"
              >
                <div className="flex items-start justify-between mb-12">
                  <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white transition-colors">
                    <BookOpen className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-1 transition-all" strokeWidth={1.5} />
                </div>
                <h3 className="text-[17px] font-semibold tracking-tight text-gray-900 mb-1">Lộ trình học</h3>
                <p className="text-[13px] text-gray-500 mb-6">Bài 3: Giao tiếp cơ bản hàng ngày</p>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Tiến độ</span>
                    <span className="text-[12px] font-semibold text-gray-900">33%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: '33%' }}></div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                whileHover={{ y: -2 }}
                onClick={() => window.location.href = '/leaderboard'}
                className="bg-white border border-gray-200 rounded-3xl p-6 cursor-pointer hover:border-gray-300 transition-all group"
              >
                <div className="flex items-start justify-between mb-12">
                  <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white transition-colors">
                    <Trophy className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-1 transition-all" strokeWidth={1.5} />
                </div>
                <h3 className="text-[17px] font-semibold tracking-tight text-gray-900 mb-1">Xếp hạng</h3>
                <p className="text-[13px] text-gray-500 mb-6">Bạn đang đứng thứ 12 trong tuần này</p>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-700">
                  Xem bảng xếp hạng <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                </div>
              </motion.div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-gray-900 rounded-3xl p-6 text-white relative overflow-hidden"
            >
              <div className="absolute top-3 right-3 opacity-10">
                <Flame className="w-20 h-20" strokeWidth={1} />
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4" strokeWidth={1.5} />
                  <span className="text-[11px] uppercase tracking-wider font-medium opacity-80">Chuỗi ngày học</span>
                </div>
                {loading ? (
                  <div className="animate-pulse h-12 bg-white/10 rounded w-1/2 mt-2"></div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-[56px] font-semibold tracking-tight leading-none">{streak?.current_streak || 0}</span>
                    <span className="text-[14px] opacity-70">ngày</span>
                  </div>
                )}
                <div className="mt-5 pt-5 border-t border-white/10 text-[12px] opacity-70">
                  Kỷ lục: {streak?.highest_streak || 0} ngày
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-white border border-gray-200 rounded-3xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[14px] font-semibold tracking-tight">Thông báo</h3>
                <span className="text-[11px] text-gray-400 font-medium">{notifications.length}</span>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-12 bg-gray-50 rounded-xl"></div>)}
                </div>
              ) : notifications.length > 0 ? (
                <div className="space-y-4">
                  {notifications.map((notif) => (
                    <div key={notif.notification_id} className={`flex gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0 ${!notif.is_read ? '' : 'opacity-60'}`}>
                      <div className={`w-1.5 h-1.5 mt-2 rounded-full shrink-0 ${!notif.is_read ? 'bg-gray-900' : 'bg-gray-300'}`}></div>
                      <div className="min-w-0">
                        <p className="text-[13px] text-gray-800 leading-snug line-clamp-2">{notif.message}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{new Date(notif.created_at).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 text-[13px]">Không có thông báo nào</div>
              )}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
