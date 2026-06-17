import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Receipt, BarChart3, Wallet,
  TrendingUp, Activity, X, ShieldAlert, ArrowRight,
  ShoppingBag
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { StatCard, Card, Badge, PrimaryButton, GhostButton } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../api/client';
import NotificationBell from '../components/NotificationBell';
import { navigate } from '../lib/router';

const NAV_ITEMS = [
  { id: 'overview',     name: 'Tổng quan', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /> },
  { id: 'transactions', name: 'Giao dịch',  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /> },
  { id: 'revenue',      name: 'Doanh thu',  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /> },
];

const HEADERS_BY_TAB = {
  overview: { title: 'Tổng quan', subtitle: 'Hoạt động hệ thống' },
  transactions: { title: 'Giao dịch', subtitle: 'Theo dõi chi tiết các giao dịch' },
  revenue: { title: 'Doanh thu', subtitle: 'Phân tích hiệu suất bán hàng' },
};

const formatCurrency = (val) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
const formatDate = (s) => {
  try { return new Date(s).toLocaleString('vi-VN'); } catch { return s; }
};

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
    if (!sessionKey || !savedUser) { navigate('/'); return; }
    setAdmin(JSON.parse(savedUser));
  }, []);

  useEffect(() => { fetchTransactions(); }, [limit, offset]);
  useEffect(() => { fetchRevenue(); }, []);

  const showNotification = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const res = await api.get(`/api/admin/transactions?limit=${limit}&offset=${offset}`);
      setTransactions(res.data.transactions || []);
      setTotalCount(res.data.total_count || 0);
    } catch {
      showNotification('Không thể lấy lịch sử giao dịch', 'error');
    } finally { setLoadingTransactions(false); }
  };

  const fetchRevenue = async () => {
    setLoadingRevenue(true);
    try {
      const res = await api.get('/api/admin/revenue');
      setRevenueData(res.data || []);
    } catch {
      showNotification('Không thể lấy dữ liệu doanh thu', 'error');
    } finally { setLoadingRevenue(false); }
  };

  const handleBanSubmit = async (e) => {
    e.preventDefault();
    if (!banReason.trim()) { showNotification('Vui lòng nhập lý do khóa tài khoản', 'error'); return; }
    setBanning(true);
    try {
      await api.post('/api/admin/users/ban', { user_id: banTarget.userId, reason: banReason });
      showNotification(`Đã khóa thành công tài khoản của ${banTarget.userName}`);
      setShowBanModal(false);
      fetchTransactions();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Có lỗi xảy ra khi khóa tài khoản', 'error');
    } finally { setBanning(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('session_key');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('role_name');
    window.dispatchEvent(new Event('auth-change'));
    navigate('/');
  };

  const totalRevenue = revenueData.reduce((a, b) => a + (b.total_revenue || 0), 0);
  const totalSales = revenueData.reduce((a, b) => a + (b.total_sales_count || 0), 0);

  const primaryItems = NAV_ITEMS.map((item) => ({
    id: item.id, label: item.name, icon: item.icon,
    active: activeTab === item.id,
    onClick: () => setActiveTab(item.id),
  }));

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <LoadingSpinner label="Đang tải..." />
      </div>
    );
  }

  return (
    <AppLayout
      role="admin"
      currentPath="/admin/dashboard"
      title={HEADERS_BY_TAB[activeTab].title}
      subtitle={HEADERS_BY_TAB[activeTab].subtitle}
      primaryItems={primaryItems}
      primaryLabel="Quản lý"
      user={admin}
      onLogout={handleLogout}
      toast={toast}
      onToastClose={() => setToast({ show: false, message: '', type: 'success' })}
      actions={
        <>
          <GhostButton
            size="sm"
            icon={<ShieldAlert size={14} strokeWidth={1.8} />}
            onClick={() => navigate('/admin/audit-logs')}
          >
            Audit Logs
          </GhostButton>
          {admin && <NotificationBell userId={admin.user_id} />}
        </>
      }
    >
      <div className="p-8">
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 max-w-6xl">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-heading">Chào mừng trở lại, {admin.username}</h2>
              <p className="text-sm text-muted mt-1">Tổng quan hoạt động hệ thống hôm nay.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Tổng doanh thu" value={formatCurrency(totalRevenue)} icon={<Wallet size={16} strokeWidth={1.8} />} />
              <StatCard label="Lượt bán" value={totalSales} icon={<ShoppingBag size={16} strokeWidth={1.8} />} />
              <StatCard label="Giao dịch" value={totalCount} icon={<Activity size={16} strokeWidth={1.8} />} />
            </div>

            <Card padding="p-0">
              <div className="px-6 py-5 border-b border-divider flex justify-between items-center">
                <h3 className="text-base font-bold text-heading">Giao dịch gần đây</h3>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs font-semibold text-body hover:text-heading flex items-center gap-1"
                >
                  Xem tất cả <ArrowRight size={12} strokeWidth={1.8} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted border-b border-divider bg-base">
                      <th className="px-6 py-3 font-semibold">Mã</th>
                      <th className="px-6 py-3 font-semibold">Thời gian</th>
                      <th className="px-6 py-3 font-semibold text-right">Số tiền</th>
                      <th className="px-6 py-3 font-semibold">Trạng thái</th>
                      <th className="px-6 py-3 font-semibold">Người gửi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 5).map((t) => (
                      <tr key={t.transaction_id} className="border-b border-divider last:border-0 hover:bg-base/60">
                        <td className="px-6 py-4 font-mono text-body">{t.transaction_id?.substring(0, 8)}</td>
                        <td className="px-6 py-4 text-muted whitespace-nowrap">{formatDate(t.created_at)}</td>
                        <td className="px-6 py-4 text-right font-semibold text-heading">{formatCurrency(t.amount)}</td>
                        <td className="px-6 py-4">
                          <Badge color={t.status === 'SUCCESS' ? 'success' : 'danger'}>
                            {t.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-heading">{t.sender_name}</td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr><td colSpan="5" className="py-12 text-center text-muted">Không có dữ liệu</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === 'transactions' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4 max-w-6xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{totalCount} giao dịch tổng cộng</p>
              <select
                value={limit}
                onChange={(e) => { setLimit(parseInt(e.target.value)); setOffset(0); }}
                className="text-sm border border-divider rounded-lg px-3 py-1.5 bg-surface"
              >
                {[5, 10, 20, 50].map((v) => <option key={v} value={v}>{v} dòng</option>)}
              </select>
            </div>

            <Card padding="p-0">
              {loadingTransactions ? (
                <LoadingSpinner label="Đang tải giao dịch..." />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-muted border-b border-divider bg-base">
                          <th className="px-6 py-3 font-semibold">Mã GD</th>
                          <th className="px-6 py-3 font-semibold">Thời gian</th>
                          <th className="px-6 py-3 font-semibold text-right">Số tiền</th>
                          <th className="px-6 py-3 font-semibold">Trạng thái</th>
                          <th className="px-6 py-3 font-semibold">Người gửi → Nhận</th>
                          <th className="px-6 py-3 font-semibold text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => (
                          <tr key={t.transaction_id} className="border-b border-divider last:border-0 hover:bg-base/60">
                            <td className="px-6 py-4 font-mono text-body">{t.transaction_id?.substring(0, 8)}</td>
                            <td className="px-6 py-4 text-muted whitespace-nowrap">{formatDate(t.created_at)}</td>
                            <td className="px-6 py-4 text-right font-semibold text-heading">{formatCurrency(t.amount)}</td>
                            <td className="px-6 py-4">
                              <Badge color={t.status === 'SUCCESS' ? 'success' : 'danger'}>{t.status}</Badge>
                            </td>
                            <td className="px-6 py-4 text-heading">{t.sender_name} → {t.receiver_name}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-1">
                                {t.sender_id && (
                                  <button
                                    onClick={() => { setBanTarget({ userId: t.sender_id, userName: t.sender_name }); setBanReason(''); setShowBanModal(true); }}
                                    className="text-[11px] text-red-600 hover:bg-red-50 px-2 py-1 rounded-md font-semibold"
                                  >Khóa gửi</button>
                                )}
                                {t.receiver_id && (
                                  <button
                                    onClick={() => { setBanTarget({ userId: t.receiver_id, userName: t.receiver_name }); setBanReason(''); setShowBanModal(true); }}
                                    className="text-[11px] text-red-600 hover:bg-red-50 px-2 py-1 rounded-md font-semibold"
                                  >Khóa nhận</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {transactions.length === 0 && (
                          <tr><td colSpan="6" className="py-12 text-center text-muted">Không có giao dịch</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4 border-t border-divider bg-base">
                    <span className="text-xs text-muted">
                      {offset + 1}–{Math.min(offset + limit, totalCount)} / {totalCount}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="text-xs px-3 py-1.5 border border-divider rounded-lg hover:bg-base disabled:opacity-50">Trang trước</button>
                      <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= totalCount} className="text-xs px-3 py-1.5 border border-divider rounded-lg hover:bg-base disabled:opacity-50">Trang sau</button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </motion.div>
        )}

        {activeTab === 'revenue' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4 max-w-6xl">
            <Card padding="p-0">
              {loadingRevenue ? (
                <LoadingSpinner label="Đang tải doanh thu..." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted border-b border-divider bg-base">
                        <th className="px-6 py-3 font-semibold">Khóa học</th>
                        <th className="px-6 py-3 font-semibold text-right">Giá</th>
                        <th className="px-6 py-3 font-semibold text-center">Lượt bán</th>
                        <th className="px-6 py-3 font-semibold text-right">Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueData.map((r) => (
                        <tr key={r.course_id} className="border-b border-divider last:border-0 hover:bg-base/60">
                          <td className="px-6 py-4 font-semibold text-heading">{r.title}</td>
                          <td className="px-6 py-4 text-right text-body">{formatCurrency(r.price)}</td>
                          <td className="px-6 py-4 text-center">
                            <Badge>{r.total_sales_count}</Badge>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-heading">{formatCurrency(r.total_revenue)}</td>
                        </tr>
                      ))}
                      {revenueData.length === 0 && (
                        <tr><td colSpan="4" className="py-12 text-center text-muted">Chưa có dữ liệu</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showBanModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-surface border border-divider w-full max-w-md rounded-2xl p-6 shadow-xl"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-heading">Khóa tài khoản</h3>
                <button onClick={() => setShowBanModal(false)} className="text-muted hover:text-heading hover:bg-base p-1.5 rounded-lg">
                  <X size={18} strokeWidth={1.8} />
                </button>
              </div>
              <form onSubmit={handleBanSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5 font-semibold">User ID</label>
                  <input type="text" readOnly value={banTarget.userId} className="w-full bg-base border border-divider rounded-lg px-3 py-2.5 text-xs text-muted font-mono" />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5 font-semibold">Tên</label>
                  <input type="text" readOnly value={banTarget.userName} className="w-full bg-base border border-divider rounded-lg px-3 py-2.5 text-sm font-semibold" />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5 font-semibold">Lý do khóa</label>
                  <textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    rows={3}
                    placeholder="Nhập lý do..."
                    className="w-full bg-surface border border-divider focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-lg px-3 py-2.5 text-sm focus:outline-none resize-none"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-3">
                  <button type="button" onClick={() => setShowBanModal(false)} className="flex-1 bg-base hover:bg-divider text-body py-2.5 rounded-lg text-sm font-semibold">
                    Hủy
                  </button>
                  <button type="submit" disabled={banning} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
                    {banning ? 'Đang xử lý...' : 'Xác nhận khóa'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
