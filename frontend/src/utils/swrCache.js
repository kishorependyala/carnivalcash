// Stale-while-revalidate cache backed by localStorage.
// Keys are user-scoped to prevent cross-user data leakage on shared devices.
// Balance PIN is never cached — callers must strip it before calling setCache.

function getUserId() {
  try {
    const u = JSON.parse(localStorage.getItem('user'));
    return u?.userId || u?.phone || 'anon';
  } catch { return 'anon'; }
}

function lsKey(key) {
  return `cc_swr_${getUserId()}_${key}`;
}

/** Return cached data immediately regardless of age (stale is fine for initial render). */
export function getStale(key) {
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch { return null; }
}

/** Persist fresh data. Never pass objects containing PIN or other secrets. */
export function setCache(key, data) {
  try {
    localStorage.setItem(lsKey(key), JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

/** Remove all SWR cache entries for the current user. Call on every logout path. */
export function clearUserCache() {
  try {
    const userId = getUserId();
    const prefix = `cc_swr_${userId}_`;
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}
