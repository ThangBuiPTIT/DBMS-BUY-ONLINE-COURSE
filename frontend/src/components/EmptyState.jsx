import React from 'react';

export default function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 gap-4 text-center">
      <div className="h-16 w-16 rounded-2xl bg-base border border-divider flex items-center justify-center text-3xl">
        {icon}
      </div>
      <div>
        {title && <p className="text-base font-bold text-heading">{title}</p>}
        {message && <p className="text-sm text-muted mt-1 max-w-md">{message}</p>}
      </div>
      {action}
    </div>
  );
}
