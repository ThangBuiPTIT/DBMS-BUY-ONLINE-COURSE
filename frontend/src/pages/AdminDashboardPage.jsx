import React, { useEffect, useState } from 'react';
import axios from 'axios';
import NotificationBell from '../components/NotificationBell';

const API_URL = 'http://localhost:8080';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'transactions', 'revenue'
  const [admin, setAdmin] = useState(null);

  // Pagination & Transactions State
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Revenue State
  const [revenueData, setRevenueData] = useState([]);
  const [loadingRevenue, setLoadingRevenue] = useState(false);

  // Ban Modal State
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTarget, setBanTarget] = useState({ userId: '', userName: '' });
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);

  // Toast State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Get Admin session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('admin_user');
    const sessionKey = localStorage.getItem('session_key');

    if (!sessionKey || !savedUser) {
      window.location.href = '/';
      return;
    }
    setAdmin(JSON.parse(savedUser));
  }, []);

  // Fetch Transactions when limit/offset changes
  useEffect(() => {
    fetchTransactions();
  }, [limit, offset]);

  // Fetch Revenue
  useEffect(() => {
    fetchRevenue();
  }, []);

  const showNotification = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/transactions?limit=${limit}&offset=${offset}`);
      setTransactions(res.data.transactions || []);
      setTotalCount(res.data.total_count || 0);
    } catch (err) {
      console.error(err);
      showNotification('Không thể lấy lịch sử giao dịch', 'error');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const fetchRevenue = async () => {
    setLoadingRevenue(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/revenue`);
      setRevenueData(res.data || []);
    } catch (err) {
      console.error(err);
      showNotification('Không thể lấy dữ liệu doanh thu', 'error');
    } finally {
      setLoadingRevenue(false);
    }
  };

  const handleOpenBanModal = (userId, userName) => {
    setBanTarget({ userId, userName });
    setBanReason('');
    setShowBanModal(true);
  };

  const handleBanUserSubmit = async (e) => {
    e.preventDefault();
    if (!banReason.trim()) {
      showNotification('Vui lòng nhập lý do khóa tài khoản', 'error');
      return;
    }

    setBanning(true);
    try {
      await axios.post(`${API_URL}/api/admin/users/ban`, {
        user_id: banTarget.userId,
        reason: banReason
      });
      showNotification(`Đã khóa thành công tài khoản của ${banTarget.userName}`);
      setShowBanModal(false);
      fetchTransactions(); // reload
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Có lỗi xảy ra khi khóa tài khoản';
      showNotification(errMsg, 'error');
    } finally {
      setBanning(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('session_key');
    localStorage.removeItem('admin_user');
    window.location.href = '/';
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('vi-VN');
    } catch (e) {
      return dateStr;
    }
  };

  const totalRevenue = revenueData.reduce((acc, curr) => acc + curr.total_revenue, 0);
  const totalSales = revenueData.reduce((acc, curr) => acc + curr.total_sales_count, 0);

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-t-indigo-500 border-slate-700 animate-spin"></div>
          <p className="text-slate-400 text-sm">Đang kết nối hệ thống...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all duration-300 transform translate-y-0 ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-indigo-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
            </svg>
          </div>
          <span className="font-extrabold tracking-wider text-base uppercase bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            E-Learning Admin
          </span>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition duration-150 ${
              activeTab === 'overview' ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            Tổng quan
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition duration-150 ${
              activeTab === 'transactions' ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
            Giám sát Giao dịch
          </button>

          <button
            onClick={() => setActiveTab('revenue')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition duration-150 ${
              activeTab === 'revenue' ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Doanh thu Khóa học
          </button>

          <button
            onClick={() => window.location.pathname = '/store'}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition duration-150 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Cửa hàng khóa học
          </button>

          <button
            onClick={() => window.location.pathname = '/students/manage'}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition duration-150 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Quản lý học viên
          </button>

          <button
            onClick={() => window.location.pathname = '/teacher/dashboard'}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition duration-150 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
            </svg>
            Teacher Dashboard
          </button>

          <button
            onClick={() => window.location.pathname = '/leaderboard'}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition duration-150 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
            </svg>
            🏆 Bảng xếp hạng
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 flex flex-col gap-3">
          <div className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 text-sm border border-indigo-500/20 uppercase">
              {admin.username[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">{admin.username}</p>
              <p className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">{admin.role_name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/35 text-red-400 py-2.5 rounded-xl text-xs font-semibold transition"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 px-8 flex justify-between items-center sticky top-0 bg-slate-950/80 backdrop-blur z-40">
          <div>
            <h1 className="text-lg font-black tracking-tight text-white capitalize">
              {activeTab === 'overview' && 'Bảng điều khiển Tổng quan'}
              {activeTab === 'transactions' && 'Lịch sử Giao dịch chi tiết'}
              {activeTab === 'revenue' && 'Báo cáo doanh thu khóa học'}
            </h1>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button
              onClick={() => window.location.pathname = '/admin/audit-logs'}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 rounded-xl font-bold cursor-pointer transition flex items-center gap-1.5"
            >
              Nhật ký kiểm toán
            </button>
            {admin && <NotificationBell userId={admin.user_id} />}
            <span className="text-slate-500">Môi trường:</span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Đang kết nối database
            </span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-grow p-8 overflow-y-auto">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900/60 backdrop-blur p-6 rounded-2xl border border-slate-800 shadow-xl">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tổng doanh thu</span>
                    <span className="text-emerald-400 bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
                      </svg>
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white">{formatCurrency(totalRevenue)}</h3>
                  <p className="text-[11px] text-slate-400 mt-2">Tổng hợp doanh thu từ tất cả các khóa học đã bán thành công.</p>
                </div>

                <div className="bg-slate-900/60 backdrop-blur p-6 rounded-2xl border border-slate-800 shadow-xl">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tổng số lượt bán</span>
                    <span className="text-indigo-400 bg-indigo-500/10 p-1.5 rounded-lg border border-indigo-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white">{totalSales} lượt</h3>
                  <p className="text-[11px] text-slate-400 mt-2">Tổng số lượt học viên đăng ký khóa học thành công trên toàn hệ thống.</p>
                </div>

                <div className="bg-slate-900/60 backdrop-blur p-6 rounded-2xl border border-slate-800 shadow-xl">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Giao dịch thành công</span>
                    <span className="text-amber-400 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0110.1 21a3.745 3.745 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0113.9 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                      </svg>
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white">{totalCount} giao dịch</h3>
                  <p className="text-[11px] text-slate-400 mt-2">Số lượng giao dịch tài chính ghi nhận trong lịch sử.</p>
                </div>
              </div>

              {/* Latest Transactions Table Panel */}
              <div className="bg-slate-900/40 backdrop-blur border border-slate-800 rounded-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-base font-bold text-white">Giao dịch gần đây</h3>
                    <p className="text-xs text-slate-500 mt-1">Danh sách 5 giao dịch tài chính mới nhất trên hệ thống.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('transactions')}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
                  >
                    Xem tất cả &rarr;
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        <th className="pb-3 pr-4">Mã GD</th>
                        <th className="pb-3 px-4">Thời gian</th>
                        <th className="pb-3 px-4 text-right">Số tiền</th>
                        <th className="pb-3 px-4 text-center">Trạng thái</th>
                        <th className="pb-3 px-4">Người gửi</th>
                        <th className="pb-3 px-4">Người nhận</th>
                        <th className="pb-3 pl-4">Lời nhắn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-xs">
                      {transactions.slice(0, 5).map((t) => (
                        <tr key={t.transaction_id} className="hover:bg-slate-900/20 transition duration-100">
                          <td className="py-3 pr-4 font-mono font-semibold text-slate-400">{t.transaction_id.substring(0, 8)}...</td>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDate(t.created_at)}</td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-200">{formatCurrency(t.amount)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{t.sender_name}</td>
                          <td className="py-3 px-4 text-slate-300">{t.receiver_name}</td>
                          <td className="py-3 pl-4 text-slate-400 truncate max-w-[200px]">{t.message}</td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan="7" className="py-8 text-center text-slate-500">
                            Không tìm thấy dữ liệu giao dịch.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSACTIONS LIST */}
          {activeTab === 'transactions' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-slate-900/40 backdrop-blur border border-slate-800 rounded-3xl p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-white">Quản lý & Giám sát Giao dịch</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Tổng số: <strong className="text-slate-300">{totalCount}</strong> giao dịch.
                    </p>
                  </div>

                  {/* Limit selection */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Số bản ghi hiển thị:</span>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(parseInt(e.target.value));
                        setOffset(0); // reset page
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
                    >
                      {[5, 10, 20, 50].map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {loadingTransactions ? (
                  <div className="py-20 flex justify-center items-center">
                    <div className="h-10 w-10 border-4 border-t-indigo-500 border-slate-800 rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                            <th className="pb-3 pr-4">Mã GD</th>
                            <th className="pb-3 px-4">Thời gian</th>
                            <th className="pb-3 px-4 text-right">Số tiền</th>
                            <th className="pb-3 px-4 text-center">Trạng thái</th>
                            <th className="pb-3 px-4">Người gửi</th>
                            <th className="pb-3 px-4">Người nhận</th>
                            <th className="pb-3 px-4">Lời nhắn</th>
                            <th className="pb-3 pl-4 text-center">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 text-xs">
                          {transactions.map((t) => (
                            <tr key={t.transaction_id} className="hover:bg-slate-900/20 transition duration-100">
                              <td className="py-4 pr-4 font-mono font-semibold text-indigo-400 whitespace-nowrap">{t.transaction_id}</td>
                              <td className="py-4 px-4 text-slate-500 whitespace-nowrap">{formatDate(t.created_at)}</td>
                              <td className="py-4 px-4 text-right font-semibold text-slate-200">{formatCurrency(t.amount)}</td>
                              <td className="py-4 px-4 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  t.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                  {t.status}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <div className="text-slate-300 font-semibold">{t.sender_name}</div>
                                {t.sender_id && <div className="text-[10px] text-slate-500 font-mono mt-0.5">{t.sender_id.substring(0, 8)}...</div>}
                              </td>
                              <td className="py-4 px-4">
                                <div className="text-slate-300 font-semibold">{t.receiver_name}</div>
                                {t.receiver_id && <div className="text-[10px] text-slate-500 font-mono mt-0.5">{t.receiver_id.substring(0, 8)}...</div>}
                              </td>
                              <td className="py-4 px-4 text-slate-400 max-w-[200px] truncate">{t.message}</td>
                              <td className="py-4 pl-4 text-center space-y-1">
                                {t.sender_id && (
                                  <button
                                    onClick={() => handleOpenBanModal(t.sender_id, t.sender_name)}
                                    className="w-full block bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/40 text-red-400 py-1.5 px-3 rounded-lg text-[10px] font-bold transition whitespace-nowrap"
                                  >
                                    Khóa người gửi
                                  </button>
                                )}
                                {t.receiver_id && (
                                  <button
                                    onClick={() => handleOpenBanModal(t.receiver_id, t.receiver_name)}
                                    className="w-full block bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 py-1.5 px-3 rounded-lg text-[10px] font-bold transition whitespace-nowrap"
                                  >
                                    Khóa người nhận
                                  </button>
                                )}
                                {!t.sender_id && !t.receiver_id && (
                                  <span className="text-[11px] text-slate-600 italic">Không khả dụng</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {transactions.length === 0 && (
                            <tr>
                              <td colSpan="8" className="py-12 text-center text-slate-500">
                                Không tìm thấy giao dịch nào.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-800">
                      <span className="text-xs text-slate-500">
                        Hiển thị từ <strong className="text-slate-300">{offset + 1}</strong> đến{' '}
                        <strong className="text-slate-300">
                          {Math.min(offset + limit, totalCount)}
                        </strong>{' '}
                        trong tổng số <strong className="text-slate-300">{totalCount}</strong> bản ghi.
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setOffset(Math.max(0, offset - limit))}
                          disabled={offset === 0}
                          className="bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-50 disabled:hover:border-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold transition duration-150"
                        >
                          Trang trước
                        </button>
                        <button
                          onClick={() => setOffset(offset + limit)}
                          disabled={offset + limit >= totalCount}
                          className="bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-50 disabled:hover:border-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold transition duration-150"
                        >
                          Trang sau
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: COURSE REVENUE */}
          {activeTab === 'revenue' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-slate-900/40 backdrop-blur border border-slate-800 rounded-3xl p-6">
                <h3 className="text-base font-bold text-white mb-6">Báo cáo Doanh thu theo khóa học</h3>

                {loadingRevenue ? (
                  <div className="py-20 flex justify-center items-center">
                    <div className="h-10 w-10 border-4 border-t-indigo-500 border-slate-800 rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Revenue statistics cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800/80 shadow-md">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-400">Doanh thu cao nhất</span>
                        <h4 className="text-lg font-black text-white mt-1">
                          {revenueData[0] ? `${revenueData[0].title} (${formatCurrency(revenueData[0].total_revenue)})` : 'Chưa có giao dịch'}
                        </h4>
                      </div>
                      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800/80 shadow-md">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">Khóa học bán chạy nhất</span>
                        <h4 className="text-lg font-black text-white mt-1">
                          {revenueData.sort((a, b) => b.total_sales_count - a.total_sales_count)[0] 
                            ? `${revenueData[0].title} (${revenueData[0].total_sales_count} lượt bán)` 
                            : 'Chưa có giao dịch'}
                        </h4>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                            <th className="pb-3 pr-4">Mã khóa học</th>
                            <th className="pb-3 px-4">Tên khóa học</th>
                            <th className="pb-3 px-4 text-right">Giá bán</th>
                            <th className="pb-3 px-4 text-center">Số lượng đã bán</th>
                            <th className="pb-3 pl-4 text-right">Tổng doanh thu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 text-xs">
                          {revenueData.map((r) => (
                            <tr key={r.course_id} className="hover:bg-slate-900/20 transition duration-100">
                              <td className="py-4 pr-4 font-mono text-slate-400">{r.course_id}</td>
                              <td className="py-4 px-4 font-bold text-slate-200">{r.title}</td>
                              <td className="py-4 px-4 text-right text-slate-300 font-semibold">{formatCurrency(r.price)}</td>
                              <td className="py-4 px-4 text-center font-bold text-indigo-400">{r.total_sales_count} lượt</td>
                              <td className="py-4 pl-4 text-right text-emerald-400 font-black">{formatCurrency(r.total_revenue)}</td>
                            </tr>
                          ))}
                          {revenueData.length === 0 && (
                            <tr>
                              <td colSpan="5" className="py-12 text-center text-slate-500">
                                Chưa ghi nhận dữ liệu doanh thu của khóa học nào.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Ban User Modal */}
      {showBanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl transform scale-100 transition-all">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                Khóa tài khoản người dùng
              </h3>
              <button 
                onClick={() => setShowBanModal(false)}
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleBanUserSubmit} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Mã người dùng (User ID):</label>
                <input
                  type="text"
                  readOnly
                  value={banTarget.userId}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-400 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tên hiển thị:</label>
                <input
                  type="text"
                  readOnly
                  value={banTarget.userName}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Lý do khóa (Reason):</label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Nhập lý do chi tiết..."
                  rows="4"
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none transition duration-150"
                  required
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBanModal(false)}
                  className="flex-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 py-3 rounded-xl text-xs font-semibold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={banning}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {banning ? 'Đang thực hiện...' : 'Xác nhận khóa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
