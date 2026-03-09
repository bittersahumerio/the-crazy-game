'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { getProgram, getGamePda, getGameVaultPda, getBetPda, TOKEN_MINT, CONFIG_PDA } from '@/lib/program';
import { useRouter } from 'next/navigation';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => m.WalletMultiButton),
  { ssr: false }
);

const TIMER_MODES = [
  { value: 'vanilla', label: 'VANILLA', desc: 'Timer resets to full on each bet' },
  { value: 'cumulative', label: 'CUMULATIVE', desc: 'Each bet adds a fixed amount of time' },
  { value: 'random', label: 'RANDOM', desc: 'Each bet adds a random amount of time' },
];

export default function CreatePage() {
  const { connected, publicKey } = useWallet();
  const router = useRouter();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    initialDeposit: '',
    minBet: '',
    roiPct: '',
    timerDuration: '',
    hostFeePct: '',
    timerMode: 'vanilla',
    timeIncrement: '',
  });

  const [errors, setErrors] = useState({});
function pf(val) {
  return parseFloat(String(val).replace(',', '.'));
}
  function set(key, value) {
    const sanitized = typeof value === 'string' ? value.replace(',', '.') : value;
    setForm(f => ({ ...f, [key]: sanitized }));
    setErrors(e => ({ ...e, [key]: null }));
  }

  function validate() {
    const e = {};
    if (!form.name || form.name.length < 3 || form.name.length > 30)
       e.name = 'Game name must be 3-30 characters';
    if (!form.initialDeposit || pf(form.initialDeposit) < 1) 
      e.initialDeposit = 'Minimum deposit is $1';
    if (!form.minBet || pf(form.minBet) < 0.5) 
      e.minBet = 'Minimum bet is $0.50';
    if (pf(form.minBet) > pf(form.initialDeposit)) 
      e.minBet = 'Min bet cannot exceed initial deposit';
    if (!form.roiPct || pf(form.roiPct) < 10 || pf(form.roiPct) > 1000) 
      e.roiPct = 'ROI must be between 10% and 1000%';
    if (!form.timerDuration || parseInt(form.timerDuration) < 1 || parseInt(form.timerDuration) > 1440) 
      e.timerDuration = 'Timer must be between 1 and 1440 minutes (24 hours)';
    if (!form.hostFeePct || pf(form.hostFeePct) < 1 || pf(form.hostFeePct) > 5) 
      e.hostFeePct = 'Host fee must be between 1% and 5%';
    if (form.timerMode !== 'vanilla' && (!form.timeIncrement || parseInt(form.timeIncrement) < 1 || parseInt(form.timeIncrement) > 120))
      e.timeIncrement = 'Time increment must be between 1 and 120 minutes';

    const deposit = pf(form.initialDeposit) || 0;
    const minBet = pf(form.minBet) || 0;
    const roi = pf(form.roiPct) || 0;
    if (minBet > 0 && roi > 0) {
      const ratio = (deposit / minBet) * (roi * 100);
      if (ratio < 3000) e.minBet = 'Game parameters too easy to farm — increase ROI or reduce min bet ratio';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    if (!connected || !publicKey) return;

    setLoading(true);
    try {
      const program = getProgram(anchorWallet, connection);
      const gameName = form.name;
      const initialDeposit = new BN(pf(form.initialDeposit) * 1_000_000);
      const minBet = new BN(pf(form.minBet) * 1_000_000);
      const roiBps = new BN(Math.round(pf(form.roiPct) * 100));
      const timerDuration = new BN(parseInt(form.timerDuration) * 60);
      const hostFeeBps = new BN(Math.round(pf(form.hostFeePct) * 100));
      const timerMode = form.timerMode === 'vanilla' ? 0 : form.timerMode === 'cumulative' ? 1 : 2;
      const timeIncrement = new BN(form.timerMode !== 'vanilla' ? parseInt(form.timeIncrement) * 60 : 0);

      const gamePda = getGamePda(publicKey, gameName);
      const gameVaultPda = getGameVaultPda(gamePda);
      const initialBetPda = getBetPda(gamePda, 0);

      const PLATFORM_VAULT = new PublicKey('Ed9rtBfVhJbeAGkPqRJM3fPJaZT2ZgEARQYiXUZJJw2z');
      const hostTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, publicKey);

      const tx = await program.methods
        .initializeGame(
          gameName,
          initialDeposit,
          minBet,
          roiBps,
          timerDuration,
          hostFeeBps,
          timerMode,
          timeIncrement
        )
        .accounts({
          game: gamePda,
          initialBet: initialBetPda,
          host: publicKey,
          tokenMint: TOKEN_MINT,
          hostTokenAccount,
          gameVault: gameVaultPda,
          platformVault: PLATFORM_VAULT,
          config: CONFIG_PDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      toast.success('Game created! ✓');
      router.push('/games');
    } catch (e) {
      console.error(e);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (key) => ({
    width: '100%',
    background: 'var(--bg)',
    border: `1px solid ${errors[key] ? 'var(--accent-red)' : 'var(--border)'}`,
    color: 'var(--text-primary)',
    padding: '12px 16px',
    fontSize: '16px',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    transition: 'border-color 0.2s',
  });

  const labelStyle = {
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
    marginBottom: '8px',
    display: 'block',
  };

  const errorStyle = {
    fontSize: '11px',
    color: 'var(--accent-red)',
    marginTop: '6px',
  };

  const fieldStyle = {
    marginBottom: '24px',
  };

  const deposit = pf(form.initialDeposit) || 0;
  const minBet = pf(form.minBet) || 0;
  const roi = pf(form.roiPct) || 0;
  const hostFee = pf(form.hostFeePct) || 0;
  const platformFee = 1;
  const totalFees = hostFee + platformFee;
  const netBet = minBet * (1 - totalFees / 100);
  const roiTarget = minBet * (1 + roi / 100);
  const timerSecs = (parseInt(form.timerDuration) || 0) * 60;
  const timerDisplay = timerSecs >= 3600
    ? `${(timerSecs / 3600).toFixed(1)}h`
    : timerSecs >= 60
      ? `${Math.floor(timerSecs / 60)}m`
      : `${timerSecs}s`;

  if (!connected) {
    return (
      <>
        <Navbar />
        <main style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '64px', marginBottom: '24px' }}>
            HOST A GAME
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Connect your wallet to create a game.
          </p>
          <WalletMultiButton />
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>

        <h1 style={{ fontSize: '64px', marginBottom: '8px' }}>HOST A GAME</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '14px' }}>
          Set your parameters. Your initial deposit starts the pool and is your first bet.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px' }}>

          {/* Form */}
          <div>
            <div style={fieldStyle}>
              <label style={labelStyle}>GAME NAME</label>
              <input
                type="text"
                placeholder="e.g. DEGEN HUNT"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                style={inputStyle('name')}
              />
              {errors.name && <div style={errorStyle}>{errors.name}</div>}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>INITIAL DEPOSIT (USDC)</label>
              <input
                type="text"
                placeholder="e.g. 100"
                value={form.initialDeposit}
                onChange={e => set('initialDeposit', e.target.value)}
                style={inputStyle('initialDeposit')}
              />
              {errors.initialDeposit && <div style={errorStyle}>{errors.initialDeposit}</div>}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>MINIMUM BET (USDC)</label>
              <input
                type="text"
                placeholder="e.g. 1"
                value={form.minBet}
                onChange={e => set('minBet', e.target.value)}
                style={inputStyle('minBet')}
              />
              {errors.minBet && <div style={errorStyle}>{errors.minBet}</div>}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>ROI TARGET (%)</label>
              <input
                type="text"
                placeholder="e.g. 50"
                value={form.roiPct}
                onChange={e => set('roiPct', e.target.value)}
                style={inputStyle('roiPct')}
              />
              {errors.roiPct && <div style={errorStyle}>{errors.roiPct}</div>}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Players withdraw when their bet grows by this percentage
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>HOST FEE (1-5%)</label>
              <input
                type="text"
                placeholder="e.g. 2"
                min="1"
                max="5"
                value={form.hostFeePct}
                onChange={e => set('hostFeePct', e.target.value)}
                style={inputStyle('hostFeePct')}
              />
              {errors.hostFeePct && <div style={errorStyle}>{errors.hostFeePct}</div>}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>TIMER MODE</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {TIMER_MODES.map(mode => (
                  <div
                    key={mode.value}
                    onClick={() => set('timerMode', mode.value)}
                    style={{
                      border: `1px solid ${form.timerMode === mode.value ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.timerMode === mode.value ? 'var(--accent-dim)' : 'var(--bg)',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{
                      fontSize: '13px',
                      color: form.timerMode === mode.value ? 'var(--accent)' : 'var(--text-primary)',
                      marginBottom: '2px',
                      letterSpacing: '0.05em',
                    }}>
                      {mode.label}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {mode.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>
                {form.timerMode === 'vanilla' ? 'TIMER DURATION (MINUTES)' : 'INITIAL TIMER (MINUTES)'}
              </label>
              <input
                type="text"
                placeholder="e.g. 60"
                value={form.timerDuration}
                onChange={e => set('timerDuration', e.target.value)}
                style={inputStyle('timerDuration')}
              />
              {errors.timerDuration && <div style={errorStyle}>{errors.timerDuration}</div>}
            </div>

            {form.timerMode !== 'vanilla' && (
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  {form.timerMode === 'cumulative' ? 'TIME INCREMENT (MINUTES)' : 'MAX TIME INCREMENT (MINUTES)'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10"
                  value={form.timeIncrement}
                  onChange={e => set('timeIncrement', e.target.value)}
                  style={inputStyle('timeIncrement')}
                />
                {errors.timeIncrement && <div style={errorStyle}>{errors.timeIncrement}</div>}
                {form.timerMode === 'random' && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    A random amount of time between 1 and {form.timeIncrement || '?'} minutes will be added per bet
                  </div>
                )}
              </div>
            )}


            {/* Game mode */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '8px', display: 'block' }}>
                GAME MODE
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{
                  border: '1px solid var(--accent)',
                  background: 'var(--accent-dim)',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--accent)', marginBottom: '2px', letterSpacing: '0.05em' }}>VANILLA</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Classic mode — last bettor wins the pool</div>
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--accent)', letterSpacing: '0.08em', border: '1px solid var(--accent)', padding: '2px 6px' }}>
                    ACTIVE
                  </div>
                </div>
                <div style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  padding: '12px 16px',
                  opacity: 0.4,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '2px', letterSpacing: '0.05em' }}>MORE MODES</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>New crazy modes are on the way</div>
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em', border: '1px solid var(--border)', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                    COMING SOON
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%',
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                padding: '20px',
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                letterSpacing: '0.05em',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => !loading && (e.currentTarget.style.opacity = '1')}
            >
              {loading ? 'CREATING...' : 'CREATE GAME'}
            </button>
          </div>

          {/* Live preview */}
          <div style={{ position: 'sticky', top: '80px', alignSelf: 'start' }}>
            <div style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              padding: '24px',
            }}>
              <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>PREVIEW</h3>
              {[
                { label: 'INITIAL POOL', value: deposit > 0 ? `$${(deposit * (1 - totalFees / 100)).toFixed(2)}` : '—' },
                { label: 'MIN BET', value: minBet > 0 ? `$${minBet.toFixed(2)}` : '—' },
                { label: 'NET BET (AFTER FEES)', value: netBet > 0 ? `$${netBet.toFixed(2)}` : '—' },
                { label: 'ROI TARGET PER BET', value: roiTarget > 0 ? `$${roiTarget.toFixed(2)}` : '—' },
                { label: 'TIMER', value: timerSecs > 0 ? timerDisplay : '—' },
                { label: 'HOST FEE', value: hostFee > 0 ? `${hostFee}%` : '—' },
                { label: 'PLATFORM FEE', value: '1%' },
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    {row.label}
                  </span>
                  <span style={{ color: row.value === '—' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  );
}