import React from 'react';
import Sidebar from './Sidebar';
import PageHeader from './PageHeader';
import Toast from './Toast';
import { useAuth } from '../hooks/useAuth';

/**
 * AppLayout renders the persistent shell (sidebar + topbar + main + toast).
 *
 * Header now carries two built-in affordances so individual pages don't have
 * to remember to wire them up:
 *   - "Quay lại" button on the left of the title when `showBack` is true
 *     (or when the current path isn't the user's role dashboard).
 *   - "Đăng xuất" button on the right whenever a session is present.
 */
export default function AppLayout({
  role = 'student',
  currentPath = '',
  title,
  subtitle,
  actions,
  user,
  onLogout,
  primaryItems,
  primaryLabel,
  toast,
  onToastClose,
  showBack,
  backTo,
  children,
}) {
  const { user: authUser, logout } = useAuth();
  const resolvedUser = user || authUser;
  const resolvedLogout = onLogout || logout;

  return (
    <div className="min-h-screen bg-base text-body flex">
      <Sidebar
        role={role}
        currentPath={currentPath}
        user={resolvedUser}
        onLogout={resolvedLogout}
        primaryItems={primaryItems}
        primaryLabel={primaryLabel}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={actions}
          showBack={showBack}
          backTo={backTo}
          onLogout={resolvedLogout}
          showLogout={Boolean(resolvedLogout && resolvedUser)}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      <Toast
        show={toast?.show}
        message={toast?.message}
        type={toast?.type}
        onClose={onToastClose}
      />
    </div>
  );
}