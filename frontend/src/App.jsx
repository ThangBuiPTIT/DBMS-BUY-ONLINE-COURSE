import React, { useEffect, useState, useCallback } from 'react';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import StudentManagementPage from './pages/StudentManagementPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import CourseStorePage from './pages/CourseStorePage';
import LeaderboardPage from './pages/LeaderboardPage';
import DictionaryPage from './pages/DictionaryPage';
import MicrolearningRoadmapPage from './pages/MicrolearningRoadmapPage';
import LessonQuizPage from './pages/LessonQuizPage';
import CourseBuilderPage from './pages/CourseBuilderPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';
import NotFoundPage from './pages/NotFoundPage';
import LoadingSpinner from './components/LoadingSpinner';
import { getCurrentUser } from './api/client';

const DASHBOARD_BY_ROLE = {
  ADMIN: '/admin/dashboard',
  TEACHER: '/teacher/dashboard',
  STUDENT: '/student/dashboard',
};

const PROTECTED_ROUTES = [
  { test: (p) => p === '/admin/dashboard',     roles: ['admin'] },
  { test: (p) => p === '/admin/audit-logs',    roles: ['admin'] },
  { test: (p) => p === '/teacher/dashboard',   roles: ['admin', 'teacher'] },
  { test: (p) => p === '/student/dashboard',   roles: ['admin', 'student'] },
  { test: (p) => p === '/students/manage',     roles: ['admin'] },
  { test: (p) => p.startsWith('/teacher/courses/') && p.endsWith('/builder'), roles: ['admin', 'teacher'] },
  { test: (p) => p.startsWith('/microlearning/lessons/') && p.endsWith('/quiz'), roles: ['admin', 'student', 'teacher'] },
];

function classify(path) {
  for (const route of PROTECTED_ROUTES) {
    if (route.test(path)) return { protected: true, roles: route.roles };
  }
  return { protected: false, roles: [] };
}

function getCurrentPath() {
  return window.location.pathname || '/';
}

// Read auth once from localStorage. Subsequent updates (login/logout) go
// through a full page reload so this initial value is always authoritative.
function readAuth() {
  const user = getCurrentUser();
  return { user, hasSession: Boolean(user && localStorage.getItem('session_key')) };
}

function App() {
  const [path, setPath] = useState(getCurrentPath);
  const auth = readAuth();

  // Re-read pathname on browser back/forward and after in-app pushState calls.
  useEffect(() => {
    const onPop = () => setPath(getCurrentPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Resolve a redirect target when the user is on a route they can't access.
  // Returns the new pathname (and pushes it to history), or null if no redirect.
  const resolveRedirect = useCallback((currentPath, currentAuth) => {
    const { protected: isProtected, roles } = classify(currentPath);

    if (currentPath === '/' && currentAuth.hasSession) {
      return DASHBOARD_BY_ROLE[currentAuth.user?.role_name] || '/';
    }

    if (isProtected && !currentAuth.hasSession) return '/';

    if (
      isProtected &&
      roles.length > 0 &&
      !roles.includes((currentAuth.user?.role_name || '').toLowerCase())
    ) {
      return DASHBOARD_BY_ROLE[currentAuth.user?.role_name] || '/';
    }

    return null;
  }, []);

  // Perform a replaceState redirect when needed. The setPath here is what
  // keeps the manual router in sync after a redirect; eslint flags it as
  // "set-state-in-effect" because router state changes during render, but
  // the alternative (running during render) would loop indefinitely.
  useEffect(() => {
    const target = resolveRedirect(path, auth);
    if (target && target !== path) {
      window.history.replaceState({}, '', target);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPath(target);
    }
  }, [path, auth, resolveRedirect]);

  const target = resolveRedirect(path, auth);

  // ---- Route matching ----
  const effectivePath = target || path;

  if (effectivePath === '/') return <AdminLoginPage />;

  if (effectivePath === '/admin/dashboard') return <AdminDashboardPage />;
  if (effectivePath === '/admin/audit-logs') return <AdminAuditLogsPage />;

  if (effectivePath === '/teacher/dashboard') return <TeacherDashboardPage />;
  if (effectivePath === '/student/dashboard') return <StudentDashboardPage />;
  if (effectivePath === '/students/manage') return <StudentManagementPage />;

  if (effectivePath === '/store') return <CourseStorePage />;
  if (effectivePath === '/leaderboard') return <LeaderboardPage />;
  if (effectivePath === '/dictionary') return <DictionaryPage />;

  if (effectivePath === '/microlearning/roadmap') return <MicrolearningRoadmapPage />;

  if (effectivePath.startsWith('/microlearning/lessons/') && effectivePath.endsWith('/quiz')) {
    const lessonId = effectivePath.split('/')[3];
    return <LessonQuizPage lessonId={lessonId} />;
  }

  if (effectivePath.startsWith('/teacher/courses/') && effectivePath.endsWith('/builder')) {
    const courseId = effectivePath.split('/')[3];
    return <CourseBuilderPage courseId={courseId} />;
  }

  return <NotFoundPage />;
}

export default App;