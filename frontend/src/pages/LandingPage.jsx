import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, BookOpen, Map, Trophy, ShoppingBag, Sparkles, Check, Play } from 'lucide-react';
import { navigate } from '../lib/router';

const LogoIcon = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="36" rx="10" fill="currentColor" className="text-primary"/>
    <path d="M12 14 L20 10 L28 14 L28 22 L20 26 L12 22 Z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    <circle cx="20" cy="18" r="3" fill="white"/>
  </svg>
);

const FEATURES = [
  { icon: BookOpen, title: 'Tra cứu', desc: 'Từ điển đa vùng miền', path: '/dictionary',
    headline: 'Tra cứu từ vựng',
    body: 'Tìm kiếm nhanh theo từ khóa. Hỗ trợ đa vùng miền với video minh họa.',
    bullets: ['Tìm kiếm theo từ khóa', 'Video minh họa đa vùng miền', 'Lưu từ vựng yêu thích'] },
  { icon: Map, title: 'Lộ trình', desc: 'Học cá nhân hóa', path: '/microlearning/roadmap',
    headline: 'Lộ trình học tập',
    body: 'Theo dõi tiến độ theo từng bài. Đề xuất bài học tiếp theo dựa trên năng lực.',
    bullets: ['Theo dõi tiến độ chi tiết', 'Đề xuất bài học thông minh', 'Đánh dấu hoàn thành'] },
  { icon: Trophy, title: 'Thực hành', desc: 'Quiz & thử thách', path: '/leaderboard',
    headline: 'Thực hành & Quiz',
    body: 'Câu hỏi trắc nghiệm, streak hàng ngày, và bảng xếp hạng bạn bè.',
    bullets: ['Quiz trắc nghiệm', 'Streak hàng ngày', 'Bảng xếp hạng'] },
  { icon: ShoppingBag, title: 'Giao dịch', desc: 'Mua khóa học an toàn', path: '/store',
    headline: 'Giao dịch an toàn',
    body: 'Mua khóa học với ví điện tử. Giao dịch ACID đảm bảo an toàn tuyệt đối.',
    bullets: ['Ví điện tử nội bộ', 'Giao dịch ACID', 'Lịch sử minh bạch'] },
];

const STATS = [
  { v: '500+',  l: 'Từ vựng ký hiệu' },
  { v: '18K+',  l: 'Học viên tích cực' },
  { v: '30+',   l: 'Khóa học chuyên sâu' },
  { v: '4.9',   l: 'Đánh giá trung bình' },
];

const NAV_LINKS = [
  { href: '/dictionary', label: 'Từ điển' },
  { href: '/microlearning/roadmap', label: 'Lộ trình' },
  { href: '/leaderboard', label: 'Xếp hạng' },
  { href: '/store', label: 'Cửa hàng' },
];

export default function LandingPage() {
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setActiveFeature((i) => (i + 1) % FEATURES.length), 5000);
    return () => clearInterval(interval);
  }, []);

  const current = FEATURES[activeFeature];

  return (
    <div className="bg-base min-h-screen font-sans text-body overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-surface/75 border-b border-divider">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer text-primary" onClick={() => navigate('/')}>
            <LogoIcon />
            <span className="text-base font-bold tracking-tight text-heading">SignLearn</span>
          </div>
          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-body hover:text-heading transition-colors font-medium">{l.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="text-sm text-body hover:text-heading px-3 py-1.5 transition-colors font-semibold">Đăng nhập</a>
            <button
              onClick={() => navigate('/student/dashboard')}
              className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer active:scale-[0.97]"
            >
              Bắt đầu
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6">
        {/* HERO */}
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-7 text-xs text-muted font-semibold">
            <Sparkles size={14} strokeWidth={1.8} />
            <span>Nền tảng e-learning cho người Việt</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}
            className="text-4xl md:text-6xl leading-[1.05] font-bold tracking-tight text-heading">
            Học ngôn ngữ ký hiệu,<br />
            <span className="text-muted">một cách tự nhiên.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-6 text-base text-muted max-w-xl mx-auto leading-relaxed">
            Hệ thống học tập với cơ sở dữ liệu mạnh mẽ, lộ trình cá nhân hóa và theo dõi tiến độ chính xác.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-10 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/student/dashboard')}
              className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all cursor-pointer active:scale-[0.97] inline-flex items-center gap-2"
            >
              Bắt đầu miễn phí
              <ArrowRight size={16} strokeWidth={1.8} />
            </button>
            <button
              onClick={() => navigate('/microlearning/roadmap')}
              className="text-sm font-semibold text-body hover:text-heading px-5 py-3 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-2 border border-divider hover:border-primary"
            >
              <Play size={14} strokeWidth={1.8} />
              Xem lộ trình
            </button>
          </motion.div>
        </div>

        {/* FEATURES */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4 }}
          className="max-w-5xl mx-auto mt-24"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {FEATURES.map((f, i) => (
              <button
                key={f.title}
                onClick={() => setActiveFeature(i)}
                className={`text-left p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                  activeFeature === i
                    ? 'bg-primary border-primary text-white'
                    : 'bg-surface border-divider text-body hover:border-primary'
                }`}
              >
                <f.icon size={20} strokeWidth={1.8} className="mb-3" />
                <div className="text-sm font-bold">{f.title}</div>
                <div className={`text-xs mt-0.5 ${activeFeature === i ? 'text-white/80' : 'text-muted'}`}>{f.desc}</div>
              </button>
            ))}
          </div>

          <div className="relative bg-surface border border-divider rounded-3xl overflow-hidden aspect-[16/9]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeature}
                initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4 }} className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-80 bg-surface rounded-2xl shadow-lg border border-divider p-6">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[11px] uppercase tracking-wider text-muted font-bold">
                      {String(activeFeature + 1).padStart(2, '0')} / 04
                    </span>
                    <span className="text-[11px] text-primary font-bold">{current.title}</span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-heading mb-2">{current.headline}</h3>
                  <p className="text-xs text-muted mb-5 leading-relaxed">{current.body}</p>
                  <div className="space-y-2 mb-5">
                    {current.bullets.map((b) => (
                      <div key={b} className="flex items-center gap-2.5 text-xs text-body">
                        <Check size={14} strokeWidth={2.5} className="text-primary" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => navigate(current.path)}
                    className="w-full bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
                  >
                    Khám phá ngay
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* STATS */}
        <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto mt-32"
        >
          <div className="text-center mb-12">
            <p className="text-[11px] uppercase tracking-[0.2em] text-primary mb-3 font-bold">Được tin dùng bởi</p>
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-heading">Hàng nghìn người học mỗi ngày.</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-divider border border-divider rounded-3xl overflow-hidden">
            {STATS.map((s) => (
              <div key={s.l} className="bg-surface py-10 text-center">
                <div className="text-3xl font-bold tracking-tight text-heading">{s.v}</div>
                <div className="text-xs text-muted mt-1.5 font-medium">{s.l}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto mt-32 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-heading mb-5">Sẵn sàng bắt đầu?</h2>
          <p className="text-sm text-muted mb-9 max-w-md mx-auto">
            Tạo tài khoản miễn phí và bắt đầu hành trình học ngôn ngữ ký hiệu của bạn ngay hôm nay.
          </p>
          <button
            onClick={() => navigate('/student/dashboard')}
            className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-7 py-3.5 rounded-xl transition-all cursor-pointer active:scale-[0.97] inline-flex items-center gap-2"
          >
            Tạo tài khoản miễn phí
            <ArrowRight size={16} strokeWidth={1.8} />
          </button>
        </motion.section>

        <footer className="max-w-6xl mx-auto mt-32 pt-8 border-t border-divider">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-10">
            <div className="flex items-center gap-2 text-primary">
              <LogoIcon />
              <span className="text-sm font-bold text-heading">SignLearn</span>
            </div>
            <p className="text-xs text-muted">© {new Date().getFullYear()} SignLearn. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
