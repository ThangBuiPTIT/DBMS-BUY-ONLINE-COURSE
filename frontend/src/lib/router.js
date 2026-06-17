/**
 * Lightweight navigation helpers.
 *
 * Why: the app uses a manual window.location.pathname router, so we need a
 * single place that decides between a full reload (when really needed) and a
 * fast in-app route change (history.pushState + popstate).
 *
 * Use `navigate('/foo')` instead of `window.location.pathname = '/foo'` so the
 * URL bar updates without re-mounting the entire React tree. Use `reload()`
 * only after a successful login/logout (the App router needs to re-evaluate
 * the current pathname against the new auth state).
 */

/**
 * In-app navigation. Updates pathname via history.pushState and dispatches a
 * popstate event so any listeners (we register one in App.jsx) can re-render.
 *
 * @param {string} path  e.g. "/store", "/admin/dashboard"
 */
export function navigate(path) {
  if (!path || typeof path !== 'string') return;
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Hard reload to the given path. Use after login/logout where the whole app
 * tree should re-mount with the new auth state.
 */
export function reload(path) {
  window.location.href = path || '/';
}

/**
 * Step back in browser history when available, otherwise fall back to a safe
 * default path.
 */
export function goBack(fallback = '/') {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  navigate(fallback);
}