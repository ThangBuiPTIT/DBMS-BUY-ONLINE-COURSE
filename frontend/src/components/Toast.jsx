import React, { useEffect } from 'react';

export default function Toast({ show, message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    if (show && duration > 0) {
      const t = setTimeout(onClose, duration);
      return () => clearTimeout(t);
    }
  }, [show, duration, onClose]);

  if (!show) return null;

  const isError = type === 'error';

  return (
    <div className="fixed top-6 right-6 z-[100]">
      <div
        className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg border bg-surface ${
          isError ? 'border-red-200' : 'border-divider'
        }`}
      >
        <div
          className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
            isError ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isError ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M12 3l9 16H3L12 3z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            )}
          </svg>
        </div>
        <span className={`text-sm font-semibold ${isError ? 'text-red-700' : 'text-heading'}`}>
          {message}
        </span>
      </div>
    </div>
  );
}
