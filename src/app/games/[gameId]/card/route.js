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

// Amount formatting matches the site: plain number with grouping + 2 decimals, ticker appended separately (no "$").
const money = (n, highDec) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: highDec ? (Math.abs(n) > 0 && Math.abs(n) < 1 ? 5 : 3) : 2 });

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

// Timer type, matching the detail page (line 804).
function timerModeLabel(g) {
  if (parseInt(g.timer_mode) === 1) return `CUMULATIVE · +${Math.round(parseInt(g.time_increment) / 60)}m per bet`;
  return `FIXED · ${Math.round(parseInt(g.timer_duration) / 60)}m reset`;
}

// Salvador type, matching the detail page (line 805).
function salvadorLabel(g) {
  const bps = (x) => (Number(x) / 100).toFixed(1);
  if (g.salvador_mode === 1) return `FIXED ${bps(g.salvador_bps)}%`;
  if (g.salvador_mode === 3) return 'INSANITY · VRF 0.2-50%';
  return `PROGRESSIVE ${bps(g.salvador_bps)}%-${bps(g.salvador_cap_bps)}% (+${bps(g.salvador_step_bps)}%)`;
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

  // token meta: real ticker + decimals + logo fallback (DAS, cached backend-side)
  let sym = '', metaImg = null, decimals = 6;
  if (g.token_mint) {
    try {
      const mres = await fetch(`${API}/api/tokens/${g.token_mint}/meta`, { cache: 'no-store' });
      if (mres.ok) {
        const m = await mres.json();
        sym = m.symbol || '';
        metaImg = m.image || null;
        if (Number.isInteger(m.decimals)) decimals = m.decimals;
      }
    } catch (e) { /* ignore */ }
  }
  const DEC = 10 ** decimals;

  let imgUrl = null;
  if (g.image_url) imgUrl = /^https?:\/\//.test(g.image_url) ? g.image_url : `${API}${g.image_url}`;
  else if (metaImg) imgUrl = metaImg;

  // last bettor: prefer @username (users/batch), else short address
  let bettorLabel = shortAddr(g.last_bettor);
  if (g.last_bettor) {
    try {
      const ures = await fetch(`${API}/api/users/batch`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallets: [g.last_bettor] }), cache: 'no-store',
      });
      if (ures.ok) { const u = await ures.json(); if (u && u[g.last_bettor]) bettorLabel = '@' + u[g.last_bettor]; }
    } catch (e) { /* ignore */ }
  }

  const jackpot = Math.max(0, Number(g.pool_balance) - Number(g.reserved_balance || 0)) / DEC;
  const jpStr = money(jackpot, decimals >= 8);
  const jpFont = jpStr.length <= 6 ? 118 : jpStr.length <= 9 ? 100 : jpStr.length <= 12 ? 82 : 66;
  const timer = fmtTimer(g.timer_end, g.is_active);
  const totalBets = Array.isArray(g.bets) ? g.bets.length : (g.active_bet_count || 0);
  const cashedOut = Array.isArray(g.bets) ? g.bets.filter(b => b.reserved || b.withdrawn).length : 0;
  const roiPct = (Number(g.roi_bps) / 100).toFixed(0);
  const salvador = Number(g.salvador_mode) > 0;

  const statRow = (label, value) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ fontSize: 20, color: DIM, letterSpacing: '0.08em', display: 'flex' }}>{label}</div>
      <div style={{ fontSize: 34, color: WHITE, fontFamily: 'Bebas', marginTop: 4, display: 'flex' }}>{value}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', padding: 44, fontFamily: 'sans-serif' }}>
        {/* accent bar */}
        <div style={{ width: '100%', height: 8, background: ACCENT, display: 'flex' }} />

        {/* TOP: square picture + identity */}
        <div style={{ display: 'flex', marginTop: 28, gap: 28 }}>
          {imgUrl
            ? <img src={imgUrl} width={260} height={260} style={{ width: 260, height: 260, borderRadius: 20, objectFit: 'cover', border: '2px solid #222' }} />
            : <div style={{ width: 260, height: 260, borderRadius: 20, background: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #222' }}>
                <div style={{ fontFamily: 'Bebas', fontSize: 120, color: ACCENT, display: 'flex' }}>{(sym || g.name || '?').slice(0, 1).toUpperCase()}</div>
              </div>
          }
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 26, color: ACCENT, fontFamily: 'Bebas', letterSpacing: '0.05em', display: 'flex' }}>#{String(g.game_number).padStart(4, '0')}</div>
              <div style={{
                display: 'flex', alignItems: 'center', padding: '3px 14px', borderRadius: 999,
                border: `2px solid ${g.is_active ? ACCENT : RED}`, color: g.is_active ? ACCENT : RED,
                fontSize: 18, letterSpacing: '0.1em',
              }}>{g.is_active ? 'LIVE' : 'ENDED'}</div>
            </div>
            <div style={{ fontSize: 58, color: WHITE, fontFamily: 'Bebas', lineHeight: 1.0, marginTop: 10, display: 'flex' }}>{g.name}</div>
            {sym ? <div style={{ fontSize: 32, color: ACCENT, fontFamily: 'Bebas', marginTop: 6, display: 'flex' }}>${sym}</div> : null}
          </div>
        </div>

        {/* JACKPOT (token-denominated + ticker) */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
          <div style={{ fontSize: 24, color: DIM, letterSpacing: '0.15em', display: 'flex' }}>JACKPOT</div>
          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 2 }}>
            <div style={{ fontSize: jpFont, color: ACCENT, fontFamily: 'Bebas', lineHeight: 0.95, display: 'flex' }}>{jpStr}</div>
            {sym ? <div style={{ fontSize: Math.round(jpFont * 0.36), color: '#5cffb0', fontFamily: 'Bebas', marginLeft: 14, display: 'flex' }}>{sym}</div> : null}
          </div>
        </div>

        {/* timer: live countdown + precise timer TYPE + snapshot note */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22, padding: '18px 24px', background: CARD, borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{ fontSize: 24, color: DIM, display: 'flex' }}>⏱</div>
            <div style={{ fontSize: 46, color: WHITE, fontFamily: 'Bebas', display: 'flex' }}>{timer.text}</div>
            {timer.live ? <div style={{ fontSize: 20, color: DIM, display: 'flex' }}>left</div> : null}
            <div style={{ fontSize: 22, color: ACCENT, fontFamily: 'Bebas', marginLeft: 'auto', display: 'flex' }}>{timerModeLabel(g)}</div>
          </div>
          <div style={{ fontSize: 17, color: '#b8860b', marginTop: 8, display: 'flex' }}>Snapshot — open the game to watch it tick live.</div>
        </div>

        {/* stat grid */}
        <div style={{ display: 'flex', marginTop: 22, gap: 20 }}>
          {statRow('TOTAL BETS', String(totalBets))}
          {statRow('CASHED OUT', String(cashedOut))}
          {statRow('ROI TARGET', roiPct + '%')}
        </div>
        <div style={{ display: 'flex', marginTop: 18, gap: 20 }}>
          {statRow('LAST BETTOR', bettorLabel)}
          {statRow('MIN BET', `${money(Number(g.min_bet) / DEC, decimals >= 8)}${sym ? ' ' + sym : ''}`)}
        </div>

        {/* salvador type strip (precise) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, padding: '14px 22px', background: CARD, borderRadius: 12, border: salvador ? `1px solid ${ACCENT}` : '1px solid #222' }}>
          <div style={{ fontSize: 20, color: DIM, letterSpacing: '0.1em', display: 'flex' }}>⚡ SALVADOR</div>
          <div style={{ fontSize: 28, color: salvador ? ACCENT : DIM, fontFamily: 'Bebas', display: 'flex' }}>{salvador ? salvadorLabel(g) : 'OFF'}</div>
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 'auto' }}>
          <div style={{ fontSize: 24, color: DIM, letterSpacing: '0.1em', display: 'flex' }}>thecrazygame.fun</div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
