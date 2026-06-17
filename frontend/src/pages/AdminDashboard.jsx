import React, { useEffect, useState } from 'react';
import { Activity, Database, ShieldCheck, Mail, User } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { Card, StatCard, Badge } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import { api } from '../api/client';
import { navigate } from '../lib/router';

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('admin_user');
    const sessionKey = localStorage.getItem('session_key');
    if (!sessionKey || !savedUser) { navigate('/'); return; }
    setAdmin(JSON.parse(savedUser));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('session_key');
    localStorage.removeItem('admin_user');
    window.dispatchEvent(new Event('auth-change'));
    navigate('/');
  };

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <LoadingSpinner label="Đang tải dữ liệu..." />
      </div>
    );
  }

  const TABLE_LIST = [
    { name: 'users', label: 'Người dùng' },
    { name: 'roles', label: 'Vai trò' },
    { name: 'authentication_sessions', label: 'Phiên đăng nhập' },
    { name: 'wallets', label: 'Ví điện tử' },
  ];

  return (
    <AppLayout
      role="admin"
      currentPath="/admin/profile"
      title={`Xin chào, ${admin.username}!`}
      subtitle="Chào mừng bạn quay trở lại trang cá nhân quản trị hệ thống."
      user={admin}
      onLogout={handleLogout}
    >
      <div className="p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-4 flex items-center gap-2">
              <User size={14} strokeWidth={1.8} />
              Thông tin cá nhân
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-muted block mb-0.5">ID Tài khoản</span>
                <span className="text-xs font-mono text-body break-all bg-base px-2 py-1 rounded inline-block">{admin.user_id}</span>
              </div>
              <div>
                <span className="text-xs text-muted block mb-0.5">Email</span>
                <span className="text-sm text-heading font-semibold">{admin.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-xs text-muted block mb-0.5">Vai trò</span>
                <Badge color="primary">{admin.role_name}</Badge>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-4 flex items-center gap-2">
              <Activity size={14} strokeWidth={1.8} />
              Trạng thái hệ thống
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-muted block mb-0.5">Kết nối DB</span>
                <span className="text-sm font-semibold text-emerald-600 flex items-center gap-2 mt-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  Đang hoạt động
                </span>
              </div>
              <div>
                <span className="text-xs text-muted block mb-0.5">Phiên làm việc</span>
                <span className="text-sm text-heading font-semibold">24 giờ (hết hạn ngày mai)</span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-4 flex items-center gap-2">
              <Database size={14} strokeWidth={1.8} />
              Thống kê cơ sở dữ liệu
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm py-1.5 border-b border-divider">
                <span className="text-body">Bảng dữ liệu</span>
                <span className="font-bold text-heading">18 bảng</span>
              </div>
              <div className="flex justify-between items-center text-sm py-1.5 border-b border-divider">
                <span className="text-body">Triggers</span>
                <Badge color="success">Hoạt động</Badge>
              </div>
              <div className="flex justify-between items-center text-sm py-1.5">
                <span className="text-body">Procedures</span>
                <Badge color="success">Sẵn sàng</Badge>
              </div>
            </div>
          </Card>
        </div>

        <Card padding="p-6">
          <h3 className="text-base font-bold text-heading mb-4 flex items-center gap-2">
            <ShieldCheck size={18} strokeWidth={1.8} className="text-primary" />
            Quản lý bảng hệ thống
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TABLE_LIST.map((table) => (
              <div key={table.name} className="bg-base p-4 rounded-xl border border-divider hover:border-primary/40 transition-colors">
                <div className="text-primary font-semibold font-mono text-sm">{table.name}</div>
                <div className="text-xs text-muted mt-1">{table.label}</div>
                <Badge color="success" size="sm">Hoạt động</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
