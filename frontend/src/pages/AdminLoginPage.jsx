import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, AlertCircle, CheckCircle2, Wallet, Users, BookOpen, ShieldCheck, GraduationCap, UserCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { navigate } from '../lib/router';

const Logo = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 40 40" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="36" rx="10" fill="currentColor" className="text-primary"/>
    <path d="M12 14 L20 10 L28 14 L28 22 L20 26 L12 22 Z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    <circle cx="20" cy="18" r="3" fill="white"/>
  </svg>
);

const QUICK_FACTS = [
  { label: 'Tổng học viên',        value: '18,432', icon: <Users size={16} strokeWidth={1.8} /> },
  { label: 'Khóa học hoạt động',   value: '32',     icon: <BookOpen size={16} strokeWidth={1.8} /> },
  { label: 'Doanh thu tháng này',  value: '₫284M',  icon: <Wallet size={16} strokeWidth={1.8} /> },
];

const ROLE_TABS = [
  { id: 'admin',   label: 'Quản trị',     icon: ShieldCheck,    endpoint: '/api/auth/admin-login',   placeholder: 'admin' },
  { id: 'teacher', label: 'Giáo viên',    icon: GraduationCap,  endpoint: '/api/auth/teacher-login', placeholder: 'teacher1' },
  { id: 'student', label: 'Học viên',     icon: UserCircle2,    endpoint: '/api/auth/student-login', placeholder: 'student1' },
];

const REDIRECT_BY_ROLE = {
  ADMIN:   '/admin/dashboard',
  TEACHER: '/teacher/dashboard',
  STUDENT: '/student/dashboard',
};

const PANEL_BY_ROLE = {
  admin: {
    title: 'Bảng điều khiển Quản trị',
    description: 'Theo dõi giao dịch, quản lý người dùng, và phân tích doanh thu trong một giao diện duy nhất.',
  },
  teacher: {
    title: 'Bảng điều khiển Giáo viên',
    description: 'Quản lý khóa học, theo dõi tiến độ học viên và phản hồi trong một không gian làm việc thống nhất.',
  },
  student: {
    title: 'Bảng điều khiển Học viên',
    description: 'Tiếp tục hành trình học tập, theo dõi chuỗi ngày học và khám phá từ điển ngôn ngữ ký hiệu.',
  },
};

export default function AdminLoginPage() {
  const [activeRole, setActiveRole] = useState('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentTab = ROLE_TABS.find((t) => t.id === activeRole);
  const CurrentIcon = currentTab.icon;
  const panel = PANEL_BY_ROLE[activeRole];

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!username.trim() || !password) { setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu'); return; }
    setLoading(true);
    try {
      const response = await api.post(currentTab.endpoint, { username: username.trim(), password });
      const { session_key, user, message } = response.data;
      localStorage.setItem('session_key', session_key);
      localStorage.setItem('admin_user', JSON.stringify(user));
      localStorage.setItem('role_name', user.role_name);
      window.dispatchEvent(new Event('auth-change'));
      setSuccess(message || 'Đăng nhập thành công');
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      const target = redirect || REDIRECT_BY_ROLE[user.role_name] || '/admin/dashboard';
      setTimeout(() => { window.location.assign(target); }, 800);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'Không thể kết nối tới máy chủ.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-base font-sans text-body flex">
      <div className="w-full lg:w-[480px] flex flex-col p-8 lg:p-12 justify-between min-h-screen bg-surface">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <Logo />
          <span className="text-base font-bold tracking-tight text-heading">SignLearn</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="my-auto w-full max-w-sm">
          <div className="flex items-center gap-2 mb-3">
            <CurrentIcon className="w-5 h-5 text-primary" strokeWidth={1.8} />
            <span className="text-[11px] uppercase tracking-[0.18em] text-primary font-bold">
              {currentTab.label}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-tight mb-2 text-heading">Chào mừng trở lại.</h1>
          <p className="text-sm text-muted mb-6">Đăng nhập để tiếp tục với vai trò <b>{currentTab.label.toLowerCase()}</b>.</p>

          <div className="flex gap-1 p-1 bg-base rounded-xl border border-divider mb-6">
            {ROLE_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = tab.id === activeRole;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setActiveRole(tab.id); setError(''); setSuccess(''); }}
                  className={
                    'flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-all ' +
                    (isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted hover:text-heading')
                  }
                >
                  <TabIcon className="w-3.5 h-3.5" strokeWidth={2} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-body mb-1.5">Tài khoản</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={currentTab.placeholder}
                autoComplete="username"
                className="w-full bg-surface border border-divider rounded-xl px-4 py-3 text-sm text-heading placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-body mb-1.5">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-surface border border-divider rounded-xl px-4 py-3 text-sm text-heading placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                disabled={loading}
              />
            </div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 px-3.5 py-3 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} />
                <span>{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3.5 py-3 rounded-xl text-xs">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} />
                <span>{success}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  Đăng nhập {currentTab.label.toLowerCase()}
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-divider">
            <p className="text-[11px] text-muted uppercase tracking-wider font-semibold mb-3">Tài khoản demo</p>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveRole(tab.id);
                    setUsername(tab.placeholder);
                    setPassword(tab.id === 'admin' ? 'admin123' : tab.id === 'teacher' ? 'teacher123' : 'student123');
                  }}
                  className="text-[10px] text-body hover:text-heading border border-divider hover:border-primary hover:bg-primary-light rounded-lg px-2 py-2 transition-all font-semibold leading-tight"
                >
                  <div className="text-heading">{tab.label}</div>
                  <div className="text-muted mt-0.5">{tab.placeholder}</div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        <p className="text-[11px] text-muted">© {new Date().getFullYear()} SignLearn</p>
      </div>

      <div className="hidden lg:flex flex-1 border-l border-divider items-center justify-center p-12 relative overflow-hidden bg-base">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.05),transparent_70%)]"></div>
        <motion.div key={activeRole} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative max-w-md">
          <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-bold mb-4">{currentTab.label}</div>
          <h2 className="text-4xl font-bold tracking-tight leading-[1.1] text-heading mb-4">
            {panel.title.split(' ').slice(0, -2).join(' ')}<br />{panel.title.split(' ').slice(-2).join(' ')}.
          </h2>
          <p className="text-sm text-muted mb-10 leading-relaxed">{panel.description}</p>

          {activeRole === 'admin' && (
            <div className="space-y-3">
              {QUICK_FACTS.map((m) => (
                <div key={m.label} className="flex items-center justify-between bg-surface border border-divider rounded-2xl px-5 py-4">
                  <span className="flex items-center gap-2.5 text-sm text-body">
                    <span className="text-primary">{m.icon}</span>
                    {m.label}
                  </span>
                  <span className="text-base font-bold tracking-tight text-heading">{m.value}</span>
                </div>
              ))}
            </div>
          )}

          {activeRole !== 'admin' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-surface border border-divider rounded-2xl px-5 py-4">
                <span className="flex items-center gap-2.5 text-sm text-body">
                  <CurrentIcon className="w-4 h-4 text-primary" strokeWidth={1.8} />
                  Vai trò
                </span>
                <span className="text-base font-bold tracking-tight text-heading">{currentTab.label}</span>
              </div>
              <div className="flex items-center justify-between bg-surface border border-divider rounded-2xl px-5 py-4">
                <span className="flex items-center gap-2.5 text-sm text-body">
                  <Users className="w-4 h-4 text-primary" strokeWidth={1.8} />
                  Đăng nhập
                </span>
                <span className="text-sm font-semibold tracking-tight text-heading">{currentTab.endpoint.replace('/api/auth/', '')}</span>
              </div>
              <div className="flex items-center justify-between bg-surface border border-divider rounded-2xl px-5 py-4">
                <span className="flex items-center gap-2.5 text-sm text-body">
                  <BookOpen className="w-4 h-4 text-primary" strokeWidth={1.8} />
                  Chuyển hướng sau đăng nhập
                </span>
                <span className="text-sm font-mono font-semibold tracking-tight text-heading">{REDIRECT_BY_ROLE[activeRole === 'teacher' ? 'TEACHER' : 'STUDENT']}</span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
