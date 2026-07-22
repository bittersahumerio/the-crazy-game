'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction, createCloseAccountInstruction } from '@solana/spl-token';
import dynamic from 'next/dynamic';
import ShareWinButton from '@/components/ShareWinButton';
import bs58 from 'bs58';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getTokenInfo, getProgram, getBetPda, getEscrowPda, PROGRAM_ID, WSOL_MINT } from '@/lib/program';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => m.WalletMultiButton),
  { ssr: false }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function StatBox({ label, value, sublabel }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: 'var(--accent)', marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', opacity: 0.6 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { publicKey, connected, signMessage } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [pendingBets, setPendingBets] = useState([]);
  const [reclaiming, setReclaiming] = useState(null); // pubkey currently being reclaimed
  // [bet-close] Finished-game bets whose ~0.0024 SOL of account rent the player can reclaim.
  const [closeableBets, setCloseableBets] = useState([]);
  const [reclaimingRent, setReclaimingRent] = useState(false);
  const [bets, setBets] = useState([]);
  const [betsTotal, setBetsTotal] = useState(0);
  const [betsOffset, setBetsOffset] = useState(0);
  const [betsLoading, setBetsLoading] = useState(false);
  const [activeBets, setActiveBets] = useState([]);
  const [stats, setStats] = useState(null);
  const [gamesHosted, setGamesHosted] = useState([]);
  const [wins, setWins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('active');
  const [referralData, setReferralData] = useState(null);
  const [refCopied, setRefCopied] = useState(false);
  const { connection } = useConnection();
  const [username, setUsername] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [socials, setSocials] = useState({ twitter: '', telegram: '', discord: '' });
  const [socialsStatus, setSocialsStatus] = useState(null);
  const [socialsLoading, setSocialsLoading] = useState(false);
  const [seeds, setSeeds] = useState(0);
  const [scovilles, setScovilles] = useState(0);
  const [heatRank, setHeatRank] = useState(null);
  const [tokenInfoByMint, setTokenInfoByMint] = useState({});

  useEffect(() => {
    if (connected && publicKey) {
      fetchProfile();
      fetchActiveBets();
      fetchPoints();
      fetchPendingBets();
      fetchCloseableBets();
    }
  }, [connected, publicKey]);

  // Resolve token symbol/decimals for every distinct mint across the user's bets / games / wins.
  useEffect(() => {
    if (!connection) return;
    const mints = [...new Set([
      ...activeBets.map(b => b.token_mint),
      ...bets.map(b => b.token_mint),
      ...gamesHosted.map(g => g.token_mint),
      ...wins.map(w => w.token_mint),
      ...pendingBets.map(b => b.tokenMint),
    ].filter(Boolean))];
    const missing = mints.filter(m => !tokenInfoByMint[m]);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const updates = {};
      for (const m of missing) { try { updates[m] = await getTokenInfo(connection, m); } catch (e) {} }
      if (!cancelled && Object.keys(updates).length) setTokenInfoByMint(prev => ({ ...prev, ...updates }));
    })();
    return () => { cancelled = true; };
  }, [activeBets, bets, gamesHosted, wins, pendingBets, connection]);

  async function fetchPoints() {
    try {
      const [seedsRes, scovillesRes, referralRes, winsRes] = await Promise.all([
        fetch(`${API_URL}/api/users/${publicKey.toString()}/seeds`),
        fetch(`${API_URL}/api/users/${publicKey.toString()}/scovilles`),
        fetch(`${API_URL}/api/users/${publicKey.toString()}/referrals`),
        fetch(`${API_URL}/api/wins/by-wallet/${publicKey.toString()}?limit=10`),
      ]);
      const seedsData = await seedsRes.json();
      const referralJson = await referralRes.json();
      setReferralData(referralJson);
      const scovillesData = await scovillesRes.json();
      setSeeds(seedsData.seeds || 0);
      setScovilles(scovillesData.scovilles || 0);
      setHeatRank(scovillesData.rank || null);
      const winsData = await winsRes.json();
      setWins(winsData.wins || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchProfile() {
    setLoading(true);
    try {
      const [playerRes, userRes] = await Promise.all([
        fetch(`${API_URL}/api/players/${publicKey.toString()}?limit=50&offset=0`),
        fetch(`${API_URL}/api/users/${publicKey.toString()}`),
      ]);
      const playerData = await playerRes.json();
      const userData = await userRes.json();
      const fetchedBets = playerData.bets || [];
      console.log('BETS DEBUG: count=', fetchedBets.length, 'total_count=', fetchedBets[0]?.total_count);
      setBets(fetchedBets);
      setBetsTotal(parseInt(fetchedBets[0]?.total_count || 0));
      setStats(playerData.stats);
      setGamesHosted(playerData.games_hosted || []);
      if (userData.user) {
        setUsername(userData.user.username);
        setSocials({
          twitter: userData.user.twitter || '',
          telegram: userData.user.telegram || '',
          discord: userData.user.discord || '',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreBets() {
    setBetsLoading(true);
    try {
      const newOffset = betsOffset + 50;
      const res = await fetch(`${API_URL}/api/players/${publicKey.toString()}?limit=50&offset=${newOffset}`);
      const data = await res.json();
      setBets(prev => [...prev, ...(data.bets || [])]);
      setBetsOffset(newOffset);
    } catch (e) {
      console.error(e);
    }
    setBetsLoading(false);
  }

  async function fetchActiveBets() {
    try {
      const res = await fetch(`${API_URL}/api/players/${publicKey.toString()}/active`);
      const data = await res.json();
      setActiveBets(data.bets || []);
    } catch (e) {
      console.error(e);
    }
  }

  // [reclaim] PENDING bets are ones that were queued on-chain but never finalized by the operator (a
  // dropped process_bet) — their deposit is still locked in the bet's escrow. This finds them via the
  // backend (the browser RPC proxy can't getProgramAccounts) so the owner can refund themselves.
  async function fetchPendingBets() {
    try {
      const res = await fetch(`${API_URL}/api/players/${publicKey.toString()}/pending-bets`);
      const data = await res.json();
      setPendingBets(data.bets || []);
    } catch (e) {
      console.error('fetchPendingBets failed:', e);
    }
  }

  // Build, sign, send, then HTTP-POLL confirm (the frontend RPC proxy has no WebSocket, so anchor's
  // .rpc() false-fails). Same pattern as the game page's bet/withdraw/claim.
  async function sendAndConfirmIxs(ixs) {
    const tx = new Transaction();
    ixs.forEach(ix => tx.add(ix));
    tx.feePayer = publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
    const signed = await anchorWallet.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 5 });
    const tid = toast.loading('Confirming refund on-chain…');
    try {
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2000));
        const st = (await connection.getSignatureStatuses([sig])).value[0];
        if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) {
          if (st.err) throw new Error('tx failed: ' + JSON.stringify(st.err));
          return sig;
        }
      }
      throw new Error('confirmation timeout — it may still have landed; refresh to check');
    } finally {
      toast.dismiss(tid);
    }
  }

  // [reclaim] Refund one stuck bet via cancel_pending_bet. Returns the deposit from escrow to the
  // player's token account. Player-signed; only works while the bet is still is_pending.
  async function reclaimBet(pb) {
    if (!connected || !publicKey || !anchorWallet) return toast.error('Connect wallet first');
    if (!pb.gameHost || !pb.gameName || !pb.tokenMint) return toast.error('Missing game info — refresh and try again');
    setReclaiming(pb.pubkey);
    try {
      const program = getProgram(anchorWallet, connection);
      const gamePda = new PublicKey(pb.game);
      const hostPk = new PublicKey(pb.gameHost);
      const mintPk = new PublicKey(pb.tokenMint);
      const ti = await getTokenInfo(connection, mintPk);
      // Re-derive the game PDA to get its canonical bump (an arg to cancel_pending_bet), and sanity-check
      // it matches the bet's stored game pubkey before signing.
      const [derivedGamePda, gameBump] = PublicKey.findProgramAddressSync(
        [Buffer.from('game'), hostPk.toBuffer(), Buffer.from(pb.gameName)], PROGRAM_ID
      );
      if (derivedGamePda.toBase58() !== gamePda.toBase58()) throw new Error('game PDA mismatch');
      const betPda = getBetPda(gamePda, pb.betSeed);
      const escrowPda = getEscrowPda(gamePda, pb.betSeed);
      const playerTokenAccount = await getAssociatedTokenAddress(mintPk, publicKey, false, ti.tokenProgram);
      const ix = await program.methods
        .cancelPendingBet(hostPk, pb.gameName, gameBump)
        .accounts({
          game: gamePda,
          bet: betPda,
          escrow: escrowPda,
          player: publicKey,
          playerTokenAccount,
          tokenMint: mintPk,
          tokenProgram: ti.tokenProgram,
        })
        .instruction();
      // [SOL games] the refund lands as wSOL, so for a SOL game ensure the wSOL ATA exists before the
      // transfer, then close it after to unwrap the refund back to native SOL. Without this the transfer
      // targets a nonexistent ATA and the whole tx fails (Phantom sim error, then on-chain fail) — the
      // same wrap/unwrap the game page's withdraw/claim already do.
      const isWsol = mintPk.equals(WSOL_MINT);
      const ixs = [];
      if (isWsol) ixs.push(createAssociatedTokenAccountIdempotentInstruction(publicKey, playerTokenAccount, publicKey, WSOL_MINT, ti.tokenProgram));
      ixs.push(ix);
      if (isWsol) ixs.push(createCloseAccountInstruction(playerTokenAccount, publicKey, publicKey, [], ti.tokenProgram));
      await sendAndConfirmIxs(ixs);
      toast.success('Refunded! ✓');
      setPendingBets(prev => prev.filter(b => b.pubkey !== pb.pubkey));
      setTimeout(fetchPendingBets, 4000);
    } catch (e) {
      console.error('reclaim failed:', e);
      toast.error(e?.message?.includes('mismatch') ? 'Could not verify this bet' : 'Refund failed — please try again');
    } finally {
      setReclaiming(null);
    }
  }

  // [bet-close] Bets in FINISHED games whose ~0.0024 SOL of account rent is reclaimable. close_bet sends that
  // rent straight back to bet.player (contract-enforced). The browser can't getProgramAccounts, so the backend
  // enumerates + filters (never a pending bet, never a reserved-but-unwithdrawn one, never an orphaned game).
  async function fetchCloseableBets() {
    try {
      const res = await fetch(`${API_URL}/api/players/${publicKey.toString()}/closeable-bets`);
      const data = await res.json();
      setCloseableBets(data.bets || []);
    } catch (e) {
      console.error('fetchCloseableBets failed:', e);
    }
  }

  // Close them all. Multiple close_bet ixs for the same player share their accounts, so ~15 fit in one tx, and
  // signAllTransactions gets the whole set through ONE wallet approval — a heavy bettor with hundreds of bets
  // reclaims everything with a single click and a single prompt.
  async function reclaimAllRent() {
    if (!connected || !publicKey || !anchorWallet) return toast.error('Connect wallet first');
    if (!closeableBets.length) return;
    setReclaimingRent(true);
    const tid = toast.loading(`Reclaiming rent from ${closeableBets.length} bet${closeableBets.length > 1 ? 's' : ''}…`);
    try {
      const program = getProgram(anchorWallet, connection);
      const BATCH = 15;
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const txs = [];
      for (let i = 0; i < closeableBets.length; i += BATCH) {
        const tx = new Transaction();
        for (const b of closeableBets.slice(i, i + BATCH)) {
          tx.add(await program.methods
            .closeBet()
            .accounts({ game: new PublicKey(b.game), bet: new PublicKey(b.pubkey), recipient: publicKey, caller: publicKey })
            .instruction());
        }
        tx.feePayer = publicKey;
        tx.recentBlockhash = blockhash;
        txs.push(tx);
      }
      const signed = await anchorWallet.signAllTransactions(txs); // one approval for the whole set
      const sigs = [];
      for (const s of signed) sigs.push(await connection.sendRawTransaction(s.serialize(), { skipPreflight: true, maxRetries: 5 }));
      // HTTP-poll confirm (the frontend RPC proxy has no WebSocket).
      const deadline = Date.now() + 90000;
      const pendingSigs = new Set(sigs);
      while (pendingSigs.size && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2000));
        const arr = [...pendingSigs];
        const sts = (await connection.getSignatureStatuses(arr)).value;
        arr.forEach((sig, i) => {
          const st = sts[i];
          if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) pendingSigs.delete(sig);
        });
      }
      toast.success('Rent reclaimed! ✓');
      setCloseableBets([]);
      setTimeout(fetchCloseableBets, 4000);
    } catch (e) {
      console.error('reclaim rent failed:', e);
      toast.error('Could not reclaim rent — please try again');
    } finally {
      toast.dismiss(tid);
      setReclaimingRent(false);
    }
  }

  // Fetch a single-use nonce and sign the canonical message for the given purpose.
  // Canonical format matches signedMessage.js on the backend.
  async function signWithNonce(purpose, payload) {
    const wallet = publicKey.toString();
    const nonceRes = await fetch(`${API_URL}/api/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, purpose }),
    });
    if (!nonceRes.ok) throw new Error('Failed to get signing nonce');
    const { nonce, exp } = await nonceRes.json();

    const DOMAIN = 'thecrazygame.fun';
    const payloadLines = Object.entries(payload).map(([k, v]) => `${k}: ${v}`).join('\n');
    const parts = [purpose, `Wallet: ${wallet}`];
    if (payloadLines) parts.push(payloadLines);
    parts.push(`Nonce: ${nonce}`, `Exp: ${exp}`, `Domain: ${DOMAIN}`);
    const message = parts.join('\n');

    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = await signMessage(msgBytes);
    return { message, signature: bs58.encode(sigBytes) };
  }

  async function registerUsername() {
    setUsernameLoading(true);
    setUsernameStatus(null);
    try {
      const { message, signature } = await signWithNonce('set_username', { Username: usernameInput });
      const res = await fetch(`${API_URL}/api/users/username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toString(), username: usernameInput, signature, message }),
      });
      const data = await res.json();
      if (data.success) {
        setUsername(data.username);
        setUsernameStatus({ ok: true, msg: 'Username set!' });
      } else {
        setUsernameStatus({ ok: false, msg: data.error });
      }
    } catch (e) {
      setUsernameStatus({ ok: false, msg: 'Failed to sign message' });
    } finally {
      setUsernameLoading(false);
    }
  }

  async function updateSocials() {
    setSocialsLoading(true);
    setSocialsStatus(null);
    try {
      const { message, signature } = await signWithNonce('set_socials', {
        Twitter: socials.twitter || '',
        Telegram: socials.telegram || '',
        Discord: socials.discord || '',
      });
      const res = await fetch(`${API_URL}/api/users/socials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          twitter: socials.twitter || null,
          telegram: socials.telegram || null,
          discord: socials.discord || null,
          signature,
          message,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSocialsStatus({ ok: true, msg: 'Socials updated!' });
      } else {
        setSocialsStatus({ ok: false, msg: data.error });
      }
    } catch (e) {
      setSocialsStatus({ ok: false, msg: 'Failed to sign message' });
    } finally {
      setSocialsLoading(false);
    }
  }

  function formatAmount(amount) {
    return (parseInt(amount) / 1_000_000).toFixed(2);
  }

  // Token-aware amount: uses the game's mint for decimals + symbol (falls back to USDC).
  function fmtTok(amount, mint) {
    const ti = mint ? tokenInfoByMint[mint] : null;
    const dec = ti ? 10 ** ti.decimals : 1_000_000;
    const sym = ti?.symbol ?? 'USDC';
    const v = parseInt(amount) / dec;
    const mx = dec >= 1e8 ? (v > 0 && v < 1 ? 5 : 3) : 2;  // [SOL games] more precision for SOL
    return `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, mx) })} ${sym}`;
  }

  function shortAddress(addr) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  function formatPoints(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    if (n < 1) return n.toFixed(2);
    if (n % 1 !== 0) return n.toFixed(1);
    return Math.floor(n).toString();
  }

  function getRoiProgress(bet) {
    const earned = parseFloat(bet.current_accumulated || bet.accumulated_base);
    const target = parseFloat(bet.roi_target);
    return Math.min(Math.floor((earned / target) * 1000) / 10, 100);
  }

  const now = Math.floor(Date.now() / 1000);

  if (!connected) {
    return (
      <>
        <Navbar />
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div className="h-display-lg" style={{ fontFamily: 'var(--font-display)', marginBottom: '24px' }}>
            CONNECT WALLET
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Connect your wallet to view your profile and bets.
          </p>
          <WalletMultiButton />
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          {username ? (
            <div className="h-display-xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', marginBottom: '4px' }}>
              {username}
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '48px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {shortAddress(publicKey.toString())}
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px' }}>
            {username ? 'CONNECTED AS' : 'NO USERNAME SET'}
          </div>
          <a href={`https://solscan.io/account/${publicKey.toString()}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', textDecoration: 'none' }}>
            {publicKey.toString()}
          </a>
        </div>

        {/* Stats */}
        <div className="grid-stats-4" style={{ gap: '16px', marginBottom: '12px' }}>
          <StatBox label="TOTAL BETS" value={stats?.total_bets || 0} />
          <StatBox label="GAMES HOSTED" value={gamesHosted.length} />
          <StatBox
            label="WEEKLY HEAT 🌶️"
            value={formatPoints(scovilles)}
            sublabel={heatRank ? `RANK #${heatRank}` : 'SCOVILLES'}
          />
          <StatBox
            label="SEEDS 🌱"
            value={formatPoints(seeds)}
            sublabel="LIFETIME · FUTURE AIRDROP"
          />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '32px' }}>
          You earn Heat and Seeds from the fees you pay in any token (Heat from the SOL value of your fees, Seeds from the USD value).
        </div>

        {/* Username + Socials */}
        <div className="grid-2-stack" style={{ gap: '24px', marginBottom: '32px' }}>
          {/* Username box */}
          <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '16px' }}>USERNAME</div>
            {username ? (
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--accent)' }}>{username}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '12px' }}>click below to change</span>
              </div>
            ) : (
              <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>No username set yet</div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="choose a username"
                value={usernameInput}
                onChange={e => { setUsernameInput(e.target.value); setUsernameStatus(null); }}
                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '10px 14px', fontSize: '14px', fontFamily: 'var(--font-body)', outline: 'none' }}
              />
              <button onClick={registerUsername} disabled={usernameLoading || !usernameInput}
                style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '10px 20px', fontWeight: '700', fontSize: '12px', letterSpacing: '0.05em', cursor: usernameLoading || !usernameInput ? 'not-allowed' : 'pointer', opacity: usernameLoading || !usernameInput ? 0.5 : 1 }}>
                {usernameLoading ? '...' : 'SET'}
              </button>
            </div>
            {usernameStatus && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: usernameStatus.ok ? 'var(--accent)' : 'var(--accent-red)' }}>
                {usernameStatus.msg}
              </div>
            )}
          </div>

          {/* Socials box */}
          <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '16px' }}>SOCIAL LINKS (OPTIONAL)</div>
            {[
              { key: 'twitter', label: 'X / TWITTER', placeholder: 'username (without @)' },
              { key: 'telegram', label: 'TELEGRAM', placeholder: 'username (without @)' },
              { key: 'discord', label: 'DISCORD', placeholder: 'username' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>{field.label}</div>
                <input type="text" placeholder={field.placeholder} value={socials[field.key]}
                  onChange={e => setSocials(s => ({ ...s, [field.key]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '10px 14px', fontSize: '14px', fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <button onClick={updateSocials} disabled={socialsLoading}
              style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '10px 20px', fontWeight: '700', fontSize: '12px', letterSpacing: '0.05em', cursor: socialsLoading ? 'not-allowed' : 'pointer', opacity: socialsLoading ? 0.5 : 1, marginTop: '8px' }}>
              {socialsLoading ? '...' : 'UPDATE SOCIALS'}
            </button>
            {socialsStatus && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: socialsStatus.ok ? 'var(--accent)' : 'var(--accent-red)' }}>
                {socialsStatus.msg}
              </div>
            )}
          </div>
        </div>

        {/* Stuck bets — reclaim */}
        {pendingBets.length > 0 && (
          <div style={{ border: '1px solid #f0c040', background: 'rgba(240,192,64,0.06)', padding: '20px 24px', marginBottom: '32px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: '#f0c040', marginBottom: '6px' }}>
              ⚠ STUCK BETS ({pendingBets.length})
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              These bets were queued on-chain but never confirmed into their game (a network drop). Your deposit is
              safe, held in escrow. Reclaim it below to refund yourself — you sign one transaction and the tokens
              return to your wallet.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingBets.map((pb) => (
                <div key={pb.pubkey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '12px 16px' }}>
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>
                      {pb.gameName || 'Unknown game'}
                      {pb.gameNumber != null && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px' }}>#{String(pb.gameNumber).padStart(4, '0')}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '15px', color: '#f0c040', marginTop: '2px' }}>{fmtTok(pb.amount, pb.tokenMint)}</div>
                  </div>
                  <button
                    onClick={() => reclaimBet(pb)}
                    disabled={reclaiming === pb.pubkey || !pb.gameHost}
                    style={{
                      background: reclaiming === pb.pubkey ? 'transparent' : '#f0c040', color: reclaiming === pb.pubkey ? '#f0c040' : '#000',
                      border: '1px solid #f0c040', padding: '10px 20px', fontWeight: '700', fontSize: '12px', letterSpacing: '0.05em',
                      cursor: reclaiming === pb.pubkey || !pb.gameHost ? 'not-allowed' : 'pointer', opacity: !pb.gameHost ? 0.5 : 1, whiteSpace: 'nowrap',
                    }}>
                    {reclaiming === pb.pubkey ? 'REFUNDING…' : 'RECLAIM'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reclaimable rent — finished-game bets */}
        {closeableBets.length > 0 && (
          <div style={{ border: '1px solid var(--accent)', background: 'var(--accent-dim)', padding: '20px 24px', marginBottom: '32px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--accent)', marginBottom: '6px' }}>
              RECLAIMABLE RENT
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Every bet you place creates a small on-chain account, funded by ~0.0024 SOL of your own SOL. Those
              games have finished, so you can close {closeableBets.length === 1 ? 'that account' : 'those accounts'} and
              take the SOL back. One click, one signature — it all returns to your wallet.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--accent)' }}>
                  ~{(closeableBets.length * 0.0024).toFixed(4)} SOL
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                  ACROSS {closeableBets.length} FINISHED BET{closeableBets.length > 1 ? 'S' : ''}
                </div>
              </div>
              <button
                onClick={reclaimAllRent}
                disabled={reclaimingRent}
                style={{
                  background: reclaimingRent ? 'transparent' : 'var(--accent)', color: reclaimingRent ? 'var(--accent)' : '#000',
                  border: '1px solid var(--accent)', padding: '12px 24px', fontWeight: '700', fontSize: '12px',
                  letterSpacing: '0.05em', cursor: reclaimingRent ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                }}>
                {reclaimingRent ? 'RECLAIMING…' : 'RECLAIM ALL'}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
          {[
            { key: 'active', label: `ACTIVE BETS (${activeBets.length})` },
            { key: 'history', label: `BET HISTORY (${betsTotal || bets.length})` },
            { key: 'hosted', label: `GAMES HOSTED (${gamesHosted.length})` },
            { key: 'wins', label: `WINS (${wins.length})` },
            { key: 'referrals', label: `REFERRALS (${referralData?.referrals?.length || 0})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background: 'transparent', border: 'none', padding: '12px 24px',
              fontSize: '12px', letterSpacing: '0.08em', cursor: 'pointer',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
              marginBottom: '-1px',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Active Bets */}
        {tab === 'active' && (
          <div>
            {activeBets.length === 0 ? (
              <div style={{ border: '1px solid var(--border)', padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', marginBottom: '16px' }}>NO ACTIVE BETS</div>
                <Link href="/games" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '13px', letterSpacing: '0.05em' }}>
                  BROWSE GAMES →
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeBets.map((bet, i) => {
                  const progress = getRoiProgress(bet);
                  const isExpired = bet.timer_end < now;
                  return (
                    <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px', gap: '16px', alignItems: 'center' }}>
                        <div>
                          <Link href={`/games/${bet.game_number}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
                            {bet.game_name || `#${String(bet.game_number).padStart(4, '0')}`}
                          </Link>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            #{String(bet.game_number).padStart(4, '0')} · BET #{bet.bet_index}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{fmtTok(bet.amount, bet.token_mint)}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>WAGERED</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{fmtTok(bet.roi_target, bet.token_mint)}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ROI TARGET</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {bet.reserved ? (
                            <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '700' }}>✓ ROI</span>
                          ) : (
                            <span style={{ color: progress >= 90 ? '#f0c040' : 'var(--accent)', fontSize: '13px', fontWeight: '600' }}>
                              {progress.toFixed(1)}%
                            </span>
                          )}
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PROGRESS</div>
                        </div>
                      </div>
                      {!bet.reserved && (
                        <div style={{ marginTop: '10px', height: '2px', background: 'var(--border)' }}>
                          <div style={{ height: '100%', width: `${progress}%`, background: progress >= 90 ? '#f0c040' : 'var(--accent)', transition: 'width 0.3s' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bet History */}
        {tab === 'history' && (
          <div>
            {bets.length === 0 ? (
              <div style={{ border: '1px solid var(--border)', padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px' }}>NO BET HISTORY</div>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 80px', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  <span>GAME</span><span style={{ textAlign: 'right' }}>WAGERED</span><span style={{ textAlign: 'right' }}>ROI TARGET</span><span style={{ textAlign: 'right' }}>DATE</span><span style={{ textAlign: 'right' }}>STATUS</span>
                </div>
                {bets.map((bet, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 80px', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', alignItems: 'center' }}>
                    <div>
                      <Link href={`/games/${bet.game_number}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '13px' }}>
                        {bet.game_name || `#${String(bet.game_number).padStart(4, '0')}`}
                      </Link>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px' }}>#{bet.bet_index}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>{fmtTok(bet.amount, bet.token_mint)}</div>
                    <div style={{ textAlign: 'right' }}>{fmtTok(bet.roi_target, bet.token_mint)}</div>
                    <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(bet.placed_at)}</div>
                    <div style={{ textAlign: 'right', fontSize: '11px', color: bet.withdrawn ? 'var(--text-muted)' : bet.reserved ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {bet.withdrawn ? 'WITHDRAWN' : bet.reserved ? 'READY' : 'ACTIVE'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
            {betsTotal > bets.length && (
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button onClick={loadMoreBets} disabled={betsLoading} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '10px 32px', cursor: betsLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px', letterSpacing: '0.08em' }}>{betsLoading ? 'LOADING...' : `LOAD MORE (${bets.length}/${betsTotal})`}</button>
              </div>
            )}

        {/* Games Hosted */}
        {tab === 'hosted' && (
          <div>
            {gamesHosted.length === 0 ? (
              <div style={{ border: '1px solid var(--border)', padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', marginBottom: '16px' }}>NO GAMES HOSTED YET</div>
                <Link href="/create" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '13px', letterSpacing: '0.05em' }}>
                  HOST A GAME →
                </Link>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 80px', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  <span>GAME</span><span style={{ textAlign: 'right' }}>POOL</span><span style={{ textAlign: 'right' }}>ROI</span><span style={{ textAlign: 'right' }}>BETS</span><span style={{ textAlign: 'right' }}>STATUS</span>
                </div>
                {gamesHosted.map((game, i) => {
                  const isLive = game.is_active && game.timer_end > now;
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 80px', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', alignItems: 'center' }}>
                      <Link href={`/games/${game.game_number}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        {game.name || `#${String(game.game_number).padStart(4, '0')}`}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px' }}>#{String(game.game_number).padStart(4, '0')}</span>
                      </Link>
                      <div style={{ textAlign: 'right' }}>{fmtTok(game.pool_balance, game.token_mint)}</div>
                      <div style={{ textAlign: 'right' }}>{(game.roi_bps / 100).toFixed(0)}%</div>
                      <div style={{ textAlign: 'right' }}>{game.bet_count}</div>
                      <div style={{ textAlign: 'right', fontSize: '11px', color: isLive ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {isLive ? '● LIVE' : '● ENDED'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {tab === 'wins' && (
          <div>
            {wins.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', marginBottom: '12px' }}>NO JACKPOT WINS YET</div>
                <p style={{ fontSize: '13px' }}>Win a game's jackpot to start your trophy case here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {wins.map((w, i) => {
                  const usd = fmtTok(w.jackpot_amount, w.token_mint);
                  const lastBetUsd = fmtTok(w.last_bet_amount, w.token_mint);
                  const pnl = Number(w.pnl_percent).toLocaleString('en-US', { maximumFractionDigits: 1 });
                  return (
                    <div key={w.game_number} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                      border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '16px 20px', flexWrap: 'wrap',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-muted)', minWidth: '32px' }}>
                          #{i + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                            {w.game_name} <span style={{ color: 'var(--text-muted)' }}>#{String(w.game_number).padStart(4, '0')}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {lastBetUsd} bet → {usd} jackpot
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--accent)', lineHeight: 1 }}>
                            {usd}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {pnl}% PnL
                          </div>
                        </div>
                        <ShareWinButton
                          gameNumber={w.game_number}
                          gameName={w.game_name}
                          refCode={publicKey?.toString().slice(0, 8)}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'referrals' && (
          <div>
            {/* Referral link */}
            <div style={{ border: '1px solid var(--border)', padding: '24px', marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '8px' }}>YOUR REFERRAL LINK</div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', padding: '10px 14px', fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-secondary)', borderRadius: '4px' }}>
                  {referralData?.referral_code ? `${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${referralData.referral_code}` : 'Loading...'}
                </div>
                <button onClick={() => { if (referralData?.referral_code) { navigator.clipboard.writeText(`${window.location.origin}?ref=${referralData.referral_code}`); setRefCopied(true); setTimeout(() => setRefCopied(false), 2000); } }} style={{ background: refCopied ? '#22c55e' : 'var(--accent)', color: '#000', border: 'none', padding: '10px 16px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px', letterSpacing: '0.08em', borderRadius: '4px', transition: 'background 0.2s' }}>
                  {refCopied ? '✓ COPIED' : 'COPY'}
                </button>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Earn 20% of every fee paid by players you refer — in SOL and Seeds.
              </div>
            </div>
            {/* Earnings */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                ['PENDING USDC', `$${((parseInt(referralData?.balance?.pending_usdc) || 0) / 1_000_000).toFixed(2)}`],
                ['TOTAL EARNED USDC', `$${((parseInt(referralData?.balance?.total_earned_usdc) || 0) / 1_000_000).toFixed(2)}`],
                ['PENDING SEEDS', parseFloat(referralData?.balance?.pending_seeds || 0).toFixed(1)],
                ['TOTAL SEEDS EARNED', parseFloat(referralData?.balance?.total_earned_seeds || 0).toFixed(1)],
                ['PENDING SOL', `${((parseFloat(referralData?.balance?.pending_sol) || 0) / 1e9).toFixed(4)} SOL`],
                ['TOTAL EARNED SOL', `${((parseFloat(referralData?.balance?.total_earned_sol) || 0) / 1e9).toFixed(4)} SOL`],
              ].map(([label, value]) => (
                <div key={label} style={{ border: '1px solid var(--border)', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--accent)', marginBottom: '4px' }}>{value}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{label}</div>
                </div>
              ))}
            </div>
            {/* Claim SOL button */}
            {Math.floor(parseFloat(referralData?.balance?.pending_sol) || 0) >= 5000000 && (
              <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                <button onClick={async () => {
                  try {
                    const pending = Math.floor(parseFloat(referralData?.balance?.pending_sol) || 0);
                    const { message, signature } = await signWithNonce('referral_claim_sol', { Amount: pending });
                    const res = await fetch(`${API_URL}/api/users/referral/claim-sol`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ wallet: publicKey.toString(), signature, message }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast.success(`Claimed ${(data.amount / 1e9).toFixed(4)} SOL!`);
                      const r = await fetch(`${API_URL}/api/users/${publicKey.toString()}/referrals`);
                      setReferralData(await r.json());
                    } else { toast.error(data.error || 'Claim failed'); }
                  } catch (e) { toast.error('Claim failed'); }
                }} style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '12px 32px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '18px', letterSpacing: '0.05em' }}>
                  CLAIM {((Math.floor(parseFloat(referralData?.balance?.pending_sol) || 0)) / 1e9).toFixed(4)} SOL
                </button>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Minimum claim: 0.005 SOL</div>
              </div>
            )}
            {/* Claim button */}
            {parseInt(referralData?.balance?.pending_usdc) >= 1000000 && (
              <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                <button onClick={async () => {
                  try {
                    const pending = parseInt(referralData?.balance?.pending_usdc) || 0;
                    const { message, signature } = await signWithNonce('referral_claim', { Amount: pending });
                    const res = await fetch(`${API_URL}/api/users/referral/claim`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ wallet: publicKey.toString(), signature, message }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast.success(`Claimed $${(data.amount / 1_000_000).toFixed(2)} USDC!`);
                      // Refresh referral data
                      const r = await fetch(`${API_URL}/api/users/${publicKey.toString()}/referrals`);
                      setReferralData(await r.json());
                    } else {
                      toast.error(data.error || 'Claim failed');
                    }
                  } catch (e) {
                    toast.error('Claim failed');
                  }
                }} style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '12px 32px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '18px', letterSpacing: '0.05em' }}>
                  CLAIM ${((parseInt(referralData?.balance?.pending_usdc) || 0) / 1_000_000).toFixed(2)} USDC
                </button>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Minimum claim: $1.00</div>
              </div>
            )}
            {/* Referrals list */}
            {!referralData?.referrals?.length ? (
              <div style={{ border: '1px solid var(--border)', padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', marginBottom: '16px' }}>NO REFERRALS YET</div>
                <div style={{ fontSize: '13px' }}>Share your referral link to start earning.</div>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  <span>PLAYER</span><span style={{ textAlign: 'right' }}>JOINED</span>
                </div>
                {referralData.referrals.map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '12px' }}>
                      {r.username ? `@${r.username}` : `${r.referee_wallet.slice(0, 8)}...`}
                    </span>
                    <span style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
