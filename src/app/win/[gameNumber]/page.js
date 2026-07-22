import Link from 'next/link';
import Navbar from '@/components/Navbar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://thecrazygame.fun';

function fmtWin(baseUnits, data) {
  const dec = Number.isInteger(data && data.decimals) ? data.decimals : 6;
  const v = Number(baseUnits) / Math.pow(10, dec);
  if (data && data.token_usd) return '$' + v.toFixed(2);
  const dp = v >= 1000 ? 2 : v >= 1 ? 3 : 4;
  return v.toFixed(dp) + ' ' + ((data && data.symbol) || '');
}

async function fetchWin(gameNumber) {
  try {
    const r = await fetch(API_URL + '/api/wins/' + gameNumber, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

export async function generateMetadata({ params }) {
  const p = await params;
  const data = await fetchWin(p.gameNumber);
  if (!data) {
    return { title: 'Win on The Crazy Game', description: 'Bet, wait, win.' };
  }
  const usd = fmtWin(data.jackpot_amount, data);
  const pnl = Number(data.pnl_percent).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const title = 'Won ' + data.game_name + ' on The Crazy Game';
  const description = usd + ' jackpot · ' + pnl + '% PnL';
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter:   { card: 'summary_large_image', title, description, site: '@thecraziestgame' },
  };
}

export default async function WinPage({ params }) {
  const p = await params;
  const data = await fetchWin(p.gameNumber);

  if (!data) {
    return (
      <>
        <Navbar />
        <main className="page-main-narrow" style={{ textAlign: 'center', padding: '80px 24px' }}>
          <h1 className="h-display-lg">NO WIN YET</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            This game hasn't been won yet, or doesn't exist.
          </p>
          <Link href="/games" style={{ background: 'var(--accent)', color: '#000', padding: '14px 28px', textDecoration: 'none', fontWeight: '700', fontSize: '14px', letterSpacing: '0.05em' }}>
            BROWSE LIVE GAMES
          </Link>
        </main>
      </>
    );
  }

  const usd = fmtWin(data.jackpot_amount, data);
  const lastBetUsd = (Number(data.last_bet_amount) / 1_000_000).toFixed(2);
  const pnl = Number(data.pnl_percent).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const refUrl = SITE_URL + '/?ref=' + (data.winner_ref_code || '');
  const NL = String.fromCharCode(10) + String.fromCharCode(10);
  const tweetText = 'Won ' + data.game_name + ' on The Crazy Game.' + NL + SITE_URL;
  const tweetUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweetText);

  return (
    <>
      <Navbar />
      <main className="page-main-narrow">
        {/* Visible win card — same vibe as the OG image */}
        <div style={{
          border: '2px solid var(--accent)',
          background: 'var(--bg-card)',
          padding: '56px 32px',
          textAlign: 'center',
          marginBottom: '24px',
          boxShadow: '0 0 24px rgba(0, 255, 136, 0.15) inset',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 4vw, 28px)', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '40px' }}>
            THE CRAZY GAME
          </div>

          <div style={{ fontSize: 'clamp(13px, 2.5vw, 16px)', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: '14px' }}>
            {data.winner_username ? '@' + data.winner_username + ' WON' : 'WINNER'}
          </div>

          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(56px, 13vw, 96px)', color: 'var(--accent)', lineHeight: 1, marginBottom: '20px' }}>
            {usd}
          </div>

          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 4.5vw, 32px)', color: 'var(--text-primary)', letterSpacing: '0.05em', marginBottom: '40px' }}>
            {pnl}% PNL
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.05em' }}>
            ON
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 4vw, 28px)', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
            {data.game_name + ' #' + String(data.game_number).padStart(4, '0')}
          </div>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: '#000', color: '#fff', border: '1px solid var(--text-muted)', padding: '14px 28px', textDecoration: 'none', fontWeight: '700', fontSize: '13px', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.622 5.905-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            SHARE ON X
          </a>
          <Link
            href={'/games?ref=' + (data.winner_ref_code || '')}
            style={{ background: 'var(--accent)', color: '#000', padding: '14px 28px', textDecoration: 'none', fontWeight: '700', fontSize: '13px', letterSpacing: '0.08em' }}
          >
            PLAY NOW →
          </Link>
        </div>
      </main>
    </>
  );
}
