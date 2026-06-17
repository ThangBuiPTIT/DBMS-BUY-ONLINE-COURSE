/**
 * Shared Sidebar — same design across all pages.
 *
 * Variants:
 *  - role: which quick links to show (admin / teacher / student)
 *  - items: override nav items for page-specific primary actions
 */
import React from 'react';
import { navigate } from '../lib/router';

const COMMON_LINKS = [
  { path: '/store',                   label: 'Cửa hàng khóa học', icon: 'cart' },
  { path: '/dictionary',              label: 'Từ điển',           icon: 'book' },
  { path: '/microlearning/roadmap',   label: 'Lộ trình học',      icon: 'compass' },
  { path: '/leaderboard',             label: 'Bảng xếp hạng',     icon: 'trophy' },
  { path: '/students/manage',         label: 'Quản lý học viên',  icon: 'users' },
];

const ROLE_LINKS = {
  admin: [
    { path: '/admin/dashboard',   label: 'Admin Dashboard',     icon: 'shield' },
    { path: '/admin/audit-logs',  label: 'Audit Logs',          icon: 'activity' },
    { path: '/teacher/dashboard', label: 'Teacher Dashboard',   icon: 'teacher' },
  ],
  teacher: [
    { path: '/teacher/dashboard', label: 'Teacher Dashboard',   icon: 'teacher' },
  ],
  student: [],
};

const ICONS = {
  cart:    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />,
  book:    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
  compass: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m-6 3l6-3" />,
  trophy:  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />,
  users:   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
  shield:  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
  activity:<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />,
  teacher: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m-7-3.5L12 18l7-3.5" />,
};

const Logo = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 40 40" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="36" rx="10" fill="currentColor" className="text-primary"/>
    <path d="M12 14 L20 10 L28 14 L28 22 L20 26 L12 22 Z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    <circle cx="20" cy="18" r="3" fill="white"/>
  </svg>
);

const SidebarLink = ({ to, label, iconName, active }) => (
  <a
    href={to}
    onClick={(e) => { e.preventDefault(); navigate(to); }}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
      active
        ? 'bg-primary-light text-primary'
        : 'text-body hover:bg-base hover:text-heading'
    }`}
  >
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {ICONS[iconName] || ICONS.book}
    </svg>
    <span className="truncate">{label}</span>
  </a>
);

export default function Sidebar({ role = 'student', currentPath = '', user, onLogout, primaryItems, primaryLabel }) {
  const roleLinks = ROLE_LINKS[role] || [];

  return (
    <aside className="w-64 bg-surface border-r border-divider flex flex-col shrink-0">
      <div className="h-16 px-5 border-b border-divider flex items-center gap-2.5">
        <Logo />
        <div>
          <div className="text-[14px] font-bold tracking-tight leading-none text-heading">SignLearn</div>
          <div className="text-[10px] text-muted mt-0.5 uppercase tracking-wider">
            {role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'E-Learning'}
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {primaryItems && primaryItems.length > 0 && (
          <div>
            <p className="text-[10px] text-muted font-bold uppercase tracking-wider px-3 mb-2">
              {primaryLabel || 'Quản lý'}
            </p>
            <div className="space-y-1">
              {primaryItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left ${
                    item.active
                      ? 'bg-primary-light text-primary'
                      : 'text-body hover:bg-base hover:text-heading'
                  }`}
                >
                  {item.icon && (
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {item.icon}
                    </svg>
                  )}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {roleLinks.length > 0 && (
          <div>
            <p className="text-[10px] text-muted font-bold uppercase tracking-wider px-3 mb-2">
              Vai trò của bạn
            </p>
            <div className="space-y-1">
              {roleLinks.map((item) => (
                <SidebarLink
                  key={item.path}
                  to={item.path}
                  label={item.label}
                  iconName={item.icon}
                  active={currentPath === item.path}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] text-muted font-bold uppercase tracking-wider px-3 mb-2">
            Khám phá
          </p>
          <div className="space-y-1">
            {COMMON_LINKS.map((item) => (
              <SidebarLink
                key={item.path}
                to={item.path}
                label={item.label}
                iconName={item.icon}
                active={currentPath === item.path}
              />
            ))}
          </div>
        </div>
      </nav>

      {user && (
        <div className="p-3 border-t border-divider">
          <div className="flex items-center gap-2.5 mb-3 px-2 py-1.5">
            <div className="h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm uppercase">
              {(user.username || user.full_name || '?')[0]}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold truncate text-heading">
                {user.full_name || user.username}
              </p>
              <p className="text-[10px] text-muted uppercase tracking-wider">
                {user.role_name || role}
              </p>
            </div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-body hover:text-heading hover:bg-base py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Đăng xuất
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

export { Logo };
