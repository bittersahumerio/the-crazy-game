'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

function formatAmount(amount) {
  return (parseInt(amount) / 1_000_000).toFixed(2);
}

function shortAddress(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getWeekDates(weekStart, weekEnd) {
  const start = new Date(weekStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const end = new Date(weekEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${start} — ${end}`;
}

function getDaysLeft(weekEnd) {
  const diff = new Date(weekEnd) - new Date();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return 'Ending soon';
}

function getTiers(payoutPotUsd) {
  if (payoutPotUsd < 10) return [50, 30, 20];
  if (payoutPotUsd < 50) return [35, 25, 18, 13, 9];
  if (payoutPotUsd < 200) return [25, 18, 14, 10, 8, 7, 6, 5, 4, 3];
  if (payoutPotUsd < 1000) return [20, 15, 11, 9, 7, 6, 5, 4, 3.5, 3, 2.5, 2.5, 2, 2, 1.5, 1.5, 1.5, 1.5, 1, 1];
  return [15, 11, 9, 7, 6, 5, 4.5, 4, 3.5, 3, 2.5, 2.5, 2, 2, 1.5, 1.5, 1.5, 1.5, 1, 1,
          0.9, 0.9, 0.8, 0.8, 0.8, 0.7, 0.7, 0.7, 0.6, 0.6, 0.6, 0.5, 0.5, 0.5, 0.5,
          0.4, 0.4, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2];
}

function formatSol(lamports) {
  return (parseInt(lamports || 0) / 1_000_000_000).toFixed(3);
}

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function LeaderboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usernames, setUsernames] = useState({});
  const [showTiers, setShowTiers] = useState(false);
  const { publicKey } = useWallet();

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function fetchLeaderboard() {
    try {
      const res = await fetch(`${API_URL}/api/leaderboard`);
      const json = await res.json();
      setData(json);
      if (json.entries) fetchUsernames(json.entries);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsernames(entries) {
    if (!entries || entries.length === 0) return;
    try {
      const wallets = entries.map(e => e.player);
      const res = await fetch(`${API_URL}/api/users/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallets }),
      });
      const map = await res.json();
      setUsernames(map);
    } catch (e) {
      console.error(e);
    }
  }

  const potAmount = parseInt(data?.week?.pot_sol_amount || 0);
  const payoutPot = potAmount / 2;
  const payoutPotSol = payoutPot / 1_000_000_000;
  const tiers = getTiers(payoutPotSol * 150);
  const myWallet = publicKey?.toString();
  const myEntry = data?.entries?.find(e => e.player === myWallet);
  const myRank = myEntry ? data.entries.indexOf(myEntry) + 1 : null;

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>

        <h1 className="h-display-xl" style={{ fontFamily: 'var(--font-display)', marginBottom: '8px', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
          THE HEAT
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '14px' }}>
          Top players by Scovilles earned this week split the pot. 50% rolls over to next week — the pot never dies.
        </p>
        <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '12px' }}>
          Every game counts — you earn Scovilles from the SOL value of the fees you pay, in any token.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>LOADING...</div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>FAILED TO LOAD</div>
        ) : (
          <>
            {/* Pot info */}
            <div className="grid-3-stack" style={{ gap: '1px', background: 'var(--border)', border: '1px solid var(--accent)', marginBottom: '24px' }}>
              <div style={{ background: 'var(--bg-card)', padding: '28px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '52px', color: 'var(--accent)', marginBottom: '4px' }}>
                  ◎{formatSol(potAmount)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>TOTAL POT</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '28px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '52px', color: 'var(--accent)', marginBottom: '4px' }}>
                  ◎{payoutPotSol.toFixed(3)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>PAID OUT</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>top {tiers.length} players</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '28px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {data.week ? getWeekDates(data.week.week_start, data.week.week_end) : '—'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                  {data.week ? getDaysLeft(data.week.week_end) : ''}
                </div>
                {false && data.week?.rollover_amount > 0 && (
                  <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--accent)' }}>
                    +${formatAmount(data.week.rollover_amount)} rollover
                  </div>
                )}
              </div>
            </div>

            {/* Player's own rank */}
            {myEntry && (
              <div style={{ border: '1px solid var(--accent)', background: 'var(--accent-dim)', padding: '16px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', color: 'var(--accent)', letterSpacing: '0.05em' }}>
                  YOUR POSITION
                </div>
                <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: myRank <= 3 ? MEDAL_COLORS[myRank - 1] : 'var(--accent)' }}>#{myRank}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>RANK</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--accent)' }}>{Math.floor(parseInt(myEntry.fees_paid) / 100000)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SCOVILLES</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: myRank <= tiers.length ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {myRank <= tiers.length ? `◎${(payoutPot * tiers[myRank - 1] / 100 / 1_000_000_000).toFixed(3)}` : '—'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>EST. REWARD</div>
                  </div>
                </div>
              </div>
            )}

            {/* Payout tiers toggle */}
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTiers(!showTiers)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.08em' }}>
                {showTiers ? 'HIDE' : 'SHOW'} PAYOUT TIERS
              </button>
            </div>

            {/* Payout tiers table */}
            {showTiers && (
              <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', marginBottom: '24px' }}>
                <div className="scroll-x">
                <div className="lb-row" style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 120px', padding: '10px 24px', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  <span>RANK</span><span>PRIZE</span><span style={{ textAlign: 'right' }}>%</span><span style={{ textAlign: 'right' }}>EST. AMOUNT</span>
                </div>
                {tiers.map((pct, i) => (
                  <div key={i} className="lb-row" style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 120px', padding: '10px 24px', borderBottom: '1px solid var(--border)', fontSize: '13px', alignItems: 'center', background: i < 3 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: i < 3 ? MEDAL_COLORS[i] : 'var(--text-muted)' }}>{i + 1}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                      {i === 0 ? '🥇 First place' : i === 1 ? '🥈 Second place' : i === 2 ? '🥉 Third place' : `Top ${i + 1}`}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{pct}%</span>
                    <span style={{ textAlign: 'right', color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: '16px' }}>
                      ◎{(payoutPot * pct / 100 / 1_000_000_000).toFixed(3)}
                    </span>
                  </div>
                ))}
                </div>
              </div>
            )}

            {/* Leaderboard table */}
            <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <div className="scroll-x">
              <div className="lb-row" style={{ display: 'grid', gridTemplateColumns: '60px 1fr 140px 120px', padding: '12px 24px', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                <span>RANK</span>
                <span>PLAYER</span>
                <span style={{ textAlign: 'right' }}>SCOVILLES</span>
                <span style={{ textAlign: 'right' }}>EST. REWARD</span>
              </div>

              {data.entries.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: 'var(--text-muted)', marginBottom: '12px' }}>NO ENTRIES YET</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Place bets to appear on the leaderboard.</p>
                </div>
              ) : (
                data.entries.map((entry, i) => {
                  const isMe = entry.player === myWallet;
                  const isPaid = i < tiers.length;
                  const estReward = isPaid ? (payoutPot * tiers[i] / 100 / 1_000_000_000).toFixed(3) : null;
                  return (
                    <div key={entry.player} className="lb-row" style={{
                      display: 'grid',
                      gridTemplateColumns: '60px 1fr 140px 120px',
                      padding: '16px 24px',
                      borderBottom: '1px solid var(--border)',
                      alignItems: 'center',
                      background: isMe ? 'var(--accent-dim)' : i < 3 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: i < 3 ? MEDAL_COLORS[i] : 'var(--text-muted)' }}>
                        {i + 1}
                      </span>
                      <Link href={usernames[entry.player] ? `/profile/${usernames[entry.player]}` : '#'} style={{ fontSize: '13px', color: isMe ? 'var(--accent)' : 'var(--text-primary)', textDecoration: 'none' }}>
                        {usernames[entry.player] ? `@${usernames[entry.player]}` : shortAddress(entry.player)}
                        {isMe && <span style={{ fontSize: '10px', marginLeft: '8px', color: 'var(--accent)' }}>YOU</span>}
                      </Link>
                      <span style={{ fontSize: '13px', textAlign: 'right', color: 'var(--accent)' }}>
                        {Math.floor(parseInt(entry.fees_paid) / 100000)}
                      </span>
                      <span style={{ fontSize: '13px', textAlign: 'right', color: isPaid ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {estReward ? `◎${estReward}` : '—'}
                      </span>
                    </div>
                  );
                })
              )}
              </div>
            </div>

            {/* How it works */}
            <div style={{ marginTop: '32px', border: '1px solid var(--border)', padding: '24px', background: 'var(--bg-card)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.05em' }}>HOW THE HEAT WORKS</div>
              Every fee you pay earns you Scovilles — 1 Scoville per 0.0001 SOL in fees. At the end of each week,
              the top players split 50% of the pot based on their rank. The other 50% rolls over to the next week,
              so the pot keeps growing. Rewards are paid in SOL directly to your wallet.
            </div>
          </>
        )}
      </main>
    </>
  );
}