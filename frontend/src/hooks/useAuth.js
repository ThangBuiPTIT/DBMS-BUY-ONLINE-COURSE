import { useCallback, useEffect, useState } from 'react';
import { api, getCurrentUser } from '../api/client';
import { reload } from '../lib/router';

/**
 * Centralized auth state + actions.
 *
 * Reads the persisted session from localStorage so a page reload doesn't kick
 * the user back to the login screen. Components that need the current user
 * call `useAuth()` instead of poking localStorage directly.
 *
 * The auth state mirrors the data already stored in localStorage by
 * AdminLoginPage; on logout we clear it and hard-reload to '/'.
 */
export function useAuth() {
  const [user, setUser] = useState(() => getCurrentUser());
  const [sessionKey, setSessionKey] = useState(
    () => localStorage.getItem('session_key') || null,
  );

  // Keep state in sync if another tab (or the axios interceptor) updates
  // localStorage under us.
  useEffect(() => {
    const sync = () => {
      setUser(getCurrentUser());
      setSessionKey(localStorage.getItem('session_key') || null);
    };
    window.addEventListener('storage', sync);
    window.addEventListener('auth-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('auth-change', sync);
    };
  }, []);

  const isAuthenticated = Boolean(user && sessionKey);

  const logout = useCallback(() => {
    localStorage.removeItem('session_key');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('role_name');
    window.dispatchEvent(new Event('auth-change'));
    reload('/');
  }, []);

  /**
   * Optional helper: validate the cached session against the backend. If the
   * backend rejects it (401), the axios interceptor will already have cleared
   * localStorage and bounced us to '/', so we just re-sync local state here.
   */
  const refresh = useCallback(async () => {
    if (!sessionKey) return null;
    try {
      // A lightweight ping — change endpoint if backend adds a /me route.
      await api.get('/api/admin/transactions?limit=1&offset=0');
    } catch {
      // Interceptor handled the redirect; just sync local state.
    }
    setUser(getCurrentUser());
    setSessionKey(localStorage.getItem('session_key') || null);
    return getCurrentUser();
  }, [sessionKey]);

  return { user, sessionKey, isAuthenticated, logout, refresh };
}