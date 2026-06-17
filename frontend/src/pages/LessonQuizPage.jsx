import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  ChevronRight, 
  ArrowLeft,
  Trophy
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

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

  // Load lesson parts
  useEffect(() => {
    async function fetchParts() {
      try {
        const res = await axios.get(`${API_URL}/api/microlearning/lessons/${lessonId}/parts`);
        setParts(res.data || []);
        
        // If first part is a quiz, load its questions immediately
        if (res.data && res.data.length > 0 && res.data[0].part_type === 'quiz') {
          fetchQuestions(res.data[0].part_id);
        }
      } catch (err) {
        console.error('Error fetching parts:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchParts();
  }, [lessonId]);

  const fetchQuestions = async (partId) => {
    setLoadingQuestions(true);
    try {
      const res = await axios.get(`${API_URL}/api/microlearning/parts/${partId}/questions`);
      setQuestions(res.data || []);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setScore(0);
      setShowResult(false);
    } catch (err) {
      console.error('Error fetching questions:', err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleNextPart = () => {
    const nextIndex = currentPartIndex + 1;
    if (nextIndex < parts.length) {
      setCurrentPartIndex(nextIndex);
      const nextPart = parts[nextIndex];
      if (nextPart.part_type === 'quiz') {
        fetchQuestions(nextPart.part_id);
      }
    }
  };

  const handlePrevPart = () => {
    const prevIndex = currentPartIndex - 1;
    if (prevIndex >= 0) {
      setCurrentPartIndex(prevIndex);
    }
  };

  const handleAnswerClick = (option) => {
    if (isAnswered) return;
    
    setSelectedAnswer(option);
    setIsAnswered(true);
    
    const currentQuestion = questions[currentQuestionIndex];
    if (option === currentQuestion.correct_answer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentQuestionIndex(nextIndex);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      setShowResult(true);
    }
  };

  const currentPart = parts[currentPartIndex];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-slate-800 px-8 py-5 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => window.location.href = '/microlearning/roadmap'}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại lộ trình
          </button>
          <div className="text-center">
            <span className="text-[10px] uppercase font-bold text-teal-400 tracking-wider">Bài học & Trắc nghiệm</span>
            <h1 className="text-sm font-extrabold text-white mt-0.5 font-sans">Tương Tác Học Tập</h1>
          </div>
          <div className="w-24"></div>
        </div>
      </header>

      {/* Main body */}
      <main className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          {loading ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-12 flex flex-col items-center justify-center gap-4 animate-pulse">
              <div className="h-10 w-10 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500 font-medium">Đang tải nội dung bài học...</p>
            </div>
          ) : parts.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-12 text-center space-y-4">
              <p className="text-lg font-bold text-slate-400">Không tìm thấy nội dung bài học</p>
              <button 
                onClick={() => window.location.href = '/microlearning/roadmap'}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 rounded-xl text-sm font-bold transition-all duration-200"
              >
                Quay lại lộ trình
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Part Tabs / Progress Indicators */}
              <div className="flex items-center gap-2 justify-center">
                {parts.map((p, idx) => (
                  <div 
                    key={p.part_id}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      idx === currentPartIndex 
                        ? 'w-10 bg-teal-500' 
                        : idx < currentPartIndex 
                          ? 'w-6 bg-teal-500/40' 
                          : 'w-2.5 bg-slate-800'
                    }`}
                  />
                ))}
              </div>

              {/* Theory Content Card */}
              {currentPart.part_type === 'theory' && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-8 md:p-10 space-y-6 shadow-xl shadow-slate-950/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-teal-500/10 text-teal-400 rounded-2xl border border-teal-500/20">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider font-mono">Phần {currentPart.order_index} • Lý thuyết</span>
                      <h2 className="text-xl font-extrabold text-white mt-0.5">{currentPart.title}</h2>
                    </div>
                  </div>

                  <div className="text-slate-300 leading-relaxed text-sm whitespace-pre-line border-t border-slate-800/80 pt-6">
                    {currentPart.content}
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={handleNextPart}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-sm font-bold rounded-2xl transition-all duration-200 shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20"
                    >
                      Làm bài trắc nghiệm <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Quiz Content Card */}
              {currentPart.part_type === 'quiz' && (
                <div>
                  {loadingQuestions ? (
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-12 flex flex-col items-center justify-center gap-4 animate-pulse">
                      <div className="h-10 w-10 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-slate-500 font-medium">Đang tải câu hỏi trắc nghiệm...</p>
                    </div>
                  ) : questions.length === 0 ? (
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-12 text-center space-y-4">
                      <p className="text-sm text-slate-500">Chưa có câu hỏi trắc nghiệm nào cho phần này.</p>
                      {currentPartIndex > 0 && (
                        <button
                          onClick={handlePrevPart}
                          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all duration-200"
                        >
                          Quay lại phần trước
                        </button>
                      )}
                    </div>
                  ) : showResult ? (
                    // Quiz Result Screen
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-10 text-center space-y-6 shadow-xl shadow-slate-950/20"
                    >
                      <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto text-4xl shadow-lg shadow-indigo-500/5">
                        <Trophy className="w-10 h-10" />
                      </div>
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-indigo-400 tracking-widest uppercase font-mono">Hoàn thành bài tập</span>
                        <h2 className="text-2xl font-black text-white">Kết Quả Luyện Tập</h2>
                        <p className="text-xs text-slate-500">Chúc mừng bạn đã hoàn tất phần tương tác bài học!</p>
                      </div>

                      <div className="py-6 bg-slate-950/40 border border-slate-800/60 rounded-2xl max-w-xs mx-auto space-y-1">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Điểm số của bạn</p>
                        <p className="text-4xl font-black text-teal-400">
                          {score} <span className="text-lg text-slate-600">/ {questions.length}</span>
                        </p>
                        <p className="text-[10px] text-teal-500/70 font-semibold mt-1">
                          Chính xác {Math.round((score / questions.length) * 100)}%
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-3 pt-4">
                        {currentPartIndex > 0 && (
                          <button
                            onClick={handlePrevPart}
                            className="px-5 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 transition-all duration-200"
                          >
                            Xem lý thuyết
                          </button>
                        )}
                        <button
                          onClick={() => window.location.href = '/microlearning/roadmap'}
                          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all duration-200"
                        >
                          Quay lại lộ trình <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    // Quiz Active Question Box
                    <div className="space-y-5">
                      {/* Question Header & Progress Bar */}
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>CÂU HỎI {currentQuestionIndex + 1} / {questions.length}</span>
                        <span className="text-teal-400">{Math.round(((currentQuestionIndex) / questions.length) * 100)}% HOÀN THÀNH</span>
                      </div>
                      
                      {/* Progress bar line */}
                      <div className="w-full h-2 bg-slate-900 border border-slate-800/80 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-teal-500 transition-all duration-300"
                          style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                        />
                      </div>

                      {/* Question & Options container */}
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={currentQuestionIndex}
                          initial={{ x: 50, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: -50, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-8 shadow-xl shadow-slate-950/20 space-y-6"
                        >
                          {/* Question Text */}
                          <div className="flex items-start gap-3.5">
                            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20 font-extrabold text-sm">
                              ?
                            </div>
                            <h3 className="text-lg font-bold text-white leading-snug">
                              {questions[currentQuestionIndex].question_text}
                            </h3>
                          </div>

                          {/* Options Buttons */}
                          <div className="grid grid-cols-1 gap-3 pt-2">
                            {questions[currentQuestionIndex].options_json && 
                             questions[currentQuestionIndex].options_json.map((option, idx) => {
                               const isCurrentSelected = selectedAnswer === option;
                               const isCorrectOption = option === questions[currentQuestionIndex].correct_answer;
                               
                               let btnStyle = "border-slate-800 bg-slate-900/30 text-slate-300 hover:border-slate-700/80 hover:bg-slate-800/20";
                               
                               if (isAnswered) {
                                 if (isCorrectOption) {
                                   btnStyle = "border-emerald-500 bg-emerald-950/20 text-emerald-300 shadow-md shadow-emerald-500/5";
                                 } else if (isCurrentSelected) {
                                   btnStyle = "border-rose-500 bg-rose-950/20 text-rose-300 shadow-md shadow-rose-500/5";
                                 } else {
                                   btnStyle = "border-slate-800 bg-slate-900/10 text-slate-500 opacity-60";
                                 }
                               }

                               return (
                                 <button
                                   key={idx}
                                   disabled={isAnswered}
                                   onClick={() => handleAnswerClick(option)}
                                   className={`w-full px-5 py-4 border rounded-2xl text-left text-sm font-semibold transition-all duration-200 flex items-center justify-between ${btnStyle}`}
                                 >
                                   <span>{option}</span>
                                   {isAnswered && isCorrectOption && (
                                     <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                                   )}
                                   {isAnswered && isCurrentSelected && !isCorrectOption && (
                                     <XCircle className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
                                   )}
                                 </button>
                               );
                            })}
                          </div>

                          {/* Next Button Footer */}
                          {isAnswered && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex justify-end pt-4 border-t border-slate-800"
                            >
                              <button
                                onClick={handleNextQuestion}
                                className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all duration-200 shadow-lg shadow-teal-500/10"
                              >
                                {currentQuestionIndex + 1 === questions.length ? "Xem kết quả" : "Tiếp tục"} 
                                <ChevronRight className="w-4 h-4" />
                              </button>
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
      </main>
    </div>
  );
}
