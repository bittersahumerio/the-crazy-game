'use client';
import { useState, useEffect } from 'react';

/**
 * Sun/moon icon button. Reads current theme from <html data-theme>,
 * toggles between dark/light, persists choice to localStorage.
 * The initial theme is set by an inline script in layout.js (no flash).
 */
export default function ThemeToggle({ size = 18, inline = false }) {
  const [theme, setTheme] = useState('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(current);
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    setTheme(next);
  }

  // Don't render the wrong icon during SSR / pre-hydration
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        style={{
          width: size + 'px',
          height: size + 'px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          opacity: 0,
        }}
      />
    );
  }

  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: inline ? '8px' : 0,
        width: inline ? 'auto' : (size + 16) + 'px',
        height: (size + 16) + 'px',
        padding: inline ? '0 12px' : 0,
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-body)',
        fontSize: '13px',
        letterSpacing: '0.05em',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {isDark ? (
        // Sun icon (clicking switches to light)
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      ) : (
        // Moon icon (clicking switches to dark)
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
      {inline && <span>{isDark ? 'LIGHT THEME' : 'DARK THEME'}</span>}
    </button>
  );
}
