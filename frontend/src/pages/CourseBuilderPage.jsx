import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  BookOpen, 
  Plus, 
  Menu, 
  ArrowLeft, 
  Save, 
  Eye, 
  EyeOff, 
  FolderPlus, 
  ChevronRight, 
  ChevronDown, 
  GripVertical, 
  Video, 
  FileText, 
  CheckCircle,
  HelpCircle,
  Loader2,
  Trash2
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function CourseBuilderPage({ courseId }) {
  const course_id = courseId;
  const navigate = (path) => {
    if (path === -1) {
      window.history.back();
    } else {
      window.location.pathname = path;
    }
  };
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals & Forms State
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonVideo, setNewLessonVideo] = useState('');

  // UI state
  const [expandedModules, setExpandedModules] = useState({});
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchCourseContent = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/teacher/courses/${course_id}/content`);
      setCourse(res.data);
      // Auto expand modules
      const initialExpand = {};
      res.data?.modules?.forEach(m => {
        initialExpand[m.module_id] = true;
      });
      setExpandedModules(initialExpand);
      setError(null);
    } catch (err) {
      console.error('Error fetching course tree:', err);
      setError('Không thể lấy nội dung khóa học. Vui lòng kiểm tra lại ID khóa học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (course_id) {
      fetchCourseContent();
    }
  }, [course_id]);

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const handleAddModule = async (e) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;

    try {
      setIsActionLoading(true);
      const res = await axios.post(`${API_URL}/api/teacher/modules`, {
        course_id: course_id,
        title: newModuleTitle.trim()
      });
      toast.success('Thêm chương mới thành công!');
      setNewModuleTitle('');
      setShowAddModuleModal(false);
      
      // Update local state with the new empty module to avoid full re-fetch
      setCourse(prev => {
        const updatedModules = [...prev.modules, { ...res.data, lessons: [] }];
        return { ...prev, modules: updatedModules };
      });
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi thêm chương mới');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;

    try {
      setIsActionLoading(true);
      const res = await axios.post(`${API_URL}/api/teacher/lessons`, {
        module_id: activeModuleId,
        title: newLessonTitle.trim(),
        video_url: newLessonVideo.trim()
      });
      toast.success('Thêm bài học mới thành công!');
      setNewLessonTitle('');
      setNewLessonVideo('');
      setShowAddLessonModal(false);

      // Append new lesson to target module
      setCourse(prev => {
        const updatedModules = prev.modules.map(m => {
          if (m.module_id === activeModuleId) {
            return {
              ...m,
              lessons: [...m.lessons, { ...res.data, materials: [] }]
            };
          }
          return m;
        });
        return { ...prev, modules: updatedModules };
      });
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi thêm bài học mới');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!course) return;
    const currentStatus = course.visibility_status;
    const nextStatus = currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';

    try {
      setIsActionLoading(true);
      await axios.put(`${API_URL}/api/teacher/courses/${course_id}/visibility`, {
        visibility_status: nextStatus
      });
      setCourse(prev => ({ ...prev, visibility_status: nextStatus }));
      toast.success(`Đã chuyển trạng thái khóa học sang ${nextStatus === 'PUBLISHED' ? 'CÔNG KHAI' : 'BẢN NHÁP'}!`);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi cập nhật trạng thái hiển thị');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Drag and Drop Logic
  const handleDragStart = (e, lessonId, index, moduleId) => {
    e.dataTransfer.setData('lessonId', lessonId);
    e.dataTransfer.setData('index', index.toString());
    e.dataTransfer.setData('moduleId', moduleId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetIndex, targetModuleId) => {
    e.preventDefault();
    const sourceLessonId = e.dataTransfer.getData('lessonId');
    const sourceIndex = parseInt(e.dataTransfer.getData('index'), 10);
    const sourceModuleId = e.dataTransfer.getData('moduleId');

    if (sourceModuleId !== targetModuleId) {
      toast.error('Chỉ có thể kéo thả sắp xếp bài học trong cùng một chương!');
      return;
    }

    if (sourceIndex === targetIndex) return;

    const targetModule = course.modules.find(m => m.module_id === targetModuleId);
    if (!targetModule) return;

    const reorderedLessons = Array.from(targetModule.lessons);
    const [removed] = reorderedLessons.splice(sourceIndex, 1);
    reorderedLessons.splice(targetIndex, 0, removed);

    // Optimistically update frontend state
    const updatedModules = course.modules.map(m => {
      if (m.module_id === targetModuleId) {
        return { ...m, lessons: reorderedLessons };
      }
      return m;
    });

    setCourse(prev => ({ ...prev, modules: updatedModules }));

    // Send order update to database
    try {
      const lessonIds = reorderedLessons.map(l => l.lesson_id);
      await axios.put(`${API_URL}/api/teacher/lessons/reorder`, {
        module_id: targetModuleId,
        lesson_ids: lessonIds
      });
      toast.success('Cập nhật thứ tự bài học thành công!');
    } catch (err) {
      console.error('Error reordering lessons:', err);
      toast.error('Lỗi khi cập nhật thứ tự bài học trên máy chủ');
      fetchCourseContent(); // rollback state
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center gap-4">
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
        <p className="text-slate-400 font-medium">Đang tải cấu trúc khóa học...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center">
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl max-w-md">
          <HelpCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Đã xảy ra lỗi</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button 
            onClick={() => navigate(-1)} 
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition duration-200"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-850 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl transition duration-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Trình tạo khóa học
              <span className="text-slate-500 text-sm font-normal">| Không gian làm việc giáo viên</span>
            </h1>
            <p className="text-xs text-indigo-400/90 font-medium">{course.title}</p>
          </div>
        </div>

        {/* Visibility Controls */}
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
            course.visibility_status === 'PUBLISHED' 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' 
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
          }`}>
            {course.visibility_status === 'PUBLISHED' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {course.visibility_status === 'PUBLISHED' ? 'Công khai' : 'Bản nháp'}
          </span>

          <button
            onClick={handleToggleVisibility}
            disabled={isActionLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition duration-300 shadow-lg ${
              course.visibility_status === 'PUBLISHED'
                ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/20'
            } disabled:opacity-50`}
          >
            {course.visibility_status === 'PUBLISHED' ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>Ẩn khóa học</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>Công khai khóa học</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-extrabold text-white">Đề cương khóa học</h2>
            <p className="text-slate-400 text-sm mt-1">Xây dựng chương trình học, kéo thả sắp xếp bài học linh hoạt.</p>
          </div>

          <button
            onClick={() => setShowAddModuleModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition duration-200 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20"
          >
            <FolderPlus className="w-4.5 h-4.5" />
            <span>Thêm Chương</span>
          </button>
        </div>

        {/* Modules Tree */}
        {course.modules && course.modules.length > 0 ? (
          <div className="space-y-6">
            {course.modules.map((module, mIdx) => (
              <div 
                key={module.module_id}
                className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl"
              >
                {/* Module Header */}
                <div 
                  className="flex items-center justify-between px-6 py-4.5 bg-slate-900/60 border-b border-slate-850 cursor-pointer select-none hover:bg-slate-850/30 transition duration-150"
                  onClick={() => toggleModule(module.module_id)}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-500/20">
                      {mIdx + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100 tracking-tight text-[15px]">{module.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {module.lessons ? module.lessons.length : 0} bài học
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setActiveModuleId(module.module_id);
                        setShowAddLessonModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-bold border border-slate-700 transition duration-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Bài học</span>
                    </button>

                    <button 
                      onClick={() => toggleModule(module.module_id)}
                      className="p-1.5 text-slate-500 hover:text-slate-350 rounded-lg transition duration-200"
                    >
                      {expandedModules[module.module_id] ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Lessons List (Collapsible) */}
                {expandedModules[module.module_id] && (
                  <div className="p-4 bg-slate-900/40 space-y-2.5">
                    {module.lessons && module.lessons.length > 0 ? (
                      module.lessons.map((lesson, lIdx) => (
                        <div
                          key={lesson.lesson_id}
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, lesson.lesson_id, lIdx, module.module_id)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, lIdx, module.module_id)}
                          className="group bg-slate-850 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col gap-3 transition duration-150 drag-target cursor-grab active:cursor-grabbing"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-slate-500 group-hover:text-slate-450 cursor-grab active:cursor-grabbing p-1">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-indigo-450 uppercase tracking-wide">Bài {lIdx + 1}</span>
                                <h4 className="font-semibold text-slate-100 text-sm mt-0.5">{lesson.title}</h4>
                                {lesson.video_url && (
                                  <span className="inline-flex items-center gap-1 text-slate-400 text-xs mt-1 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800">
                                    <Video className="w-3 h-3 text-red-400/90" />
                                    <span className="truncate max-w-[280px]">{lesson.video_url}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Lesson Materials */}
                          {lesson.materials && lesson.materials.length > 0 && (
                            <div className="mt-1 pl-8 border-l border-slate-800 space-y-1.5">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Tài liệu đính kèm:</span>
                              {lesson.materials.map(material => (
                                <div 
                                  key={material.material_id}
                                  className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/30 p-2 rounded-lg border border-slate-800/60 max-w-md"
                                >
                                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                                  <span className="truncate flex-1 font-medium">{material.title}</span>
                                  {material.content_url && (
                                    <a 
                                      href={material.content_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-indigo-400 hover:underline font-semibold text-[10px]"
                                    >
                                      Xem file
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                        <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-450">Chưa có bài học nào trong chương này.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-slate-900 border border-slate-800/80 rounded-2xl shadow-xl">
            <BookOpen className="w-16 h-16 text-indigo-500/10 border border-indigo-500/5 p-4 rounded-3xl mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-200">Không có chương nào</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">Khóa học này hiện chưa được cấu trúc chương trình. Hãy bắt đầu bằng cách thêm chương đầu tiên.</p>
            <button
              onClick={() => setShowAddModuleModal(true)}
              className="mt-6 px-6 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-sm font-semibold transition duration-200 shadow-lg shadow-indigo-600/10"
            >
              Thêm Chương Đầu Tiên
            </button>
          </div>
        )}
      </main>

      {/* Modal: Add Module */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-base text-white">Thêm Chương Mới</h3>
              <button 
                onClick={() => { setShowAddModuleModal(false); setNewModuleTitle(''); }}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddModule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-450 mb-1.5">Tên Chương</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Chương 1: Giới thiệu cơ bản"
                  value={newModuleTitle}
                  onChange={e => setNewModuleTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition duration-150"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModuleModal(false); setNewModuleTitle(''); }}
                  className="px-4.5 py-2 bg-slate-800 hover:bg-slate-750 rounded-xl text-sm font-medium text-slate-300 transition duration-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold text-white shadow-md shadow-indigo-600/10 transition duration-200 disabled:opacity-50"
                >
                  {isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Lưu lại</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Lesson */}
      {showAddLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-base text-white">Thêm Bài Học Mới</h3>
              <button 
                onClick={() => { setShowAddLessonModal(false); setNewLessonTitle(''); setNewLessonVideo(''); }}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddLesson} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-450 mb-1.5">Tiêu Đề Bài Học</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bài 1: Chữ cái và nguyên âm"
                  value={newLessonTitle}
                  onChange={e => setNewLessonTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-450 mb-1.5">Video URL (Không bắt buộc)</label>
                <input
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={newLessonVideo}
                  onChange={e => setNewLessonVideo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 transition duration-150"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddLessonModal(false); setNewLessonTitle(''); setNewLessonVideo(''); }}
                  className="px-4.5 py-2 bg-slate-800 hover:bg-slate-750 rounded-xl text-sm font-medium text-slate-300 transition duration-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold text-white shadow-md shadow-indigo-600/10 transition duration-200 disabled:opacity-50"
                >
                  {isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Lưu lại</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
