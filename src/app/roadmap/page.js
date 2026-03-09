'use client';

import Navbar from '@/components/Navbar';

const PHASES = [
  {
    phase: '01',
    title: 'LAUNCH',
    status: 'current',
    items: [
      { done: false, text: 'Smart contract audit' },
      { done: false, text: 'Vanilla & cumulative timer modes' },
      { done: false, text: 'USDC support' },
      { done: false, text: 'Beta launch on mainnet' },
      { done: false, text: 'Leaderboards' },
      { done: false, text: 'Referral system' },
    ],
  },
  {
    phase: '02',
    title: 'EXPANSION',
    status: 'upcoming',
    items: [
      { done: false, text: 'Random timer mode' },
      { done: false, text: 'Salvador mode — bounties for near-ROI bets' },
      { done: false, text: 'Multi-token support' },
      { done: false, text: 'CRAZY token launch & airdrop to early players' },
      { done: false, text: 'In-game chat' },
      { done: false, text: 'Player usernames' },
    ],
  },
  {
    phase: '03',
    title: 'WILD STUFF',
    status: 'future',
    items: [
      { done: false, text: 'VRF-powered random mechanics' },
      { done: false, text: 'Tournament mode' },
      { done: false, text: 'Mobile app' },
      { done: false, text: 'DAO governance for platform parameters' },
      { done: false, text: 'Cross-chain expansion' },
    ],
  },
];

const statusColors = {
  current: 'var(--accent)',
  upcoming: 'var(--text-secondary)',
  future: 'var(--text-muted)',
};

const statusLabels = {
  current: 'IN PROGRESS',
  upcoming: 'UPCOMING',
  future: 'FUTURE',
};

export default function RoadmapPage() {
  return (
    <>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>

        <h1 style={{ fontSize: '80px', marginBottom: '8px' }}>ROADMAP</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '60px', fontSize: '14px' }}>
          Where we are. Where we're going. No promises on dates — only on shipping.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {PHASES.map((phase, i) => (
            <div key={phase.phase} style={{
              border: `1px solid ${phase.status === 'current' ? 'var(--accent)' : 'var(--border)'}`,
              background: phase.status === 'current' ? 'var(--accent-dim)' : 'var(--bg-card)',
              padding: '32px',
              position: 'relative',
            }}>
              {/* Phase number */}
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '120px',
                color: phase.status === 'current' ? 'var(--accent)' : 'var(--text-muted)',
                opacity: 0.15,
                position: 'absolute',
                top: '16px',
                right: '24px',
                lineHeight: 1,
                pointerEvents: 'none',
              }}>
                {phase.phase}
              </div>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '36px' }}>{phase.title}</h2>
                <span style={{
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  color: statusColors[phase.status],
                  border: `1px solid ${statusColors[phase.status]}`,
                  padding: '4px 10px',
                }}>
                  {statusLabels[phase.status]}
                </span>
              </div>

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {phase.items.map((item, j) => (
                  <div key={j} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '14px',
                    color: item.done ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}>
                    <span style={{
                      width: '18px',
                      height: '18px',
                      border: `1px solid ${item.done ? 'var(--accent)' : 'var(--border)'}`,
                      background: item.done ? 'var(--accent)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      color: '#000',
                      flexShrink: 0,
                    }}>
                      {item.done ? '✓' : ''}
                    </span>
                    <span style={{ textDecoration: item.done ? 'line-through' : 'none' }}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </main>
    </>
  );
}