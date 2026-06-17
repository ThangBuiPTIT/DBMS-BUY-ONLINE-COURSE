import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDebounce } from '../hooks/useDebounce';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

function StudentManagementPage() {
  const [activeTab, setActiveTab] = useState('progress');
  const [progressData, setProgressData] = useState([]);
  const [inactiveData, setInactiveData] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Custom debounce hook with 500ms delay
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      handleSearch(debouncedSearchQuery);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery]);

  const fetchInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const [progressRes, inactiveRes] = await Promise.all([
        axios.get(`${API_URL}/api/students/progress`),
        axios.get(`${API_URL}/api/students/inactive`),
      ]);
      setProgressData(progressRes.data || []);
      setInactiveData(inactiveRes.data || []);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi tải dữ liệu học viên. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    try {
      const res = await axios.get(`${API_URL}/api/students/search?keyword=${encodeURIComponent(query)}`);
      setSearchResults(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const showToastNotification = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  const sendReminderEmail = (studentName, courseTitle) => {
    showToastNotification(`Đã gửi email nhắc nhở học tập đến học viên: ${studentName} (${courseTitle})`, 'success');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Chưa có thông tin';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 animate-slideIn">
          <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border ${
            toast.type === 'success' 
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200' 
              : 'bg-red-950/90 border-red-500/30 text-red-200'
          }`}>
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {toast.type === 'success' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938-4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              )}
            </svg>
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col p-6 shrink-0">
        {/* Title / Brand logo */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              E-Learning
            </h1>
            <span className="text-xs text-slate-500 font-medium">Student Management</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="space-y-1.5 flex-1">
          <button
            onClick={() => {
              setActiveTab('progress');
              setSearchQuery('');
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === 'progress' && !searchQuery
                ? 'bg-gradient-to-r from-violet-600/15 to-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
            </svg>
            Tiến độ học tập
          </button>

          <button
            onClick={() => {
              setActiveTab('inactive');
              setSearchQuery('');
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === 'inactive' && !searchQuery
                ? 'bg-gradient-to-r from-violet-600/15 to-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938-4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Cảnh báo rủi ro
          </button>

          <button
            onClick={() => window.location.pathname = '/store'}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Cửa hàng khóa học
          </button>

          <button
            onClick={() => window.location.pathname = '/teacher/dashboard'}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
            </svg>
            Teacher Dashboard
          </button>

          <button
            onClick={() => window.location.pathname = '/admin/dashboard'}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Admin Dashboard
          </button>

          <button
            onClick={() => window.location.pathname = '/leaderboard'}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
            </svg>
            🏆 Bảng xếp hạng
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header toolbar */}
        <header className="h-20 bg-slate-900/60 backdrop-blur-md border-b border-slate-850 px-8 flex items-center justify-between gap-6">
          <div className="flex-1 max-w-md relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm nhanh học viên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl py-2.5 pl-11 pr-10 text-sm placeholder-slate-500 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={fetchInitialData}
              className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
              title="Làm mới dữ liệu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.27 15" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 p-8 overflow-y-auto max-w-[1600px] w-full mx-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-950/40 border border-red-900/50 rounded-2xl flex items-center gap-3 text-red-200">
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-80">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
              </div>
            </div>
          ) : (
            <div className="animate-fadeIn">
              {/* If there is search query, display Search Results Panel */}
              {searchQuery ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <h2 className="text-xl font-bold text-white">Kết quả Tìm kiếm: "{searchQuery}"</h2>
                    <span className="px-3.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-semibold">
                      {searchResults.length} học viên được tìm thấy
                    </span>
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
                      Không tìm thấy học viên nào khớp với từ khóa.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {searchResults.map((student) => (
                        <div
                          key={student.student_id}
                          className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group"
                        >
                          <div>
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-bold text-lg text-slate-100 group-hover:text-indigo-400 transition-colors">
                                  {student.full_name}
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">Username: {student.username}</p>
                              </div>
                              <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold">
                                {student.grade_level || 'Học viên'}
                              </span>
                            </div>
                            <div className="mt-4 space-y-1.5 text-sm text-slate-400">
                              <p className="flex items-center gap-2">
                                <span className="font-medium text-slate-300">Trường học:</span>
                                {student.school_name || 'Chưa cập nhật'}
                              </p>
                              <p className="flex items-center gap-2">
                                <span className="font-medium text-slate-300">Ngày tham gia:</span>
                                {formatDate(student.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Tab 1: Progress Report */}
                  {activeTab === 'progress' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                      <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                        <h3 className="font-bold text-white text-base">Theo dõi Tiến độ Học tập</h3>
                        <span className="px-3 py-1 bg-slate-850 text-slate-300 rounded-full text-xs font-semibold">
                          {progressData.length} Lượt đăng ký
                        </span>
                      </div>

                      {progressData.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">Không có dữ liệu tiến độ.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase bg-slate-950/40">
                                <th className="p-5">Học viên</th>
                                <th className="p-5">Trường học</th>
                                <th className="p-5">Khóa học</th>
                                <th className="p-5">Tiến độ</th>
                                <th className="p-5 text-center">Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850">
                              {progressData.map((student, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/10 transition-colors">
                                  <td className="p-5">
                                    <div className="font-semibold text-slate-200">{student.student_name}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{student.email}</div>
                                  </td>
                                  <td className="p-5 text-slate-300 text-sm">
                                    {student.school_name || 'Chưa cập nhật'}
                                  </td>
                                  <td className="p-5 text-slate-200 text-sm font-medium">
                                    {student.course_title}
                                  </td>
                                  <td className="p-5">
                                    <div className="flex items-center gap-3 w-48">
                                      <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                                        <div
                                          className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                          style={{ width: `${Math.min(100, Math.max(0, student.progress))}%` }}
                                        ></div>
                                      </div>
                                      <span className="text-slate-300 text-xs font-bold shrink-0">{student.progress}%</span>
                                    </div>
                                  </td>
                                  <td className="p-5">
                                    <div className="flex justify-center">
                                      <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                                        student.learning_status === 'Hoàn thành'
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          : student.learning_status === 'Đang học'
                                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                                      }`}>
                                        {student.learning_status}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Risk Alert / Inactive Students */}
                  {activeTab === 'inactive' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-red-950/5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                          </span>
                          <h3 className="font-bold text-white text-base">Cảnh báo Học viên có Nguy cơ bỏ học</h3>
                        </div>
                        <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-semibold">
                          {inactiveData.length} cảnh báo rủi ro
                        </span>
                      </div>

                      {inactiveData.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">Tuyệt vời! Không có học viên nào không hoạt động hơn 30 ngày.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase bg-slate-950/40">
                                <th className="p-5">Học viên</th>
                                <th className="p-5">Số điện thoại</th>
                                <th className="p-5">Khóa học đăng ký</th>
                                <th className="p-5">Ngày hoạt động cuối</th>
                                <th className="p-5 text-center">Hành động</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850">
                              {inactiveData.map((student) => (
                                <tr key={student.enrollment_id} className="hover:bg-red-950/5 transition-colors group">
                                  <td className="p-5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-red-500 text-xs font-bold animate-pulse">⚠️</span>
                                      <div className="font-semibold text-red-400 group-hover:text-red-300 transition-colors">
                                        {student.full_name}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-5 text-slate-300 text-sm">
                                    {student.phone_number || 'Chưa cập nhật'}
                                  </td>
                                  <td className="p-5 text-slate-200 text-sm font-medium">
                                    {student.course_title}
                                  </td>
                                  <td className="p-5">
                                    <div className="text-red-500/90 text-sm font-semibold">
                                      {formatDate(student.last_activity_date)}
                                    </div>
                                    <span className="text-xs text-red-500/50">Không hoạt động &gt; 30 ngày</span>
                                  </td>
                                  <td className="p-5">
                                    <div className="flex justify-center">
                                      <button
                                        onClick={() => sendReminderEmail(student.full_name, student.course_title)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-red-950/50 hover:bg-red-900/40 border border-red-800/40 text-red-300 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        Gửi email nhắc nhở
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default StudentManagementPage;
