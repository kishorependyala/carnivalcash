import { useEffect, useRef } from 'react';

/**
 * Calls `fn` every `intervalMs` milliseconds while the browser tab is visible.
 * Pauses automatically when the tab is hidden and resumes on focus.
 */
export function usePolling(fn, intervalMs = 15000) {
  const savedFn = useRef(fn);
  useEffect(() => { savedFn.current = fn; }, [fn]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') savedFn.current();
    };
    const id = setInterval(tick, intervalMs);
    // also refresh immediately when tab becomes visible again
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);
}
