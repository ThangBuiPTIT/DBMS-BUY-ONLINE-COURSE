import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

// ---- Hằng số ----
const STUDENT_ID = '74cc1ba2-509e-4348-8722-a0a84f8ee266';

// ---- Utility ----
const getRankStyle = (rank) => {
  if (rank === 1) return {
    bg: 'bg-gradient-to-br from-yellow-400/20 via-amber-300/10 to-yellow-600/20',
    border: 'border-yellow-400/40',
    badge: '🥇',
    glow: 'shadow-yellow-500/20',
    nameColor: 'text-yellow-300',
    rankColor: 'text-yellow-400',
    ring: 'ring-2 ring-yellow-400/60',
  };
  if (rank === 2) return {
    bg: 'bg-gradient-to-br from-slate-300/15 via-gray-200/10 to-slate-400/15',
    border: 'border-slate-300/40',
    badge: '🥈',
    glow: 'shadow-slate-400/20',
    nameColor: 'text-slate-200',
    rankColor: 'text-slate-300',
    ring: 'ring-2 ring-slate-300/50',
  };
  if (rank === 3) return {
    bg: 'bg-gradient-to-br from-orange-700/20 via-amber-700/10 to-orange-600/20',
    border: 'border-orange-500/40',
    badge: '🥉',
    glow: 'shadow-orange-600/20',
    nameColor: 'text-orange-300',
    rankColor: 'text-orange-400',
    ring: 'ring-2 ring-orange-500/50',
  };
  return {
    bg: 'bg-slate-800/40',
    border: 'border-slate-700/50',
    badge: null,
    glow: '',
    nameColor: 'text-slate-200',
    rankColor: 'text-slate-500',
    ring: '',
  };
};

const getAvatarLetter = (name) => {
  return name ? name.trim()[0].toUpperCase() : '?';
};

const getAvatarGradient = (rank) => {
  if (rank === 1) return 'from-yellow-400 to-amber-600';
  if (rank === 2) return 'from-slate-300 to-slate-500';
  if (rank === 3) return 'from-orange-400 to-orange-700';
  const gradients = [
    'from-violet-500 to-indigo-600',
    'from-teal-400 to-cyan-600',
    'from-rose-400 to-pink-600',
    'from-emerald-400 to-green-600',
  ];
  return gradients[rank % gradients.length];
};

// ---- Animated Counter ----
const AnimatedNumber = ({ value }) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;
    const duration = 1200;
    const step = Math.ceil(end / (duration / 16));
    const timer = setInterval(() => {
      start = Math.min(start + step, end);
      setDisplay(start);
      if (start >= end) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return <span ref={ref}>{display}</span>;
};

// ---- Flame Effect ----
const FlameIcon = ({ size = 'w-8 h-8', lit = false }) => (
  <svg className={`${size} ${lit ? 'drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]' : 'opacity-30'} transition-all duration-500`} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2C12 2 9 8 9 12C9 14.2091 10.3431 16.1716 12 17C13.6569 16.1716 15 14.2091 15 12C15 9 13 5 12 2Z"
      fill={lit ? '#fb923c' : '#475569'}
    />
    <path
      d="M12 22C9.23858 22 7 19.7614 7 17C7 14.2386 9.5 12 12 10C14.5 12 17 14.2386 17 17C17 19.7614 14.7614 22 12 22Z"
      fill={lit ? '#ef4444' : '#334155'}
    />
    <path
      d="M12 20C12 20 10 18.5 10 17C10 15.5 11 14.5 12 14C13 14.5 14 15.5 14 17C14 18.5 12 20 12 20Z"
      fill={lit ? '#fbbf24' : '#1e293b'}
    />
  </svg>
);

// ---- Main Component ----
export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [myStreak, setMyStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leaderboard'); // sidebar tab

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [lbRes, streakRes] = await Promise.all([
          axios.get(`${API_URL}/api/gamification/leaderboard?limit=20`),
          axios.get(`${API_URL}/api/gamification/streak/${STUDENT_ID}`),
        ]);
        setLeaderboard(lbRes.data.leaderboard || []);
        setMyStreak(streakRes.data);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const isStreakActive = myStreak && myStreak.current_streak > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex overflow-hidden">
      {/* ---- Sidebar ---- */}
      <aside className="w-64 bg-slate-900/80 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-violet-500/10 p-2 rounded-xl border border-violet-500/20">
            <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <span className="font-extrabold tracking-wider text-sm uppercase bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            E-Learning
          </span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {[
            { id: 'leaderboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2', label: 'Bảng xếp hạng' },
            { id: 'mystats', icon: 'M13 10V3L4 14h7v7l9-11h-7z', label: 'Thành tích cá nhân' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/10 text-violet-300 border-l-4 border-violet-500'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}

          <div className="pt-2 border-t border-slate-800/70 mt-2">
            {[
              { path: '/store', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', label: 'Cửa hàng' },
              { path: '/students/manage', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', label: 'Quản lý học viên' },
              { path: '/admin/dashboard', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4', label: 'Admin Dashboard' },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => window.location.pathname = item.path}
                className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-800/40 hover:text-slate-300 transition-all duration-200 border-l-4 border-transparent"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </aside>

      {/* ---- Main Content ---- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 px-8 flex justify-between items-center bg-slate-950/80 backdrop-blur sticky top-0 z-40">
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">
              🏆 Bảng xếp hạng & Thành tích
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Cạnh tranh lành mạnh — Chinh phục đỉnh cao</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-400 font-semibold border border-violet-500/20 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse"></span>
              Live Rankings
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-grow overflow-y-auto p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="h-14 w-14 border-4 border-t-violet-500 border-slate-800 rounded-full animate-spin"></div>
              <p className="text-slate-500 text-sm animate-pulse">Đang tải bảng xếp hạng...</p>
            </div>
          ) : (
            <div className="space-y-8 max-w-5xl mx-auto">

              {/* ====== My Stats Card ====== */}
              <div className={`relative rounded-3xl overflow-hidden border ${isStreakActive ? 'border-orange-500/40 bg-gradient-to-r from-orange-950/60 via-red-950/40 to-slate-900/60' : 'border-slate-700/40 bg-slate-900/40'} p-6 flex items-center gap-6 backdrop-blur`}>
                {isStreakActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-600/5 to-red-600/5 pointer-events-none" />
                )}
                {/* Flame group */}
                <div className="relative flex items-end gap-1">
                  <FlameIcon size="w-7 h-7" lit={isStreakActive} />
                  <FlameIcon size="w-10 h-10" lit={isStreakActive} />
                  <FlameIcon size="w-7 h-7" lit={isStreakActive} />
                </div>

                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Streak hiện tại của bạn</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-5xl font-black tabular-nums ${isStreakActive ? 'text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.5)]' : 'text-slate-600'}`}>
                      {myStreak?.current_streak ?? 0}
                    </span>
                    <span className={`text-lg font-bold ${isStreakActive ? 'text-orange-500' : 'text-slate-600'}`}>ngày</span>
                  </div>
                  {isStreakActive ? (
                    <p className="text-sm text-orange-400/80 mt-1">🔥 Tuyệt vời! Đừng để chuỗi bị gián đoạn nhé!</p>
                  ) : (
                    <p className="text-sm text-slate-600 mt-1">Hãy học bài hôm nay để bắt đầu chuỗi streak!</p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Kỷ lục cao nhất</p>
                  <p className={`text-3xl font-black tabular-nums ${myStreak?.highest_streak > 0 ? 'text-amber-400' : 'text-slate-700'}`}>
                    {myStreak?.highest_streak ?? 0}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">ngày liên tiếp</p>
                </div>
              </div>

              {/* ====== Top 3 Podium ====== */}
              {top3.length > 0 && (
                <div>
                  <h2 className="text-base font-bold text-slate-300 mb-5 flex items-center gap-2">
                    <span className="text-yellow-400">🏆</span> Top 3 Học viên xuất sắc
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Re-order for visual podium: 2nd, 1st, 3rd */}
                    {[top3[1], top3[0], top3[2]].filter(Boolean).map((entry) => {
                      const style = getRankStyle(entry.rank);
                      const isFirst = entry.rank === 1;
                      return (
                        <div
                          key={entry.rank}
                          className={`relative rounded-3xl border ${style.bg} ${style.border} ${style.ring} p-6 flex flex-col items-center gap-3 shadow-xl ${style.glow} ${isFirst ? 'md:-mt-4 md:mb-4' : ''} transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl`}
                        >
                          {/* Rank badge */}
                          <div className={`absolute -top-4 text-3xl drop-shadow-lg`}>
                            {style.badge}
                          </div>

                          {/* Avatar */}
                          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getAvatarGradient(entry.rank)} flex items-center justify-center text-3xl font-black text-white shadow-lg ${isFirst ? 'ring-4 ring-yellow-400/40' : ''}`}>
                            {entry.avatar_url ? (
                              <img src={entry.avatar_url} alt={entry.full_name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              getAvatarLetter(entry.full_name)
                            )}
                          </div>

                          {/* Name */}
                          <div className="text-center">
                            <p className={`font-bold text-base ${style.nameColor}`}>{entry.full_name}</p>
                            <p className={`text-xs font-mono ${style.rankColor} mt-0.5`}>#{entry.rank}</p>
                          </div>

                          {/* Stats */}
                          <div className="w-full grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-black/20 rounded-xl p-2.5 text-center">
                              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Streak</p>
                              <p className={`text-xl font-black mt-0.5 ${isStreakActive && entry.rank === 1 ? 'text-orange-400' : 'text-slate-200'}`}>
                                🔥 {entry.current_streak}
                              </p>
                            </div>
                            <div className="bg-black/20 rounded-xl p-2.5 text-center">
                              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Thành tích</p>
                              <p className="text-xl font-black mt-0.5 text-violet-300">
                                ⭐ {entry.total_achievements}
                              </p>
                            </div>
                          </div>

                          {/* Highest streak */}
                          <div className="w-full text-center text-xs text-slate-500 border-t border-white/5 pt-2">
                            Kỷ lục: <span className="text-amber-400 font-bold">{entry.highest_streak}</span> ngày
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ====== Full Leaderboard Table ====== */}
              <div>
                <h2 className="text-base font-bold text-slate-300 mb-4 flex items-center gap-2">
                  <span>📋</span> Bảng xếp hạng đầy đủ
                </h2>
                <div className="bg-slate-900/50 backdrop-blur rounded-3xl border border-slate-800 overflow-hidden">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-500 border-b border-slate-800">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-5">Học viên</div>
                    <div className="col-span-2 text-center">Streak 🔥</div>
                    <div className="col-span-2 text-center">Kỷ lục</div>
                    <div className="col-span-2 text-center">Thành tích ⭐</div>
                  </div>

                  {/* Top 3 rows (condensed) */}
                  {top3.map((entry) => {
                    const style = getRankStyle(entry.rank);
                    return (
                      <div
                        key={entry.rank}
                        className={`grid grid-cols-12 gap-4 px-6 py-3.5 items-center border-b border-slate-800/50 ${style.bg} transition-all hover:brightness-110`}
                      >
                        <div className="col-span-1 text-center text-xl">{style.badge}</div>
                        <div className="col-span-5 flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarGradient(entry.rank)} flex items-center justify-center text-sm font-black text-white shrink-0`}>
                            {getAvatarLetter(entry.full_name)}
                          </div>
                          <span className={`font-bold text-sm ${style.nameColor}`}>{entry.full_name}</span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className={`text-sm font-bold ${entry.current_streak > 0 ? 'text-orange-400' : 'text-slate-600'}`}>
                            {entry.current_streak}
                          </span>
                        </div>
                        <div className="col-span-2 text-center text-sm text-amber-400 font-semibold">
                          {entry.highest_streak}
                        </div>
                        <div className="col-span-2 text-center text-sm text-violet-300 font-semibold">
                          {entry.total_achievements}
                        </div>
                      </div>
                    );
                  })}

                  {/* Remaining rows */}
                  {rest.map((entry) => (
                    <div
                      key={entry.rank}
                      className="grid grid-cols-12 gap-4 px-6 py-3.5 items-center border-b border-slate-800/30 hover:bg-slate-800/30 transition-all duration-150 group"
                    >
                      <div className="col-span-1 text-center">
                        <span className="text-sm font-mono text-slate-500 group-hover:text-slate-400 transition-colors">{entry.rank}</span>
                      </div>
                      <div className="col-span-5 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarGradient(entry.rank)} flex items-center justify-center text-sm font-black text-white shrink-0 opacity-80`}>
                          {getAvatarLetter(entry.full_name)}
                        </div>
                        <span className="font-semibold text-sm text-slate-300 group-hover:text-slate-100 transition-colors">{entry.full_name}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`text-sm font-bold ${entry.current_streak > 0 ? 'text-orange-400' : 'text-slate-600'}`}>
                          {entry.current_streak > 0 ? `🔥 ${entry.current_streak}` : '—'}
                        </span>
                      </div>
                      <div className="col-span-2 text-center text-sm text-slate-400 font-medium">
                        {entry.highest_streak}
                      </div>
                      <div className="col-span-2 text-center text-sm text-slate-400 font-medium">
                        {entry.total_achievements > 0 ? `⭐ ${entry.total_achievements}` : '—'}
                      </div>
                    </div>
                  ))}

                  {leaderboard.length === 0 && (
                    <div className="py-20 text-center text-slate-600">
                      <p className="text-4xl mb-3">🏜️</p>
                      <p className="text-sm">Chưa có dữ liệu xếp hạng. Hãy bắt đầu học ngay!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ====== Stats Summary ====== */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: 'Tổng người tham gia',
                    value: leaderboard.length,
                    icon: '👥',
                    color: 'text-violet-400',
                    bg: 'from-violet-500/10 to-indigo-500/5',
                    border: 'border-violet-500/20',
                  },
                  {
                    label: 'Streak TB toàn bảng',
                    value: leaderboard.length ? Math.round(leaderboard.reduce((s, e) => s + e.current_streak, 0) / leaderboard.length) : 0,
                    icon: '🔥',
                    color: 'text-orange-400',
                    bg: 'from-orange-500/10 to-red-500/5',
                    border: 'border-orange-500/20',
                  },
                  {
                    label: 'Thành tích nhiều nhất',
                    value: leaderboard.length ? Math.max(...leaderboard.map(e => e.total_achievements)) : 0,
                    icon: '⭐',
                    color: 'text-amber-400',
                    bg: 'from-amber-500/10 to-yellow-500/5',
                    border: 'border-amber-500/20',
                  },
                ].map((stat) => (
                  <div key={stat.label} className={`bg-gradient-to-br ${stat.bg} border ${stat.border} rounded-2xl p-5`}>
                    <div className="text-2xl mb-2">{stat.icon}</div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{stat.label}</p>
                    <p className={`text-3xl font-black tabular-nums ${stat.color}`}>
                      <AnimatedNumber value={stat.value} />
                    </p>
                  </div>
                ))}
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
