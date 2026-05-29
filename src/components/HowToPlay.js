'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LANGUAGES, TRANSLATIONS } from './HowToPlay.translations';

export default function HowToPlay() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState('en');

  // Load saved language on mount (default to English if none)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('howtoplay_lang');
      if (saved && TRANSLATIONS[saved]) setLang(saved);
    } catch (e) {}
  }, []);

  // Save + apply on change
  function changeLang(newLang) {
    setLang(newLang);
    try { localStorage.setItem('howtoplay_lang', newLang); } catch (e) {}
  }

  // Close on Escape, lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // Render footer string with {?} and {FAQ} placeholders replaced
  function renderFooter(text) {
    const parts = text.split(/(\{\?\}|\{FAQ\})/);
    return parts.map((part, i) => {
      if (part === '{?}') return (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '14px', height: '14px', border: '1px solid var(--text-muted)',
          borderRadius: '50%', fontSize: '9px', fontWeight: 'bold', verticalAlign: 'middle',
        }}>?</span>
      );
      if (part === '{FAQ}') return (
        <Link key={i} href="/faq" onClick={() => setOpen(false)} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
          FAQ
        </Link>
      );
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'transparent',
          color: 'var(--accent)',
          border: '1px solid var(--accent)',
          padding: '8px 16px',
          fontSize: '11px',
          letterSpacing: '0.08em',
          fontFamily: 'var(--font-body)',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-dim)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        HOW TO PLAY
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="How to play"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', maxWidth: '480px', width: '100%', padding: '32px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer', padding: '4px 10px', lineHeight: 1 }}
            >×</button>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', paddingRight: '32px', flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--accent)', letterSpacing: '0.05em', margin: 0 }}>
                {t.title}
              </h2>
              <select
                value={lang}
                onChange={e => changeLang(e.target.value)}
                aria-label="Language"
                style={{
                  background: 'var(--bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-body)',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>

            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)', marginBottom: '20px' }}>
              {t.steps.map((step, i) => (
                <li key={i} className="howto-step" dangerouslySetInnerHTML={{ __html: step }} />
              ))}
            </ol>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '0.03em', lineHeight: '1.6' }}>
              {renderFooter(t.footer)}
            </div>
            {t.note && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic', lineHeight: '1.5' }}>
                {t.note}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
