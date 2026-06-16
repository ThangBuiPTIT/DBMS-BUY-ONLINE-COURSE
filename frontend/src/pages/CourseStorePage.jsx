import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

function CourseStorePage() {
  const [courses, setCourses] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0.0, updated_at: '' });
  const [loading, setLoading] = useState(true);
  const [checkoutCourse, setCheckoutCourse] = useState(null);
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [submittingTopup, setSubmittingTopup] = useState(false);

  // Hardcode student for demo/test purposes as requested
  const STUDENT_ID = '74cc1ba2-509e-4348-8722-a0a84f8ee266';
  const STUDENT_NAME = 'Nguyen Van A';

  useEffect(() => {
    fetchStoreData();
  }, []);

  const fetchStoreData = async () => {
    setLoading(true);
    try {
      const [coursesRes, walletRes] = await Promise.all([
        axios.get(`http://localhost:8080/api/store/courses?student_id=${STUDENT_ID}`),
        axios.get(`http://localhost:8080/api/wallet/${STUDENT_ID}`)
      ]);
      setCourses(coursesRes.data || []);
      setWallet(walletRes.data || { balance: 0.0 });
    } catch (err) {
      console.error(err);
      toast.error('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleTopup = async (amount) => {
    setSubmittingTopup(true);
    const topupToast = toast.loading('Đang xử lý nạp tiền...');
    try {
      await axios.post('http://localhost:8080/api/wallet/topup', {
        user_id: STUDENT_ID,
        amount: amount,
        message: 'Nạp nhanh 500k từ Cửa hàng'
      });
      
      // Reload wallet balance
      const walletRes = await axios.get(`http://localhost:8080/api/wallet/${STUDENT_ID}`);
      setWallet(walletRes.data || { balance: 0.0 });
      
      toast.success(`Nạp thành công ${formatCurrency(amount)} vào ví!`, { id: topupToast });
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Lỗi khi nạp tiền';
      toast.error(errMsg, { id: topupToast });
    } finally {
      setSubmittingTopup(false);
    }
  };

  const handleCheckout = async () => {
    if (!checkoutCourse) return;
    setSubmittingCheckout(true);
    const checkoutToast = toast.loading('Đang thực hiện thanh toán...');
    try {
      await axios.post('http://localhost:8080/api/store/checkout', {
        student_id: STUDENT_ID,
        course_id: checkoutCourse.course_id
      });

      toast.success(`Mua khóa học "${checkoutCourse.title}" thành công!`, { id: checkoutToast });
      setCheckoutCourse(null);
      
      // Reload all store and wallet data
      await fetchStoreData();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Thanh toán thất bại';
      toast.error(errMsg, { id: checkoutToast });
    } finally {
      setSubmittingCheckout(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const getGradientForCard = (index) => {
    const gradients = [
      'from-blue-600/20 to-indigo-600/30 border-blue-500/20',
      'from-violet-600/20 to-purple-600/30 border-purple-500/20',
      'from-emerald-600/20 to-teal-600/30 border-emerald-500/20',
      'from-pink-600/20 to-rose-600/30 border-rose-500/20'
    ];
    return gradients[index % gradients.length];
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      <Toaster position="top-right" reverseOrder={false} />

      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col p-6 shrink-0">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              E-Learning
            </h1>
            <span className="text-xs text-slate-500 font-medium">Course Store</span>
          </div>
        </div>

        <nav className="space-y-1.5 flex-1">
          <button
            onClick={() => window.location.pathname = '/store'}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 bg-gradient-to-r from-violet-600/15 to-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Cửa hàng khóa học
          </button>

          <button
            onClick={() => window.location.pathname = '/students/manage'}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Quản lý học viên
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

          <button
            onClick={() => window.location.pathname = '/dictionary'}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            📖 Từ điển
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <header className="h-20 bg-slate-900/60 backdrop-blur-md border-b border-slate-850 px-8 flex items-center justify-between gap-6 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Cửa hàng Khóa học</h2>
            <p className="text-xs text-slate-400">Học viên: <span className="font-semibold text-slate-200">{STUDENT_NAME}</span></p>
          </div>

          {/* Wallet Widget */}
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-2.5 rounded-2xl">
            <div className="flex flex-col pl-2">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Số dư ví của bạn</span>
              <span className="text-base font-black text-indigo-400">{formatCurrency(wallet.balance)}</span>
            </div>
            <button
              onClick={() => handleTopup(500000)}
              disabled={submittingTopup}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Nạp nhanh 500k
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 p-8 overflow-y-auto max-w-[1600px] w-full mx-auto">
          {loading ? (
            <div className="flex items-center justify-center h-80">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-fadeIn">
              {/* Banner / Store Intro */}
              <div className="p-8 rounded-3xl bg-gradient-to-r from-violet-900/40 via-indigo-950/20 to-slate-900 border border-violet-850 shadow-xl relative overflow-hidden">
                <div className="absolute right-10 bottom-0 top-0 w-80 opacity-10 pointer-events-none flex items-center justify-center">
                  <svg className="w-full h-full text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="relative z-10 max-w-xl">
                  <span className="px-3 py-1 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full text-xs font-semibold uppercase tracking-wider">
                    E-Learning Store
                  </span>
                  <h3 className="text-2xl font-black text-white mt-3 leading-snug">
                    Nâng tầm kiến thức của bạn ngay hôm nay
                  </h3>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                    Sử dụng số dư ví điện tử để mua và kích hoạt tức thì các khóa học chất lượng cao từ đội ngũ giảng viên hàng đầu.
                  </p>
                </div>
              </div>

              {/* Course Grid */}
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Danh sách khóa học nổi bật
                </h4>

                {courses.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
                    Hiện chưa có khóa học nào được xuất bản.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course, idx) => (
                      <div
                        key={course.course_id}
                        className={`bg-slate-900 border rounded-3xl overflow-hidden hover:border-slate-700 transition-all duration-300 flex flex-col group shadow-lg`}
                      >
                        {/* Thumbnail Placeholders with Gradients */}
                        <div className={`h-48 bg-gradient-to-br ${getGradientForCard(idx)} relative p-6 flex flex-col justify-between overflow-hidden shrink-0`}>
                          {/* Decorative overlay grids */}
                          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
                          
                          <div className="flex justify-between items-start relative z-10">
                            <span className="px-2.5 py-1 bg-slate-950/80 backdrop-blur-md text-slate-300 rounded-lg text-[10px] font-bold tracking-wide uppercase">
                              {course.visibility_status}
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                              </svg>
                            </div>
                          </div>

                          <div className="relative z-10">
                            <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Khóa học</span>
                            <h5 className="font-extrabold text-white text-base line-clamp-2 mt-1 leading-tight group-hover:text-indigo-200 transition-colors">
                              {course.title}
                            </h5>
                          </div>
                        </div>

                        {/* Card Content */}
                        <div className="p-6 flex-1 flex flex-col justify-between">
                          <div>
                            <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                              {course.description || 'Khóa học cung cấp đầy đủ các bài học trực quan sinh động, tài liệu và bài tập thực hành chi tiết giúp học viên nhanh chóng làm chủ kiến thức.'}
                            </p>

                            <div className="mt-4 flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 text-xs font-bold border border-slate-700">
                                {course.teacher_name.charAt(0)}
                              </div>
                              <span className="text-xs text-slate-300 font-medium">Giảng viên: {course.teacher_name}</span>
                            </div>
                          </div>

                          <div className="mt-6 pt-4 border-t border-slate-850 flex items-center justify-between gap-4">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Học phí</span>
                              <span className="text-lg font-black text-white">{formatCurrency(course.price)}</span>
                            </div>

                            {course.is_enrolled ? (
                              <button
                                disabled
                                className="px-4 py-2.5 bg-slate-800 border border-slate-750 text-slate-500 rounded-xl text-xs font-bold flex items-center gap-1 cursor-not-allowed"
                              >
                                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Đã sở hữu
                              </button>
                            ) : (
                              <button
                                onClick={() => setCheckoutCourse(course)}
                                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1"
                              >
                                Mua ngay
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Checkout Confirmation Modal */}
      {checkoutCourse && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-scaleIn">
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-800">
              <div className="h-10 w-10 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-extrabold text-white text-lg">Xác nhận thanh toán</h3>
                <p className="text-xs text-slate-400">Giao dịch mua khóa học bằng Ví</p>
              </div>
            </div>

            <div className="my-6 space-y-4">
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-850 space-y-2">
                <div className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Tên khóa học</div>
                <div className="text-sm font-bold text-slate-100">{checkoutCourse.title}</div>
                <div className="text-xs text-slate-400">Giảng viên: {checkoutCourse.teacher_name}</div>
              </div>

              <div className="divide-y divide-slate-850 text-sm">
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">Giá bán</span>
                  <span className="font-semibold text-white">{formatCurrency(checkoutCourse.price)}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400">Số dư ví hiện tại</span>
                  <span className="font-semibold text-indigo-400">{formatCurrency(wallet.balance)}</span>
                </div>
                <div className="py-2.5 flex justify-between font-bold">
                  <span className="text-slate-300">Số dư sau giao dịch</span>
                  <span className={`font-extrabold ${wallet.balance >= checkoutCourse.price ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(wallet.balance - checkoutCourse.price)}
                  </span>
                </div>
              </div>

              {wallet.balance < checkoutCourse.price && (
                <div className="p-3 bg-red-950/30 border border-red-500/20 text-red-300 rounded-xl text-xs flex gap-2">
                  <svg className="w-5 h-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938-4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Số dư ví của bạn không đủ để mua khóa học này. Hãy nạp thêm tiền!</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCheckoutCourse(null)}
                disabled={submittingCheckout}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleCheckout}
                disabled={submittingCheckout || wallet.balance < checkoutCourse.price}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/10"
              >
                {submittingCheckout ? 'Đang xử lý...' : 'Xác nhận mua'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CourseStorePage;
