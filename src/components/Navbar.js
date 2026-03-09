'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => m.WalletMultiButton),
  { ssr: false }
);

export default function Navbar() {
  return (
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
      <Link href="/" style={{ textDecoration: 'none' }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          color: 'var(--accent)',
          letterSpacing: '0.1em',
        }}>
          THE CRAZY GAME
        </span>
      </Link>

      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        <Link href="/games" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>
          GAMES
        </Link>
        <Link href="/leaderboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>
          LEADERBOARD
        </Link>
        <Link href="/create" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>
          HOST
        </Link>
        <Link href="/profile" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>
          PROFILE
        </Link>
        <WalletMultiButton />
      </div>
    </nav>
  );
}