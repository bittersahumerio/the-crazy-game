'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useConnection } from '@solana/wallet-adapter-react';
import { getTokenInfo } from '@/lib/program';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function StatBox({ label, value }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '40px', color: 'var(--accent)', marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
        {label}
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [bets, setBets] = useState([]);
  const [betsTotal, setBetsTotal] = useState(0);
  const [betsOffset, setBetsOffset] = useState(0);
  const [betsLoading, setBetsLoading] = useState(false);
  const [profileWallet, setProfileWallet] = useState(null);
  const [stats, setStats] = useState(null);
  const [gamesHosted, setGamesHosted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('history');
  const { connection } = useConnection();
  const [tokenInfoByMint, setTokenInfoByMint] = useState({});

  useEffect(() => {
    if (!connection) return;
    const mints = [...new Set([...bets.map(b => b.token_mint), ...gamesHosted.map(g => g.token_mint)].filter(Boolean))];
    const missing = mints.filter(m => !tokenInfoByMint[m]);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const updates = {};
      for (const m of missing) { try { updates[m] = await getTokenInfo(connection, m); } catch (e) {} }
      if (!cancelled && Object.keys(updates).length) setTokenInfoByMint(prev => ({ ...prev, ...updates }));
    })();
    return () => { cancelled = true; };
  }, [bets, gamesHosted, connection]);
  const now = Math.floor(Date.now() / 1000);

  useEffect(() => {
    fetchProfile();
  }, [username]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const userRes = await fetch(`${API_URL}/api/users/by-username/${username}`);
      if (!userRes.ok) { setNotFound(true); return; }
      const userData = await userRes.json();
      setProfile(userData.user);

      setProfileWallet(userData.user.wallet);
      const playerRes = await fetch(`${API_URL}/api/players/${userData.user.wallet}?limit=50&offset=0`);
      const playerData = await playerRes.json();
      const fetchedBets = playerData.bets || [];
      setBets(fetchedBets);
      setBetsTotal(parseInt(fetchedBets[0]?.total_count || 0));
      setStats(playerData.stats);
      setGamesHosted(playerData.games_hosted || []);
    } catch (e) {
      console.error(e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  function formatAmount(amount) {
    return (parseInt(amount) / 1_000_000).toFixed(2);
  }

  function fmtTok(amount, mint) {
    const ti = mint ? tokenInfoByMint[mint] : null;
    const dec = ti ? 10 ** ti.decimals : 1_000_000;
    const sym = ti?.symbol ?? 'USDC';
    const v = parseInt(amount) / dec;
    const mx = dec >= 1e8 ? (v > 0 && v < 1 ? 5 : 3) : 2;
    return `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, mx) })} ${sym}`;
  }

  function shortAddress(addr) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          LOADING...
        </main>
      </>
    );
  }

  async function loadMoreBets() {
    setBetsLoading(true);
    try {
      const newOffset = betsOffset + 50;
      const res = await fetch(`${API_URL}/api/players/${profileWallet}?limit=50&offset=${newOffset}`);
      const data = await res.json();
      setBets(prev => [...prev, ...(data.bets || [])]);
      setBetsOffset(newOffset);
    } catch (e) { console.error(e); }
    setBetsLoading(false);
  }

  if (notFound) {
    return (
      <>
        <Navbar />
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '64px', marginBottom: '16px' }}>NOT FOUND</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>No player with username "{username}"</p>
          <Link href="/games" style={{ color: 'var(--accent)', textDecoration: 'none' }}>← BACK TO GAMES</Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '72px', color: 'var(--accent)', marginBottom: '4px' }}>
            {profile.username}
          </div>
          <a href={`https://solscan.io/account/${profile.wallet}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', textDecoration: 'none' }}>
            {profile.wallet}
          </a>
          {/* Socials */}
          {(profile.twitter || profile.telegram || profile.discord) && (
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              {profile.twitter && (
                <a href={`https://x.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none', letterSpacing: '0.05em' }}>
                  𝕏 @{profile.twitter}
                </a>
              )}
              {profile.telegram && (
                <a href={`https://t.me/${profile.telegram}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none', letterSpacing: '0.05em' }}>
                  TG @{profile.telegram}
                </a>
              )}
              {profile.discord && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  DC {profile.discord}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px', maxWidth: '400px' }}>
          <StatBox label="TOTAL BETS" value={stats?.total_bets || 0} />
          <StatBox label="GAMES HOSTED" value={gamesHosted.length} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
          {[
            { key: 'history', label: `BET HISTORY (${betsTotal || bets.length})` },
            { key: 'hosted', label: `GAMES HOSTED (${gamesHosted.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background: 'transparent', border: 'none', padding: '12px 24px',
              fontSize: '12px', letterSpacing: '0.08em', cursor: 'pointer',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
              marginBottom: '-1px',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Bet History */}
        {tab === 'history' && (
          <div>
            {bets.length === 0 ? (
              <div style={{ border: '1px solid var(--border)', padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px' }}>NO BET HISTORY</div>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 80px', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  <span>GAME</span><span style={{ textAlign: 'right' }}>WAGERED</span><span style={{ textAlign: 'right' }}>ROI TARGET</span><span style={{ textAlign: 'right' }}>DATE</span><span style={{ textAlign: 'right' }}>STATUS</span>
                </div>
                {bets.map((bet, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 80px', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', alignItems: 'center' }}>
                    <div>
                      <Link href={`/games/${bet.game_number}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '13px' }}>
                        {bet.game_name || `#${String(bet.game_number).padStart(4, '0')}`}
                      </Link>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px' }}>#{bet.bet_index}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>{fmtTok(bet.amount, bet.token_mint)}</div>
                    <div style={{ textAlign: 'right' }}>{fmtTok(bet.roi_target, bet.token_mint)}</div>
                    <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(bet.placed_at)}</div>
                    <div style={{ textAlign: 'right', fontSize: '11px', color: bet.withdrawn ? 'var(--text-muted)' : bet.reserved ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {bet.withdrawn ? 'WITHDRAWN' : bet.reserved ? 'READY' : 'ACTIVE'}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {betsTotal > bets.length && (
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button onClick={loadMoreBets} disabled={betsLoading} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '10px 32px', cursor: betsLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px', letterSpacing: '0.08em' }}>{betsLoading ? 'LOADING...' : `LOAD MORE (${bets.length}/${betsTotal})`}</button>
              </div>
            )}
          </div>
        )}

        {/* Games Hosted */}
        {tab === 'hosted' && (
          <div>
            {gamesHosted.length === 0 ? (
              <div style={{ border: '1px solid var(--border)', padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px' }}>NO GAMES HOSTED YET</div>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 80px', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  <span>GAME</span><span style={{ textAlign: 'right' }}>POOL</span><span style={{ textAlign: 'right' }}>ROI</span><span style={{ textAlign: 'right' }}>BETS</span><span style={{ textAlign: 'right' }}>STATUS</span>
                </div>
                {gamesHosted.map((game, i) => {
                  const isLive = game.is_active && game.timer_end > now;
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 80px', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', alignItems: 'center' }}>
                      <Link href={`/games/${game.game_number}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        {game.name || `#${String(game.game_number).padStart(4, '0')}`}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px' }}>#{String(game.game_number).padStart(4, '0')}</span>
                      </Link>
                      <div style={{ textAlign: 'right' }}>{fmtTok(game.pool_balance, game.token_mint)}</div>
                      <div style={{ textAlign: 'right' }}>{(game.roi_bps / 100).toFixed(0)}%</div>
                      <div style={{ textAlign: 'right' }}>{game.bet_count}</div>
                      <div style={{ textAlign: 'right', fontSize: '11px', color: isLive ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {isLive ? '● LIVE' : '● ENDED'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>
    </>
  );
}