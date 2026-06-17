import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bell, Check, Clock, MailOpen } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

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
      const response = await axios.get(`${API_URL}/api/notifications/${userId}`);
      setNotifications(response.data || []);
    } catch (error) {
      console.error('Lỗi khi tải thông báo:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await axios.put(`${API_URL}/api/notifications/${notificationId}/read`);
      // Update local state directly
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
      await Promise.all(unread.map(n => axios.put(`${API_URL}/api/notifications/${n.notification_id}/read`)));
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
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-all duration-200 cursor-pointer flex items-center justify-center focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-extrabold text-white border-2 border-slate-950 animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-200">Thông báo</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-extrabold border border-indigo-500/20">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Đọc tất cả
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-850 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <MailOpen className="w-8 h-8 text-slate-700" />
                <p className="text-xs font-semibold">Hộp thư thông báo trống</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notification_id}
                  className={`p-4 transition-colors duration-150 flex items-start gap-3.5 relative ${
                    n.is_read ? 'hover:bg-slate-850/40' : 'bg-indigo-950/15 hover:bg-indigo-950/25 border-l-4 border-l-indigo-500'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold text-slate-200 ${!n.is_read ? 'font-bold' : ''}`}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed break-words">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-2">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(n.created_at)}</span>
                    </div>
                  </div>

                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(n.notification_id)}
                      className="p-1 hover:bg-indigo-500/25 text-indigo-400 hover:text-indigo-300 rounded-lg transition-colors cursor-pointer"
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
