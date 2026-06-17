import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8081';

const LogoIcon = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 40 40" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="36" rx="10" fill="currentColor" className="text-gray-900"/>
    <path d="M12 14 L20 10 L28 14 L28 22 L20 26 L12 22 Z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    <circle cx="20" cy="18" r="3" fill="white"/>
  </svg>
);

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/admin-login`, {
        username: username.trim(),
        password,
      });
      const { session_key, user, message } = response.data;
      localStorage.setItem('session_key', session_key);
      localStorage.setItem('admin_user', JSON.stringify(user));
      localStorage.setItem('role_name', user.role_name);
      setSuccess(message || 'Đăng nhập thành công');
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      const target = redirect || (user.role_name === 'TEACHER' ? '/teacher/dashboard'
        : user.role_name === 'STUDENT' ? '/student/dashboard'
        : '/admin/dashboard');
      setTimeout(() => { window.location.href = target; }, 800);
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể kết nối tới máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 flex">
      {/* LEFT — Form */}
      <div className="w-full lg:w-[480px] flex flex-col p-8 lg:p-12 justify-between min-h-screen">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.location.href = '/'}>
          <LogoIcon className="w-7 h-7" />
          <span className="text-base font-semibold tracking-tight">SignLearn</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="my-auto w-full max-w-sm"
        >
          <h1 className="text-[32px] font-semibold tracking-[-0.03em] leading-tight mb-2">
            Chào mừng trở lại.
          </h1>
          <p className="text-[14px] text-gray-500 mb-10">
            Đăng nhập để tiếp tục quản trị hệ thống.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Tài khoản
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
                disabled={loading}
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 px-3.5 py-3 rounded-xl text-[12.5px]"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} />
                <span>{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-2 bg-green-50 border border-green-100 text-green-700 px-3.5 py-3 rounded-xl text-[12.5px]"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} />
                <span>{success}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white text-[14px] font-medium py-3 rounded-full transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  Đăng nhập
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-3">
              Truy cập nhanh
            </p>
            <div className="flex gap-2">
              <button onClick={() => window.location.href = '/student/dashboard'} className="text-[12px] text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-full px-3.5 py-1.5 transition-all">
                Học viên
              </button>
              <button onClick={() => window.location.href = '/teacher/dashboard'} className="text-[12px] text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-full px-3.5 py-1.5 transition-all">
                Giáo viên
              </button>
              <button onClick={() => window.location.href = '/'} className="text-[12px] text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-full px-3.5 py-1.5 transition-all">
                Trang chủ
              </button>
            </div>
          </div>
        </motion.div>

        <p className="text-[11px] text-gray-400">
          © {new Date().getFullYear()} SignLearn
        </p>
      </div>

      {/* RIGHT — Visual */}
      <div className="hidden lg:flex flex-1 bg-gray-50 border-l border-gray-200 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,0,0.03),transparent_70%)]"></div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative max-w-md"
        >
          <div className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mb-4 font-medium">Bảng điều khiển</div>
          <h2 className="text-[40px] font-semibold tracking-[-0.03em] leading-[1.1] text-gray-900 mb-4">
            Quản lý hệ thống<br />học tập của bạn.
          </h2>
          <p className="text-[15px] text-gray-500 mb-12 leading-relaxed">
            Theo dõi giao dịch, quản lý người dùng, và phân tích doanh thu trong một giao diện duy nhất.
          </p>

          <div className="space-y-3">
            {[
              { label: 'Tổng học viên', value: '18,432' },
              { label: 'Khóa học đang hoạt động', value: '32' },
              { label: 'Doanh thu tháng này', value: '₫284M' },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-4">
                <span className="text-[13px] text-gray-600">{m.label}</span>
                <span className="text-[15px] font-semibold tracking-tight text-gray-900">{m.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
