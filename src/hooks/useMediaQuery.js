'use client';
import { useState, useEffect } from 'react';

/**
 * SSR-safe media query hook. Returns false on server / first client render,
 * then updates to actual value after mount. Avoids hydration mismatch.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const handler = (e) => setMatches(e.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export const useIsMobile  = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet  = () => useMediaQuery('(max-width: 1023px)');
