'use client';
import { useState, useRef, useEffect } from 'react';

/**
 * Click-to-open tooltip with a (?) icon. Mobile-friendly — no hover dependency.
 * Closes on outside click or Escape. Renders inline so it can sit next to a label.
 */
export default function Tooltip({ children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey  = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onScrl = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrl, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrl, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const W = 320, M = 12;
    let left = rect.left;
    if (left + W + M > window.innerWidth) left = window.innerWidth - W - M;
    if (left < M) left = M;
    setPos({ left, top: rect.bottom + 8 });
  }, [open]);

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        aria-label="More info"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          marginLeft: '6px',
          fontSize: '11px',
          fontFamily: 'var(--font-body)',
          fontWeight: 'bold',
          color: open ? '#000' : 'var(--text-muted)',
          background: open ? 'var(--accent)' : 'transparent',
          border: '1px solid ' + (open ? 'var(--accent)' : 'var(--border)'),
          borderRadius: '50%',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
      >?</button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            left: pos.left + 'px',
            top: pos.top + 'px',
            minWidth: '220px',
            maxWidth: 'min(320px, calc(100vw - 32px))',
            padding: '12px 14px',
            background: 'var(--bg-card)',
            border: '1px solid var(--accent)',
            borderRadius: '4px',
            fontSize: '12px',
            lineHeight: '1.55',
            color: 'var(--text-primary)',
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
            fontWeight: 'normal',
            letterSpacing: 'normal',
            textTransform: 'none',
            fontFamily: 'var(--font-body)',
            whiteSpace: 'normal',
            textAlign: 'left',
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
