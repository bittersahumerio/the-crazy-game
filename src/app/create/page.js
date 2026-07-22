'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Tooltip from '@/components/Tooltip';
import { usePlatformStatus } from '@/hooks/usePlatformStatus';
import { SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction, createSyncNativeInstruction } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { getProgram, getGamePda, getGameVaultPda, getBetPda, CONFIG_PDA, getSelectableTokens, getTokenConfigPda, getPlatformVaultPda, getTokenInfo, INSANITY_MIN_ROI_PCT, OPERATOR_TREASURY, CUSTOM_TOKEN_ONBOARD_FEE_LAMPORTS, WSOL_MINT, getHostFeeVaultPda } from '@/lib/program';
import { useRouter } from 'next/navigation';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// [SOL games] Wrap the host's native SOL into their wSOL ATA before fund_game pulls the deposit, then
// close the ATA afterwards so the rent comes back as SOL. Host never handles wSOL directly.
function wsolWrapIxs(owner, ata, lamports, tokenProgram) {
  return [
    createAssociatedTokenAccountIdempotentInstruction(owner, ata, owner, WSOL_MINT, tokenProgram),
    SystemProgram.transfer({ fromPubkey: owner, toPubkey: ata, lamports }),
    createSyncNativeInstruction(ata, tokenProgram),
  ];
}
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => m.WalletMultiButton),
  { ssr: false }
);

const TIMER_MODES = [
  { value: 'vanilla', label: 'FIXED',   desc: 'Timer resets to full on each bet' },
  { value: 'cumulative', label: 'CUMULATIVE', desc: 'Each bet adds a fixed amount of time' },
  
];

export default function CreatePage() {
  const { connected, publicKey, signMessage } = useWallet();
  const { paused: platformPaused } = usePlatformStatus();
  const router = useRouter();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  // [Phase 3] Custom-token ("paste a CA") flow state.
  const [customMode, setCustomMode] = useState(false);
  const [customMint, setCustomMint] = useState('');
  const [customChecking, setCustomChecking] = useState(false);
  const [customResult, setCustomResult] = useState(null); // { ok, reason? } | { ok:true, wouldOnboard, priceUsd }
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
    if (!form.initialDeposit || pf(form.initialDeposit) < minBetFloorUi)
      e.initialDeposit = `Minimum deposit is ${fmt(minBetFloorUi)} ${sym}`;
    if (!form.minBet || pf(form.minBet) < minBetFloorUi)
      e.minBet = `Minimum bet is ${fmt(minBetFloorUi)} ${sym}`;
    if (pf(form.minBet) > pf(form.initialDeposit))
      e.minBet = 'Min bet cannot exceed initial deposit';
    const maxRoi = form.salvadorMode === 'random' ? 150 : 100;
    if (!form.roiPct || pf(form.roiPct) < 20 || pf(form.roiPct) > maxRoi)
      e.roiPct = `ROI must be between 20% and ${maxRoi}%`;
    if (!form.timerDuration || parseInt(form.timerDuration) < 1 || parseInt(form.timerDuration) > 1440) 
      e.timerDuration = 'Timer must be between 1 and 1440 minutes (24 hours)';
    if (!form.hostFeePct || pf(form.hostFeePct) < 1 || pf(form.hostFeePct) > 5) 
      e.hostFeePct = 'Host fee must be between 1% and 5%';
    if (form.timerMode !== 'vanilla' && (!form.timeIncrement || parseInt(form.timeIncrement) < 1 || parseInt(form.timeIncrement) > 120))
      e.timeIncrement = 'Time increment must be between 1 and 120 minutes';

    // [v10] Random Salvador requires the token to allow it and a starting deposit at/above its
    // on-chain random-pool floor (contract: initialize_game rejects otherwise).
    if (form.salvadorMode === 'random') {
      if (pf(form.roiPct) < INSANITY_MIN_ROI_PCT)
        e.roiPct = `Insanity games need at least ${INSANITY_MIN_ROI_PCT}% ROI (keeps the per-bet VRF fee fair)`;
      if (!(randomMinPoolUi > 0))
        e.initialDeposit = `Random Salvador is not enabled for ${sym || 'this token'}`;
      else if (pf(form.initialDeposit) < randomMinPoolUi)
        e.initialDeposit = `Random Salvador needs a starting deposit of at least ${fmt(randomMinPoolUi)} ${sym}`;
    }

    // [v11] Fixed / Progressive salvador ranges (match the contract; without this an out-of-range
    // value reaches the chain as a raw InvalidSalvadorBps reject that Phantom flags as "malicious").
    if (form.salvadorMode === 'fixed') {
      const b = pf(form.salvadorBps);
      if (!form.salvadorBps || b < 0.5 || b > 3)
        e.salvadorBps = 'Salvation reward must be between 0.5% and 3%';
    }
    if (form.salvadorMode === 'progressive') {
      const b = pf(form.salvadorBps), st = pf(form.salvadorStepBps), c = pf(form.salvadorCapBps);
      if (!form.salvadorBps || b < 0.5 || b > 1)
        e.salvadorBps = 'Starting bounty must be between 0.5% and 1%';
      if (!form.salvadorStepBps || st < 0.1 || st > 0.5)
        e.salvadorStepBps = 'Step increase must be between 0.1% and 0.5%';
      if (!form.salvadorCapBps || c < 2 || c > 5)
        e.salvadorCapBps = 'Cap must be between 2% and 5%';
    }

    const deposit = pf(form.initialDeposit) || 0;
    const minBet = pf(form.minBet) || 0;
    const roi = pf(form.roiPct) || 0;
    if (minBet > 0 && roi > 0) {
      const ratio = (deposit / minBet) * (roi * 10);
      if (ratio < 5000) e.minBet = 'Game parameters too easy to farm — increase ROI or reduce min bet ratio';
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

  // [v10] Load the selectable tokens from chain (each with its own decimals, token program, symbol,
  // fee, and min-bet / random-pool floors). Any onboarded candidate mint appears automatically with
  // no per-mint config in code. Single-account reads only (the browser RPC proxy blocks gPA).
  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getSelectableTokens(connection);
        if (cancelled) return;
        setTokens(list);
        setSelectedToken(prev => prev || list[0] || null);
      } catch (e) {
        console.error('Failed to load selectable tokens:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [connection]);

  // [v10] Everything about the selected token comes from its on-chain TokenConfig + mint — no hardcoding.
  const dec = selectedToken ? 10 ** selectedToken.decimals : 1_000_000;
  const sym = selectedToken?.symbol ?? '';
  const platformFeeBps = selectedToken?.feeBps ?? 100;
  const minBetFloorUi = selectedToken ? Number(selectedToken.minBetFloor) / dec : 0.5;
  const randomMinPoolUi = selectedToken ? Number(selectedToken.randomMinPool) / dec : 0;
  const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 6 });

  // [Phase 3] Pre-flight a pasted mint via the backend (dryRun): validates approvability + prices it + computes
  // floors, WITHOUT any on-chain write. If it passes, merge with on-chain token info and make it selectable.
  async function checkCustomToken() {
    const mintStr = customMint.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mintStr)) {
      setCustomResult({ ok: false, reason: "That doesn't look like a valid token address" });
      setSelectedToken(null);
      return;
    }
    setCustomChecking(true);
    setCustomResult(null);
    try {
      const res = await fetch(`${API_URL}/api/tokens/onboard`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mint: mintStr, dryRun: true }),
      });
      const j = await res.json();
      if (!j.ok) { setCustomResult({ ok: false, reason: j.reason || 'This token is not supported' }); setSelectedToken(null); return; }
      // Merge the backend floors/fee with on-chain token info (decimals/tokenProgram/symbol/image).
      const ti = await getTokenInfo(connection, mintStr);
      const tok = {
        mint: ti.mint, decimals: ti.decimals, tokenProgram: ti.tokenProgram, isToken2022: ti.isToken2022,
        symbol: ti.symbol, image: ti.image, feeBps: j.feeBps, minBetFloor: j.minBetFloor, randomMinPool: j.randomMinPool,
        _custom: true, _needsOnboard: j.wouldOnboard === true, _priceUsd: j.priceUsd,
      };
      setTokens(prev => [...prev.filter(t => t.mint.toBase58() !== ti.mint.toBase58()), tok]);
      setSelectedToken(tok);
      setCustomResult({ ok: true, wouldOnboard: j.wouldOnboard === true, priceUsd: j.priceUsd });
    } catch (e) {
      console.error('custom token check failed:', e);
      setCustomResult({ ok: false, reason: 'Could not check this token — try again' });
      setSelectedToken(null);
    } finally {
      setCustomChecking(false);
    }
  }

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
    if (!selectedToken) return toast.error('Token list still loading — try again');

    setLoading(true);
    try {
      const program = getProgram(anchorWallet, connection);
      const gameName = form.name;
      // [v10] use the token the host picked — every field comes from its on-chain token info.
      const token = selectedToken;
      const mint = token.mint;
      const tokenProgram = token.tokenProgram;
      const dec = 10 ** token.decimals;
      const initialDeposit = new BN(Math.round(pf(form.initialDeposit) * dec));
      const minBet = new BN(Math.round(pf(form.minBet) * dec));
      const roiBps = new BN(Math.round(pf(form.roiPct) * 100));
      const timerDuration = new BN(parseInt(form.timerDuration) * 60);
      const hostFeeBps = new BN(Math.round(pf(form.hostFeePct) * 100));
      const timerMode = form.timerMode === 'vanilla' ? 0 : form.timerMode === 'cumulative' ? 1 : 2;
      const timeIncrement = new BN(form.timerMode !== 'vanilla' ? parseInt(form.timeIncrement) * 60 : 0);

      const salvadorModeNum = form.salvadorMode === 'off' ? 0 : form.salvadorMode === 'fixed' ? 1 : form.salvadorMode === 'progressive' ? 2 : 3;
      const salvadorBps = (salvadorModeNum === 1 || salvadorModeNum === 2) ? Math.round(pf(form.salvadorBps || '0') * 100) : 0;
      const salvadorStepBps = salvadorModeNum === 2 ? Math.round(pf(form.salvadorStepBps || '0') * 100) : 0;
      const salvadorCapBps = salvadorModeNum === 2 ? Math.round(pf(form.salvadorCapBps || '0') * 100) : 0;

      const gamePda = getGamePda(publicKey, gameName);
      const gameVaultPda = getGameVaultPda(gamePda);
      const initialBetPda = getBetPda(gamePda, 0);
      const tokenConfigPda = getTokenConfigPda(mint);
      const platformVaultPda = getPlatformVaultPda(mint);
      const hostTokenAccount = await getAssociatedTokenAddress(mint, publicKey, false, tokenProgram);

      // [Phase 3] A brand-new custom token must be onboarded (operator sets its on-chain TokenConfig) BEFORE the
      // create tx — initialize_game requires the TokenConfig to already exist. Only charge the 0.01 SOL fee if we
      // ACTUALLY onboarded it (wasNewOnboard); a retry against an already-onboarded token is free.
      let chargeOnboardFee = false;
      if (token._needsOnboard) {
        const onbRes = await fetch(`${API_URL}/api/tokens/onboard`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mint: mint.toBase58(), dryRun: false }),
        });
        const onbJson = await onbRes.json().catch(() => ({}));
        if (!onbRes.ok || !onbJson.ok) throw new Error('Could not onboard ' + (token.symbol || 'token') + ': ' + (onbJson.reason || 'try again'));
        chargeOnboardFee = onbJson.wasNewOnboard === true;
      }

      // [v10] initialize_game (state; new tokenConfig acct, no transfer) + fund_game (deposit), bundled atomically.
      const initIx = await program.methods
        .initializeGame(
          gameName, initialDeposit, minBet, roiBps, timerDuration, hostFeeBps,
          timerMode, timeIncrement, salvadorModeNum, salvadorBps, salvadorStepBps, salvadorCapBps
        )
        .accounts({
          game: gamePda,
          initialBet: initialBetPda,
          host: publicKey,
          tokenMint: mint,
          config: CONFIG_PDA,
          tokenConfig: tokenConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      const fundIx = await program.methods
        .fundGame()
        .accounts({
          game: gamePda,
          host: publicKey,
          tokenMint: mint,
          hostTokenAccount,
          gameVault: gameVaultPda,
          hostFeeVault: getHostFeeVaultPda(gamePda),
          platformVault: platformVaultPda,
          config: CONFIG_PDA,
          tokenProgram,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .instruction();
      // [v10] Build, sign, send, then HTTP-POLL confirm. The frontend RPC proxy has no WebSocket,
      // so sendAndConfirm's WS confirmation false-fails even when the tx lands. Poll instead.
      const ixs = [];
      // [Phase 3] First creator of a custom token pays the one-time onboarding fee (bundled here, one signature).
      if (chargeOnboardFee) ixs.push(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: OPERATOR_TREASURY, lamports: CUSTOM_TOKEN_ONBOARD_FEE_LAMPORTS }));
      // [SOL games] wSOL games: wrap the host's initial deposit of native SOL into their wSOL ATA before
      // fund_game pulls exactly initial_deposit from it. Leave the ATA OPEN (do NOT close it): the host's
      // per-bet host fees are paid in wSOL to this account, so closing it would make the contract redirect
      // those fees into the prize pool. The host unwraps/closes it themselves when they collect their fees.
      const isWsol = mint.equals(WSOL_MINT);
      if (isWsol) ixs.push(...wsolWrapIxs(publicKey, hostTokenAccount, initialDeposit.toNumber(), tokenProgram));
      ixs.push(initIx, fundIx);
      const tx = new Transaction().add(...ixs);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
      const signed = await anchorWallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 5 });
      const deadline = Date.now() + 60000;
      let confirmed = false;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2000));
        const st = (await connection.getSignatureStatuses([sig])).value[0];
        if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) {
          if (st.err) throw new Error('tx failed: ' + JSON.stringify(st.err));
          confirmed = true;
          break;
        }
      }
      if (!confirmed) throw new Error('confirmation timeout — the game may still have been created; check My Games');
      // Salvador config is now set on-chain via initialize_game args; no backend
      // call needed.

      toast.success('Game created! ✓');
      // [v10] optional custom image: wait for the game to be indexed (ownership is checked against
      // games.host), then POST the signed multipart. The nonce is only consumed on the successful try.
      if (imageFile) {
        try {
          const gamePdaStr = gamePda.toString();
          let uploaded = false;
          for (let attempt = 0; attempt < 8; attempt++) {
            const fd = new FormData();
            fd.append('image', imageFile);
            const r = await fetch(`${API_URL}/api/games/${gamePdaStr}/image`, { method: 'POST', body: fd });
            if (r.ok) { uploaded = true; break; }
            if (r.status !== 404) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Upload failed'); }
            await new Promise(res => setTimeout(res, 2500));
          }
          toast[uploaded ? 'success' : 'error'](uploaded ? 'Image uploaded ✓' : 'Game is still indexing — add the image again shortly');
        } catch (e) {
          console.error('image upload failed', e);
          toast.error('Image upload failed: ' + (e.message || 'try later'));
        }
      }
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
  const formulaOk = formulaValue >= 500;
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
              <label style={labelStyle}>TOKEN</label>
              {tokens.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>Loading tokens…</div>
              ) : (
                <select
                  value={customMode ? '__custom__' : (selectedToken ? selectedToken.mint.toBase58() : '')}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === '__custom__') { setCustomMode(true); setSelectedToken(null); setCustomResult(null); }
                    else { setCustomMode(false); setCustomResult(null); setSelectedToken(tokens.find(t => t.mint.toBase58() === v) || null); }
                  }}
                  style={{
                    width: '100%',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontFamily: 'var(--font-body)',
                    letterSpacing: '0.05em',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {tokens.filter(t => !t._custom).map(t => (
                    <option key={t.mint.toBase58()} value={t.mint.toBase58()}>{t.symbol}</option>
                  ))}
                  <option value="__custom__">＋ Custom token (paste address)</option>
                </select>
              )}
              {customMode && (
                <div style={{ marginTop: '12px' }}>
                  {/* [onboarding UX] State the gate BEFORE they paste, so a rejection is never a surprise. */}
                  <div style={{ marginBottom: '10px', padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    <div style={{ color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '4px', letterSpacing: '0.05em' }}>WHAT IS ACCEPTED</div>
                    • Mint and freeze authority must be <b>renounced</b> (else the owner could inflate the supply, or freeze the game vault)<br />
                    • <b>No transfer fees / taxes</b> or other exotic Token-2022 extensions — they would skim every payout and break pool accounting<br />
                    • Must be <b>priceable</b>: a DEX pool, or a live pump.fun bonding curve<br />
                    • Custom tokens pay a <b>5% platform fee</b> (curated tokens pay 3%), plus a one-time 0.01 SOL onboarding fee
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Paste the token mint address"
                      value={customMint}
                      onChange={e => { setCustomMint(e.target.value.trim()); setCustomResult(null); }}
                      style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }}
                    />
                    <button type="button" onClick={checkCustomToken} disabled={customChecking || !customMint}
                      style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '0 20px', fontWeight: '700', fontSize: '12px', letterSpacing: '0.05em', cursor: customChecking || !customMint ? 'not-allowed' : 'pointer', opacity: customChecking || !customMint ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                      {customChecking ? 'CHECKING…' : 'CHECK'}
                    </button>
                  </div>
                  {customResult && !customResult.ok && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--accent-red)' }}>{customResult.reason}</div>
                  )}
                  {customResult && customResult.ok && selectedToken && (
                    <div style={{ marginTop: '10px', padding: '12px 14px', border: '1px solid var(--accent)', background: 'var(--accent-dim)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <div style={{ color: 'var(--accent)', fontWeight: '700' }}>✓ {selectedToken.symbol} accepted{selectedToken.isToken2022 ? ' (Token-2022)' : ''}</div>
                      <div>Min bet: {fmt(minBetFloorUi)} {selectedToken.symbol}{customResult.priceUsd ? ` (~$${(minBetFloorUi * customResult.priceUsd).toFixed(2)})` : ''}</div>
                      <div>
                        Platform fee: {(selectedToken.feeBps / 100).toFixed(selectedToken.feeBps % 100 ? 1 : 0)}%
                        {selectedToken.feeBps > 300 && <span style={{ opacity: 0.75 }}> — higher for tokens outside the curated list</span>}
                      </div>
                      {customResult.wouldOnboard
                        ? <div style={{ color: '#f0c040' }}>First game in this token adds a one-time 0.01 SOL onboarding fee to your create transaction.</div>
                        : <div>Already onboarded — no onboarding fee.</div>}
                      <div style={{ marginTop: '6px', opacity: 0.8 }}>Games play in {selectedToken.symbol}, which can be volatile — winning more {selectedToken.symbol} can still be a loss in USD.</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>GAME IMAGE (OPTIONAL)<Tooltip>Upload a square image for your game, like a token logo. If you skip it, we use the token&apos;s own logo. PNG, JPG, WEBP or GIF, up to 3MB.</Tooltip></label>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg)', border: '1px dashed var(--border)', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {imagePreview
                    ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: 'var(--text-muted)', fontSize: '24px', lineHeight: 1 }}>+</span>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'inline-block', cursor: 'pointer', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', letterSpacing: '0.06em', fontWeight: 700 }}>
                    {imageFile ? 'CHANGE IMAGE' : 'UPLOAD IMAGE'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={e => { const f = e.target.files?.[0] || null; setImageFile(f); setImagePreview(prev => { if (prev) URL.revokeObjectURL(prev); return f ? URL.createObjectURL(f) : null; }); }}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {imageFile && <button type="button" onClick={() => { setImageFile(null); setImagePreview(prev => { if (prev) URL.revokeObjectURL(prev); return null; }); }} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}>remove</button>}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    {imageFile ? `${imageFile.name} (${Math.round(imageFile.size / 1024)} KB)` : 'Square recommended, e.g. 500×500. Shown as a coin-style avatar.'}
                  </div>
                </div>
              </div>
            </div>

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
              <label style={labelStyle}>INITIAL DEPOSIT ({sym})<Tooltip>Funds the starting pool. Goes into the game vault, minus the host and platform fees. You only get it back if you win the game yourself.</Tooltip></label>
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
              <label style={labelStyle}>MINIMUM BET ({sym})<Tooltip>Smallest bet a player can place. Lower min bet means more action but easier to farm; higher means fewer bets but more meaningful ones.</Tooltip></label>
              <input
                type="text"
                placeholder="e.g. 1"
                value={form.minBet}
                onChange={e => set('minBet', e.target.value)}
                style={inputStyle('minBet')}
              />
              {errors.minBet && <div style={errorStyle}>{errors.minBet}</div>}
              {selectedToken && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>On-chain minimum for {sym}: {fmt(minBetFloorUi)}</div>}
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
              <label style={labelStyle}>HOST FEE (1-5%)<Tooltip>Your cut of every bet placed in this game. Deducted before the bet enters the pool. Heads up: fees are paid to your account for the token this game uses, so if that account is closed your host fees go to the prize pool instead.</Tooltip></label>
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
                  { value: 'random', label: 'THE SALVADOR — INSANITY', desc: 'Random Salvations. From 0.2% to 50% of the pool. More info in FAQ.' },
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
                  <input type="text" placeholder="e.g. 2" value={form.salvadorBps} onChange={e => set('salvadorBps', e.target.value)} style={inputStyle('salvadorBps')} />
                  {errors.salvadorBps && <div style={errorStyle}>{errors.salvadorBps}</div>}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>0.5-3% of the unreserved pool, paid to the bettor who saves another player</div>
                </div>
              )}
              {form.salvadorMode === 'progressive' && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px', display: 'block' }}>STARTING BOUNTY % (0.5-1%)<Tooltip>Initial salvation reward. Grows by Step % with every save, up to the Cap.</Tooltip></label>
                    <input type="text" placeholder="e.g. 0.5" value={form.salvadorBps} onChange={e => set('salvadorBps', e.target.value)} style={inputStyle('salvadorBps')} />
                    {errors.salvadorBps && <div style={errorStyle}>{errors.salvadorBps}</div>}
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px', display: 'block' }}>STEP INCREASE % (0.1-0.5%)<Tooltip>How much the bounty grows after each save.</Tooltip></label>
                    <input type="text" placeholder="e.g. 0.2" value={form.salvadorStepBps} onChange={e => set('salvadorStepBps', e.target.value)} style={inputStyle('salvadorStepBps')} />
                    {errors.salvadorStepBps && <div style={errorStyle}>{errors.salvadorStepBps}</div>}
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px', display: 'block' }}>CAP % (2-5%)<Tooltip>Maximum the bounty can grow to. Hard-capped to keep salvation rewards from depleting the prize pool.</Tooltip></label>
                    <input type="text" placeholder="e.g. 5" value={form.salvadorCapBps} onChange={e => set('salvadorCapBps', e.target.value)} style={inputStyle('salvadorCapBps')} />
                    {errors.salvadorCapBps && <div style={errorStyle}>{errors.salvadorCapBps}</div>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bounty starts at {form.salvadorBps || '?'}%, increases by {form.salvadorStepBps || '?'}% each save, capped at {form.salvadorCapBps || '?'}%</div>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || platformPaused || !selectedToken}
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
              {platformPaused ? 'PLATFORM PAUSED' : !selectedToken ? 'LOADING TOKENS…' : loading ? 'CREATING...' : 'CREATE GAME'}
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
                { label: 'INITIAL POOL', tip: 'Your initial deposit minus host + platform fees. This is what actually funds the pool at launch.', value: deposit > 0 ? `${fmt(deposit * (1 - totalFees / 100))} ${sym}` : '—' },
                { label: 'MIN BET', value: minBet > 0 ? `${fmt(minBet)} ${sym}` : '—' },
                { label: 'NET BET (AFTER FEES)', tip: 'Min bet minus host + platform fees. This is what actually enters the pool from each minimum bet.', value: netBet > 0 ? `${fmt(netBet)} ${sym}` : '—' },
                { label: 'TIMER', value: timerSecs > 0 ? timerDisplay : '—' },
                { label: 'HOST FEE', value: hostFee > 0 ? `${hostFee}%` : '—' },
                { label: 'PLATFORM FEE', tip: "Platform's cut of every bet.", value: (platformFeeBps % 100 === 0 ? (platformFeeBps / 100).toString() : (platformFeeBps / 100).toFixed(1)) + '%' },
                ...(form.salvadorMode !== 'off' ? [{ label: 'SALVADOR', value: form.salvadorMode === 'fixed' ? `FIXED ${form.salvadorBps || '?'}%` : form.salvadorMode === 'random' ? 'INSANITY (VRF)' : `PROGRESSIVE ${form.salvadorBps || '?'}%-${form.salvadorCapBps || '?'}%` }] : []),
                { label: 'THE ANTI-FARMING FORMULA', value: deposit > 0 && minBet > 0 && roi > 0 ? formulaValue.toString() : '—', special: true, ok: formulaOk },
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
                    {row.special && row.value !== '—' ? (row.ok ? `${row.value} \u2713` : `${row.value} \u2717 (min 500)`) : row.value}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '0.05em' }}>THE ANTI-FARMING FORMULA</div>
              (Deposit / Min Bet) x ROI% must be at least 500. This prevents games that are too easy to farm. Increase deposit, raise ROI, or lower min bet to hit the threshold.
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
