/**
 * Shared Card components — consistent across pages.
 */
import React from 'react';

export function Card({ children, className = '', padding = 'p-6' }) {
  return (
    <div className={`bg-surface border border-divider rounded-2xl ${padding} ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, icon, trend }) {
  return (
    <div className="bg-surface border border-divider rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-muted font-semibold uppercase tracking-wider">{label}</span>
        {icon && (
          <div className="w-9 h-9 bg-primary-light rounded-lg flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight text-heading truncate">{value}</div>
      {trend && <p className="text-xs text-muted mt-1">{trend}</p>}
    </div>
  );
}

export function Badge({ children, color = 'primary', size = 'sm' }) {
  const colors = {
    primary: 'bg-primary-light text-primary',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger:  'bg-red-50 text-red-700',
    muted:   'bg-base text-muted',
  };
  const sizes = {
    sm: 'text-[11px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
  };
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${colors[color]} ${sizes[size]}`}>
      {children}
    </span>
  );
}

export function PrimaryButton({ children, onClick, disabled, type = 'button', icon, size = 'md', className = '' }) {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, icon, size = 'md', className = '' }) {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 text-body hover:text-heading hover:bg-base font-semibold rounded-lg transition-colors border border-divider ${sizes[size]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function DataTable({ columns, rows, emptyMessage = 'Không có dữ liệu', onRowClick }) {
  return (
    <div className="bg-surface border border-divider rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted border-b border-divider bg-base">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3 font-semibold ${col.align === 'right' ? 'text-right' : ''} ${col.align === 'center' ? 'text-center' : ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id || i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-divider last:border-0 hover:bg-base/60 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-5 py-4 ${col.align === 'right' ? 'text-right' : ''} ${col.align === 'center' ? 'text-center' : ''} ${col.cellClass || ''}`}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
