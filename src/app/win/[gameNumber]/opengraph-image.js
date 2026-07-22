import { ImageResponse } from 'next/og';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export const runtime = 'nodejs';
export const alt = 'Win on The Crazy Game';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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

export default async function Image({ params }) {
  const p = await params;
  const data = await fetchWin(p.gameNumber);

  // Fallback: generic Crazy Game card if no win data
  if (!data) {
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%',
          background: '#0a0a0a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#00ff88', fontSize: 84, letterSpacing: 8,
          border: '8px solid #00ff88',
        }}>
          THE CRAZY GAME
        </div>
      ),
      { ...size }
    );
  }

  const usd = fmtWin(data.jackpot_amount, data);
  const pnl = Number(data.pnl_percent).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const winnerLabel = data.winner_username ? '@' + data.winner_username + ' WON' : 'WINNER';

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 60,
        position: 'relative',
        boxShadow: '0 0 80px rgba(0,255,136,0.25) inset',
      }}>
        {/* Border frame */}
        <div style={{
          position: 'absolute', top: 24, left: 24, right: 24, bottom: 24,
          border: '4px solid #00ff88',
          display: 'flex',
        }} />

        {/* Brand top */}
        <div style={{
          fontSize: 36, color: '#00ff88', letterSpacing: 8, marginBottom: 28,
          fontWeight: 700, display: 'flex',
        }}>
          THE CRAZY GAME
        </div>

        {/* Winner label */}
        <div style={{ fontSize: 26, color: '#888', letterSpacing: 4, marginBottom: 24, display: 'flex' }}>
          {winnerLabel}
        </div>

        {/* The big amount */}
        <div style={{
          fontSize: 140, color: '#00ff88', lineHeight: 1.1, fontWeight: 800,
          letterSpacing: -4, marginBottom: 60, display: 'flex',
        }}>
          {usd}
        </div>

        {/* PnL */}
        <div style={{ fontSize: 48, color: '#fff', letterSpacing: 4, marginBottom: 56, fontWeight: 700, display: 'flex' }}>
          {pnl}% PNL
        </div>

        {/* Game name */}
        <div style={{ fontSize: 22, color: '#888', marginBottom: 10, display: 'flex', letterSpacing: 4 }}>ON</div>
        <div style={{ fontSize: 38, color: '#fff', letterSpacing: 2, fontWeight: 700, marginBottom: 50, display: 'flex' }}>
          {data.game_name + ' #' + String(data.game_number).padStart(4, '0')}
        </div>

        {/* URL */}
        <div style={{ fontSize: 22, color: '#666', letterSpacing: 2, display: 'flex' }}>
          thecrazygame.fun
        </div>
      </div>
    ),
    { ...size }
  );
}
