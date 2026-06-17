import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldAlert, 
  ArrowLeft, 
  RefreshCw, 
  Search, 
  AlertOctagon, 
  CheckCircle2, 
  HelpCircle,
  Clock,
  Filter
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/api/admin/audit-logs`);
      setLogs(response.data || []);
    } catch (err) {
      console.error(err);
      setError('Không thể tải nhật ký kiểm toán hệ thống. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            SUCCESS
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/20 shadow-sm shadow-rose-500/5 animate-pulse">
            <AlertOctagon className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      case 'ROLLED_BACK':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <HelpCircle className="w-3.5 h-3.5" />
            ROLLED_BACK
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return 'Hôm qua';
    return date.toLocaleString('vi-VN', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.error_message && log.error_message.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.audit_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-[1400px] mx-auto p-6 md:p-10 relative">
        
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.location.pathname = '/admin/dashboard'}
              className="p-3 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-all duration-200 cursor-pointer shadow-md flex items-center justify-center"
              title="Quay lại Admin Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
                  <ShieldAlert className="w-5 h-5" />
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Nhật Ký Kiểm Toán (Audit Logs)
                </h1>
              </div>
              <p className="text-slate-400 text-xs mt-1.5">
                Giám sát bảo mật, lịch sử giao dịch và lỗi hệ thống (Phân vùng theo tháng)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-850 disabled:bg-slate-900/40 text-slate-200 hover:text-white border border-slate-800 hover:border-slate-700 rounded-xl font-semibold transition-all duration-200 cursor-pointer disabled:cursor-not-allowed shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              Làm mới
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-8 p-4 bg-rose-950/40 border border-rose-900/50 rounded-2xl flex items-center gap-3.5 text-rose-200 shadow-lg animate-fadeIn">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Controls Card */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-850 rounded-2xl p-6 mb-8 shadow-xl flex flex-col md:flex-row gap-5 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm theo Action, Error Message hoặc ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-indigo-500/50 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none transition-all duration-300"
            />
          </div>

          {/* Status Filter Tab-like buttons */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-950 border border-slate-850 rounded-xl w-full md:w-auto overflow-x-auto">
            <span className="text-xs text-slate-500 px-2.5 font-bold uppercase hidden lg:inline-block">Trạng thái:</span>
            {['ALL', 'SUCCESS', 'FAILED', 'ROLLED_BACK'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {status === 'ALL' ? 'TẤT CẢ' : status}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Logs Table */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
              </div>
              <p className="text-slate-400 text-sm font-medium animate-pulse">Đang tải nhật ký kiểm toán...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center gap-3">
              <ShieldAlert className="w-12 h-12 text-slate-700" />
              <p className="text-base font-semibold">Không tìm thấy nhật ký kiểm toán phù hợp</p>
              <p className="text-xs text-slate-600">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 text-xs font-extrabold uppercase bg-slate-950/60 tracking-wider">
                    <th className="p-5 w-[14%]">Audit ID</th>
                    <th className="p-5 w-[18%]">Hành động (Action)</th>
                    <th className="p-5 w-[15%]">Trạng thái (Status)</th>
                    <th className="p-5 w-[38%]">Chi tiết lỗi (Error Message)</th>
                    <th className="p-5 w-[15%]">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredLogs.map((log) => {
                    const isFailed = log.status === 'FAILED';
                    return (
                      <tr 
                        key={log.audit_id} 
                        className={`transition-colors duration-250 ${
                          isFailed 
                            ? 'bg-rose-950/10 hover:bg-rose-950/15 border-l-4 border-l-rose-500' 
                            : 'hover:bg-slate-800/10'
                        }`}
                      >
                        {/* Audit ID */}
                        <td className="p-5 font-mono text-[11px] text-slate-400 select-all">
                          {log.audit_id.slice(0, 8)}...
                        </td>

                        {/* Action */}
                        <td className="p-5">
                          <span className="font-semibold text-slate-200 text-sm tracking-wide bg-slate-800/50 px-2.5 py-1 rounded-lg border border-slate-750">
                            {log.action}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-5">
                          {getStatusBadge(log.status)}
                        </td>

                        {/* Error Message */}
                        <td className="p-5 text-sm">
                          {log.error_message ? (
                            <span className="text-rose-300 font-mono bg-rose-950/25 border border-rose-900/30 px-3 py-1.5 rounded-lg block max-w-xl truncate" title={log.error_message}>
                              {log.error_message}
                            </span>
                          ) : (
                            <span className="text-slate-600 font-medium italic">-</span>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="p-5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
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
        </div>
      </div>
    </div>
  );
}
