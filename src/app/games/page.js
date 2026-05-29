'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import TypeBadge, { timerBadgeKind, modeBadgeKind } from '@/components/TypeBadge';
import HowToPlay from '@/components/HowToPlay';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PAGE_SIZE = 50;

function GameCard({ game }) {
  const timeLeft = game.timer_end - Math.floor(Date.now() / 1000);
  const isExpired = timeLeft <= 0;

  function formatTime(secs) {
    if (secs <= 0) return 'ENDED';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function formatAmount(amount) {
    return (parseInt(amount) / 1_000_000).toFixed(2);
  }

  const poolPct = game.initial_deposit > 0
    ? Math.min(Math.round((parseInt(game.pool_balance) / parseInt(game.initial_deposit)) * 100), 999)
    : 0;

  const statusColor = isExpired
    ? 'var(--accent-red)'
    : poolPct >= 200 ? '#f0c040' : 'var(--accent)';

  return (
    <div
        style={{
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          padding: '24px',
          cursor: 'pointer',
          transition: 'border-color 0.2s, background 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.background = 'var(--bg-card-hover)';
        }}
        onMouseLeave={e => {
  e.currentTarget.style.borderColor = 'var(--border)';
  e.currentTarget.style.background = 'var(--bg-card)';
}}
onClick={() => window.location.href = `/games/${game.game_number}`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '2px' }}>
              {game.name || `GAME #${String(game.game_number).padStart(4, '0')}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                #{String(game.game_number).padStart(4, '0')}
              </span>
              <TypeBadge kind={timerBadgeKind(game)} size={18} />
              <TypeBadge kind={modeBadgeKind(game)} size={18} />
            </div>
            <div style={{ fontSize: '10px', marginTop: '2px' }}>
              {game.host_username ? (
                <a href={`/profile/${game.host_username}`}
                  onClick={e => e.stopPropagation()}
                  style={{ color: 'var(--text-muted)', textDecoration: 'none', letterSpacing: '0.05em' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  @{game.host_username}
                </a>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>{game.host.slice(0,6)}...{game.host.slice(-4)}</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: statusColor, letterSpacing: '0.1em', marginBottom: '2px' }}>
              {isExpired ? '● ENDED' : '● LIVE'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              ⏱ {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: '42px', color: 'var(--text-primary)', marginBottom: '4px' }}>
          {formatAmount(game.pool_balance)}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', letterSpacing: '0.05em' }}>
          USDC IN POOL
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>POOL GROWTH</span>
            <span style={{ fontSize: '10px', color: statusColor, fontWeight: '700' }}>{poolPct}%</span>
          </div>
          <div style={{ height: '3px', background: 'var(--border)', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(poolPct, 100)}%`, background: statusColor, transition: 'width 0.3s' }} />
          </div>
        </div>

        <div className="grid-stats-4" style={{ gap: '8px' }}>
          {[
            { label: 'MIN BET', value: `$${formatAmount(game.min_bet)}` },
            { label: 'ROI', value: `${(game.roi_bps / 100).toFixed(0)}%` },
            { label: 'BETS', value: game.bet_count || '—' },
            { label: 'TIMER', value: parseInt(game.timer_mode) === 1 ? `+${Math.round(parseInt(game.time_increment) / 60)}m/bet` : `${Math.round(parseInt(game.timer_duration) / 60)}m reset` },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--bg)', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--accent)', marginBottom: '2px' }}>{stat.value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
  );
}

const TIMER_MODE_LABELS = { '': 'ANY', '0': 'FIXED', '1': 'CUMULATIVE', '2': 'RANDOM' };
const SALVADOR_MODE_LABELS = { '': 'ANY', '0': 'VANILLA', '1': 'SALVADOR — FIXED', '2': 'SALVADOR — PROGRESSIVE' };

const inputStyle = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  padding: '8px 12px',
  fontSize: '13px',
  fontFamily: 'var(--font-body)',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function GamesPage() {
  const [games, setGames] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState('created_at');
  const [tab, setTab] = useState('active');
  const [offset, setOffset] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [, setTick] = useState(0);

  const [filters, setFilters] = useState({
    name: '',
    min_pool: '',
    max_pool: '',
    min_min_bet: '',
    max_min_bet: '',
    timer_mode: '',
    salvador_mode: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({});

  useEffect(() => {
    setGames([]);
    setOffset(0);
    fetchGames(0, true, appliedFilters);
    const interval = setInterval(() => fetchGames(0, true, appliedFilters), 300_000);
    return () => clearInterval(interval);
  }, [sort, tab, appliedFilters]);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  function buildQuery(extraFilters = {}) {
    const f = { ...appliedFilters, ...extraFilters };
    const params = new URLSearchParams({
      sort,
      order: 'DESC',
      status: tab,
      limit: PAGE_SIZE,
    });
    if (f.name) params.set('name', f.name);
    if (f.min_pool) params.set('min_pool', f.min_pool);
    if (f.max_pool) params.set('max_pool', f.max_pool);
    if (f.max_min_bet) params.set('max_min_bet', f.max_min_bet);
    if (f.timer_mode !== '') params.set('timer_mode', f.timer_mode);
    if (f.salvador_mode !== '') params.set('salvador_mode', f.salvador_mode);
    return params;
  }

  async function fetchGames(fetchOffset = 0, replace = false, currentFilters = appliedFilters) {
    if (fetchOffset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        sort, order: 'DESC', status: tab, limit: PAGE_SIZE, offset: fetchOffset,
      });
      if (currentFilters.name) params.set('name', currentFilters.name);
      if (currentFilters.min_pool) params.set('min_pool', currentFilters.min_pool);
      if (currentFilters.max_pool) params.set('max_pool', currentFilters.max_pool);
      if (currentFilters.min_min_bet) params.set('min_min_bet', currentFilters.min_min_bet);
      if (currentFilters.max_min_bet) params.set('max_min_bet', currentFilters.max_min_bet);
      if (currentFilters.timer_mode !== undefined && currentFilters.timer_mode !== '') params.set('timer_mode', currentFilters.timer_mode);
      if (currentFilters.salvador_mode !== undefined && currentFilters.salvador_mode !== '') params.set('salvador_mode', currentFilters.salvador_mode);

      const res = await fetch(`${API_URL}/api/games?${params.toString()}`);
      const data = await res.json();
      if (replace) setGames(data.games || []);
      else setGames(prev => [...prev, ...(data.games || [])]);
      setTotal(data.total || 0);
    } catch (e) {
      console.error('Failed to fetch games:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function applyFilters() {
    setAppliedFilters({ ...filters });
    setOffset(0);
  }

  function clearFilters() {
    const empty = { name: '', min_pool: '', max_pool: '', min_min_bet: '', max_min_bet: '', timer_mode: '', salvador_mode: '' };
    setFilters(empty);
    setAppliedFilters({});
    setOffset(0);
  }

  const activeFilterCount = Object.values(appliedFilters).filter(v => v !== '' && v !== undefined).length;

  function loadMore() {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchGames(newOffset, false);
  }

  const hasMore = games.length < total;

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px' }}>
            <h1 className="h-display-lg">GAMES</h1>
            <div style={{ marginBottom: '8px' }}><HowToPlay /></div>
            <div style={{ display: 'flex', marginBottom: '8px' }}>
              {[{ label: 'LIVE', value: 'active' }, { label: 'ENDED', value: 'ended' }].map(t => (
                <button key={t.value} onClick={() => setTab(t.value)} style={{
                  background: tab === t.value ? 'var(--accent)' : 'transparent',
                  color: tab === t.value ? '#000' : 'var(--text-secondary)',
                  border: '1px solid', borderColor: tab === t.value ? 'var(--accent)' : 'var(--border)',
                  padding: '8px 16px', fontSize: '11px', letterSpacing: '0.08em',
                  cursor: 'pointer', transition: 'all 0.2s', marginRight: '-1px',
                }}>
                  {t.label} {!loading && tab === t.value ? `(${total})` : ''}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Filter toggle */}
            <button
              onClick={() => setFiltersOpen(o => !o)}
              style={{
                background: activeFilterCount > 0 ? 'var(--accent-dim)' : 'transparent',
                color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-secondary)',
                border: '1px solid', borderColor: activeFilterCount > 0 ? 'var(--accent)' : 'var(--border)',
                padding: '8px 16px', fontSize: '11px', letterSpacing: '0.08em',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              FILTERS {activeFilterCount > 0 ? `(${activeFilterCount})` : ''} {filtersOpen ? '▲' : '▼'}
            </button>

            {/* Sort buttons */}
            {[
              { label: 'NEWEST', value: 'created_at' },
              { label: 'BIGGEST POOL', value: 'pool_balance' },
              { label: 'ENDING SOON', value: 'timer_end' },
            ].map(s => (
              <button key={s.value} onClick={() => setSort(s.value)} style={{
                background: sort === s.value ? 'var(--accent)' : 'transparent',
                color: sort === s.value ? '#000' : 'var(--text-secondary)',
                border: '1px solid', borderColor: sort === s.value ? 'var(--accent)' : 'var(--border)',
                padding: '8px 16px', fontSize: '11px', letterSpacing: '0.08em',
                cursor: 'pointer', transition: 'all 0.2s',
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div style={{
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            padding: '24px',
            marginBottom: '24px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>SEARCH BY NAME</div>
                <input
                  type="text"
                  placeholder="e.g. DEGEN"
                  value={filters.name}
                  onChange={e => setFilters(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && applyFilters()}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>MIN POOL ($)</div>
                <input
                  type="number"
                  placeholder="e.g. 10"
                  value={filters.min_pool}
                  onChange={e => setFilters(f => ({ ...f, min_pool: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>MAX POOL ($)</div>
                <input
                  type="number"
                  placeholder="e.g. 1000"
                  value={filters.max_pool}
                  onChange={e => setFilters(f => ({ ...f, max_pool: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>MIN BET FROM ($)</div>
                <input
                  type="number"
                  placeholder="e.g. 0.5"
                  value={filters.min_min_bet}
                  onChange={e => setFilters(f => ({ ...f, min_min_bet: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>MIN BET UP TO ($)</div>
                <input
                  type="number"
                  placeholder="e.g. 5"
                  value={filters.max_min_bet}
                  onChange={e => setFilters(f => ({ ...f, max_min_bet: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>TIMER MODE</div>
                <select
                  value={filters.timer_mode}
                  onChange={e => setFilters(f => ({ ...f, timer_mode: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {Object.entries(TIMER_MODE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>GAME MODE</div>
                <select
                  value={filters.salvador_mode}
                  onChange={e => setFilters(f => ({ ...f, salvador_mode: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {Object.entries(SALVADOR_MODE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={applyFilters}
                style={{
                  background: 'var(--accent)', color: '#000', border: 'none',
                  padding: '10px 24px', fontSize: '12px', letterSpacing: '0.08em',
                  fontFamily: 'var(--font-body)', cursor: 'pointer', fontWeight: '700',
                }}
              >
                APPLY FILTERS
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  style={{
                    background: 'transparent', color: 'var(--text-secondary)',
                    border: '1px solid var(--border)', padding: '10px 24px',
                    fontSize: '12px', letterSpacing: '0.08em', cursor: 'pointer',
                  }}
                >
                  CLEAR ALL
                </button>
              )}
            </div>
          </div>
        )}

        {/* Games grid */}
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '80px' }}>LOADING...</div>
        ) : games.length === 0 ? (
          <div style={{ border: '1px solid var(--border)', padding: '80px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '48px', marginBottom: '16px' }}>
              {activeFilterCount > 0 ? 'NO GAMES MATCH YOUR FILTERS' : tab === 'active' ? 'NO LIVE GAMES' : 'NO ENDED GAMES'}
            </div>
            {activeFilterCount > 0 ? (
              <button onClick={clearFilters} style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '12px 24px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>
                CLEAR FILTERS
              </button>
            ) : tab === 'active' && (
              <>
                <p style={{ marginBottom: '24px' }}>Be the first to host one.</p>
                <Link href="/create" style={{ background: 'var(--accent)', color: '#000', padding: '12px 24px', textDecoration: 'none', fontWeight: '700', fontSize: '13px' }}>
                  HOST A GAME →
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              {games.map(game => <GameCard key={game.id} game={game} />)}
            </div>

            {hasMore && (
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    background: 'transparent', color: 'var(--text-secondary)',
                    border: '1px solid var(--border)', padding: '12px 32px',
                    fontSize: '12px', letterSpacing: '0.08em',
                    cursor: loadingMore ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => !loadingMore && (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {loadingMore ? 'LOADING...' : `LOAD MORE (${games.length} / ${total})`}
                </button>
              </div>
            )}
          </>
        )}

      </main>
    </>
  );
}