'use client';
import { useState, useRef, useEffect } from 'react';

/**
 * Single-letter type badge that opens an explanatory tooltip on click.
 * Used to annotate games with their timer mode (F/C/R) and game mode (V/S/P).
 */

const TYPE_BADGES = {
  // Timer modes
  timer_fixed:      { letter: 'F', label: 'Fixed timer',         tip: 'Fixed timer — every bet resets the clock to the full duration.' },
  timer_cumulative: { letter: 'C', label: 'Cumulative timer',    tip: 'Cumulative timer — each bet adds a fixed amount of time to the clock.' },
  timer_random:     { letter: 'R', label: 'Random timer',        tip: 'Random timer — each bet adds a random amount of time up to a cap.' },
  // Game modes
  mode_vanilla:     { letter: 'V', label: 'Vanilla',             tip: 'Vanilla — last bettor when the timer expires wins the pool.' },
  mode_salvador:    { letter: 'S', label: 'Salvador (Fixed)',    tip: 'Salvador (Fixed) — a fixed % of the pool is paid out when one player saves another (their bet pushes the previous bettor past ROI).' },
  mode_progressive: { letter: 'P', label: 'Salvador (Progressive)', tip: 'Salvador (Progressive) — salvation reward grows by a step % with each save, up to a cap.' },
};

export function timerBadgeKind(game) {
  const t = parseInt(game.timer_mode);
  if (t === 1) return 'timer_cumulative';
  if (t === 2) return 'timer_random';
  return 'timer_fixed';
}

export function modeBadgeKind(game) {
  const m = parseInt(game.salvador_mode || 0);
  if (m === 1) return 'mode_salvador';
  if (m === 2) return 'mode_progressive';
  return 'mode_vanilla';
}

export default function TypeBadge({ kind, size = 22 }) {
  const cfg = TYPE_BADGES[kind];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc   = (e) => { if (e.key === 'Escape') setOpen(false); };
    const scroll = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', scroll, true);
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

  if (!cfg) return null;

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        aria-label={cfg.label}
        aria-expanded={open}
        title={cfg.label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size + 'px',
          height: size + 'px',
          fontSize: Math.round(size * 0.55) + 'px',
          fontFamily: 'var(--font-display)',
          fontWeight: 'bold',
          color: open ? '#000' : 'var(--accent)',
          background: open ? 'var(--accent)' : 'transparent',
          border: '1px solid var(--accent)',
          borderRadius: '3px',
          cursor: 'pointer',
          padding: 0,
          letterSpacing: 0,
          flexShrink: 0,
          lineHeight: 1,
          transition: 'all 0.15s',
        }}
      >{cfg.letter}</button>
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
          {cfg.tip}
        </span>
      )}
    </span>
  );
}
