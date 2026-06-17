import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import {
  BookOpen, Plus, ArrowLeft, Eye, EyeOff, FolderPlus,
  ChevronRight, ChevronDown, GripVertical, Video, FileText, X, HelpCircle
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { Card, Badge, PrimaryButton, GhostButton } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';
import { navigate } from '../lib/router';

export default function CourseBuilderPage({ courseId }) {
  const course_id = courseId;
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonVideo, setNewLessonVideo] = useState('');

  const [expandedModules, setExpandedModules] = useState({});
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchCourseContent = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/teacher/courses/${course_id}/content`);
      setCourse(res.data);
      const initialExpand = {};
      res.data?.modules?.forEach((m) => { initialExpand[m.module_id] = true; });
      setExpandedModules(initialExpand);
      setError(null);
    } catch (err) {
      setError('Không thể lấy nội dung khóa học. Vui lòng kiểm tra lại ID khóa học.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (course_id) fetchCourseContent(); }, [course_id]);

  const toggleModule = (moduleId) =>
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));

  const handleAddModule = async (e) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    try {
      setIsActionLoading(true);
      const res = await api.post('/api/teacher/modules', {
        course_id, title: newModuleTitle.trim(),
      });
      toast.success('Thêm chương mới thành công!');
      setNewModuleTitle(''); setShowAddModuleModal(false);
      setCourse((prev) => ({ ...prev, modules: [...prev.modules, { ...res.data, lessons: [] }] }));
    } catch {
      toast.error('Lỗi khi thêm chương mới');
    } finally { setIsActionLoading(false); }
  };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;
    try {
      setIsActionLoading(true);
      const res = await api.post('/api/teacher/lessons', {
        module_id: activeModuleId,
        title: newLessonTitle.trim(),
        video_url: newLessonVideo.trim(),
      });
      toast.success('Thêm bài học mới thành công!');
      setNewLessonTitle(''); setNewLessonVideo(''); setShowAddLessonModal(false);
      setCourse((prev) => ({
        ...prev,
        modules: prev.modules.map((m) =>
          m.module_id === activeModuleId
            ? { ...m, lessons: [...m.lessons, { ...res.data, materials: [] }] }
            : m),
      }));
    } catch {
      toast.error('Lỗi khi thêm bài học mới');
    } finally { setIsActionLoading(false); }
  };

  const handleToggleVisibility = async () => {
    if (!course) return;
    const nextStatus = course.visibility_status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      setIsActionLoading(true);
      await api.put(`/api/teacher/courses/${course_id}/visibility`, { visibility_status: nextStatus });
      setCourse((prev) => ({ ...prev, visibility_status: nextStatus }));
      toast.success(`Đã chuyển trạng thái sang ${nextStatus === 'PUBLISHED' ? 'CÔNG KHAI' : 'BẢN NHÁP'}!`);
    } catch {
      toast.error('Lỗi khi cập nhật trạng thái hiển thị');
    } finally { setIsActionLoading(false); }
  };

  const handleDragStart = (e, lessonId, index, moduleId) => {
    e.dataTransfer.setData('lessonId', lessonId);
    e.dataTransfer.setData('index', index.toString());
    e.dataTransfer.setData('moduleId', moduleId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e) => e.preventDefault();

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

    const module = course.modules.find((m) => m.module_id === targetModuleId);
    if (!module) return;

    const reordered = [...module.lessons];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setCourse((prev) => ({
      ...prev,
      modules: prev.modules.map((m) =>
        m.module_id === targetModuleId ? { ...m, lessons: reordered } : m),
    }));

    try {
      await api.put('/api/teacher/lessons/reorder', {
        module_id: targetModuleId,
        ordered_lesson_ids: reordered.map((l) => l.lesson_id),
      });
      toast.success('Đã sắp xếp lại bài học');
    } catch {
      toast.error('Lỗi khi lưu thứ tự');
      fetchCourseContent();
    }
  };

  const isPublished = course?.visibility_status === 'PUBLISHED';

  if (loading) {
    return (
      <AppLayout role="teacher" currentPath="/teacher/courses" title="Trình tạo khóa học" subtitle="Đang tải...">
        <div className="p-8"><LoadingSpinner /></div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout role="teacher" currentPath="/teacher/courses" title="Lỗi" subtitle="">
        <div className="p-8 max-w-md mx-auto">
          <Card>
            <EmptyState
              icon="⚠️"
              title="Không thể tải khóa học"
              message={error}
              action={<PrimaryButton onClick={() => navigate('/teacher/dashboard')}>Quay lại Dashboard</PrimaryButton>}
            />
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!course) return null;

  return (
    <AppLayout
      role="teacher"
      currentPath="/teacher/courses"
      title="Trình tạo khóa học"
      subtitle={course.title}
      actions={
        <>
          <Badge color={isPublished ? 'success' : 'warning'}>
            <span className="inline-flex items-center gap-1">
              {isPublished ? <Eye size={12} strokeWidth={2.5} /> : <EyeOff size={12} strokeWidth={2.5} />}
              {isPublished ? 'Công khai' : 'Bản nháp'}
            </span>
          </Badge>
          <PrimaryButton
            size="sm"
            icon={isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
            onClick={handleToggleVisibility}
            disabled={isActionLoading}
            className={isPublished ? '!bg-base !text-body hover:!bg-divider' : ''}
          >
            {isPublished ? 'Ẩn khóa học' : 'Công khai khóa học'}
          </PrimaryButton>
        </>
      }
    >
      <Toaster position="top-right" reverseOrder={false} />

      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-heading">Đề cương khóa học</h2>
            <p className="text-body text-sm mt-1">Xây dựng chương trình học, kéo thả sắp xếp bài học linh hoạt.</p>
          </div>

          <PrimaryButton
            icon={<FolderPlus size={14} strokeWidth={1.8} />}
            onClick={() => setShowAddModuleModal(true)}
          >
            Thêm Chương
          </PrimaryButton>
        </div>

        {course.modules && course.modules.length > 0 ? (
          <div className="space-y-6">
            {course.modules.map((module, mIdx) => (
              <Card key={module.module_id} padding="p-0" className="overflow-hidden">
                <div
                  className="flex items-center justify-between px-6 py-4 border-b border-divider cursor-pointer select-none hover:bg-base/60 transition-colors"
                  onClick={() => toggleModule(module.module_id)}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-primary-light text-primary flex items-center justify-center font-bold text-sm">
                      {mIdx + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-heading tracking-tight text-base">{module.title}</h3>
                      <p className="text-xs text-muted mt-0.5">{module.lessons?.length || 0} bài học</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <GhostButton
                      size="sm"
                      icon={<Plus size={12} />}
                      onClick={() => { setActiveModuleId(module.module_id); setShowAddLessonModal(true); }}
                    >
                      Thêm bài
                    </GhostButton>
                    {expandedModules[module.module_id]
                      ? <ChevronDown size={16} className="text-muted" />
                      : <ChevronRight size={16} className="text-muted" />}
                  </div>
                </div>

                {expandedModules[module.module_id] && (
                  <div className="p-4 space-y-2 bg-base/40">
                    {module.lessons?.length > 0 ? (
                      module.lessons.map((lesson, lIdx) => (
                        <div
                          key={lesson.lesson_id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, lesson.lesson_id, lIdx, module.module_id)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, lIdx, module.module_id)}
                          className="group bg-surface hover:bg-base/40 border border-divider hover:border-primary/40 rounded-xl p-4 flex flex-col gap-3 transition-colors cursor-grab active:cursor-grabbing"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-muted group-hover:text-body p-1">
                                <GripVertical size={16} strokeWidth={1.8} />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-primary uppercase tracking-wide">Bài {lIdx + 1}</span>
                                <h4 className="font-semibold text-heading text-sm mt-0.5">{lesson.title}</h4>
                                {lesson.video_url && (
                                  <span className="inline-flex items-center gap-1 text-body text-xs mt-1 bg-base px-2 py-0.5 rounded border border-divider">
                                    <Video size={12} className="text-red-500" />
                                    <span className="truncate max-w-[280px]">{lesson.video_url}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {lesson.materials && lesson.materials.length > 0 && (
                            <div className="mt-1 pl-8 border-l border-divider space-y-1.5">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-muted">Tài liệu đính kèm:</span>
                              {lesson.materials.map((material) => (
                                <div key={material.material_id} className="flex items-center gap-2 text-xs text-body bg-base p-2 rounded-lg border border-divider max-w-md">
                                  <FileText size={12} className="text-primary" />
                                  <span className="truncate flex-1 font-medium">{material.title}</span>
                                  {material.content_url && (
                                    <a href={material.content_url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold text-[10px]">
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
                      <div className="text-center py-8 border-2 border-dashed border-divider rounded-xl bg-surface">
                        <BookOpen size={28} className="text-muted mx-auto mb-2" />
                        <p className="text-xs text-body">Chưa có bài học nào trong chương này.</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<BookOpen size={36} className="text-primary" />}
              title="Không có chương nào"
              message="Khóa học này hiện chưa được cấu trúc chương trình. Hãy bắt đầu bằng cách thêm chương đầu tiên."
              action={<PrimaryButton onClick={() => setShowAddModuleModal(true)}>Thêm Chương Đầu Tiên</PrimaryButton>}
            />
          </Card>
        )}
      </div>

      {/* Add Module Modal */}
      <AnimatePresence>
        {showAddModuleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-surface border border-divider rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
            >
              <div className="px-6 py-4 border-b border-divider flex justify-between items-center">
                <h3 className="font-bold text-base text-heading">Thêm Chương Mới</h3>
                <button onClick={() => { setShowAddModuleModal(false); setNewModuleTitle(''); }} className="text-muted hover:text-heading hover:bg-base p-1 rounded-lg">
                  <X size={18} strokeWidth={1.8} />
                </button>
              </div>
              <form onSubmit={handleAddModule} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-body mb-1.5 uppercase tracking-wider">Tên chương</label>
                  <input
                    type="text" value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)}
                    placeholder="Ví dụ: Chương 1: Giới thiệu"
                    className="w-full bg-surface border border-divider focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <GhostButton className="flex-1 justify-center py-2.5" onClick={() => { setShowAddModuleModal(false); setNewModuleTitle(''); }} disabled={isActionLoading}>Hủy</GhostButton>
                  <PrimaryButton type="submit" className="flex-1 justify-center py-2.5" disabled={isActionLoading}>
                    {isActionLoading ? 'Đang tạo...' : 'Tạo chương'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Lesson Modal */}
      <AnimatePresence>
        {showAddLessonModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-surface border border-divider rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
            >
              <div className="px-6 py-4 border-b border-divider flex justify-between items-center">
                <h3 className="font-bold text-base text-heading">Thêm Bài Học</h3>
                <button onClick={() => { setShowAddLessonModal(false); setNewLessonTitle(''); setNewLessonVideo(''); }} className="text-muted hover:text-heading hover:bg-base p-1 rounded-lg">
                  <X size={18} strokeWidth={1.8} />
                </button>
              </div>
              <form onSubmit={handleAddLesson} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-body mb-1.5 uppercase tracking-wider">Tên bài học</label>
                  <input
                    type="text" value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)}
                    placeholder="Ví dụ: Bài 1: Lịch sử..."
                    className="w-full bg-surface border border-divider focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-body mb-1.5 uppercase tracking-wider">Video URL (tùy chọn)</label>
                  <input
                    type="url" value={newLessonVideo} onChange={(e) => setNewLessonVideo(e.target.value)}
                    placeholder="https://www.youtube.com/embed/..."
                    className="w-full bg-surface border border-divider focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <GhostButton className="flex-1 justify-center py-2.5" onClick={() => { setShowAddLessonModal(false); setNewLessonTitle(''); setNewLessonVideo(''); }} disabled={isActionLoading}>Hủy</GhostButton>
                  <PrimaryButton type="submit" className="flex-1 justify-center py-2.5" disabled={isActionLoading}>
                    {isActionLoading ? 'Đang tạo...' : 'Tạo bài học'}
                  </PrimaryButton>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
