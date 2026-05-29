'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

/**
 * Reads ?src=... from the URL and POSTs to /api/platform/track once per session
 * (sessionStorage dedup). Mount this near the root layout.
 */
export default function SourceTracker() {
  const params = useSearchParams();
  useEffect(() => {
    const src = params && params.get('src');
    if (!src) return;
    if (!/^[a-zA-Z0-9._-]{2,64}$/.test(src)) return;
    try {
      const key = 'src_tracked_' + src;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch (e) {}
    fetch(API_URL + '/api/platform/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: src }),
    }).catch(() => {});
  }, [params]);
  return null;
}
