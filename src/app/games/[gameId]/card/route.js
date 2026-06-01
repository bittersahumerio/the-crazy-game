import { ImageResponse } from 'next/og';
import fs from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://thecrazygame.fun';
const ACCENT = '#00ff88';
const BG = '#0a0a0a';
const CARD = '#141414';
const WHITE = '#ffffff';
const DIM = '#888888';
const RED = '#ff4d4d';

function fmtUsd(micro) {
  return '$' + (Number(micro || 0) / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTimer(timerEnd, isActive) {
  if (!isActive) return { text: 'ENDED', live: false };
  const diff = Number(timerEnd) - Math.floor(Date.now() / 1000);
  if (diff <= 0) return { text: 'ENDING…', live: true };
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  let text;
  if (d > 0) text = `${d}d ${h}h ${m}m`;
  else if (h > 0) text = `${h}h ${m}m ${s}s`;
  else text = `${m}m ${s}s`;
  return { text, live: true };
}

function shortAddr(a) {
  if (!a) return '—';
  return a.slice(0, 4) + '…' + a.slice(-4);
}

export async function GET(request, { params }) {
  const { gameId } = await params;
  const bebas = await fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'BebasNeue-Regular.ttf'));

  let g = null;
  try {
    const res = await fetch(`${API}/api/games/${gameId}`, { cache: 'no-store' });
    if (res.ok) g = await res.json();
  } catch (e) { /* fall through to not-found card */ }

  const size = { width: 800, height: 1000 };
  const fonts = [{ name: 'Bebas', data: bebas, style: 'normal', weight: 400 }];

  if (!g || !g.game_number) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'Bebas', fontSize: 90, color: WHITE, display: 'flex' }}>GAME NOT FOUND</div>
          <div style={{ fontSize: 28, color: DIM, marginTop: 16, display: 'flex' }}>thecrazygame.fun</div>
        </div>
      ),
      { ...size, fonts }
    );
  }

  const jackpot = Math.max(0, Number(g.pool_balance) - Number(g.reserved_balance || 0));
  const timer = fmtTimer(g.timer_end, g.is_active);
  const totalBets = Array.isArray(g.bets) ? g.bets.length : (g.active_bet_count || 0);
  const cashedOut = Array.isArray(g.bets) ? g.bets.filter(b => b.reserved || b.withdrawn).length : 0;
  const roiPct = (Number(g.roi_bps) / 100).toFixed(0);
  const salvador = Number(g.salvador_mode) > 0;

  const statRow = (label, value) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ fontSize: 22, color: DIM, letterSpacing: '0.08em', display: 'flex' }}>{label}</div>
      <div style={{ fontSize: 40, color: WHITE, fontFamily: 'Bebas', marginTop: 4, display: 'flex' }}>{value}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', padding: 48, fontFamily: 'sans-serif' }}>
        {/* accent bar */}
        <div style={{ width: '100%', height: 8, background: ACCENT, display: 'flex' }} />

        {/* header: name + number + status */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 24, color: ACCENT, fontFamily: 'Bebas', letterSpacing: '0.05em', display: 'flex' }}>#{String(g.game_number).padStart(4, '0')}</div>
            <div style={{
              display: 'flex', alignItems: 'center', padding: '4px 16px', borderRadius: 999,
              border: `2px solid ${g.is_active ? ACCENT : RED}`, color: g.is_active ? ACCENT : RED,
              fontSize: 20, letterSpacing: '0.1em',
            }}>{g.is_active ? 'LIVE' : 'ENDED'}</div>
          </div>
          <div style={{ fontSize: 76, color: WHITE, fontFamily: 'Bebas', lineHeight: 1.0, marginTop: 8, display: 'flex' }}>{g.name}</div>
        </div>

        {/* jackpot */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 44 }}>
          <div style={{ fontSize: 26, color: DIM, letterSpacing: '0.15em', display: 'flex' }}>JACKPOT</div>
          <div style={{ fontSize: 140, color: ACCENT, fontFamily: 'Bebas', lineHeight: 0.95, display: 'flex' }}>{fmtUsd(jackpot)}</div>
        </div>

        {/* timer + snapshot note */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, padding: 28, background: CARD, borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <div style={{ fontSize: 30, color: DIM, display: 'flex' }}>⏱</div>
            <div style={{ fontSize: 72, color: WHITE, fontFamily: 'Bebas', display: 'flex' }}>{timer.text}</div>
            {timer.live && <div style={{ fontSize: 28, color: DIM, display: 'flex' }}>left</div>}
          </div>
          <div style={{ fontSize: 22, color: '#b8860b', marginTop: 8, display: 'flex' }}>
            ⚠ Snapshot — not live. Open the game or refresh for the current time.
          </div>
        </div>

        {/* stat grid */}
        <div style={{ display: 'flex', marginTop: 36, gap: 24 }}>
          {statRow('TOTAL BETS', String(totalBets))}
          {statRow('CASHED OUT', String(cashedOut))}
          {statRow('ROI TARGET', roiPct + '%')}
        </div>
        <div style={{ display: 'flex', marginTop: 28, gap: 24 }}>
          {statRow('LAST BETTOR', shortAddr(g.last_bettor))}
          {statRow('MIN BET', fmtUsd(g.min_bet))}
        </div>

        {/* footer: salvador badge + url */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          {salvador
            ? <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', border: `2px solid ${ACCENT}`, borderRadius: 999, color: ACCENT, fontSize: 22, letterSpacing: '0.08em' }}>⚡ SALVADOR ON</div>
            : <div style={{ display: 'flex' }} />}
          <div style={{ fontSize: 26, color: DIM, letterSpacing: '0.1em', display: 'flex' }}>thecrazygame.fun</div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
