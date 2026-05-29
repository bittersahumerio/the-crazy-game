'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Tooltip from '@/components/Tooltip';
import { usePlatformStatus } from '@/hooks/usePlatformStatus';
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
  { value: 'vanilla', label: 'FIXED',   desc: 'Timer resets to full on each bet' },
  { value: 'cumulative', label: 'CUMULATIVE', desc: 'Each bet adds a fixed amount of time' },
  
];

export default function CreatePage() {
  const { connected, publicKey } = useWallet();
  const { paused: platformPaused } = usePlatformStatus();
  const [platformFeeBps, setPlatformFeeBps] = useState(100); // default 1% until live config fetched
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
    salvadorMode: 'off',
    salvadorBps: '',
    salvadorStepBps: '',
    salvadorCapBps: '',
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
    if (!form.roiPct || pf(form.roiPct) < 10 || pf(form.roiPct) > 100) 
      e.roiPct = 'ROI must be between 10% and 100%';
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
      const ratio = (deposit / minBet) * (roi * 10);
      if (ratio < 3000) e.minBet = 'Game parameters too easy to farm — increase ROI or reduce min bet ratio';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function parseError(e) {
  const str = JSON.stringify(e) || '';
  const msg = (e.message || e.transactionMessage || e.toString() || str).toLowerCase();
  if (str.includes('"Custom":1') || str.includes('"Custom": 1') || msg.includes('insufficient funds'))
    return 'Insufficient funds in your wallet';
  if (msg.includes('invalidname')) return 'Invalid game name';
  if (msg.includes('invaliddeposit')) return 'Invalid deposit amount';
  if (msg.includes('farmingprotection')) return 'Game parameters too easy to farm — increase deposit or raise min bet';
  if (msg.includes('user rejected') || msg.includes('rejected the request')) return 'Transaction cancelled';
  if (str.includes('"Custom":0') || str.includes('"Custom": 0') || msg.includes('already in use')) 
  return 'You already have a game with this name — try a different name';
  return 'Transaction failed — please try again';
}

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    (async () => {
      try {
        const info = await connection.getAccountInfo(CONFIG_PDA);
        if (!info || cancelled) return;
        // PlatformConfig layout:
        // 8 discriminator + 32 admin + 32 operator + u16 default_fee_bps + u16 jackpot_fee_bps + u32 token_fees_len + N*(32 mint + u16 fee) ...
        const data = info.data;
        const defaultBps = data.readUInt16LE(72);
        const tokenFeesLen = data.readUInt32LE(76);
        let effectiveBps = defaultBps;
        for (let i = 0; i < tokenFeesLen; i++) {
          const offset = 80 + i * 34;
          if (offset + 34 > data.length) break; // safety
          const mintPubkey = new PublicKey(data.slice(offset, offset + 32));
          if (mintPubkey.equals(TOKEN_MINT)) {
            effectiveBps = data.readUInt16LE(offset + 32);
            break;
          }
        }
        setPlatformFeeBps(effectiveBps);
      } catch (e) {
        console.error('Failed to read live platform fee:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [connection]);

  async function handleSubmit() {
    if (!validate()) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
    try {
    const nameCheck = await fetch(`${API_URL}/api/games?status=all&name=${encodeURIComponent(form.name)}&limit=1`);
      const nameData = await nameCheck.json();
if (nameData.games.some(g => g.host === publicKey.toString())) {
  return toast.error(`You already have a game named "${form.name}"`);
}
} catch (e) {
  // Don't block if check fails
}
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
      const [platformVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('platform_vault'), TOKEN_MINT.toBuffer()],
        program.programId
      );
      const salvadorModeNum = form.salvadorMode === 'off' ? 0 : form.salvadorMode === 'fixed' ? 1 : 2;
      const salvadorBps = salvadorModeNum > 0 ? Math.round(pf(form.salvadorBps || '0') * 100) : 0;
      const salvadorStepBps = salvadorModeNum === 2 ? Math.round(pf(form.salvadorStepBps || '0') * 100) : 0;
      const salvadorCapBps = salvadorModeNum === 2 ? Math.round(pf(form.salvadorCapBps || '0') * 100) : 0;

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
          timeIncrement,
          salvadorModeNum,
          salvadorBps,
          salvadorStepBps,
          salvadorCapBps
        )
        .accounts({
          game: gamePda,
          initialBet: initialBetPda,
          host: publicKey,
          tokenMint: TOKEN_MINT,
          hostTokenAccount,
          gameVault: gameVaultPda,
          platformVault: platformVaultPda,
          config: CONFIG_PDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      // Salvador config is now set on-chain via initialize_game args; no backend
      // call needed.

      toast.success('Game created! ✓');
      router.push('/games');
    } catch (e) {
      toast.error(parseError(e));
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
  const platformFee = platformFeeBps / 100;
  const totalFees = hostFee + platformFee;
  const netBet = minBet * (1 - totalFees / 100);
  const roiTarget = minBet * (1 + roi / 100);
  const formulaValue = minBet > 0 ? Math.round((deposit / minBet) * roi) : 0;
  const formulaOk = formulaValue >= 300;
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
          <div className="h-display-lg" style={{ fontFamily: 'var(--font-display)', marginBottom: '24px' }}>
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

        <h1 className="h-display-lg" style={{ marginBottom: '8px' }}>HOST A GAME</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '14px' }}>
          Set your parameters. Your initial deposit starts the pool and is your first bet.
        </p>

        <div className="grid-form-preview" style={{ gap: '32px' }}>

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
              <label style={labelStyle}>INITIAL DEPOSIT (USDC)<Tooltip>Funds the starting pool. Goes into the game vault, minus the host and platform fees. You only get it back if you win the game yourself.</Tooltip></label>
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
              <label style={labelStyle}>MINIMUM BET (USDC)<Tooltip>Smallest bet a player can place. Lower min bet means more action but easier to farm; higher means fewer bets but more meaningful ones.</Tooltip></label>
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
              <label style={labelStyle}>ROI TARGET (%)<Tooltip>How much each bet must accumulate before the bettor can withdraw. Every new bet is split equally among the still-open prior bets — once a bet has earned (bet x ROI%) on top of itself, the bettor can cash out at bet + ROI. Higher % means harder to hit, but larger payout.</Tooltip></label>
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
              <label style={labelStyle}>HOST FEE (1-5%)<Tooltip>Your cut of every bet placed in this game. Deducted before the bet enters the pool.</Tooltip></label>
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
                <Tooltip>Minutes the timer starts at. In Vanilla mode, every bet resets it to this value. In Cumulative, this is the starting time before any bets push it forward.</Tooltip>
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
                  <Tooltip>Minutes added to the timer by each new bet.</Tooltip>
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


            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '8px', display: 'block' }}>
                GAME MODE
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { value: 'off', label: 'VANILLA', desc: 'Classic mode — last bettor wins the pool' },
                  { value: 'fixed', label: 'THE SALVADOR — FIXED', desc: 'Save another player, earn a fixed % of the pool as a reward' },
                  { value: 'progressive', label: 'THE SALVADOR — PROGRESSIVE', desc: 'Salvation rewards grow with each save' },
                ].map(mode => (
                  <div
                    key={mode.value}
                    onClick={() => set('salvadorMode', mode.value)}
                    style={{
                      border: `1px solid ${form.salvadorMode === mode.value ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.salvadorMode === mode.value ? 'var(--accent-dim)' : 'var(--bg)',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{
                      fontSize: '13px',
                      color: form.salvadorMode === mode.value ? 'var(--accent)' : 'var(--text-primary)',
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
              {form.salvadorMode === 'fixed' && (
                <div style={{ marginTop: '12px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px', display: 'block' }}>SALVATION REWARD (% OF POOL)<Tooltip>% of the pool paid out when one player saves another (their bet pushes the previous bettor past ROI).</Tooltip></label>
                  <input type="text" placeholder="e.g. 1" value={form.salvadorBps} onChange={e => set('salvadorBps', e.target.value)} style={inputStyle('salvadorBps')} />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>0.5-3% of the unreserved pool, paid to the bettor who saves another player</div>
                </div>
              )}
              {form.salvadorMode === 'progressive' && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px', display: 'block' }}>STARTING BOUNTY %<Tooltip>Initial salvation reward. Grows by Step % with every save, up to the Cap.</Tooltip></label>
                    <input type="text" placeholder="e.g. 0.5" value={form.salvadorBps} onChange={e => set('salvadorBps', e.target.value)} style={inputStyle('salvadorBps')} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px', display: 'block' }}>STEP INCREASE %<Tooltip>How much the bounty grows after each save.</Tooltip></label>
                    <input type="text" placeholder="e.g. 0.5" value={form.salvadorStepBps} onChange={e => set('salvadorStepBps', e.target.value)} style={inputStyle('salvadorStepBps')} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px', display: 'block' }}>CAP %<Tooltip>Maximum the bounty can grow to. Hard-capped to keep salvation rewards from depleting the prize pool.</Tooltip></label>
                    <input type="text" placeholder="e.g. 10" value={form.salvadorCapBps} onChange={e => set('salvadorCapBps', e.target.value)} style={inputStyle('salvadorCapBps')} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bounty starts at {form.salvadorBps || '?'}%, increases by {form.salvadorStepBps || '?'}% each save, capped at {form.salvadorCapBps || '?'}%</div>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || platformPaused}
              style={{
                width: '100%',
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                padding: '20px',
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                letterSpacing: '0.05em',
                cursor: (loading || platformPaused) ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
                opacity: (loading || platformPaused) ? 0.5 : 1,
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => !loading && (e.currentTarget.style.opacity = '1')}
            >
              {platformPaused ? 'PLATFORM PAUSED' : loading ? 'CREATING...' : 'CREATE GAME'}
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
                { label: 'INITIAL POOL', tip: 'Your initial deposit minus host + platform fees. This is what actually funds the pool at launch.', value: deposit > 0 ? `$${(deposit * (1 - totalFees / 100)).toFixed(2)}` : '—' },
                { label: 'MIN BET', value: minBet > 0 ? `$${minBet.toFixed(2)}` : '—' },
                { label: 'NET BET (AFTER FEES)', tip: 'Min bet minus host + platform fees. This is what actually enters the pool from each minimum bet.', value: netBet > 0 ? `$${netBet.toFixed(2)}` : '—' },
                { label: 'TIMER', value: timerSecs > 0 ? timerDisplay : '—' },
                { label: 'HOST FEE', value: hostFee > 0 ? `${hostFee}%` : '—' },
                { label: 'PLATFORM FEE', tip: "Platform's cut of every bet.", value: (platformFeeBps % 100 === 0 ? (platformFeeBps / 100).toString() : (platformFeeBps / 100).toFixed(1)) + '%' },
                ...(form.salvadorMode !== 'off' ? [{ label: 'SALVADOR', value: form.salvadorMode === 'fixed' ? `FIXED ${form.salvadorBps || '?'}%` : `PROGRESSIVE ${form.salvadorBps || '?'}%-${form.salvadorCapBps || '?'}%` }] : []),
                { label: 'THE FORMULA', tip: 'Player-attractiveness score: (Deposit / Min Bet) x ROI%. The contract rejects values under 300; higher numbers mean the game is more attractive to players and harder for the host to farm.', value: deposit > 0 && minBet > 0 && roi > 0 ? formulaValue.toString() : '—', special: true, ok: formulaOk },
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center' }}>
                    {row.label}
                    {row.tip && <Tooltip>{row.tip}</Tooltip>}
                  </span>
                  <span style={{ color: row.special ? (row.value === '—' ? 'var(--text-muted)' : row.ok ? '#22c55e' : 'var(--accent-red)') : row.value === '—' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {row.special && row.value !== '—' ? (row.ok ? `${row.value} \u2713` : `${row.value} \u2717 (min 300)`) : row.value}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '0.05em' }}>THE FORMULA</div>
              (Deposit / Min Bet) x ROI% must be at least 300. This prevents games that are too easy to farm. Increase deposit, raise ROI, or lower min bet to hit the threshold.
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
