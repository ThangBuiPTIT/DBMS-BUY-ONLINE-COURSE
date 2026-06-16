import React from 'react';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import StudentManagementPage from './pages/StudentManagementPage';
import CourseStorePage from './pages/CourseStorePage';
import LeaderboardPage from './pages/LeaderboardPage';
import DictionaryPage from './pages/DictionaryPage';
import MicrolearningRoadmapPage from './pages/MicrolearningRoadmapPage';
import LessonQuizPage from './pages/LessonQuizPage';
import CourseBuilderPage from './pages/CourseBuilderPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';

function App() {
  const path = window.location.pathname;

  if (path === '/admin/dashboard') {
    return <AdminDashboardPage />;
  }

  if (path === '/admin/audit-logs') {
    return <AdminAuditLogsPage />;
  }

  if (path === '/teacher/dashboard') {
    return <TeacherDashboardPage />;
  }

  if (path === '/students/manage') {
    return <StudentManagementPage />;
  }

  if (path === '/store') {
    return <CourseStorePage />;
  }

  if (path === '/leaderboard') {
    return <LeaderboardPage />;
  }

  if (path === '/dictionary') {
    return <DictionaryPage />;
  }

  if (path === '/microlearning/roadmap') {
    return <MicrolearningRoadmapPage />;
  }

  if (path.startsWith('/microlearning/lessons/') && path.endsWith('/quiz')) {
    const parts = path.split('/');
    const lessonId = parts[3];
    return <LessonQuizPage lessonId={lessonId} />;
  }

  if (path.startsWith('/teacher/courses/') && path.endsWith('/builder')) {
    const parts = path.split('/');
    const courseId = parts[3];
    return <CourseBuilderPage courseId={courseId} />;
  }

  // Default path serves the login page
  return <AdminLoginPage />;
}

export default App;
