import React from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { goBack, navigate } from '../lib/router';

/**
 * PageHeader — sticky top bar with title, subtitle, and an actions slot.
 *
 * Always renders a back button on the left unless the caller explicitly opts
 * out via `showBack={false}`. If `backTo` is provided we navigate there;
 * otherwise we pop browser history. A logout button is rendered alongside
 * actions whenever `showLogout` is true.
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
  showBack = true,
  backTo,
  onLogout,
  showLogout = false,
}) {
  const handleBack = () => {
    if (backTo) navigate(backTo);
    else goBack('/');
  };

  return (
    <header className="h-16 border-b border-divider px-6 flex items-center justify-between bg-surface sticky top-0 z-30 gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Quay lại"
            title="Quay lại"
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border border-divider text-body hover:text-heading hover:bg-base transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={1.8} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-tight text-heading truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {showLogout && onLogout && (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="shrink-0 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-divider text-body hover:text-red-600 hover:border-red-200 hover:bg-red-50 text-xs font-semibold transition-colors"
          >
            <LogOut size={14} strokeWidth={1.8} />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        )}
      </div>
    </header>
  );
}