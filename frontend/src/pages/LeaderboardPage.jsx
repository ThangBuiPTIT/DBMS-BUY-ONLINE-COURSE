import React, { useEffect, useState, useRef } from 'react';
import { Trophy, Flame, Award, Activity } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { Card, StatCard, Badge } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { api, getCurrentUser } from '../api/client';

const FALLBACK_STUDENT_ID = '74cc1ba2-509e-4348-8722-a0a84f8ee266';

const RANK_META = {
  1: { badge: '🥇', name: 'Quán quân',  ring: 'ring-amber-300' },
  2: { badge: '🥈', name: 'Á quân',    ring: 'ring-slate-300' },
  3: { badge: '🥉', name: 'Top 3',     ring: 'ring-orange-300' },
};

const AVATAR_COLORS = [
  'bg-primary text-white',
  'bg-emerald-500 text-white',
  'bg-rose-500 text-white',
  'bg-amber-500 text-white',
  'bg-violet-500 text-white',
  'bg-cyan-500 text-white',
];

const avatarColor = (rank) => AVATAR_COLORS[(rank - 1) % AVATAR_COLORS.length];
const avatarLetter = (name) => (name || '?').trim()[0]?.toUpperCase() || '?';

const AnimatedNumber = ({ value }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value || 0;
    if (start === end) return;
    const duration = 1000;
    const step = Math.max(1, Math.ceil(end / (duration / 16)));
    const timer = setInterval(() => {
      start = Math.min(start + step, end);
      setDisplay(start);
      if (start >= end) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}</>;
};

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [myStreak, setMyStreak] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = getCurrentUser()?.user_id || FALLBACK_STUDENT_ID;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [lbRes, streakRes] = await Promise.all([
          api.get('/api/gamification/leaderboard?limit=20'),
          api.get(`/api/gamification/streak/${userId}`),
        ]);
        setLeaderboard(lbRes.data.leaderboard || []);
        setMyStreak(streakRes.data);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const isStreakActive = myStreak && myStreak.current_streak > 0;
  const topPodium = [top3[1], top3[0], top3[2]].filter(Boolean);
  const avgStreak = leaderboard.length
    ? Math.round(leaderboard.reduce((s, e) => s + (e.current_streak || 0), 0) / leaderboard.length)
    : 0;
  const maxAchievements = leaderboard.length
    ? Math.max(...leaderboard.map((e) => e.total_achievements || 0))
    : 0;

  return (
    <AppLayout
      role="student"
      currentPath="/leaderboard"
      title="Bảng xếp hạng"
      subtitle="Cạnh tranh lành mạnh — Chinh phục đỉnh cao"
      actions={
        <Badge color="primary">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
            Live Rankings
          </span>
        </Badge>
      }
    >
      <div className="p-8 max-w-5xl mx-auto">
        {loading ? (
          <LoadingSpinner label="Đang tải bảng xếp hạng..." />
        ) : (
          <div className="space-y-8">
            <Card padding="p-6" className={isStreakActive ? 'border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50' : ''}>
              <div className="flex items-center gap-6">
                <div className="flex items-end gap-1 text-orange-500">
                  <Flame size={28} strokeWidth={1.8} className={isStreakActive ? 'opacity-100' : 'opacity-30'} />
                  <Flame size={40} strokeWidth={1.8} className={isStreakActive ? 'opacity-100' : 'opacity-30'} />
                  <Flame size={28} strokeWidth={1.8} className={isStreakActive ? 'opacity-100' : 'opacity-30'} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Streak hiện tại của bạn</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-5xl font-bold tabular-nums ${isStreakActive ? 'text-orange-500' : 'text-muted'}`}>
                      {myStreak?.current_streak ?? 0}
                    </span>
                    <span className={`text-lg font-bold ${isStreakActive ? 'text-orange-500' : 'text-muted'}`}>ngày</span>
                  </div>
                  <p className={`text-sm mt-1 ${isStreakActive ? 'text-orange-600' : 'text-muted'}`}>
                    {isStreakActive ? 'Tuyệt vời! Đừng để chuỗi bị gián đoạn nhé!' : 'Hãy học bài hôm nay để bắt đầu chuỗi streak!'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Kỷ lục cao nhất</p>
                  <p className={`text-3xl font-bold tabular-nums ${myStreak?.highest_streak > 0 ? 'text-amber-500' : 'text-muted'}`}>
                    {myStreak?.highest_streak ?? 0}
                  </p>
                  <p className="text-xs text-muted mt-0.5">ngày liên tiếp</p>
                </div>
              </div>
            </Card>

            {top3.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-heading mb-5 flex items-center gap-2">
                  <Trophy size={18} strokeWidth={1.8} className="text-amber-500" />
                  Top 3 học viên xuất sắc
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {topPodium.map((entry) => {
                    const meta = RANK_META[entry.rank];
                    const isFirst = entry.rank === 1;
                    return (
                      <Card
                        key={entry.rank}
                        padding="p-6"
                        className={`text-center flex flex-col items-center gap-3 ${isFirst ? 'md:-mt-4 ring-2 ring-amber-300' : ''}`}
                      >
                        <div className="text-2xl -mt-3">{meta.badge}</div>
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white ${avatarColor(entry.rank)} ${isFirst ? 'ring-4 ring-amber-300' : ''}`}>
                          {avatarLetter(entry.full_name)}
                        </div>
                        <div>
                          <p className="font-bold text-base text-heading">{entry.full_name}</p>
                          <p className="text-xs text-muted font-mono mt-0.5">#{entry.rank} • {meta.name}</p>
                        </div>
                        <div className="w-full grid grid-cols-2 gap-2 mt-2">
                          <div className="bg-base rounded-xl p-2.5 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Streak</p>
                            <p className={`text-xl font-bold mt-0.5 ${isStreakActive ? 'text-orange-500' : 'text-heading'}`}>
                              {entry.current_streak}
                            </p>
                          </div>
                          <div className="bg-base rounded-xl p-2.5 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Thành tích</p>
                            <p className="text-xl font-bold mt-0.5 text-primary">{entry.total_achievements}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted border-t border-divider pt-2 w-full text-center">
                          Kỷ lục: <span className="font-bold text-amber-500">{entry.highest_streak}</span> ngày
                        </p>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-base font-bold text-heading mb-4 flex items-center gap-2">
                <Activity size={18} strokeWidth={1.8} className="text-primary" />
                Bảng xếp hạng đầy đủ
              </h2>
              <Card padding="p-0">
                <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-muted border-b border-divider bg-base">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-5">Học viên</div>
                  <div className="col-span-2 text-center">Streak</div>
                  <div className="col-span-2 text-center">Kỷ lục</div>
                  <div className="col-span-2 text-center">Thành tích</div>
                </div>
                {leaderboard.length === 0 ? (
                  <EmptyState icon="🏆" title="Chưa có dữ liệu" message="Hãy bắt đầu học để lên bảng xếp hạng!" />
                ) : (
                  leaderboard.map((entry) => (
                    <div
                      key={entry.rank}
                      className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center border-b border-divider last:border-0 hover:bg-base/60 transition-colors"
                    >
                      <div className="col-span-1 text-center">
                        <span className={`inline-flex h-7 w-7 rounded-full items-center justify-center text-xs font-bold text-white ${avatarColor(entry.rank)}`}>
                          {entry.rank}
                        </span>
                      </div>
                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(entry.rank)}`}>
                          {avatarLetter(entry.full_name)}
                        </div>
                        <span className="font-semibold text-sm text-heading truncate">{entry.full_name}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`text-sm font-bold ${entry.current_streak > 0 ? 'text-orange-500' : 'text-muted'}`}>
                          {entry.current_streak > 0 ? entry.current_streak : '—'}
                        </span>
                      </div>
                      <div className="col-span-2 text-center text-sm text-body font-semibold">{entry.highest_streak || '—'}</div>
                      <div className="col-span-2 text-center text-sm text-primary font-semibold">
                        {entry.total_achievements > 0 ? entry.total_achievements : '—'}
                      </div>
                    </div>
                  ))
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Tổng người tham gia" value={<AnimatedNumber value={leaderboard.length} />} icon={<Trophy size={16} strokeWidth={1.8} />} />
              <StatCard label="Streak TB toàn bảng"  value={avgStreak} icon={<Flame size={16} strokeWidth={1.8} />} />
              <StatCard label="Thành tích nhiều nhất" value={maxAchievements} icon={<Award size={16} strokeWidth={1.8} />} />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
