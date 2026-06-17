import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Receipt, BarChart3, ShoppingBag,
  Users, Trophy, LogOut, ArrowRight, Wallet,
  TrendingUp, Activity, CheckCircle2, AlertCircle, X, ShieldAlert,
  Search, BookOpen, ShieldCheck, Home
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8081';

const LogoIcon = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 40 40" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="36" rx="10" fill="currentColor" className="text-gray-900"/>
    <path d="M12 14 L20 10 L28 14 L28 22 L20 26 L12 22 Z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    <circle cx="20" cy="18" r="3" fill="white"/>
  </svg>
);

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [admin, setAdmin] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [revenueData, setRevenueData] = useState([]);
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTarget, setBanTarget] = useState({ userId: '', userName: '' });
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    const savedUser = localStorage.getItem('admin_user');
    const sessionKey = localStorage.getItem('session_key');
    if (!sessionKey || !savedUser) {
      window.location.href = '/admin/login';
      return;
    }
    setAdmin(JSON.parse(savedUser));
  }, []);

  useEffect(() => { fetchTransactions(); }, [limit, offset]);
  useEffect(() => { fetchRevenue(); }, []);

  const showNotification = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/transactions?limit=${limit}&offset=${offset}`);
      setTransactions(res.data.transactions || []);
      setTotalCount(res.data.total_count || 0);
    } catch (err) {
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
      fetchTransactions();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Có lỗi xảy ra khi khóa tài khoản';
      showNotification(errMsg, 'error');
    } finally {
      setBanning(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('session_key');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('role_name');
    window.location.href = '/admin/login';
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const formatDate = (dateStr) => {
    try { return new Date(dateStr).toLocaleString('vi-VN'); } catch (e) { return dateStr; }
  };

  const totalRevenue = revenueData.reduce((acc, curr) => acc + curr.total_revenue, 0);
  const totalSales = revenueData.reduce((acc, curr) => acc + curr.total_sales_count, 0);

  const navItems = [
    { id: 'overview', name: 'Tổng quan', icon: LayoutDashboard },
    { id: 'transactions', name: 'Giao dịch', icon: Receipt },
    { id: 'revenue', name: 'Doanh thu', icon: BarChart3 },
  ];

  const externalLinks = [
    { name: 'Trang chủ', path: '/', icon: Home },
    { name: 'Học viên', path: '/student/dashboard', icon: Users },
    { name: 'Giáo viên', path: '/teacher/dashboard', icon: Trophy },
    { name: 'Cửa hàng', path: '/store', icon: ShoppingBag },
    { name: 'Audit Logs', path: '/admin/audit-logs', icon: Activity },
  ];

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-900 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin"></div>
          <p className="text-gray-500 text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex">
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-[100]"
          >
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border text-[13px] font-medium ${
              toast.type === 'success' ? 'bg-white border-gray-200 text-gray-900' : 'bg-white border-red-100 text-red-600'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 size={16} className="text-green-600" /> : <AlertCircle size={16} />}
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="h-14 px-5 border-b border-gray-200 flex items-center gap-2.5">
          <LogoIcon className="w-7 h-7" />
          <div>
            <div className="text-[14px] font-semibold tracking-tight leading-none">SignLearn</div>
            <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">Admin</div>
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
            <div className="h-8 w-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-semibold text-[13px] uppercase">
              {admin.username[0]}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-[13px] font-medium truncate">{admin.username}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{admin.role_name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-[12.5px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut size={14} strokeWidth={1.5} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gray-200 px-8 flex items-center justify-between bg-white sticky top-0 z-40">
          <h1 className="text-[15px] font-semibold tracking-tight">
            {activeTab === 'overview' && 'Tổng quan'}
            {activeTab === 'transactions' && 'Giao dịch'}
            {activeTab === 'revenue' && 'Doanh thu khóa học'}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = '/admin/audit-logs'}
              className="text-[13px] font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert size={14} strokeWidth={1.5} />
              Audit Logs
            </button>
            {admin && <NotificationBell userId={admin.user_id} />}
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'overview' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 max-w-6xl">
              <div>
                <h2 className="text-[24px] font-semibold tracking-tight">Chào mừng trở lại, {admin.username}</h2>
                <p className="text-[14px] text-gray-500 mt-1">Tổng quan hoạt động hệ thống hôm nay.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Tổng doanh thu', value: formatCurrency(totalRevenue), icon: Wallet },
                  { label: 'Lượt bán', value: totalSales, icon: ShoppingBag },
                  { label: 'Giao dịch', value: totalCount, icon: Activity },
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
                <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-[15px] font-semibold">Giao dịch gần đây</h3>
                  <button onClick={() => setActiveTab('transactions')} className="text-[12px] font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1 cursor-pointer">
                    Xem tất cả <ArrowRight size={12} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                        <th className="px-6 py-3 font-medium">Mã</th>
                        <th className="px-6 py-3 font-medium">Thời gian</th>
                        <th className="px-6 py-3 font-medium text-right">Số tiền</th>
                        <th className="px-6 py-3 font-medium">Trạng thái</th>
                        <th className="px-6 py-3 font-medium">Người gửi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 5).map((t) => (
                        <tr key={t.transaction_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-6 py-4 font-mono text-gray-700">{t.transaction_id.substring(0, 8)}</td>
                          <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(t.created_at)}</td>
                          <td className="px-6 py-4 text-right font-medium">{formatCurrency(t.amount)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                              t.status === 'SUCCESS' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-900">{t.sender_name}</td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr><td colSpan="5" className="py-12 text-center text-gray-400 text-[13px]">Không có dữ liệu</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'transactions' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4 max-w-6xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[24px] font-semibold tracking-tight">Giao dịch</h2>
                  <p className="text-[13px] text-gray-500 mt-1">{totalCount} giao dịch tổng cộng</p>
                </div>
                <select
                  value={limit}
                  onChange={(e) => { setLimit(parseInt(e.target.value)); setOffset(0); }}
                  className="text-[13px] border border-gray-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer"
                >
                  {[5, 10, 20, 50].map((v) => <option key={v} value={v}>{v} dòng</option>)}
                </select>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {loadingTransactions ? (
                  <div className="py-24 flex justify-center">
                    <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin"></div>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50/50">
                            <th className="px-6 py-3 font-medium">Mã GD</th>
                            <th className="px-6 py-3 font-medium">Thời gian</th>
                            <th className="px-6 py-3 font-medium text-right">Số tiền</th>
                            <th className="px-6 py-3 font-medium">Trạng thái</th>
                            <th className="px-6 py-3 font-medium">Người gửi → Nhận</th>
                            <th className="px-6 py-3 font-medium text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((t) => (
                            <tr key={t.transaction_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                              <td className="px-6 py-4 font-mono text-gray-700">{t.transaction_id.substring(0, 8)}</td>
                              <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(t.created_at)}</td>
                              <td className="px-6 py-4 text-right font-medium">{formatCurrency(t.amount)}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                                  t.status === 'SUCCESS' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                }`}>
                                  {t.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-gray-900">{t.sender_name} → {t.receiver_name}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-1">
                                  {t.sender_id && (
                                    <button onClick={() => handleOpenBanModal(t.sender_id, t.sender_name)} className="text-[11px] text-red-600 hover:bg-red-50 px-2 py-1 rounded-md cursor-pointer">
                                      Khóa gửi
                                    </button>
                                  )}
                                  {t.receiver_id && (
                                    <button onClick={() => handleOpenBanModal(t.receiver_id, t.receiver_name)} className="text-[11px] text-red-600 hover:bg-red-50 px-2 py-1 rounded-md cursor-pointer">
                                      Khóa nhận
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {transactions.length === 0 && (
                            <tr><td colSpan="6" className="py-12 text-center text-gray-400 text-[13px]">Không có giao dịch</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50">
                      <span className="text-[12px] text-gray-500">
                        {offset + 1}–{Math.min(offset + limit, totalCount)} / {totalCount}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 cursor-pointer">
                          Trang trước
                        </button>
                        <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= totalCount} className="text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 cursor-pointer">
                          Trang sau
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'revenue' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4 max-w-6xl">
              <div>
                <h2 className="text-[24px] font-semibold tracking-tight">Doanh thu khóa học</h2>
                <p className="text-[13px] text-gray-500 mt-1">Phân tích hiệu suất bán hàng.</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {loadingRevenue ? (
                  <div className="py-24 flex justify-center">
                    <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin"></div>
                  </div>
                ) : (
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50/50">
                        <th className="px-6 py-3 font-medium">Khóa học</th>
                        <th className="px-6 py-3 font-medium text-right">Giá</th>
                        <th className="px-6 py-3 font-medium text-center">Lượt bán</th>
                        <th className="px-6 py-3 font-medium text-right">Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueData.map((r) => (
                        <tr key={r.course_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{r.title}</td>
                          <td className="px-6 py-4 text-right text-gray-700">{formatCurrency(r.price)}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center bg-gray-100 text-gray-900 px-2.5 py-0.5 rounded-full font-medium">
                              {r.total_sales_count}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-gray-900">{formatCurrency(r.total_revenue)}</td>
                        </tr>
                      ))}
                      {revenueData.length === 0 && (
                        <tr><td colSpan="4" className="py-12 text-center text-gray-400 text-[13px]">Chưa có dữ liệu</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {showBanModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-gray-200 w-full max-w-md rounded-2xl p-6 shadow-xl"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-[17px] font-semibold tracking-tight">Khóa tài khoản</h3>
                <button onClick={() => setShowBanModal(false)} className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 p-1.5 rounded-lg cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleBanUserSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1.5 font-medium">User ID</label>
                  <input type="text" readOnly value={banTarget.userId} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[12.5px] text-gray-500 font-mono" />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1.5 font-medium">Tên</label>
                  <input type="text" readOnly value={banTarget.userName} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] font-medium" />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1.5 font-medium">Lý do khóa</label>
                  <textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    rows={3}
                    placeholder="Nhập lý do..."
                    className="w-full bg-white border border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none resize-none"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-3">
                  <button type="button" onClick={() => setShowBanModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg text-[13px] font-medium cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" disabled={banning} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-[13px] font-medium cursor-pointer disabled:opacity-50">
                    {banning ? 'Đang xử lý...' : 'Xác nhận khóa'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
