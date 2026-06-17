import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const sessionKey = localStorage.getItem('session_key');
  if (sessionKey) {
    config.headers = config.headers || {};
    config.headers['Session-Key'] = sessionKey;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('session_key');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('role_name');
      window.dispatchEvent(new Event('auth-change'));
      if (typeof window !== 'undefined' && window.location) {
        const currentPath = window.location.pathname || '';
        const isOnLoginPage =
          currentPath === '/' ||
          currentPath === '/admin/login' ||
          currentPath === '/login';
        if (!isOnLoginPage) {
          window.location.assign('/');
        }
      }
    }
    return Promise.reject(error);
  },
);

export function getCurrentUser() {
  const raw = localStorage.getItem('admin_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default api;