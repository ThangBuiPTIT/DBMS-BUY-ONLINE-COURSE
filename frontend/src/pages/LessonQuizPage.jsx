import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, CheckCircle, XCircle, ChevronRight, ArrowLeft, ArrowRight, Trophy, HelpCircle } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { Card, Badge, PrimaryButton, GhostButton } from '../components/ui';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import { navigate } from '../lib/router';

export default function LessonQuizPage({ lessonId }) {
  const [parts, setParts] = useState([]);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    async function fetchParts() {
      try {
        const res = await api.get(`/api/microlearning/lessons/${lessonId}/parts`);
        setParts(res.data || []);
        if (res.data?.[0]?.part_type === 'quiz') fetchQuestions(res.data[0].part_id);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    fetchParts();
  }, [lessonId]);

  const fetchQuestions = async (partId) => {
    setLoadingQuestions(true);
    try {
      const res = await api.get(`/api/microlearning/parts/${partId}/questions`);
      setQuestions(res.data || []);
      setCurrentQuestionIndex(0); setSelectedAnswer(null); setIsAnswered(false);
      setScore(0); setShowResult(false);
    } catch { /* silent */ }
    finally { setLoadingQuestions(false); }
  };

  const handleNextPart = () => {
    const nextIndex = currentPartIndex + 1;
    if (nextIndex < parts.length) {
      setCurrentPartIndex(nextIndex);
      const nextPart = parts[nextIndex];
      if (nextPart.part_type === 'quiz') fetchQuestions(nextPart.part_id);
    }
  };

  const handlePrevPart = () => {
    const prevIndex = currentPartIndex - 1;
    if (prevIndex >= 0) setCurrentPartIndex(prevIndex);
  };

  const handleAnswerClick = (option) => {
    if (isAnswered) return;
    setSelectedAnswer(option); setIsAnswered(true);
    if (option === questions[currentQuestionIndex].correct_answer) setScore((s) => s + 1);
  };

  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentQuestionIndex(nextIndex); setSelectedAnswer(null); setIsAnswered(false);
    } else { setShowResult(true); }
  };

  const currentPart = parts[currentPartIndex];

  return (
    <AppLayout
      role="student"
      currentPath="/microlearning/lessons"
      title="Bài học & Trắc nghiệm"
      subtitle="Tương tác học tập"
      actions={
        <GhostButton
          size="sm"
          icon={<ArrowLeft size={14} strokeWidth={1.8} />}
          onClick={() => navigate('/microlearning/roadmap')}
        >
          Quay lại lộ trình
        </GhostButton>
      }
    >
      <div className="p-8 flex items-start justify-center min-h-[60vh]">
        <div className="w-full max-w-2xl">
          {loading ? (
            <Card padding="p-12" className="flex flex-col items-center justify-center gap-4">
              <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-muted font-medium">Đang tải nội dung bài học...</p>
            </Card>
          ) : parts.length === 0 ? (
            <Card>
              <EmptyState
                title="Không tìm thấy nội dung bài học"
                message="Bài học này chưa có nội dung."
                action={<PrimaryButton onClick={() => navigate('/microlearning/roadmap')}>Quay lại lộ trình</PrimaryButton>}
              />
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2 justify-center">
                {parts.map((p, idx) => (
                  <div
                    key={p.part_id}
                    className={`h-2.5 rounded-full transition-all ${
                      idx === currentPartIndex
                        ? 'w-10 bg-primary'
                        : idx < currentPartIndex
                          ? 'w-6 bg-primary/40'
                          : 'w-2.5 bg-divider'
                    }`}
                  />
                ))}
              </div>

              {currentPart.part_type === 'theory' && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
                  className="bg-surface border border-divider rounded-3xl p-8 md:p-10 space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary-light text-primary rounded-2xl border border-primary/30">
                      <BookOpen size={20} strokeWidth={1.8} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Phần {currentPart.order_index} • Lý thuyết</span>
                      <h2 className="text-xl font-bold text-heading mt-0.5">{currentPart.title}</h2>
                    </div>
                  </div>

                  <div className="text-body leading-relaxed text-sm whitespace-pre-line border-t border-divider pt-6">
                    {currentPart.content}
                  </div>

                  <div className="flex justify-end pt-4">
                    <PrimaryButton size="lg" icon={<ChevronRight size={16} strokeWidth={1.8} />} onClick={handleNextPart}>
                      Làm bài trắc nghiệm
                    </PrimaryButton>
                  </div>
                </motion.div>
              )}

              {currentPart.part_type === 'quiz' && (
                <div>
                  {loadingQuestions ? (
                    <Card padding="p-12" className="flex flex-col items-center justify-center gap-4">
                      <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-muted font-medium">Đang tải câu hỏi...</p>
                    </Card>
                  ) : questions.length === 0 ? (
                    <Card>
                      <EmptyState title="Chưa có câu hỏi" message="Chưa có câu hỏi trắc nghiệm nào cho phần này." />
                    </Card>
                  ) : showResult ? (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="bg-surface border border-divider rounded-3xl p-10 text-center space-y-6"
                    >
                      <div className="w-20 h-20 bg-primary-light border border-primary/30 text-primary rounded-3xl flex items-center justify-center mx-auto">
                        <Trophy size={36} strokeWidth={1.8} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-primary tracking-widest uppercase">Hoàn thành bài tập</span>
                        <h2 className="text-2xl font-bold text-heading mt-1">Kết quả luyện tập</h2>
                        <p className="text-xs text-muted mt-1">Chúc mừng bạn đã hoàn tất phần tương tác bài học!</p>
                      </div>

                      <div className="py-6 bg-base border border-divider rounded-2xl max-w-xs mx-auto space-y-1">
                        <p className="text-xs text-muted font-bold uppercase tracking-wider">Điểm số của bạn</p>
                        <p className="text-4xl font-bold text-primary">
                          {score} <span className="text-lg text-muted">/ {questions.length}</span>
                        </p>
                        <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                          Chính xác {Math.round((score / questions.length) * 100)}%
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-3 pt-4">
                        {currentPartIndex > 0 && (
                          <GhostButton onClick={handlePrevPart}>Xem lý thuyết</GhostButton>
                        )}
                        <PrimaryButton
                          icon={<ArrowRight size={14} strokeWidth={1.8} />}
                          onClick={() => navigate('/microlearning/roadmap')}
                        >
                          Quay lại lộ trình
                        </PrimaryButton>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between text-xs font-bold text-muted">
                        <span>CÂU HỎI {currentQuestionIndex + 1} / {questions.length}</span>
                        <span className="text-primary">{Math.round((currentQuestionIndex / questions.length) * 100)}% hoàn thành</span>
                      </div>

                      <div className="w-full h-2 bg-divider rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }} />
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.div
                          key={currentQuestionIndex}
                          initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="bg-surface border border-divider rounded-3xl p-8 space-y-6"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className="w-9 h-9 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0 font-bold">
                              <HelpCircle size={18} strokeWidth={1.8} />
                            </div>
                            <h3 className="text-lg font-bold text-heading leading-snug">
                              {questions[currentQuestionIndex].question_text}
                            </h3>
                          </div>

                          <div className="grid grid-cols-1 gap-3 pt-2">
                            {questions[currentQuestionIndex].options_json?.map((option, idx) => {
                              const isSelected = selectedAnswer === option;
                              const isCorrect = option === questions[currentQuestionIndex].correct_answer;
                              let cls = 'border-divider bg-surface text-body hover:border-primary/40 hover:bg-primary-light/30';
                              if (isAnswered) {
                                if (isCorrect) cls = 'border-emerald-500 bg-emerald-50 text-emerald-700';
                                else if (isSelected) cls = 'border-red-500 bg-red-50 text-red-700';
                                else cls = 'border-divider bg-surface text-muted opacity-60';
                              }
                              return (
                                <button
                                  key={idx} disabled={isAnswered} onClick={() => handleAnswerClick(option)}
                                  className={`w-full px-5 py-4 border rounded-2xl text-left text-sm font-semibold transition-colors flex items-center justify-between ${cls}`}
                                >
                                  <span>{option}</span>
                                  {isAnswered && isCorrect && <CheckCircle size={16} className="text-emerald-600 shrink-0 ml-2" />}
                                  {isAnswered && isSelected && !isCorrect && <XCircle size={16} className="text-red-600 shrink-0 ml-2" />}
                                </button>
                              );
                            })}
                          </div>

                          {isAnswered && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              className="flex justify-end pt-4 border-t border-divider">
                              <PrimaryButton
                                icon={<ChevronRight size={14} strokeWidth={1.8} />}
                                onClick={handleNextQuestion}
                              >
                                {currentQuestionIndex + 1 === questions.length ? 'Xem kết quả' : 'Tiếp tục'}
                              </PrimaryButton>
                            </motion.div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
