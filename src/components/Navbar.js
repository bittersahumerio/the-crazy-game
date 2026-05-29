'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { TwitterIcon, TelegramIcon } from './SocialIcons';
import ThemeToggle from './ThemeToggle';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => m.WalletMultiButton),
  { ssr: false }
);

// Single source of truth for nav links. Add new items here.
const NAV_LINKS = [
  { href: '/games',       label: 'GAMES'   },
  { href: '/leaderboard', label: 'HEAT'    },
  { href: '/create',      label: 'HOST'    },
  { href: '/profile',     label: 'PROFILE' },
  { href: '/roadmap',     label: 'ROADMAP' },
  { href: '/support',     label: 'SUPPORT' },
  { href: '/faq',         label: 'FAQ'     },
];

const SOCIAL_LINKS = [
  { href: 'https://twitter.com/thecraziestgame', label: 'TWITTER', icon: TwitterIcon, showLabelOnDesktop: false },
  { href: 'https://t.me/thecrazygame_news',     label: 'NEWS',    icon: TelegramIcon, showLabelOnDesktop: true  },
  { href: 'https://t.me/thecrazygamebets',      label: 'BETS',    icon: TelegramIcon, showLabelOnDesktop: true  },
];

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <>
      <nav style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: 'var(--bg)',
        zIndex: 100,
      }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(20px, 5vw, 28px)',
            color: 'var(--accent)',
            letterSpacing: '0.1em',
            whiteSpace: 'nowrap',
          }}>
            THE CRAZY GAME
          </span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(20px, 5vw, 28px)',
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
            whiteSpace: 'nowrap',
          }}>BETA</span>
        </Link>

        <div className="desktop-only" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>{l.label}</Link>
          ))}
          {SOCIAL_LINKS.map(s => (
            <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" title={s.label} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', letterSpacing: '0.05em' }}>
              <s.icon />
              {s.showLabelOnDesktop && s.label}
            </a>
          ))}
          <ThemeToggle />
          <WalletMultiButton />
        </div>

        <div className="mobile-only" style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            className="tap-target"
            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', justifyContent: 'center' }}
          >
            <span style={{ width: 18, height: 2, background: 'var(--text-primary)' }} />
            <span style={{ width: 18, height: 2, background: 'var(--text-primary)' }} />
            <span style={{ width: 18, height: 2, background: 'var(--text-primary)' }} />
          </button>
        </div>
      </nav>

      {drawerOpen && (
        <>
          <div className="mobile-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <aside className="mobile-drawer" role="dialog" aria-label="Site navigation">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: '14px', letterSpacing: '0.1em' }}>MENU</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="tap-target"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '24px', cursor: 'pointer', padding: '8px', fontFamily: 'var(--font-body)', lineHeight: 1 }}
              >×</button>
            </div>
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
              <WalletMultiButton />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <ThemeToggle inline />
            </div>
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setDrawerOpen(false)}>{l.label}</Link>
            ))}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {SOCIAL_LINKS.map(s => (
                <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" onClick={() => setDrawerOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <s.icon size={18} />
                  {s.label}
                </a>
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
