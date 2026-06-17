import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { Bell, Check, Clock, MailOpen } from 'lucide-react';

export default function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (userId) {
      fetchNotifications();
    }
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get(`/api/notifications/${userId}`);
      setNotifications(response.data || []);
    } catch (error) {
      console.error('Lỗi khi tải thông báo:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.put(`/api/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(n => n.notification_id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Lỗi khi đánh dấu đã đọc:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    try {
      await Promise.all(unread.map(n => api.put(`/api/notifications/${n.notification_id}/read`)));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Lỗi khi đánh dấu tất cả đã đọc:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-surface hover:bg-gray-50 text-body hover:text-heading rounded-xl border border-divider transition-colors flex items-center justify-center focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-white border-2 border-surface">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-surface border border-divider rounded-2xl shadow-lg z-50 overflow-hidden">
          <div className="p-4 border-b border-divider flex items-center justify-between bg-base">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-heading">Thông báo</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary-light text-primary text-[10px] font-extrabold border border-blue-200">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Đọc tất cả
              </button>
            )}
          </div>

          <div className="max-h-[350px] overflow-y-auto divide-y divide-divider">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted flex flex-col items-center gap-2">
                <MailOpen className="w-8 h-8 text-muted" />
                <p className="text-xs font-semibold">Hộp thư thông báo trống</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notification_id}
                  className={`p-4 transition-colors flex items-start gap-3.5 relative ${
                    n.is_read ? 'hover:bg-gray-50' : 'bg-primary-light/40 hover:bg-primary-light border-l-4 border-l-primary'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold text-heading ${!n.is_read ? 'font-bold' : ''}`}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-body mt-1 leading-relaxed break-words">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-muted mt-2">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(n.created_at)}</span>
                    </div>
                  </div>

                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(n.notification_id)}
                      className="p-1 hover:bg-primary text-primary hover:text-white rounded-lg transition-colors"
                      title="Đánh dấu đã đọc"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}