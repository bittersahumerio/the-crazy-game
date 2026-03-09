'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <Navbar />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px' }}>
        
        {/* Hero */}
        <div style={{ marginBottom: '80px' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(64px, 12vw, 160px)',
            lineHeight: 0.9,
            color: 'var(--text-primary)',
            marginBottom: '32px',
          }}>
            BET.<br />
            <span style={{ color: 'var(--accent)' }}>WIN.</span><br />
            REPEAT.
          </div>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '18px',
            maxWidth: '480px',
            lineHeight: 1.6,
            marginBottom: '40px',
          }}>
            The wildest betting game on Solana. Every bet feeds the players before you. 
            Be early. Be smart. Or be last.
          </p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link href="/games" style={{
              background: 'var(--accent)',
              color: '#000',
              padding: '14px 32px',
              textDecoration: 'none',
              fontWeight: '700',
              fontSize: '14px',
              letterSpacing: '0.05em',
            }}>
              VIEW GAMES →
            </Link>
            <Link href="/create" style={{
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              padding: '14px 32px',
              textDecoration: 'none',
              fontSize: '14px',
              letterSpacing: '0.05em',
            }}>
              HOST A GAME
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1px',
          background: 'var(--border)',
          border: '1px solid var(--border)',
          marginBottom: '80px',
        }}>
          {[
            { label: 'ACTIVE GAMES', value: '—' },
            { label: 'TOTAL VOLUME', value: '—' },
            { label: 'PLAYERS TODAY', value: '—' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'var(--bg-card)',
              padding: '32px',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '48px',
                color: 'var(--accent)',
                marginBottom: '8px',
              }}>
                {stat.value}
              </div>
              <div style={{
                color: 'var(--text-secondary)',
                fontSize: '12px',
                letterSpacing: '0.1em',
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div>
          <h2 style={{ fontSize: '48px', marginBottom: '40px' }}>HOW IT WORKS</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {[
              { n: '01', title: 'HOST SETS THE RULES', desc: 'Set your deposit, minimum bet, ROI target and timer. Every bet after yours feeds you first.' },
              { n: '02', title: 'PLAYERS BET IN', desc: 'Each new bet is split equally among all previous players. Hit your ROI target and withdraw anytime.' },
              { n: '03', title: 'LAST ONE WINS', desc: 'When the timer runs out, the last bettor takes the jackpot. The clock resets with every bet.' },
            ].map(step => (
              <div key={step.n} style={{
                border: '1px solid var(--border)',
                padding: '32px',
                background: 'var(--bg-card)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '64px',
                  color: 'var(--text-muted)',
                  marginBottom: '16px',
                }}>
                  {step.n}
                </div>
                <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>{step.title}</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '14px' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </main>
    </>
  );
}
