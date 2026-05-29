'use client';
import { useWallet, useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction, createTransferInstruction } from '@solana/spl-token';
import dynamic from 'next/dynamic';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getProgram, CONFIG_PDA, TOKEN_MINT } from '@/lib/program';
const WalletMultiButton = dynamic(() => import('@solana/wallet-adapter-react-ui').then(m => m.WalletMultiButton), { ssr: false });
import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', padding: '0' },
  header: { borderBottom: '1px solid var(--border)', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 100 },
  title: { fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--accent)', letterSpacing: '0.1em' },
  body: { display: 'flex', minHeight: 'calc(100vh - 60px)' },
  sidebar: { width: '200px', borderRight: '1px solid var(--border)', padding: '24px 0', flexShrink: 0 },
  sidebarItem: (active) => ({ padding: '10px 24px', cursor: 'pointer', fontSize: '13px', letterSpacing: '0.05em', color: active ? 'var(--accent)' : 'var(--text-secondary)', background: active ? 'var(--accent-dim)' : 'transparent', borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent', transition: 'all 0.15s' }),
  main: { flex: 1, padding: '32px', overflowY: 'auto' },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px', marginBottom: '24px' },
  cardTitle: { fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '0.05em', marginBottom: '16px' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' },
  stat: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px' },
  statLabel: { fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: '6px' },
  statValue: { fontSize: '22px', fontFamily: 'var(--font-display)', color: 'var(--accent)' },
  input: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 12px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: '13px', outline: 'none', width: '100%' },
  btn: (variant = 'primary') => ({ padding: '8px 16px', borderRadius: '4px', fontSize: '12px', letterSpacing: '0.08em', cursor: 'pointer', fontFamily: 'var(--font-body)', border: 'none', background: variant === 'primary' ? 'var(--accent)' : variant === 'danger' ? 'var(--accent-red)' : 'var(--bg-card-hover)', color: variant === 'primary' ? '#000' : variant === 'danger' ? '#fff' : 'var(--text-primary)', transition: 'opacity 0.15s' }),
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '0.1em', borderBottom: '1px solid var(--border)' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' },
  row: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' },
  badge: (color) => ({ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: color === 'green' ? 'var(--accent-dim)' : '#ff333322', color: color === 'green' ? 'var(--accent)' : 'var(--accent-red)', letterSpacing: '0.05em' }),
  loginWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' },
  loginBox: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '40px', width: '360px', textAlign: 'center' },
};

const TABS = ['STATS', 'GAMES', 'LEADERBOARD', 'AIRDROP', 'MODERATION', 'MODERATORS', 'SUPPORT', 'ROADMAP', 'TRAFFIC', 'ON-CHAIN'];
const TICKET_STATUS_COLOR = {
  open: { bg: 'var(--status-open-bg)', color: 'var(--status-open-fg)' },
  answered: { bg: 'var(--status-warn-bg)', color: 'var(--status-warn-fg)' },
  closed: { bg: 'var(--status-mute-bg)', color: 'var(--status-mute-fg)' },
};

export default function ClaroscuroPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState('STATS');
  const [loading, setLoading] = useState(false);
  const { publicKey, connected, sendTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const [defaultFee, setDefaultFee] = useState('');
  const [tokenFeeAddr, setTokenFeeAddr] = useState('');
  const [tokenFeeBps, setTokenFeeBps] = useState('');
  const [closeGameId, setCloseGameId] = useState('');

  const [stats, setStats] = useState(null);
  const [balance, setBalance] = useState(null);
  const [treasury, setTreasury] = useState(null);
  const [games, setGames] = useState([]);
  const [gameSearch, setGameSearch] = useState('');
  const [currentWeek, setCurrentWeek] = useState(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [closedWeeks, setClosedWeeks] = useState([]);
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [weekEntries, setWeekEntries] = useState({});
  const [payoutBusy, setPayoutBusy] = useState(null);   // weekId of in-progress payout
  const [payoutProgress, setPayoutProgress] = useState({ done: 0, total: 0 });
  const [multipliers, setMultipliers] = useState([]);
  const [newMult, setNewMult] = useState({ multiplier: '', date_from: '', date_to: '' });
  const [modGameSearch, setModGameSearch] = useState('');
  const [modGame, setModGame] = useState(null);
  const [newGameName, setNewGameName] = useState('');
  const [banWallet, setBanWallet] = useState('');
  const [banReason, setBanReason] = useState('');
  const [bannedUsers, setBannedUsers] = useState([]);
  const [moderators, setModerators] = useState([]);
  const [newModWallet, setNewModWallet] = useState('');
  const [tickets, setTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('open');
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketReplies, setTicketReplies] = useState([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [roadmapItems, setRoadmapItems] = useState([]);
  const [rmForm, setRmForm] = useState({ phase: '', title: '', description: '', status: 'planned', sort_order: '' });
  const [rmEditId, setRmEditId] = useState(null);
  const [roadmapPhases, setRoadmapPhases] = useState([]);
  const [traffic, setTraffic] = useState([]);
  const [rmPhaseForm, setRmPhaseForm] = useState({ name: '', description: '' });
  const [rmPhaseEditId, setRmPhaseEditId] = useState(null);

  const adminFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API_URL}/api/admin${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret, ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, [secret]);

  async function login() {
    try {
      await adminFetch('/stats');
      setAuthed(true);
      sessionStorage.setItem('admin_secret', secret);
    } catch { alert('Invalid secret'); }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_secret');
    if (saved) setSecret(saved);
  }, []);

  useEffect(() => { if (!authed) return; loadTab(tab); }, [authed, tab]);

  async function loadTab(t, filter) {
    setLoading(true);
    try {
      if (t === 'STATS') {
        const [st, b, tr] = await Promise.all([adminFetch('/stats'), adminFetch('/indexer-balance'), adminFetch('/treasury')]);
        setStats(st); setBalance(b); setTreasury(tr);
      } else if (t === 'GAMES') {
        const d = await adminFetch('/games'); setGames(d.games);
      } else if (t === 'LEADERBOARD') {
        const [d, cw] = await Promise.all([
          fetch(`${API_URL}/api/leaderboard`).then(r => r.json()),
          adminFetch('/leaderboard/closed-weeks'),
        ]);
        setCurrentWeek(d.week);
        setClosedWeeks(cw.weeks || []);
      } else if (t === 'AIRDROP') {
        const d = await adminFetch('/airdrop/multipliers'); setMultipliers(d.multipliers);
      } else if (t === 'MODERATION') {
        const d = await adminFetch('/banned-users'); setBannedUsers(d.banned_users);
      } else if (t === 'MODERATORS') {
        const d = await adminFetch('/moderators'); setModerators(d.moderators);
      } else if (t === 'SUPPORT') {
        const f = filter !== undefined ? filter : ticketFilter;
        const d = await adminFetch(`/support${f !== 'all' ? `?status=${f}` : ''}`);
        setTickets(d.tickets); setActiveTicket(null);
      } else if (t === 'TRAFFIC') {
        const d = await adminFetch('/traffic'); setTraffic(d.sources || []);
      } else if (t === 'ROADMAP') {
        const d = await adminFetch('/roadmap');
        setRoadmapPhases(d.phases || []);
        setRoadmapItems(d.items || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  if (!authed) {
    return (
      <div style={s.loginWrap}>
        <div style={s.loginBox}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '24px' }}>CLAROSCURO</div>
          <input style={{ ...s.input, marginBottom: '12px' }} type="password" placeholder="Admin secret" value={secret} onChange={e => setSecret(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') login(); }} />
          <button style={{ ...s.btn(), width: '100%' }} onClick={login}>LOGIN</button>
        </div>
      </div>
    );
  }

  function renderOnChain() {
    if (!connected || !anchorWallet) {
      return (
        <div style={s.card}>
          <div style={s.cardTitle}>CONNECT WALLET</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Connect your admin wallet to manage on-chain settings.</p>
          <WalletMultiButton />
        </div>
      );
    }
    return (
      <>
        <div style={{ marginBottom: '16px' }}><WalletMultiButton /></div>
        <div style={s.card}>
          <div style={s.cardTitle}>PLATFORM FEES</div>
          <div style={s.row}>
            <input style={{ ...s.input, width: '120px' }} placeholder="Fee bps (e.g. 500)" value={defaultFee} onChange={e => setDefaultFee(e.target.value)} />
            <button style={s.btn()} onClick={async () => {
              try {
                const program = getProgram(anchorWallet, connection);
                await program.methods.updateDefaultFee(parseInt(defaultFee))
                  .accounts({ config: CONFIG_PDA, admin: publicKey })
                  .rpc();
                alert('Default fee updated to ' + defaultFee + ' bps');
                setDefaultFee('');
              } catch (e) { alert('Error: ' + e.message); }
            }}>SET DEFAULT FEE</button>
          </div>
          <div style={s.row}>
            <input style={{ ...s.input, width: '280px' }} placeholder="Token mint address" value={tokenFeeAddr} onChange={e => setTokenFeeAddr(e.target.value)} />
            <input style={{ ...s.input, width: '120px' }} placeholder="Fee bps" value={tokenFeeBps} onChange={e => setTokenFeeBps(e.target.value)} />
            <button style={s.btn()} onClick={async () => {
              try {
                const program = getProgram(anchorWallet, connection);
                await program.methods.setTokenFee(new PublicKey(tokenFeeAddr), parseInt(tokenFeeBps))
                  .accounts({ config: CONFIG_PDA, admin: publicKey })
                  .rpc();
                alert('Token fee set');
                setTokenFeeAddr(''); setTokenFeeBps('');
              } catch (e) { alert('Error: ' + e.message); }
            }}>SET TOKEN FEE</button>
            <button style={s.btn('danger')} onClick={async () => {
              try {
                const program = getProgram(anchorWallet, connection);
                await program.methods.removeTokenFee(new PublicKey(tokenFeeAddr))
                  .accounts({ config: CONFIG_PDA, admin: publicKey })
                  .rpc();
                alert('Token fee removed');
                setTokenFeeAddr('');
              } catch (e) { alert('Error: ' + e.message); }
            }}>REMOVE TOKEN FEE</button>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>PLATFORM PAUSE</div>
          <div style={s.row}>
            <button style={s.btn('danger')} onClick={async () => {
              try {
                const program = getProgram(anchorWallet, connection);
                await program.methods.pausePlatform()
                  .accounts({ config: CONFIG_PDA, admin: publicKey })
                  .rpc();
                alert('Platform PAUSED');
              } catch (e) { alert('Error: ' + e.message); }
            }}>PAUSE PLATFORM</button>
            <button style={s.btn()} onClick={async () => {
              try {
                const program = getProgram(anchorWallet, connection);
                await program.methods.unpausePlatform()
                  .accounts({ config: CONFIG_PDA, admin: publicKey })
                  .rpc();
                alert('Platform UNPAUSED');
              } catch (e) { alert('Error: ' + e.message); }
            }}>UNPAUSE PLATFORM</button>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>CLOSE GAME</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>Close a finished game to recover rent. Game must have jackpot claimed. Use force close if players abandoned withdrawals.</p>
          <div style={s.row}>
            <input style={{ ...s.input, width: '360px' }} placeholder="Game address" value={closeGameId} onChange={e => setCloseGameId(e.target.value)} />
            <button style={s.btn()} onClick={async () => {
              try {
                const program = getProgram(anchorWallet, connection);
                const gameKey = new PublicKey(closeGameId);
                const gameAccount = await program.account.game.fetch(gameKey);
                const [vaultPda] = PublicKey.findProgramAddressSync(
                  [Buffer.from('vault'), gameKey.toBuffer()],
                  program.programId
                );
                await program.methods.closeGame()
                  .accounts({ game: gameKey, gameVault: vaultPda, host: gameAccount.host, tokenProgram: TOKEN_PROGRAM_ID })
                  .rpc();
                alert('Game closed, rent recovered!');
                setCloseGameId('');
              } catch (e) { alert('Error: ' + e.message); }
            }}>CLOSE GAME</button>
            <button style={s.btn('danger')} onClick={async () => {
              if (!confirm('Force close will sweep remaining tokens to platform vault. Continue?')) return;
              try {
                const program = getProgram(anchorWallet, connection);
                const gameKey = new PublicKey(closeGameId);
                const gameAccount = await program.account.game.fetch(gameKey);
                const [vaultPda] = PublicKey.findProgramAddressSync(
                  [Buffer.from('vault'), gameKey.toBuffer()],
                  program.programId
                );
                const [platformVaultPda] = PublicKey.findProgramAddressSync(
                  [Buffer.from('platform_vault'), gameAccount.tokenMint.toBuffer()],
                  program.programId
                );
                await program.methods.adminForceCloseGame()
                  .accounts({ game: gameKey, gameVault: vaultPda, platformVault: platformVaultPda, config: CONFIG_PDA, admin: publicKey, host: gameAccount.host, tokenProgram: TOKEN_PROGRAM_ID })
                  .rpc();
                alert('Game force closed!');
                setCloseGameId('');
              } catch (e) { alert('Error: ' + e.message); }
            }}>FORCE CLOSE</button>
          </div>
        </div>
      </>
    );
  }


  function renderStats() {
    return (
      <div>
        <div style={s.card}>
          <div style={s.cardTitle}>PLATFORM STATS</div>
          <div style={s.statGrid}>
            {[['TOTAL GAMES', stats?.games?.total_games || 0], ['ACTIVE GAMES', stats?.games?.active_games || 0], ['TOTAL BETS', stats?.bets?.total_bets || 0], ['TOTAL VOLUME', `$${((parseInt(stats?.bets?.total_volume) || 0) / 1_000_000).toFixed(0)}`], ['TOTAL POOL', `$${((parseInt(stats?.games?.total_pool_balance) || 0) / 1_000_000).toFixed(0)}`]].map(([label, value]) => (
              <div key={label} style={s.stat}><div style={s.statLabel}>{label}</div><div style={s.statValue}>{value}</div></div>
            ))}
          </div>
        </div>
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={s.cardTitle}>INDEXER WALLET</div>
            <button style={s.btn('secondary')} onClick={() => loadTab('STATS')}>REFRESH</button>
          </div>
          <div style={s.statGrid}>
            <div style={s.stat}><div style={s.statLabel}>BALANCE</div><div style={s.statValue}>{balance?.balance_sol?.toFixed(4)} SOL</div></div>
            <div style={{ ...s.stat, gridColumn: 'span 2' }}><div style={s.statLabel}>WALLET</div><div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '4px' }}>{balance?.wallet}</div></div>
          </div>
        </div>
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={s.cardTitle}>TREASURY</div>
          </div>
          <div style={s.statGrid}>
            <div style={s.stat}><div style={s.statLabel}>TREASURY BALANCE</div><div style={s.statValue}>${((treasury?.treasury_balance_usdc || 0) / 1_000_000).toFixed(2)}</div></div>
            <div style={s.stat}><div style={s.statLabel}>TREASURY SOL</div><div style={s.statValue}>{((treasury?.treasury_sol_balance || 0) / 1e9).toFixed(4)} SOL</div></div>
            <div style={s.stat}><div style={s.statLabel}>OWED TO REFERRERS</div><div style={{ ...s.statValue, color: 'var(--accent-red)' }}>${((treasury?.total_owed_usdc || 0) / 1_000_000).toFixed(2)}</div></div>
            <div style={s.stat}><div style={s.statLabel}>AVAILABLE</div><div style={s.statValue}>${((treasury?.available_usdc || 0) / 1_000_000).toFixed(2)}</div></div>
            <div style={s.stat}><div style={s.statLabel}>TOTAL REFERRALS</div><div style={s.statValue}>{treasury?.total_referrals || 0}</div></div>
          </div>
        </div>
        <div style={s.card}>
          <div style={s.cardTitle}>PLATFORM CONTROLS</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={s.btn('danger')} onClick={async () => { if (!confirm('Pause ALL games?')) return; await adminFetch('/pause', { method: 'POST' }); alert('Platform paused'); }}>PAUSE PLATFORM</button>
            <button style={s.btn('secondary')} onClick={async () => { if (!confirm('Restart ALL games?')) return; await adminFetch('/restart', { method: 'POST' }); alert('Platform restarted'); }}>RESTART PLATFORM</button>
          </div>
        </div>
      </div>
    );
  }

  function renderGames() {
    const filtered = games.filter(g => !gameSearch || g.name?.toLowerCase().includes(gameSearch.toLowerCase()) || String(g.game_number).includes(gameSearch));
    return (
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={s.cardTitle}>ALL GAMES</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={{ ...s.input, width: '200px' }} placeholder="Search by name or #" value={gameSearch} onChange={e => setGameSearch(e.target.value)} />
            <button style={s.btn('secondary')} onClick={() => loadTab('GAMES')}>REFRESH</button>
          </div>
        </div>
        <table style={s.table}>
          <thead><tr><th style={s.th}>#</th><th style={s.th}>NAME</th><th style={s.th}>STATUS</th><th style={s.th}>POOL</th><th style={s.th}>ACTIONS</th></tr></thead>
          <tbody>
            {filtered.map(g => (
              <tr key={g.id}>
                <td style={s.td}><span style={{ color: 'var(--text-secondary)' }}>#{String(g.game_number).padStart(4, '0')}</span></td>
                <td style={s.td}>{g.name}</td>
                <td style={s.td}>
                  <span style={s.badge(g.is_active ? 'green' : 'red')}>{g.is_active ? 'ACTIVE' : 'ENDED'}</span>
                  {g.is_hidden && <span style={{ ...s.badge('red'), marginLeft: '4px' }}>HIDDEN</span>}
                </td>
                <td style={s.td}>${((parseInt(g.pool_balance) || 0) / 1_000_000).toFixed(2)}</td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {g.is_active && <button style={s.btn('danger')} onClick={async () => { await adminFetch(`/games/${g.id}/pause`, { method: 'POST' }); loadTab('GAMES'); }}>PAUSE</button>}
                    {!g.is_active && <button style={s.btn('secondary')} onClick={async () => { await adminFetch(`/games/${g.id}/restart`, { method: 'POST' }); loadTab('GAMES'); }}>RESTART</button>}
                    <button style={s.btn('secondary')} onClick={async () => { await adminFetch(`/games/${g.id}/recover`, { method: 'POST' }); alert('Recovery triggered'); }}>RECOVER</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }


  async function toggleWeekDetails(weekId) {
    if (expandedWeek === weekId) { setExpandedWeek(null); return; }
    if (!weekEntries[weekId]) {
      const d = await adminFetch('/leaderboard/entries/' + weekId);
      setWeekEntries(prev => ({ ...prev, [weekId]: d.entries }));
    }
    setExpandedWeek(weekId);
  }

  async function payAllForWeek(weekId, totalOwedRaw, unpaidCount) {
    if (!connected || !publicKey) return alert('Connect your treasury wallet first.');
    if (!sendTransaction) return alert('Wallet does not support sendTransaction');
    const totalUsd = (Number(totalOwedRaw) / 1_000_000).toFixed(2);
    if (!confirm('Pay ' + unpaidCount + ' winner(s) totaling $' + totalUsd + ' USDC? Funds come from the connected wallet.')) return;

    setPayoutBusy(weekId);
    setPayoutProgress({ done: 0, total: unpaidCount });

    try {
      const { entries } = await adminFetch('/leaderboard/unpaid/' + weekId);
      if (!entries || entries.length === 0) { alert('Nothing to pay.'); setPayoutBusy(null); return; }

      const sourceATA = await getAssociatedTokenAddress(TOKEN_MINT, publicKey);
      const BATCH = 4;   // ~4 transfers + ATA-creates per legacy tx (~1232 byte cap)
      let done = 0;

      for (let i = 0; i < entries.length; i += BATCH) {
        const batch = entries.slice(i, i + BATCH);
        const tx = new Transaction();

        for (const entry of batch) {
          const recipient = new PublicKey(entry.player);
          const recipientATA = await getAssociatedTokenAddress(TOKEN_MINT, recipient);
          tx.add(
            createAssociatedTokenAccountIdempotentInstruction(publicKey, recipientATA, recipient, TOKEN_MINT)
          );
          tx.add(
            createTransferInstruction(sourceATA, recipientATA, publicKey, BigInt(entry.reward))
          );
        }

        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, 'confirmed');

        for (const entry of batch) {
          await adminFetch('/leaderboard/mark-paid', {
            method: 'POST',
            body: JSON.stringify({ entry_id: entry.id, tx_signature: sig }),
          });
          done++;
          setPayoutProgress({ done, total: entries.length });
        }
      }

      alert('All ' + entries.length + ' winners paid.');
      loadTab('LEADERBOARD');
    } catch (e) {
      alert('Payout failed at winner ' + (payoutProgress.done + 1) + ': ' + e.message + '. Unpaid winners stay marked unpaid — you can retry.');
      loadTab('LEADERBOARD');
    } finally {
      setPayoutBusy(null);
      setPayoutProgress({ done: 0, total: 0 });
    }
  }

  function renderLeaderboard() {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>CURRENT WEEK</div>
        {currentWeek ? (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            <div>Start: {new Date(currentWeek.week_start).toLocaleDateString()}</div>
            <div>Pot: ${((parseInt(currentWeek.pot_amount) || 0) / 1_000_000).toFixed(2)} USDC</div>
            <div>Rollover: ${((parseInt(currentWeek.rollover_amount) || 0) / 1_000_000).toFixed(2)} USDC</div>
          </div>
        ) : <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>No active week</div>}
        <div style={s.row}>
          <input style={{ ...s.input, width: '160px' }} placeholder="Top-up amount (USDC)" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
          <button style={s.btn()} onClick={async () => { const usd = parseFloat(topupAmount); if (!usd || usd <= 0) return alert('Enter a valid USDC amount'); if (!confirm('Top up the pot by $' + usd + ' USDC? This only updates the ledger — you must transfer this amount manually to the treasury.')) return; await adminFetch('/leaderboard/topup', { method: 'POST', body: JSON.stringify({ amount: usd }) }); setTopupAmount(''); loadTab('LEADERBOARD'); alert('Pot updated by $' + usd); }}>TOP UP</button>
        </div>
        <button style={s.btn('danger')} onClick={async () => { if (!confirm('Close current week and distribute rewards?')) return; await adminFetch('/leaderboard/close-week', { method: 'POST' }); loadTab('LEADERBOARD'); alert('Week closed!'); }}>CLOSE WEEK</button>

        {closedWeeks.length > 0 && (
          <div style={{ marginTop: '32px' }}>
            <div style={{ ...s.cardTitle, marginBottom: '12px' }}>CLOSED WEEKS — PAYOUTS</div>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>WEEK</th>
                  <th style={s.th}>POT</th>
                  <th style={s.th}>WINNERS</th>
                  <th style={s.th}>UNPAID</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {closedWeeks.map(w => {
                  const unpaidUsd = (Number(w.unpaid_amount) / 1_000_000).toFixed(2);
                  const totalUsd = (Number(w.pot_amount) / 1_000_000).toFixed(2);
                  const isBusy = payoutBusy === w.id;
                  const isExpanded = expandedWeek === w.id;
                  const entries = weekEntries[w.id] || [];
                  return (
                    <>
                    <tr key={w.id}>
                      <td style={s.td}>
                        <button onClick={() => toggleWeekDetails(w.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0 6px', fontSize: '14px' }}>{isExpanded ? '▼' : '▶'}</button>
                        {new Date(w.week_start).toLocaleDateString()}
                      </td>
                      <td style={s.td}>${totalUsd}</td>
                      <td style={s.td}>{w.paid_count}/{w.total_winners} paid</td>
                      <td style={s.td}>{w.unpaid_count} owed ${unpaidUsd}</td>
                      <td style={s.td}>
                        {w.unpaid_count > 0 ? (
                          <button
                            style={{ ...s.btn(), opacity: isBusy ? 0.5 : 1 }}
                            disabled={isBusy || payoutBusy !== null}
                            onClick={() => payAllForWeek(w.id, w.unpaid_amount, w.unpaid_count)}
                          >
                            {isBusy ? ('PAYING ' + payoutProgress.done + '/' + payoutProgress.total) : ('PAY ' + w.unpaid_count + ' ($' + unpaidUsd + ')')}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '0.05em' }}>✓ ALL PAID</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={w.id + '-detail'}>
                        <td colSpan={5} style={{ ...s.td, padding: '0' }}>
                          <table style={{ ...s.table, background: 'var(--bg)' }}>
                            <thead>
                              <tr>
                                <th style={{ ...s.th, paddingLeft: '24px' }}>RANK</th>
                                <th style={s.th}>PLAYER</th>
                                <th style={s.th}>REWARD</th>
                                <th style={s.th}>STATUS</th>
                                <th style={s.th}>TX</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entries.length === 0 && <tr><td colSpan={5} style={{ ...s.td, color: 'var(--text-muted)', textAlign: 'center' }}>Loading…</td></tr>}
                              {entries.map(e => {
                                const rewardUsd = (Number(e.reward) / 1_000_000).toFixed(2);
                                return (
                                  <tr key={e.id}>
                                    <td style={{ ...s.td, paddingLeft: '24px', color: 'var(--text-muted)' }}>#{e.rank}</td>
                                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '11px' }}>{e.player.slice(0, 8)}…{e.player.slice(-6)}</td>
                                    <td style={s.td}>${rewardUsd}</td>
                                    <td style={s.td}>
                                      {e.paid_at ? <span style={{ color: 'var(--accent)' }}>✓ PAID</span> : <span style={{ color: 'var(--text-muted)' }}>UNPAID</span>}
                                    </td>
                                    <td style={s.td}>
                                      {e.payout_tx ? (
                                        <a href={'https://solscan.io/tx/' + e.payout_tx} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: '11px', fontFamily: 'monospace' }}>
                                          {e.payout_tx.slice(0, 8)}…
                                        </a>
                                      ) : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                    </>
                  );
                })}
              </tbody>
            </table>
            {!connected && (
              <div style={{ marginTop: '12px', padding: '12px', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', fontSize: '12px' }}>
                ⚠ Connect your treasury wallet (top-right) to enable payouts.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderAirdrop() {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>MULTIPLIERS</div>
        <table style={s.table}>
          <thead><tr><th style={s.th}>MULTIPLIER</th><th style={s.th}>FROM</th><th style={s.th}>TO</th><th style={s.th}></th></tr></thead>
          <tbody>
            {multipliers.map(m => (
              <tr key={m.id}>
                <td style={s.td}>{m.multiplier}x</td>
                <td style={s.td}>{new Date(m.date_from).toLocaleDateString()}</td>
                <td style={s.td}>{new Date(m.date_to).toLocaleDateString()}</td>
                <td style={s.td}><button style={s.btn('danger')} onClick={async () => { await adminFetch(`/airdrop/multipliers/${m.id}`, { method: 'DELETE' }); loadTab('AIRDROP'); }}>DELETE</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ ...s.row, marginTop: '16px' }}>
          <input style={s.input} placeholder="Multiplier (e.g. 10)" value={newMult.multiplier} onChange={e => setNewMult({ ...newMult, multiplier: e.target.value })} />
          <input style={s.input} type="date" value={newMult.date_from} onChange={e => setNewMult({ ...newMult, date_from: e.target.value })} />
          <input style={s.input} type="date" value={newMult.date_to} onChange={e => setNewMult({ ...newMult, date_to: e.target.value })} />
          <button style={{ ...s.btn(), flexShrink: 0 }} onClick={async () => { await adminFetch('/airdrop/multipliers', { method: 'POST', body: JSON.stringify(newMult) }); setNewMult({ multiplier: '', date_from: '', date_to: '' }); loadTab('AIRDROP'); }}>ADD</button>
        </div>
      </div>
    );
  }

  function renderModeration() {
    return (
      <div>
        <div style={s.card}>
          <div style={s.cardTitle}>RENAME GAME</div>
          <div style={s.row}>
            <input style={s.input} placeholder="Game # or ID" value={modGameSearch} onChange={e => setModGameSearch(e.target.value)} />
            <button style={{ ...s.btn('secondary'), flexShrink: 0 }} onClick={async () => { const d = await adminFetch(`/games?search=${modGameSearch}`); setModGame(d.games[0] || null); if (d.games[0]) setNewGameName(d.games[0].name); }}>SEARCH</button>
          </div>
          {modGame && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>#{String(modGame.game_number).padStart(4, '0')} — {modGame.name}</div>
              <div style={s.row}>
                <input style={s.input} value={newGameName} onChange={e => setNewGameName(e.target.value)} placeholder="New name" />
                <button style={{ ...s.btn(), flexShrink: 0 }} onClick={async () => { await adminFetch(`/games/${modGame.id}/rename`, { method: 'POST', body: JSON.stringify({ name: newGameName }) }); setModGame(null); setModGameSearch(''); alert('Game renamed!'); }}>RENAME</button>
              </div>
            </div>
          )}
        </div>
        <div style={s.card}>
          <div style={s.cardTitle}>BAN USER</div>
          <div style={s.row}>
            <input style={s.input} placeholder="Wallet address" value={banWallet} onChange={e => setBanWallet(e.target.value)} />
            <input style={s.input} placeholder="Reason (optional)" value={banReason} onChange={e => setBanReason(e.target.value)} />
            <button style={{ ...s.btn('danger'), flexShrink: 0 }} onClick={async () => { await adminFetch('/banned-users', { method: 'POST', body: JSON.stringify({ wallet: banWallet, reason: banReason, banned_by: 'admin' }) }); setBanWallet(''); setBanReason(''); loadTab('MODERATION'); }}>BAN</button>
          </div>
          <table style={s.table}>
            <thead><tr><th style={s.th}>WALLET</th><th style={s.th}>REASON</th><th style={s.th}>DATE</th><th style={s.th}></th></tr></thead>
            <tbody>
              {bannedUsers.map(u => (
                <tr key={u.wallet}>
                  <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '11px' }}>{u.wallet}</td>
                  <td style={s.td}>{u.reason || '—'}</td>
                  <td style={s.td}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={s.td}><button style={s.btn('secondary')} onClick={async () => { await adminFetch(`/banned-users/${u.wallet}`, { method: 'DELETE' }); loadTab('MODERATION'); }}>UNBAN</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderModerators() {
    return (
      <div style={s.card}>
        <div style={s.cardTitle}>MODERATORS</div>
        <div style={{ ...s.row, marginBottom: '20px' }}>
          <input style={s.input} placeholder="Wallet address" value={newModWallet} onChange={e => setNewModWallet(e.target.value)} />
          <button style={{ ...s.btn(), flexShrink: 0 }} onClick={async () => { await adminFetch('/moderators', { method: 'POST', body: JSON.stringify({ wallet: newModWallet }) }); setNewModWallet(''); loadTab('MODERATORS'); }}>ADD MODERATOR</button>
        </div>
        <table style={s.table}>
          <thead><tr><th style={s.th}>WALLET</th><th style={s.th}>ADDED</th><th style={s.th}></th></tr></thead>
          <tbody>
            {moderators.length === 0 && <tr><td style={{ ...s.td, color: 'var(--text-secondary)' }} colSpan={3}>No moderators yet</td></tr>}
            {moderators.map(m => (
              <tr key={m.wallet}>
                <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '11px' }}>{m.wallet}</td>
                <td style={s.td}>{new Date(m.created_at).toLocaleDateString()}</td>
                <td style={s.td}><button style={s.btn('danger')} onClick={async () => { await adminFetch(`/moderators/${m.wallet}`, { method: 'DELETE' }); loadTab('MODERATORS'); }}>REMOVE</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderSupport() {
    if (activeTicket) {
      return (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={s.cardTitle}>#{activeTicket.id} — {activeTicket.subject}</div>
            <button style={s.btn('secondary')} onClick={() => setActiveTicket(null)}>← BACK</button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            <span style={{ fontFamily: 'monospace' }}>{activeTicket.wallet}</span>
            {activeTicket.game_id && <span style={{ marginLeft: '16px' }}>Game: {activeTicket.game_id}</span>}
            <span style={{ marginLeft: '16px' }}>{new Date(activeTicket.created_at).toLocaleDateString()}</span>
            <span style={{ marginLeft: '12px', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: TICKET_STATUS_COLOR[activeTicket.status]?.bg, color: TICKET_STATUS_COLOR[activeTicket.status]?.color }}>{activeTicket.status.toUpperCase()}</span>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '4px', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>{activeTicket.message}</div>
          {ticketReplies.map(r => (
            <div key={r.id} style={{ padding: '12px 16px', background: r.author === 'admin' ? 'var(--accent-dim)' : 'var(--bg)', borderRadius: '4px', marginBottom: '8px', fontSize: '13px', lineHeight: '1.6' }}>
              <div style={{ fontSize: '11px', color: r.author === 'admin' ? 'var(--accent)' : 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.05em' }}>{r.author === 'admin' ? 'SUPPORT' : 'USER'} · {new Date(r.created_at).toLocaleDateString()}</div>
              {r.message}
            </div>
          ))}
          {activeTicket.status !== 'closed' && (
            <div style={{ marginTop: '16px' }}>
              <textarea style={{ ...s.input, minHeight: '80px', resize: 'vertical', marginBottom: '8px' }} placeholder="Reply..." value={replyMessage} onChange={e => setReplyMessage(e.target.value)} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={s.btn()} onClick={async () => {
                  if (!replyMessage.trim()) return;
                  await adminFetch(`/support/${activeTicket.id}/reply`, { method: 'POST', body: JSON.stringify({ message: replyMessage }) });
                  setReplyMessage('');
                  const d = await adminFetch(`/support/${activeTicket.id}`);
                  setActiveTicket(d.ticket); setTicketReplies(d.replies);
                }}>SEND REPLY</button>
                <button style={s.btn('danger')} onClick={async () => {
                  if (!confirm('Close this ticket?')) return;
                  await adminFetch(`/support/${activeTicket.id}/close`, { method: 'POST' });
                  setActiveTicket(null); loadTab('SUPPORT');
                }}>CLOSE TICKET</button>
              </div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={s.cardTitle}>SUPPORT TICKETS</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['open', 'answered', 'closed', 'all'].map(f => (
              <button key={f} style={{ ...s.btn(ticketFilter === f ? 'primary' : 'secondary'), padding: '6px 12px' }} onClick={() => { setTicketFilter(f); loadTab('SUPPORT', f); }}>{f.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <table style={s.table}>
          <thead><tr><th style={s.th}>#</th><th style={s.th}>SUBJECT</th><th style={s.th}>WALLET</th><th style={s.th}>STATUS</th><th style={s.th}>REPLIES</th><th style={s.th}>DATE</th></tr></thead>
          <tbody>
            {tickets.length === 0 && <tr><td style={{ ...s.td, color: 'var(--text-secondary)' }} colSpan={6}>No tickets</td></tr>}
            {tickets.map(t => (
              <tr key={t.id} style={{ cursor: 'pointer' }} onClick={async () => {
                const d = await adminFetch(`/support/${t.id}`);
                setActiveTicket(d.ticket); setTicketReplies(d.replies);
              }}>
                <td style={s.td}>{t.id}</td>
                <td style={s.td}>{t.subject}</td>
                <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '11px' }}>{t.wallet.slice(0, 8)}...</td>
                <td style={s.td}><span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: TICKET_STATUS_COLOR[t.status]?.bg, color: TICKET_STATUS_COLOR[t.status]?.color, letterSpacing: '0.05em' }}>{t.status.toUpperCase()}</span></td>
                <td style={s.td}>{t.reply_count}</td>
                <td style={s.td}>{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }


  function renderRoadmap() {
    const phasesByName = {};
    roadmapPhases.forEach(ph => { phasesByName[ph.name] = ph; });
    const phaseItemCounts = {};
    roadmapItems.forEach(it => {
      phaseItemCounts[it.phase] = (phaseItemCounts[it.phase] || 0) + 1;
    });

    return (
      <div>
        {/* === ADD/EDIT PHASE === */}
        <div style={s.card}>
          <div style={s.cardTitle}>{rmPhaseEditId ? 'EDIT PHASE' : 'ADD PHASE'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input style={s.input} placeholder="Phase name (e.g. PRE-LAUNCH)" value={rmPhaseForm.name} onChange={e => setRmPhaseForm({ ...rmPhaseForm, name: e.target.value })} />
            <textarea style={{ ...s.input, minHeight: '60px', resize: 'vertical' }} placeholder="Description (optional, shown on public page)" value={rmPhaseForm.description} onChange={e => setRmPhaseForm({ ...rmPhaseForm, description: e.target.value })} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={s.btn()} onClick={async () => {
                if (!rmPhaseForm.name.trim()) return alert('Name required');
                try {
                  if (rmPhaseEditId) {
                    await adminFetch('/roadmap/phases/' + rmPhaseEditId, { method: 'PUT', body: JSON.stringify(rmPhaseForm) });
                    setRmPhaseEditId(null);
                  } else {
                    await adminFetch('/roadmap/phases', { method: 'POST', body: JSON.stringify(rmPhaseForm) });
                  }
                  setRmPhaseForm({ name: '', description: '' });
                  loadTab('ROADMAP');
                } catch (e) { alert('Error: ' + e.message); }
              }}>{rmPhaseEditId ? 'SAVE PHASE' : 'ADD PHASE'}</button>
              {rmPhaseEditId && <button style={s.btn('secondary')} onClick={() => { setRmPhaseEditId(null); setRmPhaseForm({ name: '', description: '' }); }}>CANCEL</button>}
            </div>
          </div>
        </div>

        {/* === PHASES TABLE === */}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={s.cardTitle}>PHASES ({roadmapPhases.length})</div>
            <button style={s.btn('secondary')} onClick={() => loadTab('ROADMAP')}>REFRESH</button>
          </div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>ORDER</th>
                <th style={s.th}>NAME</th>
                <th style={s.th}>DESCRIPTION</th>
                <th style={s.th}>ITEMS</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {roadmapPhases.length === 0 && (
                <tr><td style={{ ...s.td, color: 'var(--text-secondary)' }} colSpan={5}>No phases yet. Add one above.</td></tr>
              )}
              {roadmapPhases.map((ph, i) => (
                <tr key={ph.id} style={{ background: rmPhaseEditId === ph.id ? 'var(--accent-dim)' : 'transparent' }}>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button style={{ ...s.btn('secondary'), padding: '4px 8px', opacity: i === 0 ? 0.3 : 1 }} disabled={i === 0} onClick={async () => { await adminFetch('/roadmap/phases/' + ph.id + '/move-up', { method: 'POST' }); loadTab('ROADMAP'); }}>↑</button>
                      <button style={{ ...s.btn('secondary'), padding: '4px 8px', opacity: i === roadmapPhases.length - 1 ? 0.3 : 1 }} disabled={i === roadmapPhases.length - 1} onClick={async () => { await adminFetch('/roadmap/phases/' + ph.id + '/move-down', { method: 'POST' }); loadTab('ROADMAP'); }}>↓</button>
                    </div>
                  </td>
                  <td style={s.td}><strong>{ph.name}</strong></td>
                  <td style={s.td}>
                    {ph.description ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{ph.description.length > 80 ? ph.description.slice(0, 80) + '...' : ph.description}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>no description</span>
                    )}
                  </td>
                  <td style={s.td}>{phaseItemCounts[ph.name] || 0}</td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button style={s.btn('secondary')} onClick={() => { setRmPhaseEditId(ph.id); setRmPhaseForm({ name: ph.name, description: ph.description || '' }); }}>EDIT</button>
                      <button style={s.btn('danger')} onClick={async () => {
                        const cnt = phaseItemCounts[ph.name] || 0;
                        const msg = cnt > 0 ? 'Delete this phase? ' + cnt + ' item(s) will be uncategorized but kept.' : 'Delete this phase?';
                        if (!confirm(msg)) return;
                        await adminFetch('/roadmap/phases/' + ph.id, { method: 'DELETE' });
                        loadTab('ROADMAP');
                      }}>DELETE</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* === ADD/EDIT ITEM === */}
        <div style={s.card}>
          <div style={s.cardTitle}>{rmEditId ? 'EDIT ITEM' : 'ADD ITEM'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={s.row}>
              <select style={{ ...s.input, width: '180px' }} value={rmForm.phase} onChange={e => setRmForm({ ...rmForm, phase: e.target.value })}>
                <option value="">— no phase —</option>
                {roadmapPhases.map(ph => (
                  <option key={ph.id} value={ph.name}>{ph.name}</option>
                ))}
              </select>
              <input style={s.input} placeholder="Title *" value={rmForm.title} onChange={e => setRmForm({ ...rmForm, title: e.target.value })} />
              <select style={{ ...s.input, width: '150px' }} value={rmForm.status} onChange={e => setRmForm({ ...rmForm, status: e.target.value })}>
                <option value="in-progress">IN PROGRESS</option>
                <option value="planned">PLANNED</option>
                <option value="done">DONE</option>
              </select>
              <input style={{ ...s.input, width: '80px' }} type="number" placeholder="Order" value={rmForm.sort_order} onChange={e => setRmForm({ ...rmForm, sort_order: e.target.value })} />
            </div>
            <textarea style={{ ...s.input, minHeight: '60px', resize: 'vertical' }} placeholder="Description (optional)" value={rmForm.description} onChange={e => setRmForm({ ...rmForm, description: e.target.value })} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={s.btn()} onClick={async () => {
                if (!rmForm.title.trim()) return alert('Title required');
                try {
                  const body = { ...rmForm, sort_order: parseInt(rmForm.sort_order) || 0 };
                  if (rmEditId) {
                    await adminFetch('/roadmap/' + rmEditId, { method: 'PUT', body: JSON.stringify(body) });
                    setRmEditId(null);
                  } else {
                    await adminFetch('/roadmap', { method: 'POST', body: JSON.stringify(body) });
                  }
                  setRmForm({ phase: '', title: '', description: '', status: 'planned', sort_order: '' });
                  loadTab('ROADMAP');
                } catch (e) { alert('Error: ' + e.message); }
              }}>{rmEditId ? 'SAVE CHANGES' : 'ADD ITEM'}</button>
              {rmEditId && <button style={s.btn('secondary')} onClick={() => { setRmEditId(null); setRmForm({ phase: '', title: '', description: '', status: 'planned', sort_order: '' }); }}>CANCEL</button>}
            </div>
          </div>
        </div>


        {/* === ITEMS TABLE === */}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={s.cardTitle}>ROADMAP ITEMS ({roadmapItems.length})</div>
          </div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>ORDER</th>
                <th style={s.th}>PHASE</th>
                <th style={s.th}>TITLE</th>
                <th style={s.th}>STATUS</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {roadmapItems.length === 0 && (
                <tr><td style={{ ...s.td, color: 'var(--text-secondary)' }} colSpan={5}>No items yet.</td></tr>
              )}
              {roadmapItems.map(item => (
                <tr key={item.id} style={{ background: rmEditId === item.id ? 'var(--accent-dim)' : 'transparent' }}>
                  <td style={{ ...s.td, color: 'var(--text-secondary)' }}>{item.sort_order}</td>
                  <td style={s.td}>{item.phase || '—'}</td>
                  <td style={s.td}>
                    <div>{item.title}</div>
                    {item.description && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {item.description.length > 80 ? item.description.slice(0, 80) + '...' : item.description}
                      </div>
                    )}
                  </td>
                  <td style={s.td}>
                    <span style={{
                      fontSize: '10px', padding: '2px 6px', borderRadius: '3px', letterSpacing: '0.05em',
                      background: item.status === 'done' ? 'var(--accent-dim)' : item.status === 'in-progress' ? '#ffaa0022' : '#88888822',
                      color:      item.status === 'done' ? 'var(--accent)'    : item.status === 'in-progress' ? '#ffaa00'    : '#888',
                    }}>{item.status.toUpperCase()}</span>
                  </td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button style={s.btn('secondary')} onClick={() => {
                        setRmEditId(item.id);
                        setRmForm({ phase: item.phase || '', title: item.title, description: item.description || '', status: item.status, sort_order: String(item.sort_order) });
                      }}>EDIT</button>
                      <button style={s.btn('danger')} onClick={async () => {
                        if (!confirm('Delete this item?')) return;
                        await adminFetch('/roadmap/' + item.id, { method: 'DELETE' });
                        loadTab('ROADMAP');
                      }}>DELETE</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderTraffic() {
    return (
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={s.cardTitle}>TRAFFIC SOURCES ({traffic.length})</div>
          <button style={s.btn('secondary')} onClick={() => loadTab('TRAFFIC')}>REFRESH</button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
          Visits attributed via <code style={{ background: 'var(--bg)', padding: '1px 6px' }}>?src=...</code> URL param. Each visit counted once per browser session. Use unique source codes per campaign (e.g. <code style={{ background: 'var(--bg)', padding: '1px 6px' }}>btg-banner</code>, <code style={{ background: 'var(--bg)', padding: '1px 6px' }}>twitter-launch</code>).
        </p>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>SOURCE</th>
              <th style={s.th}>VISITS</th>
              <th style={s.th}>FIRST SEEN</th>
              <th style={s.th}>LAST SEEN</th>
            </tr>
          </thead>
          <tbody>
            {traffic.length === 0 && (
              <tr><td style={{ ...s.td, color: 'var(--text-secondary)' }} colSpan={4}>No tracked visits yet. Use a URL like <code>?src=btg-banner</code> to attribute campaigns.</td></tr>
            )}
            {traffic.map(t => (
              <tr key={t.source}>
                <td style={{ ...s.td, fontFamily: 'monospace' }}>{t.source}</td>
                <td style={{ ...s.td, fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: '18px' }}>{t.count}</td>
                <td style={{ ...s.td, fontSize: '11px', color: 'var(--text-secondary)' }}>{new Date(t.first_seen).toLocaleString()}</td>
                <td style={{ ...s.td, fontSize: '11px', color: 'var(--text-secondary)' }}>{new Date(t.last_seen).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const renderMap = { STATS: renderStats, GAMES: renderGames, LEADERBOARD: renderLeaderboard, AIRDROP: renderAirdrop, MODERATION: renderModeration, MODERATORS: renderModerators, SUPPORT: renderSupport, ROADMAP: renderRoadmap, TRAFFIC: renderTraffic, 'ON-CHAIN': renderOnChain };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>CLAROSCURO</div>
        <button style={s.btn('secondary')} onClick={() => { sessionStorage.removeItem('admin_secret'); setAuthed(false); setSecret(''); }}>LOGOUT</button>
      </div>
      <div style={s.body}>
        <div style={s.sidebar}>{TABS.map(t => <div key={t} style={s.sidebarItem(tab === t)} onClick={() => setTab(t)}>{t}</div>)}</div>
        <div style={s.main}>{loading ? <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading...</div> : renderMap[tab]?.()}</div>
      </div>
    </div>
  );
}
