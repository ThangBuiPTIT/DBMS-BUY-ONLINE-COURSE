import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, BookOpen, Map, Trophy, ShoppingBag, Sparkles, Check, Play } from 'lucide-react';

const LogoIcon = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="36" rx="10" fill="currentColor" className="text-gray-900"/>
    <path d="M12 14 L20 10 L28 14 L28 22 L20 26 L12 22 Z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    <circle cx="20" cy="18" r="3" fill="white"/>
  </svg>
);

const features = [
  { icon: BookOpen, title: 'Tra cứu', desc: 'Từ điển đa vùng miền' },
  { icon: Map, title: 'Lộ trình', desc: 'Học cá nhân hóa' },
  { icon: Trophy, title: 'Thực hành', desc: 'Quiz & thử thách' },
  { icon: ShoppingBag, title: 'Giao dịch', desc: 'Mua khóa học an toàn' },
];

const LandingPage = () => {
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((i) => (i + 1) % features.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white min-h-screen font-sans text-gray-900 overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-white/75 border-b border-gray-200/60">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.location.href = '/'}>
            <LogoIcon />
            <span className="text-base font-semibold tracking-tight">SignLearn</span>
          </div>
          <div className="hidden md:flex items-center gap-7">
            <a href="/dictionary" className="text-[13px] text-gray-600 hover:text-gray-900 transition-colors">Từ điển</a>
            <a href="/microlearning/roadmap" className="text-[13px] text-gray-600 hover:text-gray-900 transition-colors">Lộ trình</a>
            <a href="/leaderboard" className="text-[13px] text-gray-600 hover:text-gray-900 transition-colors">Xếp hạng</a>
            <a href="/store" className="text-[13px] text-gray-600 hover:text-gray-900 transition-colors">Cửa hàng</a>
          </div>
          <div className="flex items-center gap-2">
            <a href="/admin/login" className="text-[13px] text-gray-600 hover:text-gray-900 px-3 py-1.5 transition-colors">Đăng nhập</a>
            <button
              onClick={() => window.location.href = '/student/dashboard'}
              className="bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-medium px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-[0.97]"
            >
              Bắt đầu
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 mb-7 text-[12px] text-gray-500"
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Nền tảng e-learning cho người Việt</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
            className="text-[44px] md:text-[64px] leading-[1.05] font-semibold tracking-[-0.04em] text-gray-900"
          >
            Học ngôn ngữ ký hiệu,
            <br />
            <span className="text-gray-400">một cách tự nhiên.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="mt-6 text-[17px] text-gray-500 max-w-xl mx-auto leading-relaxed"
          >
            Hệ thống học tập với cơ sở dữ liệu mạnh mẽ, lộ trình cá nhân hóa và theo dõi tiến độ chính xác.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
            className="mt-10 flex items-center justify-center gap-3"
          >
            <button
              onClick={() => window.location.href = '/student/dashboard'}
              className="bg-gray-900 hover:bg-gray-800 text-white text-[14px] font-medium px-6 py-3 rounded-full transition-all duration-200 cursor-pointer active:scale-[0.97] inline-flex items-center gap-2"
            >
              Bắt đầu miễn phí
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              onClick={() => window.location.href = '/microlearning/roadmap'}
              className="text-[14px] font-medium text-gray-700 hover:text-gray-900 px-5 py-3 rounded-full transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" strokeWidth={1.5} />
              Xem lộ trình
            </button>
          </motion.div>
        </div>

        {/* Feature Showcase */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
          className="max-w-5xl mx-auto mt-24"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {features.map((f, i) => (
              <button
                key={f.title}
                onClick={() => setActiveFeature(i)}
                className={`text-left p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                  activeFeature === i
                    ? 'bg-gray-900 border-gray-900 text-white'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <f.icon className="w-5 h-5 mb-3" strokeWidth={1.5} />
                <div className="text-[13px] font-medium">{f.title}</div>
                <div className={`text-[12px] mt-0.5 ${activeFeature === i ? 'text-gray-400' : 'text-gray-500'}`}>
                  {f.desc}
                </div>
              </button>
            ))}
          </div>

          <div className="relative bg-gray-50 border border-gray-200 rounded-3xl overflow-hidden aspect-[16/9]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeature}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-80 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                      {String(activeFeature + 1).padStart(2, '0')} / 04
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">
                      {features[activeFeature].title}
                    </span>
                  </div>
                  <h3 className="text-[20px] font-semibold tracking-tight text-gray-900 mb-2">
                    {activeFeature === 0 && 'Tra cứu từ vựng'}
                    {activeFeature === 1 && 'Lộ trình học tập'}
                    {activeFeature === 2 && 'Thực hành & Quiz'}
                    {activeFeature === 3 && 'Giao dịch an toàn'}
                  </h3>
                  <p className="text-[13px] text-gray-500 mb-5 leading-relaxed">
                    {activeFeature === 0 && 'Tìm kiếm nhanh theo từ khóa. Hỗ trợ đa vùng miền với video minh họa.'}
                    {activeFeature === 1 && 'Theo dõi tiến độ theo từng bài. Đề xuất bài học tiếp theo dựa trên năng lực.'}
                    {activeFeature === 2 && 'Câu hỏi trắc nghiệm, streak hàng ngày, và bảng xếp hạng bạn bè.'}
                    {activeFeature === 3 && 'Mua khóa học với ví điện tử. Giao dịch ACID đảm bảo an toàn tuyệt đối.'}
                  </p>
                  <div className="space-y-2 mb-5">
                    {(activeFeature === 0
                      ? ['Tìm kiếm theo từ khóa', 'Video minh họa đa vùng miền', 'Lưu từ vựng yêu thích']
                      : activeFeature === 1
                      ? ['Theo dõi tiến độ chi tiết', 'Đề xuất bài học thông minh', 'Đánh dấu hoàn thành']
                      : activeFeature === 2
                      ? ['Quiz trắc nghiệm', 'Streak hàng ngày', 'Bảng xếp hạng']
                      : ['Ví điện tử nội bộ', 'Giao dịch ACID', 'Lịch sử minh bạch']
                    ).map((item) => (
                      <div key={item} className="flex items-center gap-2.5 text-[12.5px] text-gray-600">
                        <Check className="w-3.5 h-3.5 text-gray-900" strokeWidth={2} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const paths = ['/dictionary', '/microlearning/roadmap', '/leaderboard', '/store'];
                      window.location.href = paths[activeFeature];
                    }}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white text-[12.5px] font-medium py-2.5 rounded-full transition-colors cursor-pointer"
                  >
                    Khám phá ngay
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* STATS */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto mt-32"
        >
          <div className="text-center mb-12">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mb-3 font-medium">
              Được tin dùng bởi
            </p>
            <h2 className="text-[28px] md:text-[36px] font-semibold tracking-tight text-gray-900">
              Hàng nghìn người học mỗi ngày.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200 border border-gray-200 rounded-3xl overflow-hidden">
            {[
              { v: '500+', l: 'Từ vựng ký hiệu' },
              { v: '18K+', l: 'Học viên tích cực' },
              { v: '30+', l: 'Khóa học chuyên sâu' },
              { v: '4.9', l: 'Đánh giá trung bình' },
            ].map((s) => (
              <div key={s.l} className="bg-white py-10 text-center">
                <div className="text-[32px] font-semibold tracking-tight text-gray-900">{s.v}</div>
                <div className="text-[12px] text-gray-500 mt-1.5 font-medium">{s.l}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* FOOTER CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto mt-32 text-center"
        >
          <h2 className="text-[32px] md:text-[44px] font-semibold tracking-[-0.03em] text-gray-900 mb-5">
            Sẵn sàng bắt đầu?
          </h2>
          <p className="text-[15px] text-gray-500 mb-9 max-w-md mx-auto">
            Tạo tài khoản miễn phí và bắt đầu hành trình học ngôn ngữ ký hiệu của bạn ngay hôm nay.
          </p>
          <button
            onClick={() => window.location.href = '/student/dashboard'}
            className="bg-gray-900 hover:bg-gray-800 text-white text-[14px] font-medium px-7 py-3.5 rounded-full transition-all cursor-pointer active:scale-[0.97] inline-flex items-center gap-2"
          >
            Tạo tài khoản miễn phí
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </motion.section>

        <footer className="max-w-6xl mx-auto mt-32 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-10">
            <div className="flex items-center gap-2">
              <LogoIcon />
              <span className="text-[13px] font-semibold">SignLearn</span>
            </div>
            <p className="text-[12px] text-gray-400">
              © {new Date().getFullYear()} SignLearn. All rights reserved.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default LandingPage;
