'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { getProgram, getGameVaultPda, getBetPda, TOKEN_MINT } from '@/lib/program';
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
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const [betAmount, setBetAmount] = useState('');
  const [betLoading, setBetLoading] = useState(false);
  const [playerUsernames, setPlayerUsernames] = useState({});
  useEffect(() => {
    fetchGame();
    const interval = setInterval(fetchGame, 10_000);
    return () => clearInterval(interval);
  }, [gameId]);

  useEffect(() => {
    if (!game) return;
    const interval = setInterval(() => {
      setTimeLeft(Math.max(0, game.timer_end - Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [game]);

  async function fetchGame() {
    try {
      const res = await fetch(`${API_URL}/api/games/${gameId}`);
      const data = await res.json();
      setGame(data);
      setBets(data.bets || []);
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
      setTimeLeft(Math.max(0, data.timer_end - Math.floor(Date.now() / 1000)))
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

  const jackpot = (parseInt(game.pool_balance) - parseInt(game.reserved_balance)) / 1_000_000;

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
      const gameVaultPda = getGameVaultPda(gamePda);
      const onChainGame = await program.account.game.fetch(gamePda);
const betIndex = onChainGame.betCount.toNumber();
const betPda = getBetPda(gamePda, betIndex);
      const PLATFORM_VAULT = new PublicKey('Ed9rtBfVhJbeAGkPqRJM3fPJaZT2ZgEARQYiXUZJJw2z');
      const playerTokenAccount = await getAssociatedTokenAddress(TOKEN_MINT, publicKey);
      const hostVault = await getAssociatedTokenAddress(TOKEN_MINT, new PublicKey(game.host));
      const amount = new BN(Math.round(parseFloat(betAmount.replace(',', '.')) * 1_000_000));

      await program.methods
        .placeBet(amount)
        .accounts({
          game: gamePda,
          bet: betPda,
          player: publicKey,
          playerTokenAccount,
          gameVault: gameVaultPda,
          platformVault: PLATFORM_VAULT,
          hostVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc({ skipPreflight: true });

      toast.success('Bet placed! ✓');
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
    const betPda = getBetPda(gamePda, bet.bet_index);
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

      const tx = await program.methods
        .claimJackpot()
        .accounts({
          game: gamePda,
          claimant: publicKey,
          claimantTokenAccount,
          gameVault: gameVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
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
  <span style={{
    fontFamily: 'var(--font-display)',
    fontSize: '24px',
    color: 'var(--text-muted)',
  }}>
    #{String(game.game_number).padStart(4, '0')}
  </span>
</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '1px',
          background: 'var(--border)',
          border: '1px solid var(--border)',
          marginBottom: '24px',
        }}>
          <div style={{ background: 'var(--bg-card)', padding: '32px', textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '48px',
              color: timeLeft < 60 ? 'var(--accent-red)' : 'var(--accent)',
              marginBottom: '4px',
            }}>
              {formatTime(timeLeft)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              TIME REMAINING
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>

          <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ fontSize: '24px' }}>BET HISTORY</h2>
              
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
              <span>ROI TARGET</span>
              <span>STATUS</span>
            </div>

            {bets.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No bets yet
              </div>
            ) : (
              bets.map((bet, i) => (
                <div key={bet.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 100px 100px 120px',
                  padding: '16px 24px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  background: i === bets.length - 1 ? 'var(--accent-dim)' : 'transparent',
                }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {bet.bet_index}
                  </span>
                  <span style={{ fontSize: '13px', fontFamily: 'monospace' }}>
                    <a href={playerUsernames[bet.player] ? `/profile/${playerUsernames[bet.player]}` : `https://solscan.io/account/${bet.player}`}
  target={playerUsernames[bet.player] ? '_self' : '_blank'}
  rel="noopener noreferrer"
  style={{ color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace' }}
>
  {playerUsernames[bet.player] ? `@${playerUsernames[bet.player]}` : shortAddress(bet.player)}
</a>
                    {i === bets.length - 1 && (
                      <span style={{ marginLeft: '8px', fontSize: '9px', color: 'var(--accent)', letterSpacing: '0.08em' }}>
                        LAST BET
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '13px' }}>${formatAmount(bet.amount)}</span>
                  <span style={{ fontSize: '13px' }}>${formatAmount(bet.roi_target)}</span>
                  <span style={{
                    fontSize: '10px',
                    letterSpacing: '0.05em',
                    color: 'var(--text-primary)',
                  }}>
                    {bet.withdrawn ? (
                      <span style={{ color: 'var(--text-muted)' }}>WITHDRAWN</span>
                    ) : bet.reserved ? (
                      bet.player === publicKey?.toString() ? (
                        <button
                          onClick={() => handleWithdraw(bet)}
                          style={{
                            background: 'var(--accent)',
                            color: '#000',
                            border: 'none',
                            padding: '4px 10px',
                            fontFamily: 'var(--font-display)',
                            fontSize: '10px',
                            cursor: 'pointer',
                            letterSpacing: '0.05em',
                          }}
                        >
                          WITHDRAW
                        </button>
                      ) : (
                        <span style={{ color: 'var(--accent)' }}>✓ ROI</span>
                      )
                    ) : (() => {
                      const liveAccumulated = parseInt(bet.accumulated_base) + 
  (                     parseInt(game.cumulative_per_bet) - parseInt(bet.cumulative_at_join));
                      const pct = bet.roi_target > 0
                        ? Math.floor((liveAccumulated / parseInt(bet.roi_target)) * 1000) / 10
                        : 0;
                      const color = pct >= 90 ? '#f0c040' : pct >= 50 ? 'var(--accent)' : 'var(--text-secondary)';
                      return (
                        <span style={{ color, fontWeight: '600' }}>{pct.toFixed(1)}%</span>
                      );
                    })()}
                  </span>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
              <h3 style={{ fontSize: '20px', marginBottom: '16px' }}>GAME INFO</h3>
              {[
                { label: 'MIN BET', value: `$${formatAmount(game.min_bet)}` },
                { label: 'ROI TARGET', value: `${(game.roi_bps / 100).toFixed(0)}%` },
                { label: 'HOST FEE', value: `${(game.host_fee_bps / 100).toFixed(0)}%` },
                { label: 'TOKEN', value: 'USDC' },
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

            {timeLeft === 0 && !game.jackpot_claimed && game.last_bettor === publicKey?.toString() ? (
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
            ) : timeLeft > 0 ? (
              <>
                <input
                  type="text"
                  placeholder={`Min: $${(game.min_bet / 1_000_000).toFixed(2)}`}
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value.replace(',', '.'))}
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
                  disabled={betLoading}
                  style={{
                    background: 'var(--accent)',
                    color: '#000',
                    border: 'none',
                    padding: '20px',
                    fontFamily: 'var(--font-display)',
                    fontSize: '28px',
                    letterSpacing: '0.05em',
                    cursor: betLoading ? 'not-allowed' : 'pointer',
                    width: '100%',
                    transition: 'opacity 0.2s',
                    opacity: betLoading ? 0.6 : 1,
                  }}
                  onMouseEnter={e => !betLoading && (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => !betLoading && (e.currentTarget.style.opacity = '1')}
                >
                  {betLoading ? 'PLACING...' : 'PLACE BET'}
                </button>
              </>
            ) : (
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
            )}
          </div>
        </div>
      </main>
    </>
  );
}