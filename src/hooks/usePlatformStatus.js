'use client';
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

/**
 * Returns the platform-wide paused status.
 * Polls every 60s so users see the state update without a manual refresh.
 */
export function usePlatformStatus() {
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const r = await fetch(API_URL + '/api/platform/status');
        const d = await r.json();
        if (!cancelled) { setPaused(!!d.paused); setLoaded(true); }
      } catch (e) {
        if (!cancelled) setLoaded(true);
      }
    }
    check();
    const interval = setInterval(check, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { paused, loaded };
}
