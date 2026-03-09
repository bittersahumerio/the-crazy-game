'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import bs58 from 'bs58';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import toast from 'react-hot-toast';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => m.WalletMultiButton),
  { ssr: false }
);

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

export default function ProfilePage() {
  const { publicKey, connected, signMessage } = useWallet();
  const [bets, setBets] = useState([]);
  const [activeBets, setActiveBets] = useState([]);
  const [stats, setStats] = useState(null);
  const [gamesHosted, setGamesHosted] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('active');
  const { connection } = useConnection();
  const [username, setUsername] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [socials, setSocials] = useState({ twitter: '', telegram: '', discord: '' });
  const [socialsStatus, setSocialsStatus] = useState(null);
  const [socialsLoading, setSocialsLoading] = useState(false);

  useEffect(() => {
    if (connected && publicKey) {
      fetchProfile();
      fetchActiveBets();
    }
  }, [connected, publicKey]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const [playerRes, userRes] = await Promise.all([
        fetch(`${API_URL}/api/players/${publicKey.toString()}`),
        fetch(`${API_URL}/api/users/${publicKey.toString()}`),
      ]);
      const playerData = await playerRes.json();
      const userData = await userRes.json();
      setBets(playerData.bets || []);
      setStats(playerData.stats);
      setGamesHosted(playerData.games_hosted || []);
      if (userData.user) {
        setUsername(userData.user.username);
        setSocials({
          twitter: userData.user.twitter || '',
          telegram: userData.user.telegram || '',
          discord: userData.user.discord || '',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchActiveBets() {
    try {
      const res = await fetch(`${API_URL}/api/players/${publicKey.toString()}/active`);
      const data = await res.json();
      setActiveBets(data.bets || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function registerUsername() {
    setUsernameLoading(true);
    setUsernameStatus(null);
    try {
      const message = `Register username: ${usernameInput}`;
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);
      const res = await fetch(`${API_URL}/api/users/username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toString(), username: usernameInput, signature, message }),
      });
      const data = await res.json();
      if (data.success) {
        setUsername(data.username);
        setUsernameStatus({ ok: true, msg: 'Username set!' });
      } else {
        setUsernameStatus({ ok: false, msg: data.error });
      }
    } catch (e) {
      setUsernameStatus({ ok: false, msg: 'Failed to sign message' });
    } finally {
      setUsernameLoading(false);
    }
  }

  async function updateSocials() {
    setSocialsLoading(true);
    setSocialsStatus(null);
    try {
      const message = `Update socials: ${publicKey.toString()}`;
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);
      const res = await fetch(`${API_URL}/api/users/socials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          twitter: socials.twitter || null,
          telegram: socials.telegram || null,
          discord: socials.discord || null,
          signature,
          message,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSocialsStatus({ ok: true, msg: 'Socials updated!' });
      } else {
        setSocialsStatus({ ok: false, msg: data.error });
      }
    } catch (e) {
      setSocialsStatus({ ok: false, msg: 'Failed to sign message' });
    } finally {
      setSocialsLoading(false);
    }
  }

  function formatAmount(amount) {
    return (parseInt(amount) / 1_000_000).toFixed(2);
  }

  function shortAddress(addr) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  function getRoiProgress(bet) {
    const earned = parseFloat(bet.current_accumulated || bet.accumulated_base);
    const target = parseFloat(bet.roi_target);
    return Math.min(Math.floor((earned / target) * 1000) / 10, 100);
  }

  const now = Math.floor(Date.now() / 1000);

  if (!connected) {
    return (
      <>
        <Navbar />
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '64px', marginBottom: '24px' }}>
            CONNECT WALLET
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Connect your wallet to view your profile and bets.
          </p>
          <WalletMultiButton />
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
          {username ? (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '72px', color: 'var(--accent)', marginBottom: '4px' }}>
              {username}
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '48px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {shortAddress(publicKey.toString())}
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px' }}>
            {username ? 'CONNECTED AS' : 'NO USERNAME SET'}
          </div>
          <a href={`https://solscan.io/account/${publicKey.toString()}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', textDecoration: 'none' }}>
            {publicKey.toString()}
          </a>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px', maxWidth: '400px' }}>
          <StatBox label="TOTAL BETS" value={stats?.total_bets || 0} />
          <StatBox label="GAMES HOSTED" value={gamesHosted.length} />
        </div>

        {/* Username + Socials */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
          {/* Username box */}
          <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '16px' }}>USERNAME</div>
            {username ? (
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--accent)' }}>{username}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '12px' }}>click below to change</span>
              </div>
            ) : (
              <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>No username set yet</div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="choose a username"
                value={usernameInput}
                onChange={e => { setUsernameInput(e.target.value); setUsernameStatus(null); }}
                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '10px 14px', fontSize: '14px', fontFamily: 'var(--font-body)', outline: 'none' }}
              />
              <button onClick={registerUsername} disabled={usernameLoading || !usernameInput}
                style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '10px 20px', fontWeight: '700', fontSize: '12px', letterSpacing: '0.05em', cursor: usernameLoading || !usernameInput ? 'not-allowed' : 'pointer', opacity: usernameLoading || !usernameInput ? 0.5 : 1 }}>
                {usernameLoading ? '...' : 'SET'}
              </button>
            </div>
            {usernameStatus && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: usernameStatus.ok ? 'var(--accent)' : 'var(--accent-red)' }}>
                {usernameStatus.msg}
              </div>
            )}
          </div>

          {/* Socials box */}
          <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '16px' }}>SOCIAL LINKS (OPTIONAL)</div>
            {[
              { key: 'twitter', label: 'X / TWITTER', placeholder: 'username (without @)' },
              { key: 'telegram', label: 'TELEGRAM', placeholder: 'username (without @)' },
              { key: 'discord', label: 'DISCORD', placeholder: 'username' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>{field.label}</div>
                <input type="text" placeholder={field.placeholder} value={socials[field.key]}
                  onChange={e => setSocials(s => ({ ...s, [field.key]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '10px 14px', fontSize: '14px', fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <button onClick={updateSocials} disabled={socialsLoading}
              style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '10px 20px', fontWeight: '700', fontSize: '12px', letterSpacing: '0.05em', cursor: socialsLoading ? 'not-allowed' : 'pointer', opacity: socialsLoading ? 0.5 : 1, marginTop: '8px' }}>
              {socialsLoading ? '...' : 'UPDATE SOCIALS'}
            </button>
            {socialsStatus && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: socialsStatus.ok ? 'var(--accent)' : 'var(--accent-red)' }}>
                {socialsStatus.msg}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
          {[
            { key: 'active', label: `ACTIVE BETS (${activeBets.length})` },
            { key: 'history', label: `BET HISTORY (${bets.length})` },
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

        {/* Active Bets */}
        {tab === 'active' && (
          <div>
            {activeBets.length === 0 ? (
              <div style={{ border: '1px solid var(--border)', padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', marginBottom: '16px' }}>NO ACTIVE BETS</div>
                <Link href="/games" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '13px', letterSpacing: '0.05em' }}>
                  BROWSE GAMES →
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeBets.map((bet, i) => {
                  const progress = getRoiProgress(bet);
                  const isExpired = bet.timer_end < now;
                  return (
                    <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px', gap: '16px', alignItems: 'center' }}>
                        <div>
                          <Link href={`/games/${bet.game_number}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
                            {bet.game_name || `#${String(bet.game_number).padStart(4, '0')}`}
                          </Link>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            #{String(bet.game_number).padStart(4, '0')} · BET #{bet.bet_index}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>${formatAmount(bet.amount)}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>WAGERED</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>${formatAmount(bet.roi_target)}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ROI TARGET</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {bet.reserved ? (
                            <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '700' }}>✓ ROI</span>
                          ) : (
                            <span style={{ color: progress >= 90 ? '#f0c040' : 'var(--accent)', fontSize: '13px', fontWeight: '600' }}>
                              {progress.toFixed(1)}%
                            </span>
                          )}
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PROGRESS</div>
                        </div>
                      </div>
                      {/* Progress bar */}
                      {!bet.reserved && (
                        <div style={{ marginTop: '10px', height: '2px', background: 'var(--border)' }}>
                          <div style={{ height: '100%', width: `${progress}%`, background: progress >= 90 ? '#f0c040' : 'var(--accent)', transition: 'width 0.3s' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
                    <div style={{ textAlign: 'right' }}>${formatAmount(bet.amount)}</div>
                    <div style={{ textAlign: 'right' }}>${formatAmount(bet.roi_target)}</div>
                    <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(bet.placed_at)}</div>
                    <div style={{ textAlign: 'right', fontSize: '11px', color: bet.withdrawn ? 'var(--text-muted)' : bet.reserved ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {bet.withdrawn ? 'WITHDRAWN' : bet.reserved ? 'READY' : 'ACTIVE'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Games Hosted */}
        {tab === 'hosted' && (
          <div>
            {gamesHosted.length === 0 ? (
              <div style={{ border: '1px solid var(--border)', padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', marginBottom: '16px' }}>NO GAMES HOSTED YET</div>
                <Link href="/create" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '13px', letterSpacing: '0.05em' }}>
                  HOST A GAME →
                </Link>
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
                      <div style={{ textAlign: 'right' }}>${formatAmount(game.pool_balance)}</div>
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