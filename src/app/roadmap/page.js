'use client';
import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const STATUS_CONFIG = {
  'done':        { label: 'DONE',        color: 'var(--accent)',         border: 'var(--accent)' },
  'in-progress': { label: 'IN PROGRESS', color: '#ffaa00',               border: '#ffaa00' },
  'planned':     { label: 'PLANNED',     color: 'var(--text-secondary)', border: 'var(--border)' },
};

export default function RoadmapPage() {
  const [phases, setPhases] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API_URL + '/api/roadmap')
      .then(r => r.json())
      .then(d => { setPhases(d.phases || []); setItems(d.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const itemsByPhase = {};
  for (const item of items) {
    const key = item.phase || '';
    if (!itemsByPhase[key]) itemsByPhase[key] = [];
    itemsByPhase[key].push(item);
  }

  const phaseList = phases.map(p => ({
    name: p.name,
    description: p.description,
    items: itemsByPhase[p.name] || [],
  }));
  for (const phaseName of Object.keys(itemsByPhase)) {
    if (!phaseName) continue;
    if (!phases.some(p => p.name === phaseName)) {
      phaseList.push({ name: phaseName, description: '', items: itemsByPhase[phaseName] });
    }
  }
  const uncategorized = itemsByPhase[''] || [];
  const visiblePhases = phaseList.filter(p => p.items.length > 0 || p.description);

  return (
    <>
      <Navbar />
      <main className="page-main-narrow">

        <h1 className="h-display-xl" style={{ marginBottom: '8px' }}>ROADMAP</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '60px', fontSize: '14px' }}>
          Where we are. Where we're going. No promises on dates — only on shipping.
        </p>

        {loading && <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>}
        {!loading && visiblePhases.length === 0 && uncategorized.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Coming soon.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {visiblePhases.map((group, i) => {
            const hasActive = group.items.some(it => it.status === 'in-progress');
            const allDone   = group.items.length > 0 && group.items.every(it => it.status === 'done');
            const phaseNum  = String(i + 1).padStart(2, '0');
            const phaseLabel = hasActive ? 'IN PROGRESS' : allDone ? 'COMPLETE' : 'UPCOMING';
            const labelColor = hasActive ? '#ffaa00' : allDone ? 'var(--accent)' : 'var(--text-muted)';
            const borderColor = (hasActive || allDone) ? 'var(--accent)' : 'var(--border)';
            const bgColor = (hasActive || allDone) ? 'var(--accent-dim)' : 'var(--bg-card)';

            return (
              <div key={group.name || i} style={{
                border: '1px solid ' + borderColor,
                background: bgColor,
                padding: '32px',
                position: 'relative',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '120px',
                  color: hasActive ? 'var(--accent)' : 'var(--text-muted)',
                  opacity: 0.12,
                  position: 'absolute',
                  top: '16px',
                  right: '24px',
                  lineHeight: 1,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}>{phaseNum}</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: group.description ? '12px' : '24px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '36px' }}>{group.name}</h2>
                  <span style={{ fontSize: '10px', letterSpacing: '0.1em', color: labelColor, border: '1px solid ' + labelColor, padding: '4px 10px' }}>{phaseLabel}</span>
                </div>

                {group.description && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '24px', maxWidth: '700px' }}>
                    {group.description}
                  </p>
                )}

                {group.items.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {group.items.map(item => {
                      const isDone = item.status === 'done';
                      const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG['planned'];
                      return (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px', color: isDone ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                          <span style={{
                            width: '18px', height: '18px',
                            border: '1px solid ' + (isDone ? 'var(--accent)' : sc.border),
                            background: isDone ? 'var(--accent)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '10px', color: '#000', flexShrink: 0, marginTop: '2px',
                          }}>
                            {isDone ? '✓' : ''}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ textDecoration: isDone ? 'line-through' : 'none' }}>{item.title}</div>
                            {item.description && (
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: '1.5' }}>
                                {item.description}
                              </div>
                            )}
                          </div>
                          {item.status === 'in-progress' && (
                            <span style={{ fontSize: '9px', padding: '2px 7px', border: '1px solid #ffaa00', color: '#ffaa00', letterSpacing: '0.08em', flexShrink: 0, marginTop: '2px' }}>LIVE</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {uncategorized.length > 0 && (
            <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '32px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', marginBottom: '16px', color: 'var(--text-secondary)' }}>OTHER</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {uncategorized.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px' }}>
                    <span style={{ width: '18px', height: '18px', border: '1px solid var(--border)', flexShrink: 0, marginTop: '2px' }} />
                    <div>{item.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </main>
    </>
  );
}
