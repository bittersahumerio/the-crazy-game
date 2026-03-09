'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function LeaderboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usernames, setUsernames] = useState({});
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
  return (
    <>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>

        <h1 style={{ fontSize: '80px', marginBottom: '8px' }}>LEADERBOARD</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '14px' }}>
          Top players by fees paid this week share the pot. 50% rolls over to next week.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
            LOADING...
          </div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
            FAILED TO LOAD
          </div>
        ) : (
          <>
            {/* Pot and week info */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1px',
              background: 'var(--border)',
              border: '1px solid var(--accent)',
              marginBottom: '32px',
            }}>
              <div style={{ background: 'var(--bg-card)', padding: '32px', textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '64px',
                  color: 'var(--accent)',
                  marginBottom: '4px',
                }}>
                  ${formatAmount(data.week?.pot_amount || 0)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                  THIS WEEK'S POT
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '32px', textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '40px',
                  color: 'var(--text-primary)',
                  marginBottom: '4px',
                }}>
                  {data.week ? getWeekDates(data.week.week_start, data.week.week_end) : '—'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                  {data.week ? getDaysLeft(data.week.week_end) : ''}
                </div>
                {data.week?.rollover_amount > 0 && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    color: 'var(--accent)',
                  }}>
                    includes ${formatAmount(data.week.rollover_amount)} rollover from last week
                  </div>
                )}
              </div>
            </div>

            {/* Leaderboard table */}
            <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 160px',
                padding: '12px 24px',
                borderBottom: '1px solid var(--border)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
              }}>
                <span>RANK</span>
                <span>PLAYER</span>
                <span style={{ textAlign: 'right' }}>POINTS</span>
              </div>

              {data.entries.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center' }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '36px',
                    color: 'var(--text-muted)',
                    marginBottom: '12px',
                  }}>
                    NO ENTRIES YET
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Place bets to appear on the leaderboard.
                  </p>
                </div>
              ) : (
                data.entries.map((entry, i) => (
                  <div key={entry.player} style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 160px',
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'center',
                    background: i < 3 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '24px',
                      color: i < 3 ? MEDAL_COLORS[i] : 'var(--text-muted)',
                    }}>
                      {i + 1}
                    </span>
                    <Link href={usernames[entry.player] ? `/profile/${usernames[entry.player]}` : '#'} style={{
  fontSize: '13px',
  fontFamily: 'monospace',
  color: 'var(--text-primary)',
  textDecoration: 'none',
}}>
  {usernames[entry.player] || shortAddress(entry.player)}
</Link>
                    <span style={{
                      fontSize: '13px',
                      textAlign: 'right',
                      color: 'var(--accent)',
                    }}>
                      {parseInt(entry.fees_paid / 10000)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* How it works */}
            <div style={{
              marginTop: '32px',
              border: '1px solid var(--border)',
              padding: '24px',
              background: 'var(--bg-card)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.8,
            }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.05em' }}>
                HOW IT WORKS
              </div>
              Every bet you place contributes fees to this week's pot. At the end of the week, 
              the top players split 50% of the pot — weighted by rank, so first place gets the most. 
              The other 50% rolls over to boost next week's pot.
            </div>
          </>
        )}
      </main>
    </>
  );
}