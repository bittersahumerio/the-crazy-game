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

function getTimeLeft(weekEnd, now) {
  const diff = new Date(weekEnd).getTime() - now;
  if (diff <= 0) return 'Ending soon';
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${d}d ${h}h ${m}m left`;
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

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function LeaderboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usernames, setUsernames] = useState({});
  const [showTiers, setShowTiers] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { publicKey } = useWallet();

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Live countdown tick (d:h:m display) — independent of the 30s data refresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function fetchLeaderboard() {
    try {
      const res = await fetch(`${API_URL}/api/leaderboard`);
      const json = await res.json();
      setData(json);
      const allPlayers = [...(json.entries || []), ...((json.lastWeek && json.lastWeek.entries) || [])];
      if (allPlayers.length) fetchUsernames(allPlayers);
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

  const potAmount = parseInt(data?.week?.pot_amount || 0);
  const payoutPot = potAmount / 2;
  const payoutPotUsd = payoutPot / 1_000_000;
  const tiers = getTiers(payoutPotUsd);

  // Tie-aware placements: players with equal Scovilles share a rank and split
  // the combined prize for the slots they occupy (mirrors backend closeWeek).
  const placements = (() => {
    const e = data?.entries || [];
    const out = new Array(e.length);
    let i = 0;
    while (i < e.length) {
      let j = i;
      while (j < e.length && e[j].fees_paid === e[i].fees_paid) j++;
      const groupSize = j - i;
      let groupPct = 0;
      for (let pos = i; pos < j; pos++) groupPct += pos < tiers.length ? tiers[pos] : 0;
      const rewardEach = groupPct > 0 ? (payoutPot * (groupPct / 100)) / groupSize / 1_000_000 : null;
      for (let k = i; k < j; k++) out[k] = { rank: i + 1, reward: rewardEach };
      i = j;
    }
    return out;
  })();

  const myWallet = publicKey?.toString();
  const myEntry = data?.entries?.find(e => e.player === myWallet);
  const myIndex = myEntry ? data.entries.indexOf(myEntry) : -1;
  const myRank = myIndex >= 0 ? placements[myIndex].rank : null;
  const myReward = myIndex >= 0 ? placements[myIndex].reward : null;

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>

        <h1 className="h-display-xl" style={{ fontFamily: 'var(--font-display)', marginBottom: '8px', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
          THE HEAT
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '14px' }}>
          Top players by Scovilles earned this week split the pot. 50% rolls over to next week — the pot never dies.
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
                  ${formatAmount(potAmount)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>TOTAL POT</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '28px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '52px', color: 'var(--accent)', marginBottom: '4px' }}>
                  ${payoutPotUsd.toFixed(2)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>PAID OUT</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>top {tiers.length} players</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '28px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {data.week ? getWeekDates(data.week.week_start, data.week.week_end) : '—'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                  {data.week ? getTimeLeft(data.week.week_end, now) : ''}
                </div>
                {data.week?.rollover_amount > 0 && (
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
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--accent)' }}>{Math.floor(parseInt(myEntry.fees_paid) / 10000)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SCOVILLES</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: myReward != null ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {myReward != null ? `$${myReward.toFixed(2)}` : '—'}
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
                      ${(payoutPot * pct / 100 / 1_000_000).toFixed(2)}
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
                  const place = placements[i];
                  const estReward = place.reward != null ? place.reward.toFixed(2) : null;
                  const isPaid = place.reward != null;
                  return (
                    <div key={entry.player} className="lb-row" style={{
                      display: 'grid',
                      gridTemplateColumns: '60px 1fr 140px 120px',
                      padding: '16px 24px',
                      borderBottom: '1px solid var(--border)',
                      alignItems: 'center',
                      background: isMe ? 'var(--accent-dim)' : i < 3 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: place.rank <= 3 ? MEDAL_COLORS[place.rank - 1] : 'var(--text-muted)' }}>
                        {place.rank}
                      </span>
                      <Link href={usernames[entry.player] ? `/profile/${usernames[entry.player]}` : '#'} style={{ fontSize: '13px', color: isMe ? 'var(--accent)' : 'var(--text-primary)', textDecoration: 'none' }}>
                        {usernames[entry.player] ? `@${usernames[entry.player]}` : shortAddress(entry.player)}
                        {isMe && <span style={{ fontSize: '10px', marginLeft: '8px', color: 'var(--accent)' }}>YOU</span>}
                      </Link>
                      <span style={{ fontSize: '13px', textAlign: 'right', color: 'var(--accent)' }}>
                        {Math.floor(parseInt(entry.fees_paid) / 10000)}
                      </span>
                      <span style={{ fontSize: '13px', textAlign: 'right', color: isPaid ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {estReward ? `$${estReward}` : '—'}
                      </span>
                    </div>
                  );
                })
              )}
              </div>
            </div>

            {/* Last week's final results */}
            {data.lastWeek?.entries?.length > 0 && (
              <div style={{ marginTop: '32px', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>LAST WEEK</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {getWeekDates(data.lastWeek.week.week_start, data.lastWeek.week.week_end)} · ${(data.lastWeek.entries.reduce((s, e) => s + (parseInt(e.reward) || 0), 0) / 1_000_000).toFixed(2)} paid out
                  </div>
                </div>
                <div className="scroll-x">
                  <div className="lb-row" style={{ display: 'grid', gridTemplateColumns: '60px 1fr 140px 120px', padding: '12px 24px', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                    <span>RANK</span>
                    <span>PLAYER</span>
                    <span style={{ textAlign: 'right' }}>SCOVILLES</span>
                    <span style={{ textAlign: 'right' }}>WON</span>
                  </div>
                  {data.lastWeek.entries.map((entry) => {
                    const r = parseInt(entry.rank);
                    const won = (parseInt(entry.reward) || 0) / 1_000_000;
                    return (
                      <div key={entry.player} className="lb-row" style={{ display: 'grid', gridTemplateColumns: '60px 1fr 140px 120px', padding: '14px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center', background: r <= 3 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: r <= 3 ? MEDAL_COLORS[r - 1] : 'var(--text-muted)' }}>{r}</span>
                        <Link href={usernames[entry.player] ? `/profile/${usernames[entry.player]}` : '#'} style={{ fontSize: '13px', color: 'var(--text-primary)', textDecoration: 'none' }}>
                          {usernames[entry.player] ? `@${usernames[entry.player]}` : shortAddress(entry.player)}
                        </Link>
                        <span style={{ fontSize: '13px', textAlign: 'right', color: 'var(--accent)' }}>{Math.floor(parseInt(entry.fees_paid) / 10000)}</span>
                        <span style={{ fontSize: '13px', textAlign: 'right', color: won > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{won > 0 ? `$${won.toFixed(2)}` : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* How it works */}
            <div style={{ marginTop: '32px', border: '1px solid var(--border)', padding: '24px', background: 'var(--bg-card)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.05em' }}>HOW THE HEAT WORKS</div>
              Every fee you pay earns you Scovilles — 1 Scoville per $0.01 in fees. At the end of each week,
              the top players split 50% of the pot based on their rank. The other 50% rolls over to the next week,
              so the pot keeps growing. Rewards are paid in USDC directly to your wallet.
            </div>
          </>
        )}
      </main>
    </>
  );
}