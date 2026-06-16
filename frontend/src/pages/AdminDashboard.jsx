import React, { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    // Read from localStorage
    const savedUser = localStorage.getItem('admin_user');
    const sessionKey = localStorage.getItem('session_key');

    if (!sessionKey || !savedUser) {
      // If not logged in, redirect to login page
      window.location.href = '/';
      return;
    }

    setAdmin(JSON.parse(savedUser));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('session_key');
    localStorage.removeItem('admin_user');
    window.location.href = '/';
  };

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-sans">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-t-indigo-500 border-slate-700 animate-spin"></div>
          <p className="text-slate-400 text-sm">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Navbar */}
      <nav className="bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-indigo-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.57 50.57 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A57.778 57.778 0 0 1 12 8c1.766 0 3.482.156 5.14.458V15" />
              </svg>
            </div>
            <span className="font-extrabold tracking-wider text-lg uppercase bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              E-Learning Admin
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-200">{admin.username}</div>
              <div className="text-xs text-indigo-400">{admin.role_name}</div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/40 text-red-400 px-4 py-2 rounded-xl text-xs font-semibold transition duration-150 active:scale-95"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </nav>

      {/* Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {/* Welcome Header */}
        <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-900/40 p-6 rounded-3xl border border-slate-800">
          <h2 className="text-2xl font-black text-white">Xin chào, {admin.username}!</h2>
          <p className="text-slate-400 text-sm mt-1">Chào mừng bạn quay trở lại trang cá nhân quản trị hệ thống.</p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Admin Profile Card */}
          <div className="bg-slate-900/60 backdrop-blur border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 mb-4">Thông tin cá nhân</h3>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-500 block">ID Tài khoản:</span>
                <span className="text-sm font-mono text-slate-300 break-all">{admin.user_id}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Email:</span>
                <span className="text-sm text-slate-300">{admin.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Vai trò:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mt-1">
                  {admin.role_name}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Card */}
          <div className="bg-slate-900/60 backdrop-blur border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-4">Trạng thái hệ thống</h3>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-500 block">Kết nối DB:</span>
                <span className="text-sm font-semibold text-emerald-400 flex items-center gap-2 mt-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                  Đang hoạt động
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Phiên làm việc:</span>
                <span className="text-sm text-slate-300 font-semibold">24 Giờ (Hết hạn ngày mai)</span>
              </div>
            </div>
          </div>

          {/* Database Summary Card */}
          <div className="bg-slate-900/60 backdrop-blur border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-4">Thống kê cơ sở dữ liệu</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Bảng dữ liệu đã nạp:</span>
                <span className="font-semibold text-slate-200">18 bảng</span>
              </div>
              <div className="flex justify-between items-center text-sm py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Trình kích hoạt (Triggers):</span>
                <span className="font-semibold text-slate-200">Hoạt động</span>
              </div>
              <div className="flex justify-between items-center text-sm py-1">
                <span className="text-slate-400">Thủ tục (Procedures):</span>
                <span className="font-semibold text-slate-200">Sẵn sàng</span>
              </div>
            </div>
          </div>
        </div>

        {/* Database Tables Overview */}
        <div className="bg-slate-900/40 backdrop-blur border border-slate-800/60 rounded-3xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Quản lý Bảng hệ thống</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['users', 'roles', 'authentication_sessions', 'wallets'].map((table) => (
              <div key={table} className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 hover:border-indigo-500/30 transition duration-150">
                <div className="text-indigo-400 font-semibold font-mono text-sm">{table}</div>
                <div className="text-xs text-slate-500 mt-1">Trạng thái: Hoạt động</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
