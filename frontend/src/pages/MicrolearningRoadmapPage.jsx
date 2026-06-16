import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BookOpen, 
  PlayCircle, 
  ChevronDown, 
  ChevronUp, 
  Award, 
  ArrowRight, 
  Sparkles, 
  Compass, 
  List, 
  HelpCircle 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function MicrolearningRoadmapPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedUnits, setExpandedUnits] = useState({});

  useEffect(() => {
    async function fetchRoadmap() {
      try {
        const res = await axios.get(`${API_URL}/api/microlearning/roadmap`);
        setTopics(res.data || []);
        
        // Auto expand the first unit of the first topic if available
        if (res.data && res.data.length > 0 && res.data[0].units && res.data[0].units.length > 0) {
          const firstUnitId = res.data[0].units[0].unit_id;
          setExpandedUnits({ [firstUnitId]: true });
        }
      } catch (err) {
        console.error('Error fetching roadmap:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRoadmap();
  }, []);

  const toggleUnit = (unitId) => {
    setExpandedUnits(prev => ({
      ...prev,
      [unitId]: !prev[unitId]
    }));
  };

  const totalLessons = topics.reduce((acc, topic) => {
    return acc + (topic.units ? topic.units.reduce((uAcc, unit) => uAcc + (unit.lessons ? unit.lessons.length : 0), 0) : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex overflow-hidden">
      {/* ---- Sidebar ---- */}
      <aside className="w-64 bg-slate-900/80 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-teal-500/10 p-2 rounded-xl border border-teal-500/20">
            <Compass className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <p className="font-extrabold tracking-wider text-sm uppercase text-teal-400">Lộ Trình Học</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Microlearning Roadmap</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3 px-2">Các Chủ Đề</p>
          <div className="space-y-1">
            {topics.map(topic => (
              <a
                key={topic.topic_id}
                href={`#topic-${topic.topic_id}`}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all duration-200"
              >
                <span>🎯</span>
                <span className="truncate">{topic.title}</span>
              </a>
            ))}
          </div>

          {/* Navigation links */}
          <div className="mt-6 pt-4 border-t border-slate-800/70 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3 px-2">Điều hướng</p>
            {[
              { path: '/dictionary', label: '📖 Từ điển Khmer' },
              { path: '/leaderboard', label: '🏆 Bảng xếp hạng' },
              { path: '/store', label: '🛍️ Cửa hàng' },
              { path: '/students/manage', label: '👥 Học viên' },
              { path: '/admin/dashboard', label: '⚙️ Admin' },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => window.location.pathname = item.path}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-800/40 hover:text-slate-300 transition-all duration-200 text-left"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ---- Main Content ---- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="border-b border-slate-800 px-8 py-5 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white mb-1">
                🗺️ Lộ Trình Học Tập Tự Cường
              </h1>
              <p className="text-xs text-slate-500">Chinh phục tiếng Khmer thông qua các bài học siêu nhỏ (Microlearning)</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl shrink-0">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span className="text-xs font-bold text-indigo-300">{totalLessons} Bài học</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {loading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6 animate-pulse">
                    <div className="h-6 w-1/3 bg-slate-800 rounded-lg mb-3"></div>
                    <div className="h-4 w-2/3 bg-slate-800 rounded-lg mb-6"></div>
                    <div className="space-y-3">
                      <div className="h-12 bg-slate-800 rounded-2xl"></div>
                      <div className="h-12 bg-slate-800 rounded-2xl"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : topics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="h-24 w-24 rounded-3xl bg-slate-800/50 border border-slate-700/40 flex items-center justify-center text-4xl">
                  🗺️
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-400">Không tìm thấy lộ trình học tập nào</p>
                  <p className="text-sm text-slate-600 mt-1">Dữ liệu lộ trình đang được cập nhật, vui lòng quay lại sau.</p>
                </div>
              </div>
            ) : (
              topics.map(topic => (
                <section 
                  key={topic.topic_id} 
                  id={`topic-${topic.topic_id}`}
                  className="bg-slate-900/40 border border-slate-800/50 rounded-[2rem] p-6 md:p-8 space-y-6"
                >
                  {/* Topic Title */}
                  <div className="flex items-start gap-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-extrabold w-12 h-12 rounded-2xl flex items-center justify-center text-lg shadow-lg shadow-indigo-500/20 shrink-0">
                      {topic.topic_id}
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-white">{topic.title}</h2>
                      <p className="text-sm text-slate-400 mt-1 leading-relaxed">{topic.description}</p>
                    </div>
                  </div>

                  {/* Units Accordion */}
                  <div className="space-y-3 pt-2">
                    {topic.units && topic.units.length > 0 ? (
                      topic.units.map(unit => {
                        const isExpanded = !!expandedUnits[unit.unit_id];
                        return (
                          <div 
                            key={unit.unit_id} 
                            className={`border rounded-2xl overflow-hidden transition-all duration-300 ${
                              isExpanded 
                                ? 'border-teal-500/40 bg-teal-950/10' 
                                : 'border-slate-800 bg-slate-900/20 hover:border-slate-700/60'
                            }`}
                          >
                            {/* Accordion Trigger */}
                            <button
                              onClick={() => toggleUnit(unit.unit_id)}
                              className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
                                  isExpanded ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {unit.order_index}
                                </div>
                                <span className="font-bold text-sm text-slate-200 truncate pr-4">{unit.title}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/40">
                                  {unit.lessons ? unit.lessons.length : 0} bài học
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                            </button>

                            {/* Accordion Content */}
                            <div 
                              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                                isExpanded ? 'max-h-[800px] border-t border-slate-800/50' : 'max-h-0'
                              }`}
                            >
                              <div className="p-4 bg-slate-950/20 space-y-2">
                                {unit.lessons && unit.lessons.length > 0 ? (
                                  unit.lessons.map(lesson => (
                                    <div 
                                      key={lesson.lesson_id}
                                      onClick={() => window.location.pathname = `/microlearning/lessons/${lesson.lesson_id}/quiz`}
                                      className="group flex items-center justify-between p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/50 hover:border-slate-700/60 hover:bg-slate-800/30 transition-all duration-200 cursor-pointer"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:bg-indigo-500/20 transition-colors shrink-0">
                                          <PlayCircle className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-200 truncate group-hover:text-white transition-colors">{lesson.title}</p>
                                          <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Bài {lesson.order_index} • Video</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity pr-2 shrink-0">
                                        Học ngay <ArrowRight className="w-3.5 h-3.5" />
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs text-slate-600 text-center py-4">Chương này chưa có bài học nào.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-600 text-center py-4">Chủ đề này chưa có phần học nào.</p>
                    )}
                  </div>
                </section>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
