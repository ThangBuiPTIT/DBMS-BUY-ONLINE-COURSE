import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, RefreshCw, Search, AlertOctagon,
  CheckCircle2, HelpCircle, Clock, ArrowLeft
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { Card, Badge, PrimaryButton, GhostButton } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import { navigate } from '../lib/router';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'SUCCESS', label: 'SUCCESS' },
  { value: 'FAILED', label: 'FAILED' },
  { value: 'ROLLED_BACK', label: 'ROLLED_BACK' },
];

const STATUS_BADGES = {
  SUCCESS: { color: 'success', icon: <CheckCircle2 size={12} strokeWidth={2.5} /> },
  FAILED:  { color: 'danger',  icon: <AlertOctagon size={12} strokeWidth={2.5} /> },
  ROLLED_BACK: { color: 'warning', icon: <HelpCircle size={12} strokeWidth={2.5} /> },
};

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays === 1) return 'Hôm qua';
  return date.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('admin_user');
    const sessionKey = localStorage.getItem('session_key');
    if (!sessionKey || !savedUser) { navigate('/'); return; }
    setAdmin(JSON.parse(savedUser));
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/api/admin/audit-logs');
      setLogs(response.data || []);
    } catch (err) {
      setError('Không thể tải nhật ký kiểm toán hệ thống. Vui lòng thử lại sau.');
    } finally { setLoading(false); }
  };

  const filteredLogs = logs.filter((log) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q ||
      log.action?.toLowerCase().includes(q) ||
      (log.error_message && log.error_message.toLowerCase().includes(q)) ||
      log.audit_id?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <AppLayout
      role="admin"
      currentPath="/admin/audit-logs"
      title="Nhật ký kiểm toán"
      subtitle="Giám sát bảo mật, lịch sử giao dịch và lỗi hệ thống"
      user={admin}
      onLogout={() => {
        localStorage.removeItem('session_key');
        localStorage.removeItem('admin_user');
        localStorage.removeItem('role_name');
        window.dispatchEvent(new Event('auth-change'));
        navigate('/');
      }}
      actions={
        <GhostButton
          size="sm"
          icon={<ArrowLeft size={14} strokeWidth={1.8} />}
          onClick={() => navigate('/admin/dashboard')}
        >
          Quay lại Dashboard
        </GhostButton>
      }
    >
      <div className="p-8 max-w-[1400px] mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700">
            <AlertOctagon className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <Card padding="p-5" className="mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Tìm theo Action, Error Message hoặc ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-surface border border-divider focus:border-primary rounded-xl text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-base border border-divider rounded-xl w-full md:w-auto overflow-x-auto">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    statusFilter === s.value ? 'bg-primary text-white' : 'text-body hover:text-heading hover:bg-surface'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <PrimaryButton
              size="sm"
              icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              onClick={fetchLogs}
              disabled={loading}
            >
              Làm mới
            </PrimaryButton>
          </div>
        </Card>

        <Card padding="p-0">
          {loading ? (
            <LoadingSpinner label="Đang tải nhật ký..." />
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon={<ShieldAlert className="w-10 h-10 text-muted" />}
              title="Không tìm thấy nhật ký phù hợp"
              message="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-divider text-muted text-[11px] font-bold uppercase bg-base tracking-wider">
                    <th className="px-5 py-3">Audit ID</th>
                    <th className="px-5 py-3">Hành động</th>
                    <th className="px-5 py-3">Trạng thái</th>
                    <th className="px-5 py-3">Chi tiết lỗi</th>
                    <th className="px-5 py-3">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const isFailed = log.status === 'FAILED';
                    const cfg = STATUS_BADGES[log.status] || { color: 'muted', icon: null };
                    return (
                      <tr
                        key={log.audit_id}
                        className={`border-b border-divider last:border-0 transition-colors ${
                          isFailed ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-base/60'
                        }`}
                      >
                        <td className="px-5 py-4 font-mono text-xs text-muted">{log.audit_id?.slice(0, 8)}...</td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-heading text-sm bg-base px-2.5 py-1 rounded-lg border border-divider">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Badge color={cfg.color}>
                            <span className="inline-flex items-center gap-1.5">
                              {cfg.icon}
                              {log.status}
                            </span>
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {log.error_message ? (
                            <span className="text-red-700 font-mono bg-red-50 border border-red-200 px-3 py-1 rounded-lg inline-block max-w-xl truncate" title={log.error_message}>
                              {log.error_message}
                            </span>
                          ) : (
                            <span className="text-muted italic">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-xs text-body">
                            <Clock className="w-3.5 h-3.5 text-muted" />
                            <span>{formatRelativeTime(log.created_at)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
