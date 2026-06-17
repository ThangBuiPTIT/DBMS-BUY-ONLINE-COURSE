import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, AlertCircle, Mail, TrendingUp, AlertTriangle } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { Card, Badge, GhostButton } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import { useDebounce } from '../hooks/useDebounce';

const STATUS_STYLES = {
  'Hoàn thành': { color: 'success' },
  'Đang học':   { color: 'primary' },
  'default':     { color: 'muted' },
};

const formatDate = (dateString) => {
  if (!dateString) return 'Chưa có thông tin';
  try {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateString; }
};

const NAV_ITEMS = [
  { id: 'progress', label: 'Tiến độ học tập',  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /> },
  { id: 'inactive', label: 'Cảnh báo rủi ro',  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01M12 3l9 16H3L12 3z" /> },
];

export default function StudentManagementPage() {
  const [activeTab, setActiveTab] = useState('progress');
  const [progressData, setProgressData] = useState([]);
  const [inactiveData, setInactiveData] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  useEffect(() => { fetchInitialData(); }, []);

  useEffect(() => {
    if (debouncedSearchQuery.trim()) handleSearch(debouncedSearchQuery);
    else setSearchResults([]);
  }, [debouncedSearchQuery]);

  const fetchInitialData = async () => {
    setLoading(true); setError('');
    try {
      const [progressRes, inactiveRes] = await Promise.all([
        api.get('/api/students/progress'),
        api.get('/api/students/inactive'),
      ]);
      setProgressData(progressRes.data || []);
      setInactiveData(inactiveRes.data || []);
    } catch {
      setError('Lỗi khi tải dữ liệu học viên. Vui lòng thử lại sau.');
    } finally { setLoading(false); }
  };

  const handleSearch = async (query) => {
    try {
      const res = await api.get(`/api/students/search?keyword=${encodeURIComponent(query)}`);
      setSearchResults(res.data || []);
    } catch { /* silent */ }
  };

  const sendReminderEmail = (studentName, courseTitle) => {
    setToast({ show: true, message: `Đã gửi email nhắc nhở học tập đến học viên: ${studentName} (${courseTitle})`, type: 'success' });
  };

  const primaryItems = NAV_ITEMS.map((item) => ({
    id: item.id, label: item.label, icon: item.icon,
    active: activeTab === item.id && !searchQuery,
    onClick: () => { setActiveTab(item.id); setSearchQuery(''); },
  }));

  return (
    <AppLayout
      role="student"
      currentPath="/students/manage"
      title="Quản lý học viên"
      subtitle="Theo dõi tiến độ và hoạt động"
      primaryItems={primaryItems}
      primaryLabel="Báo cáo"
      toast={toast}
      onToastClose={() => setToast({ show: false, message: '', type: 'success' })}
      actions={
        <GhostButton
          size="sm"
          icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
          onClick={fetchInitialData}
        >
          Làm mới
        </GhostButton>
      }
    >
      <div className="p-8 max-w-[1600px] w-full mx-auto">
        <Card padding="p-4" className="mb-6">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Tìm kiếm nhanh học viên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-surface border border-divider focus:border-primary rounded-xl text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>
            {searchQuery && (
              <span className="text-xs text-muted">
                Tìm thấy <span className="font-bold text-primary">{searchResults.length}</span> học viên
              </span>
            )}
          </div>
        </Card>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {loading ? (
          <LoadingSpinner label="Đang tải dữ liệu học viên..." />
        ) : searchQuery ? (
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-divider">
              <h2 className="text-lg font-bold text-heading">Kết quả tìm kiếm: &ldquo;{searchQuery}&rdquo;</h2>
            </div>
            {searchResults.length === 0 ? (
              <Card>
                <EmptyState title="Không tìm thấy học viên" message="Thử từ khóa khác." />
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.map((student) => (
                  <Card key={student.student_id} className="hover:border-primary/40 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-base text-heading">{student.full_name}</h3>
                        <p className="text-xs text-muted mt-1">@{student.username}</p>
                      </div>
                      <Badge color="primary">{student.grade_level || 'Học viên'}</Badge>
                    </div>
                    <div className="space-y-1.5 text-sm text-body">
                      <p><span className="font-semibold text-heading">Trường:</span> {student.school_name || 'Chưa cập nhật'}</p>
                      <p><span className="font-semibold text-heading">Ngày tham gia:</span> {formatDate(student.created_at)}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {activeTab === 'progress' && (
              <Card padding="p-0">
                <div className="px-6 py-5 border-b border-divider flex justify-between items-center">
                  <h3 className="text-base font-bold text-heading flex items-center gap-2">
                    <TrendingUp size={18} strokeWidth={1.8} className="text-primary" />
                    Tiến độ học tập
                  </h3>
                  <Badge color="primary">{progressData.length} lượt đăng ký</Badge>
                </div>
                {progressData.length === 0 ? (
                  <EmptyState title="Không có dữ liệu tiến độ" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-divider text-muted text-[11px] font-bold uppercase bg-base tracking-wider">
                          <th className="px-5 py-3">Học viên</th>
                          <th className="px-5 py-3">Trường học</th>
                          <th className="px-5 py-3">Khóa học</th>
                          <th className="px-5 py-3">Tiến độ</th>
                          <th className="px-5 py-3 text-center">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progressData.map((s, idx) => {
                          const cfg = STATUS_STYLES[s.learning_status] || STATUS_STYLES.default;
                          return (
                            <tr key={idx} className="border-b border-divider last:border-0 hover:bg-base/60">
                              <td className="px-5 py-4">
                                <div className="font-semibold text-heading">{s.student_name}</div>
                                <div className="text-xs text-muted mt-0.5">{s.email}</div>
                              </td>
                              <td className="px-5 py-4 text-body text-sm">{s.school_name || 'Chưa cập nhật'}</td>
                              <td className="px-5 py-4 text-heading text-sm font-semibold">{s.course_title}</td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3 w-48">
                                  <div className="flex-1 bg-base rounded-full h-2 overflow-hidden">
                                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, s.progress))}%` }} />
                                  </div>
                                  <span className="text-body text-xs font-bold shrink-0">{s.progress}%</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-center">
                                <Badge color={cfg.color}>{s.learning_status}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {activeTab === 'inactive' && (
              <Card padding="p-0">
                <div className="px-6 py-5 border-b border-divider flex justify-between items-center bg-red-50/40">
                  <h3 className="text-base font-bold text-heading flex items-center gap-2">
                    <AlertTriangle size={18} strokeWidth={1.8} className="text-red-500" />
                    Cảnh báo học viên có nguy cơ bỏ học
                  </h3>
                  <Badge color="danger">{inactiveData.length} cảnh báo</Badge>
                </div>
                {inactiveData.length === 0 ? (
                  <EmptyState icon="🎉" title="Tuyệt vời!" message="Không có học viên nào không hoạt động hơn 30 ngày." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-divider text-muted text-[11px] font-bold uppercase bg-base tracking-wider">
                          <th className="px-5 py-3">Học viên</th>
                          <th className="px-5 py-3">Số điện thoại</th>
                          <th className="px-5 py-3">Khóa học</th>
                          <th className="px-5 py-3">Ngày hoạt động cuối</th>
                          <th className="px-5 py-3 text-center">Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inactiveData.map((s) => (
                          <tr key={s.enrollment_id} className="border-b border-divider last:border-0 hover:bg-red-50/30">
                            <td className="px-5 py-4 font-semibold text-red-600">{s.full_name}</td>
                            <td className="px-5 py-4 text-body text-sm">{s.phone_number || 'Chưa cập nhật'}</td>
                            <td className="px-5 py-4 text-heading text-sm font-semibold">{s.course_title}</td>
                            <td className="px-5 py-4">
                              <div className="text-red-600 text-sm font-semibold">{formatDate(s.last_activity_date)}</div>
                              <span className="text-xs text-red-500">Không hoạt động &gt; 30 ngày</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button
                                onClick={() => sendReminderEmail(s.full_name, s.course_title)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs font-bold transition-colors"
                              >
                                <Mail size={12} strokeWidth={1.8} />
                                Gửi email nhắc nhở
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
