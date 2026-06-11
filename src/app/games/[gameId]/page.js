'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Tooltip from '@/components/Tooltip';
import TypeBadge, { timerBadgeKind, modeBadgeKind } from '@/components/TypeBadge';
import { usePlatformStatus } from '@/hooks/usePlatformStatus';
import ShareWinButton from '@/components/ShareWinButton';
import GameChat from '@/components/GameChat';
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { getProgram, getGameVaultPda, getBetPda, getEscrowPda, generateBetSeed, TOKEN_MINT, CONFIG_PDA } from '@/lib/program';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function ROIBar({ current, target }) {
  const pct = Math.min((current / target) * 100, 100);
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{
        height: '4px',
        background: 'var(--border)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: pct >= 100 ? 'var(--accent)' : '#00ff8866',
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: 'var(--text-muted)',
        marginTop: '4px',
      }}>
        <span>{pct.toFixed(1)}%</span>
        <span>{pct >= 100 ? 'READY TO WITHDRAW' : 'ACCUMULATING'}</span>
      </div>
    </div>
  );
}

export default function GamePage() {
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [bets, setBets] = useState([]);
  const [walletFilter, setWalletFilter] = useState('');
  const [roiCollapsed, setRoiCollapsed] = useState(true);
  const [middleCollapsed, setMiddleCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { paused: platformPaused } = usePlatformStatus();
  const anchorWallet = useAnchorWallet();
  const [betAmount, setBetAmount] = useState('');
  const [betLoading, setBetLoading] = useState(false);
  const [playerUsernames, setPlayerUsernames] = useState({});
  const [middleVisible, setMiddleVisible] = useState(50);
  const [infoTab, setInfoTab] = useState('INFO');
  const [salvations, setSalvations] = useState([]);
  useEffect(() => {
    fetchGame();
    const interval = setInterval(fetchGame, 10_000);
    return () => clearInterval(interval);
  }, [gameId]);

  useEffect(() => {
    if (!game) return;
    const interval = setInterval(() => {
      setTimeLeft((game.is_active && !game.is_paused) ? Math.max(0, game.timer_end - Math.floor(Date.now() / 1000)) : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [game]);

  async function fetchGame() {
    try {
      const res = await fetch(`${API_URL}/api/games/${gameId}`);
      const data = await res.json();
      setGame(data);
      setBets(data.bets || []);
      // Fetch salvation events for Salvador games
      if (data.salvador_mode > 0) {
        try {
          const evRes = await fetch(`${API_URL}/api/games/${data.id}/events?limit=100`);
          const evData = await evRes.json();
          setSalvations((evData.events || []).filter(e => e.event_type === 'Salvation').map(e => {
            const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            return { ...d, created_at: e.created_at };
          }));
        } catch (e) { console.error('Failed to fetch salvations:', e); }
      }
      // Fetch usernames for all players
const wallets = [...new Set((data.bets || []).map(b => b.player))];
if (wallets.length > 0) {
  const uRes = await fetch(`${API_URL}/api/users/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallets }),
  });
  const uData = await uRes.json();
  setPlayerUsernames(uData);
}
      setTimeLeft((data.is_active && !data.is_paused) ? Math.max(0, data.timer_end - Math.floor(Date.now() / 1000)) : 0)
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(secs) {
    if (secs <= 0) return 'EXPIRED';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
  }

  function formatAmount(amount) {
    return (parseInt(amount) / 1_000_000).toFixed(2);
  }

  function shortAddress(addr) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  if (loading) return (
    <>
      <Navbar />
      <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-secondary)' }}>
        LOADING...
      </div>
    </>
  );

  if (!game) return (
    <>
      <Navbar />
      <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-secondary)' }}>
        GAME NOT FOUND
      </div>
    </>
  );

  const jackpot = Math.max(0, (parseInt(game.pool_balance) - parseInt(game.reserved_balance)) / 1_000_000);

  function parseError(e) {
  const str = JSON.stringify(e) || '';
  const msg = (e.message || e.transactionMessage || e.toString() || str).toLowerCase();
  
  if (msg.includes('insufficient funds') || msg.includes('0x1'))
    return 'Insufficient funds in your wallet';
  if (msg.includes('gamenotactive') || msg.includes('custom program error: 0x1f88'))
    return 'This game is no longer active';
  if (msg.includes('bettosmall') || msg.includes('custom program error: 0x1f89'))
    return 'Bet is below the minimum';
  if (msg.includes('timerexpired') || msg.includes('custom program error: 0x1f8a'))
    return 'Timer has expired';
  if (msg.includes('notlastbettor') || msg.includes('custom program error: 0x1f90'))
    return 'Only the last bettor can claim the jackpot';
  if (msg.includes('jackpotalreadyclaimed') || msg.includes('custom program error: 0x1f91'))
    return 'Jackpot already claimed';
  if (msg.includes('jackpotdelaynotmet') || msg.includes('custom program error: 0x1f92'))
    return 'Jackpot not claimable yet — wait 5 minutes after timer expires';
  if (msg.includes('user rejected') || msg.includes('rejected the request'))
    return 'Transaction cancelled';
  return 'Transaction failed — please try again';
}

  async function handlePlaceBet() {
    if (!connected || !publicKey || !anchorWallet) return toast.error('Connect wallet first');
    if (!betAmount || parseFloat(betAmount.replace(',', '.')) <= 0) return toast.error('Enter a bet amount');
    const minBet = parseInt(game.min_bet) / 1_000_000;
    if (parseFloat(betAmount.replace(',', '.')) < minBet) return toast.error(`Minimum bet is $${minBet.toFixed(2)}`);

    // Pre-validate balance
    try {
      const playerTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, publicKey);
      const balance = await connection.getTokenAccountBalance(playerTokenAccount);
      const balanceLamports = parseInt(balance.value.amount);
      if (balanceLamports < Math.round(parseFloat(betAmount.replace(',', '.')) * 1_000_000)) {
        return toast.error('Insufficient funds in your wallet');
    }
} catch {
  // Token account doesn't exist yet — will fail on-chain anyway
}

    setBetLoading(true);
    try {
      const program = getProgram(anchorWallet, connection);
      const gamePda = new PublicKey(game.id);
      const playerTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, publicKey);
      const amount = new BN(Math.round(parseFloat(betAmount.replace(',', '.')) * 1_000_000));
      const betSeed = generateBetSeed();
      const betPda = getBetPda(gamePda, betSeed);
      const escrowPda = getEscrowPda(gamePda, betSeed);
      await program.methods
        .placeBet(amount, new BN(betSeed.toString()))
        .accounts({
          game: gamePda,
          bet: betPda,
          escrow: escrowPda,
          player: publicKey,
          tokenMint: TOKEN_MINT,
          playerTokenAccount,
          config: CONFIG_PDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc({ skipPreflight: true });
      toast.success('Bet submitted! Processing...');
      // Refresh after delay to pick up processed bet
      setTimeout(fetchGame, 3000);
      setTimeout(fetchGame, 6000);
      setTimeout(fetchGame, 10000);
      // Register referral on first bet
      const refCode = localStorage.getItem('referral_code');
      if (refCode) {
        try {
          await fetch(`${API_URL}/api/users/referral`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet: publicKey.toString(), ref_code: refCode }),
          });
          localStorage.removeItem('referral_code');
        } catch (e) {
          console.error('Referral registration failed:', e);
        }
      }
      fetchGame();
    } catch (e) {
      console.error('FULL ERROR:', JSON.stringify(e, null, 2));
      console.error('TRANSACTION LOGS:', e?.transactionLogs);
      console.error('ERROR TYPE:', typeof e);
      console.error('ERROR KEYS:', Object.keys(e || {}));
      console.error('ERROR STRING:', String(e));
      console.error('ERROR MESSAGE:', e?.message);
      console.error('ERROR LOGS:', e?.logs);
  toast.error(parseError(e));
} finally {
      setBetLoading(false);
    }
  }
async function handleWithdraw(bet) {
  if (!connected || !publicKey || !anchorWallet) return toast.error('Connect wallet first')

  setBetLoading(true);
  try {
    const program = getProgram(anchorWallet, connection);
    const gamePda = new PublicKey(game.id);
    const gameVaultPda = getGameVaultPda(gamePda);
    const betPda = getBetPda(gamePda, bet.bet_seed);
    const playerTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, publicKey);
    const hostVault = await getAssociatedTokenAddress(TOKEN_MINT, new PublicKey(game.host)); 
    const amount = new BN(Math.round(parseFloat(betAmount.replace(',', '.')) * 1_000_000)); 
    const tx = await program.methods
      .withdraw()
      .accounts({
        game: gamePda,
        bet: betPda,
        player: publicKey,
        playerTokenAccount,
        gameVault: gameVaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ skipPreflight: true });

    toast.success('Withdrawn! ✓');
    fetchGame();
  } catch (e) {
  console.error(e);
  toast.error(parseError(e));
} finally {
    setBetLoading(false);
  }
}
  async function handleClaimJackpot() {
    if (!connected || !publicKey || !anchorWallet) return toast.error('Connect wallet first')

    setBetLoading(true);
    try {
      const program = getProgram(anchorWallet, connection);
      const gamePda = new PublicKey(game.id);
      const gameVaultPda = getGameVaultPda(gamePda);
      const claimantTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, publicKey);

      const [burnVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('burn_vault'), TOKEN_MINT.toBuffer()],
        program.programId
      );
      const tx = await program.methods
        .claimJackpot()
        .accounts({
          game: gamePda,
          claimant: publicKey,
          claimantTokenAccount,
          gameVault: gameVaultPda,
          config: CONFIG_PDA,
          burnVault: burnVaultPda,
          tokenMint: TOKEN_MINT,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc({ skipPreflight: true });

      toast.success('Jackpot claimed! 🎉');
      fetchGame();
    } catch (e) {
  console.error(e);
  toast.error(parseError(e));
}
     finally {
      setBetLoading(false);
    }
  }

    return (
    <>
      <Navbar />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'baseline', gap: '16px' }}>
  <span style={{
    fontFamily: 'var(--font-display)',
    fontSize: '48px',
    color: 'var(--text-primary)',
  }}>
    {game.name}
  </span>
  {game.is_paused && (
    <div style={{
      background: '#ff333322',
      border: '1px solid var(--accent-red)',
      borderRadius: '6px',
      padding: '12px 20px',
      color: 'var(--accent-red)',
      fontFamily: 'var(--font-display)',
      fontSize: '16px',
      letterSpacing: '0.05em',
      marginTop: '16px',
      textAlign: 'center',
    }}>
      ⚠ THIS GAME IS TEMPORARILY PAUSED DUE TO TECHNICAL ISSUES
    </div>
  )}
  <span style={{
    fontFamily: 'var(--font-display)',
    fontSize: '24px',
    color: 'var(--text-muted)',
  }}>
    #{String(game.game_number).padStart(4, '0')}
  </span>
  <TypeBadge kind={timerBadgeKind(game)} size={26} />
  <TypeBadge kind={modeBadgeKind(game)} size={26} />
</div>
        <div className="grid-3-stack" style={{
          gap: '1px',
          background: 'var(--border)',
          border: '1px solid var(--border)',
          marginBottom: '24px',
        }}>
          <div style={{ background: 'var(--bg-card)', padding: '32px', textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '48px',
              color: game.is_paused ? 'var(--text-muted)' : timeLeft < 60 ? 'var(--accent-red)' : 'var(--accent)',
              marginBottom: '4px',
            }}>
              {game.is_paused ? 'PAUSED' : formatTime(timeLeft)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              {game.is_paused ? 'GAME PAUSED BY ADMIN' : 'TIME REMAINING'}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '32px', textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '48px',
              color: 'var(--text-primary)',
              marginBottom: '4px',
            }}>
              ${jackpot.toFixed(2)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              JACKPOT
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '32px', textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '48px',
              color: 'var(--text-primary)',
              marginBottom: '4px',
            }}>
              {bets.length}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              BETS PLACED
            </div>
          </div>
        </div>

        <div className="grid-content-sidebar" style={{ gap: '24px' }}>

          <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
{game.salvador_mode > 0 ? (
                <div style={{ display: 'flex', gap: '0' }}>
                  {['BETS', 'SALVATIONS'].map(t => (
                    <div key={t} onClick={() => setInfoTab(t)} style={{
                      padding: '4px 16px',
                      cursor: 'pointer',
                      fontSize: '18px',
                      fontFamily: 'var(--font-display)',
                      color: infoTab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                      borderBottom: infoTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                      transition: 'all 0.15s',
                    }}>{t}</div>
                  ))}
                </div>
              ) : (
                <h2 style={{ fontSize: '24px' }}>BET HISTORY</h2>
              )}
              
                <a href={`https://solscan.io/account/${game.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '11px',
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  letterSpacing: '0.08em',
                }}
              >
                VIEW ON SOLSCAN
              </a>
            </div>
            {infoTab === 'SALVATIONS' ? (
              <div className="scroll-x">
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 60px 70px 90px',
                  padding: '12px 24px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                }}>
                  <span>#</span>
                  <span>PLAYER</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>SAVE #<Tooltip>Running count of saves by this player up through this row. The 1st time this player saved someone shows 1, 2nd time shows 2, etc.</Tooltip></span>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>BOUNTY %<Tooltip>What % of the unreserved pool this salvation paid out. In Fixed mode this is constant; in Progressive mode it grows with each save.</Tooltip></span>
                  <span style={{ textAlign: 'right', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>REWARD<Tooltip>Total earned from saves in this game.</Tooltip></span>
                </div>
                {salvations.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px 24px', textAlign: 'center' }}>No salvations yet</div>
                ) : (
                  salvations.map((s, i) => {
                    const username = playerUsernames[s.recipient];
                    const playerSalvCount = salvations.filter((x, j) => j >= i && x.recipient === s.recipient).length > 0
                      ? salvations.slice(0, i + 1).filter(x => x.recipient === s.recipient).length
                      : 1;
                    return (
                      <div key={i} style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 60px 70px 90px',
                        padding: '16px 24px',
                        borderBottom: '1px solid var(--border)',
                        alignItems: 'center',
                        fontSize: '13px',
                      }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{s.bounty_number}</span>
                        <span>{username ? (
                          <a href={`/profile/${username}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace', fontSize: '13px' }}>@{username}</a>
                        ) : (
                          <a href={`https://solscan.io/account/${s.recipient}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace', fontSize: '13px' }}>{s.recipient?.slice(0, 8)}...</a>
                        )}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{playerSalvCount}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{(s.bps / 100).toFixed(1)}%</span>
                        <span style={{ textAlign: 'right', color: '#22c55e', fontFamily: 'var(--font-display)' }}>${(s.amount / 1_000_000).toFixed(2)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
            <div className="scroll-x">

            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Filter by wallet or username..."
                value={walletFilter}
                onChange={e => setWalletFilter(e.target.value)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  flex: 1,
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="text"
                placeholder="Jump to #"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const idx = parseInt(e.target.value);
                    if (!isNaN(idx)) {
                      const el = document.querySelector(`[data-bet-index="${idx}"]`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }
                }}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  width: '100px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 100px 100px 120px',
              padding: '12px 24px',
              borderBottom: '1px solid var(--border)',
              fontSize: '10px',
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
            }}>
              <span>#</span>
              <span>PLAYER</span>
              <span>AMOUNT</span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>ROI TARGET<Tooltip>How much each bet must accumulate before the bettor can withdraw. Once a bet has earned (bet x ROI%) on top of itself, the player can cash out at bet + ROI.</Tooltip></span>
              <span>STATUS</span>
            </div>

            {bets.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No bets yet
              </div>
            ) : (
              (() => {
                const filter = walletFilter.toLowerCase().trim();
                const matchesFilter = (bet) => {
                  if (!filter) return true;
                  const username = (playerUsernames[bet.player] || '').toLowerCase();
                  return bet.player.toLowerCase().includes(filter) || username.includes(filter);
                };

                const sectionHeader = (label, count, collapsed, setCollapsed) => (
                  <div
                    onClick={() => setCollapsed(c => !c)}
                    style={{
                      padding: '10px 24px',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.08em',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: 'var(--bg-card)',
                    }}
                  >
                    {collapsed ? '▶' : '▼'} {count} {label}
                  </div>
                );

                const renderBetRow = (bet) => {
                  const isLast = bet.id === bets[bets.length - 1].id;
                  return (
                    <div key={bet.id} data-bet-index={bet.bet_index} style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 100px 100px 120px',
                      padding: '16px 24px',
                      borderBottom: '1px solid var(--border)',
                      alignItems: 'center',
                      background: isLast ? 'var(--accent-dim)' : 'transparent',
                    }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{bet.bet_index}</span>
                      <span style={{ fontSize: '13px', fontFamily: 'monospace' }}>
                        <a
                          href={playerUsernames[bet.player] ? `/profile/${playerUsernames[bet.player]}` : `https://solscan.io/account/${bet.player}`}
                          target={playerUsernames[bet.player] ? '_self' : '_blank'}
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace' }}
                        >
                          {playerUsernames[bet.player] ? `@${playerUsernames[bet.player]}` : shortAddress(bet.player)}
                        </a>
                        {isLast && (
                          <span className="desktop-only" style={{ marginLeft: '8px', fontSize: '9px', color: 'var(--accent)', letterSpacing: '0.08em' }}>LAST BET</span>
                        )}
                      </span>
                      <span style={{ fontSize: '13px' }}>${formatAmount(bet.amount)}</span>
                      <span style={{ fontSize: '13px' }}>${formatAmount(bet.roi_target)}</span>
                      <span style={{ fontSize: '10px', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                        {bet.withdrawn ? (
                          <span style={{ color: 'var(--text-muted)' }}>WITHDRAWN</span>
                        ) : bet.reserved ? (
                          bet.player === publicKey?.toString() ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <button
                                onClick={() => handleWithdraw(bet)}
                                style={{
                                  background: 'var(--accent)', color: '#000', border: 'none',
                                  padding: '4px 10px', fontFamily: 'var(--font-display)',
                                  fontSize: '10px', cursor: 'pointer', letterSpacing: '0.05em',
                                }}
                              >WITHDRAW</button>
                              <Tooltip>Claim your winnings. Appears when you win the pool (your bet was last when the timer expired) or your bet has accumulated enough to hit its ROI target.</Tooltip>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--accent)' }}>✓ ROI</span>
                          )
                        ) : (() => {
                          const liveAccumulated = parseInt(bet.accumulated_base) +
                            (parseInt(game.cumulative_per_bet) - parseInt(bet.cumulative_at_join));
                          const pct = bet.roi_target > 0
                            ? Math.floor((liveAccumulated / parseInt(bet.roi_target)) * 1000) / 10 : 0;
                          const color = pct >= 90 ? '#f0c040' : pct >= 50 ? 'var(--accent)' : 'var(--text-secondary)';
                          return <span style={{ color, fontWeight: '600' }}>{pct.toFixed(1)}%</span>;
                        })()}
                      </span>
                    </div>
                  );
                };

                // Filter mode — show all matching, no sections
                if (filter) {
                  const filtered = bets.filter(matchesFilter);
                  return filtered.length === 0
                    ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No matching bets</div>
                    : <>{filtered.map(renderBetRow)}</>;
                }

                // Section mode
                const firstBet = bets[0];
                const roiBets = bets.filter(b => (b.withdrawn || b.reserved) && b.id !== firstBet.id);
                const nonRoiBets = bets.filter(b => !b.withdrawn && !b.reserved && b.id !== firstBet.id);
                const oldest20 = nonRoiBets.slice(0, 20);
                const shownIds = new Set([firstBet.id, ...roiBets.map(b => b.id), ...oldest20.map(b => b.id)]);
                const remaining = bets.filter(b => !shownIds.has(b.id));
                const last10 = remaining.slice(-10);
                const last10Ids = new Set(last10.map(b => b.id));
                const middle = remaining.filter(b => !last10Ids.has(b.id));

                return (
                  <>
                    {renderBetRow(firstBet)}
                    {roiBets.length > 0 && <>
                      {sectionHeader('bets reached ROI', roiBets.length, roiCollapsed, setRoiCollapsed)}
                      {!roiCollapsed && roiBets.map(renderBetRow)}
                    </>}
                    {oldest20.map(renderBetRow)}
                    {middle.length > 0 && <>
                      {sectionHeader('bets accumulating', middle.length, middleCollapsed, setMiddleCollapsed)}
                      {!middleCollapsed && <>
                        {middle.slice(0, middleVisible).map(renderBetRow)}
                        {middleVisible < middle.length && (
                          <div
                            onClick={() => setMiddleVisible(v => v + 50)}
                            style={{
                              padding: '14px 24px',
                              textAlign: 'center',
                              fontSize: '12px',
                              color: 'var(--accent)',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border)',
                              letterSpacing: '0.08em',
                            }}
                          >
                            LOAD MORE ({middle.length - middleVisible} remaining)
                          </div>
                        )}
                      </>}
                    </>}
                    {last10.map(renderBetRow)}
                  </>
                );
              })()
            )}
            </div>)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
              <h3 style={{ fontSize: '20px', marginBottom: '16px' }}>GAME INFO</h3>
              
              {[
                { label: 'MIN BET', value: `$${formatAmount(game.min_bet)}` },
                { label: 'ROI TARGET', value: `${(game.roi_bps / 100).toFixed(0)}%` },
                { label: 'HOST FEE', value: `${(game.host_fee_bps / 100).toFixed(0)}%` },
                { label: 'TOKEN', value: 'USDC' },
                { label: 'TIMER MODE', value: parseInt(game.timer_mode) === 1 ? `CUMULATIVE (+${Math.round(parseInt(game.time_increment) / 60)}m/bet)` : `FIXED (${Math.round(parseInt(game.timer_duration) / 60)}m reset)` },
                ...(game.salvador_mode > 0 ? [{ label: 'SALVADOR', value: game.salvador_mode === 1 ? `FIXED ${(game.salvador_bps / 100).toFixed(1)}%` : `PROGRESSIVE ${(game.salvador_bps / 100).toFixed(1)}%-${(game.salvador_cap_bps / 100).toFixed(1)}% (+${(game.salvador_step_bps / 100).toFixed(1)}%)` }] : []),
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px',
                }}>
                  <span style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', fontSize: '11px' }}>
                    {row.label}
                  </span>
                  <span>{row.value}</span>
                </div>
              ))}

            </div>

           {!loading && timeLeft === 0 && game.timer_end < Math.floor(Date.now() / 1000) && !game.jackpot_claimed && game.last_bettor === publicKey?.toString() ? (
  (() => {
    const jackpotUnlocksAt = parseInt(game.timer_end) + 300;
    const delayLeft = Math.max(0, jackpotUnlocksAt - Math.floor(Date.now() / 1000));
    if (delayLeft > 0) {
      return (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid #FFD700',
          padding: '20px',
          textAlign: 'center',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '8px' }}>
            JACKPOT UNLOCKS IN
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: '#FFD700' }}>
            {delayLeft}s
          </div>
        </div>
      );
    }
    return (
      <button
        onClick={handleClaimJackpot}
        disabled={betLoading}
        style={{
          background: '#FFD700',
          color: '#000',
          border: 'none',
          padding: '20px',
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          letterSpacing: '0.05em',
          cursor: betLoading ? 'not-allowed' : 'pointer',
          width: '100%',
          transition: 'opacity 0.2s',
          opacity: betLoading ? 0.6 : 1,
        }}
      >
        {betLoading ? 'CLAIMING...' : `CLAIM JACKPOT $${jackpot.toFixed(2)}`}
      </button>
    );
  })()
) : timeLeft > 0 ? (
              <>
                <input
                  type="text"
                  placeholder={`Min: $${(game.min_bet / 1_000_000).toFixed(2)}`}
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value.replace(',', '.'))}
                  onKeyDown={e => { if (e.key === 'Enter' && !betLoading && !platformPaused) handlePlaceBet(); }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    boxSizing: 'border-box',
                    marginBottom: '8px',
                  }}
                />
                <button
                  onClick={handlePlaceBet}
                  disabled={betLoading || platformPaused}
                  style={{
                    background: 'var(--accent)',
                    color: '#000',
                    border: 'none',
                    padding: '20px',
                    fontFamily: 'var(--font-display)',
                    fontSize: '28px',
                    letterSpacing: '0.05em',
                    cursor: (betLoading || platformPaused) ? 'not-allowed' : 'pointer',
                    width: '100%',
                    transition: 'opacity 0.2s',
                    opacity: (betLoading || platformPaused) ? 0.5 : 1,
                  }}
                  onMouseEnter={e => !(betLoading || platformPaused) && (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => !(betLoading || platformPaused) && (e.currentTarget.style.opacity = '1')}
                >
                  {platformPaused ? 'PLATFORM PAUSED' : betLoading ? 'PLACING...' : 'PLACE BET'}
                </button>
              </>
            ) : (
              <>
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                letterSpacing: '0.05em',
              }}>
                GAME OVER
              </div>
              {game.jackpot_claimed && game.last_bettor === publicKey?.toString() && (
                <div style={{ marginTop: '12px', textAlign: 'center' }}>
                  <ShareWinButton
                    gameNumber={game.game_number}
                    gameName={game.name}
                    refCode={publicKey?.toString().slice(0, 8)}
                  />
                </div>
              )}
              {!game.jackpot_claimed && bets.some(b => b.reserved && !b.withdrawn && b.player === publicKey?.toString()) && (
                <div style={{ padding: '12px 16px', background: '#ffaa0015', border: '1px solid #ffaa0033', fontSize: '12px', color: '#ffaa00', textAlign: 'center', marginTop: '8px' }}>
                  You have reserved bets to withdraw. Please withdraw within 30 days or funds may be reclaimed.
                </div>
              )}
              </>
            )}
            {game?.id && <GameChat gameId={game.id} />}
          </div>
        </div>
      </main>
    </>
  );
}