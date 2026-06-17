import React from 'react';

export default function LoadingSpinner({ label = 'Đang tải...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="h-10 w-10 rounded-full border-2 border-divider border-t-primary animate-spin"></div>
      {label && <p className="text-sm text-muted animate-pulse">{label}</p>}
    </div>
  );
}
