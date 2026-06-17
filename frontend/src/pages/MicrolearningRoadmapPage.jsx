import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ArrowRight, Sparkles, PlayCircle } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { Card, Badge, GhostButton } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import { navigate } from '../lib/router';

export default function MicrolearningRoadmapPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedUnits, setExpandedUnits] = useState({});

  useEffect(() => {
    api.get('/api/microlearning/roadmap')
      .then((res) => {
        setTopics(res.data || []);
        if (res.data?.[0]?.units?.[0]) {
          setExpandedUnits({ [res.data[0].units[0].unit_id]: true });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleUnit = (unitId) =>
    setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }));

  const totalLessons = topics.reduce((acc, topic) =>
    acc + (topic.units ? topic.units.reduce((uAcc, u) => uAcc + (u.lessons ? u.lessons.length : 0), 0) : 0), 0);

  const primaryItems = topics.map((topic) => ({
    id: `topic-${topic.topic_id}`,
    label: topic.title,
    active: false,
    onClick: () => {
      window.location.hash = `topic-${topic.topic_id}`;
    },
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4" />,
  }));

  return (
    <AppLayout
      role="student"
      currentPath="/microlearning/roadmap"
      title="Lộ trình học tập tự cường"
      subtitle="Chinh phục ngôn ngữ qua các bài học siêu nhỏ (Microlearning)"
      primaryItems={primaryItems}
      primaryLabel="Chủ đề"
      actions={
        <Badge color="primary">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={12} strokeWidth={2.5} className="animate-pulse" />
            {totalLessons} bài học
          </span>
        </Badge>
      }
    >
      <div className="p-8 max-w-3xl mx-auto">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-6 w-1/3 bg-base rounded-lg mb-3"></div>
                <div className="h-4 w-2/3 bg-base rounded-lg mb-6"></div>
                <div className="space-y-3">
                  <div className="h-12 bg-base rounded-2xl"></div>
                  <div className="h-12 bg-base rounded-2xl"></div>
                </div>
              </Card>
            ))}
          </div>
        ) : topics.length === 0 ? (
          <Card>
            <EmptyState
              icon="🗺️"
              title="Không tìm thấy lộ trình học tập nào"
              message="Dữ liệu lộ trình đang được cập nhật, vui lòng quay lại sau."
            />
          </Card>
        ) : (
          <div className="space-y-6">
            {topics.map((topic) => (
              <section
                key={topic.topic_id}
                id={`topic-${topic.topic_id}`}
                className="bg-surface border border-divider rounded-3xl p-6 md:p-8 space-y-6"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-primary text-white font-bold w-12 h-12 rounded-2xl flex items-center justify-center text-lg shrink-0">
                    {topic.topic_id}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-heading">{topic.title}</h2>
                    {topic.description && (
                      <p className="text-sm text-body mt-1 leading-relaxed">{topic.description}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {topic.units?.length > 0 ? (
                    topic.units.map((unit) => {
                      const isExpanded = !!expandedUnits[unit.unit_id];
                      return (
                        <Card
                          key={unit.unit_id}
                          padding="p-0"
                          className={`overflow-hidden transition-colors ${isExpanded ? 'border-primary' : ''}`}
                        >
                          <button
                            onClick={() => toggleUnit(unit.unit_id)}
                            className="w-full px-5 py-4 flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
                                isExpanded ? 'bg-primary text-white' : 'bg-base text-body'
                              }`}>
                                {unit.order_index}
                              </div>
                              <span className="font-bold text-sm text-heading truncate pr-4">{unit.title}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <Badge color="muted">{unit.lessons?.length || 0} bài học</Badge>
                              {isExpanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
                            </div>
                          </button>

                          <div className={`transition-all overflow-hidden ${isExpanded ? 'max-h-[800px] border-t border-divider' : 'max-h-0'}`}>
                            <div className="p-4 bg-base space-y-2">
                              {unit.lessons?.length > 0 ? (
                                unit.lessons.map((lesson) => (
                                  <div
                                    key={lesson.lesson_id}
                                    onClick={() => navigate(`/microlearning/lessons/${lesson.lesson_id}/quiz`)}
                                    className="group flex items-center justify-between p-3.5 rounded-xl bg-surface border border-divider hover:border-primary/40 cursor-pointer transition-colors"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="p-2 bg-primary-light text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                                        <PlayCircle size={16} strokeWidth={1.8} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-heading truncate group-hover:text-primary transition-colors">{lesson.title}</p>
                                        <p className="text-[10px] text-muted mt-0.5 font-mono">Bài {lesson.order_index} • Video</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity pr-2 shrink-0">
                                      Học ngay <ArrowRight size={14} strokeWidth={1.8} />
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-muted text-center py-4">Chương này chưa có bài học nào.</p>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted text-center py-4">Chủ đề này chưa có phần học nào.</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
