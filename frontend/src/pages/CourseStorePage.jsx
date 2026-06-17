import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Plus, CheckCircle2, AlertTriangle, Wallet } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { Card, Badge, PrimaryButton, GhostButton } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';
import { api, getCurrentUser } from '../api/client';
import { navigate } from '../lib/router';

const formatCurrency = (v) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

const CARD_GRADIENTS = [
  'from-primary to-blue-700',
  'from-violet-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
];

export default function CourseStorePage() {
  const currentUser = getCurrentUser();
  const STUDENT_ID = currentUser?.user_id;
  const STUDENT_NAME = currentUser?.full_name || currentUser?.username || 'Học viên';
  const [courses, setCourses] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0.0, updated_at: '' });
  const [loading, setLoading] = useState(true);
  const [checkoutCourse, setCheckoutCourse] = useState(null);
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [submittingTopup, setSubmittingTopup] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (!STUDENT_ID) { navigate('/'); return; }
    fetchStoreData();
  }, []);

  const fetchStoreData = async () => {
    setLoading(true);
    try {
      const [coursesRes, walletRes] = await Promise.all([
        api.get(`/api/store/courses?student_id=${STUDENT_ID}`),
        api.get(`/api/wallet/${STUDENT_ID}`),
      ]);
      setCourses(coursesRes.data || []);
      setWallet(walletRes.data || { balance: 0.0 });
    } catch (err) {
      setToast({ show: true, message: 'Không thể kết nối đến máy chủ.', type: 'error' });
    } finally { setLoading(false); }
  };

  const handleTopup = async (amount) => {
    setSubmittingTopup(true);
    try {
      await api.post('/api/wallet/topup', {
        user_id: STUDENT_ID,
        amount,
        message: `Nạp ${formatCurrency(amount)} từ Cửa hàng`,
      });
      const walletRes = await api.get(`/api/wallet/${STUDENT_ID}`);
      setWallet(walletRes.data || { balance: 0.0 });
      setToast({ show: true, message: `Nạp thành công ${formatCurrency(amount)} vào ví!`, type: 'success' });
    } catch (err) {
      setToast({ show: true, message: err.response?.data?.error || 'Lỗi khi nạp tiền', type: 'error' });
    } finally { setSubmittingTopup(false); }
  };

  const handleCheckout = async () => {
    if (!checkoutCourse) return;
    setSubmittingCheckout(true);
    try {
      await api.post('/api/store/checkout', {
        student_id: STUDENT_ID,
        course_id: checkoutCourse.course_id,
      });
      setToast({ show: true, message: `Mua khóa học "${checkoutCourse.title}" thành công!`, type: 'success' });
      setCheckoutCourse(null);
      await fetchStoreData();
    } catch (err) {
      setToast({ show: true, message: err.response?.data?.error || 'Thanh toán thất bại', type: 'error' });
    } finally { setSubmittingCheckout(false); }
  };

  return (
    <AppLayout
      role="student"
      currentPath="/store"
      title="Cửa hàng khóa học"
      subtitle={`Học viên: ${STUDENT_NAME}`}
      user={currentUser || { username: STUDENT_NAME }}
      toast={toast}
      onToastClose={() => setToast({ show: false, message: '', type: 'success' })}
      actions={
        <Card padding="p-2" className="flex items-center gap-3">
          <div className="flex flex-col px-2">
            <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Số dư ví</span>
            <span className="text-base font-bold text-primary">{formatCurrency(wallet.balance)}</span>
          </div>
          <PrimaryButton
            size="sm"
            icon={<Plus size={14} strokeWidth={2.5} />}
            onClick={() => handleTopup(500000)}
            disabled={submittingTopup}
          >
            Nạp nhanh 500k
          </PrimaryButton>
        </Card>
      }
    >
      <div className="p-8 max-w-[1600px] w-full mx-auto">
        {loading ? (
          <LoadingSpinner label="Đang tải cửa hàng..." />
        ) : (
          <div className="space-y-8">
            <Card padding="p-8" className="bg-primary-light border-primary/30">
              <span className="inline-block px-3 py-1 bg-white text-primary border border-primary/30 rounded-full text-xs font-bold uppercase tracking-wider">
                E-Learning Store
              </span>
              <h3 className="text-2xl font-bold text-heading mt-3 leading-snug">
                Nâng tầm kiến thức của bạn ngay hôm nay
              </h3>
              <p className="text-sm text-body mt-2 leading-relaxed max-w-2xl">
                Sử dụng số dư ví điện tử để mua và kích hoạt tức thì các khóa học chất lượng cao từ đội ngũ giảng viên hàng đầu.
              </p>
            </Card>

            <div>
              <h4 className="text-lg font-bold text-heading flex items-center gap-2 mb-4">
                <ShoppingBag size={20} strokeWidth={1.8} className="text-primary" />
                Danh sách khóa học nổi bật
              </h4>

              {courses.length === 0 ? (
                <Card>
                  <EmptyState icon="📚" title="Chưa có khóa học nào" message="Hiện chưa có khóa học nào được xuất bản." />
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.map((course, idx) => (
                    <motion.div
                      key={course.course_id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.04 }}
                    >
                      <Card padding="p-0" className="overflow-hidden flex flex-col h-full">
                        <div className={`h-44 bg-gradient-to-br ${CARD_GRADIENTS[idx % CARD_GRADIENTS.length]} relative p-6 flex flex-col justify-between overflow-hidden shrink-0`}>
                          <div className="flex justify-between items-start relative z-10">
                            <span className="px-2.5 py-1 bg-white/90 text-body rounded-lg text-[10px] font-bold tracking-wide uppercase">
                              {course.visibility_status}
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
                              <ShoppingBag size={14} strokeWidth={2} />
                            </div>
                          </div>
                          <div className="relative z-10">
                            <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Khóa học</span>
                            <h5 className="font-bold text-white text-base line-clamp-2 mt-1 leading-tight">
                              {course.title}
                            </h5>
                          </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <p className="text-xs text-body line-clamp-3 leading-relaxed">
                              {course.description || 'Khóa học cung cấp đầy đủ các bài học trực quan sinh động, tài liệu và bài tập thực hành chi tiết.'}
                            </p>
                            <div className="mt-4 flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary-light text-primary flex items-center justify-center text-xs font-bold">
                                {course.teacher_name?.[0] || 'G'}
                              </div>
                              <span className="text-xs text-body font-medium">Giảng viên: {course.teacher_name}</span>
                            </div>
                          </div>

                          <div className="mt-5 pt-4 border-t border-divider flex items-center justify-between gap-4">
                            <div>
                              <span className="text-[9px] text-muted uppercase font-bold tracking-wider">Học phí</span>
                              <div className="text-lg font-bold text-heading">{formatCurrency(course.price)}</div>
                            </div>
                            {course.is_enrolled ? (
                              <button
                                disabled
                                className="px-4 py-2.5 bg-base border border-divider text-muted rounded-xl text-xs font-bold flex items-center gap-1 cursor-not-allowed"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={2.5} />
                                Đã sở hữu
                              </button>
                            ) : (
                              <PrimaryButton size="sm" onClick={() => setCheckoutCourse(course)}>
                                Mua ngay
                              </PrimaryButton>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {checkoutCourse && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-surface border border-divider rounded-3xl p-7 max-w-md w-full shadow-xl"
            >
              <div className="flex items-center gap-3 pb-4 border-b border-divider">
                <div className="h-10 w-10 rounded-2xl bg-primary-light text-primary flex items-center justify-center">
                  <Wallet size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <h3 className="font-bold text-heading text-lg">Xác nhận thanh toán</h3>
                  <p className="text-xs text-muted">Giao dịch mua khóa học bằng Ví</p>
                </div>
              </div>

              <div className="my-6 space-y-4">
                <div className="bg-base p-4 rounded-2xl border border-divider space-y-1">
                  <div className="text-[10px] text-muted uppercase font-bold tracking-wider">Tên khóa học</div>
                  <div className="text-sm font-bold text-heading">{checkoutCourse.title}</div>
                  <div className="text-xs text-body">Giảng viên: {checkoutCourse.teacher_name}</div>
                </div>

                <div className="divide-y divide-divider text-sm">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-muted">Giá bán</span>
                    <span className="font-semibold text-heading">{formatCurrency(checkoutCourse.price)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-muted">Số dư ví hiện tại</span>
                    <span className="font-semibold text-primary">{formatCurrency(wallet.balance)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-body font-semibold">Số dư sau giao dịch</span>
                    <span className={`font-bold ${wallet.balance >= checkoutCourse.price ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(wallet.balance - checkoutCourse.price)}
                    </span>
                  </div>
                </div>

                {wallet.balance < checkoutCourse.price && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex gap-2">
                    <AlertTriangle size={16} strokeWidth={1.8} className="shrink-0 mt-0.5" />
                    <span>Số dư ví của bạn không đủ để mua khóa học này. Hãy nạp thêm tiền!</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                <GhostButton className="flex-1 justify-center py-3" onClick={() => setCheckoutCourse(null)} disabled={submittingCheckout}>
                  Hủy
                </GhostButton>
                <PrimaryButton
                  className="flex-1 justify-center py-3"
                  onClick={handleCheckout}
                  disabled={submittingCheckout || wallet.balance < checkoutCourse.price}
                >
                  {submittingCheckout ? 'Đang xử lý...' : 'Xác nhận mua'}
                </PrimaryButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
