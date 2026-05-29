'use client';
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import toast from 'react-hot-toast';
import bs58 from 'bs58';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => m.WalletMultiButton),
  { ssr: false }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const STATUS_COLOR = {
  open: { bg: 'var(--status-open-bg)', color: 'var(--status-open-fg)' },
  answered: { bg: 'var(--status-warn-bg)', color: 'var(--status-warn-fg)' },
  closed: { bg: 'var(--status-mute-bg)', color: 'var(--status-mute-fg)' },
};

export default function SupportPage() {
  const { publicKey, signMessage } = useWallet();
  const wallet = publicKey?.toString();

  const [view, setView] = useState('list'); // 'list' | 'new' | 'ticket'
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ subject: '', game_id: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (wallet) fetchTickets();
  }, [wallet]);


  // Fetch a single-use nonce and sign the canonical message (matches backend signedMessage.js).
  async function signWithNonce(purpose, payload) {
    const walletAddr = publicKey.toString();
    const nonceRes = await fetch(`${API_URL}/api/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddr, purpose }),
    });
    if (!nonceRes.ok) throw new Error('Failed to get signing nonce');
    const { nonce, exp } = await nonceRes.json();
    const DOMAIN = 'thecrazygame.fun';
    const payloadLines = Object.entries(payload).map(([k, v]) => `${k}: ${v}`).join('\n');
    const parts = [purpose, `Wallet: ${walletAddr}`];
    if (payloadLines) parts.push(payloadLines);
    parts.push(`Nonce: ${nonce}`, `Exp: ${exp}`, `Domain: ${DOMAIN}`);
    const message = parts.join('\n');
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = await signMessage(msgBytes);
    return { message, signature: bs58.encode(sigBytes) };
  }

  async function fetchTickets() {
    try {
      const res = await fetch(`${API_URL}/api/support/wallet/${wallet}`);
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function openTicket(ticket) {
    setLoading(true);
    try {
      const { message, signature } = await signWithNonce('support_read', { TicketId: String(ticket.id) });
      const res = await fetch(`${API_URL}/api/support/ticket/${ticket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, signature, message }),
      });
      const data = await res.json();
      setSelectedTicket(data.ticket);
      setReplies(data.replies || []);
      setView('ticket');
    } catch (e) {
      toast.error('Failed to load ticket');
    }
    setLoading(false);
  }

  async function submitTicket() {
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    setSubmitting(true);
    try {
      const { message: signedMessage, signature } = await signWithNonce('support_write', {
        Subject: form.subject,
        GameId: form.game_id || '',
        Message: form.message,
      });
      const res = await fetch(`${API_URL}/api/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, ...form, signature, signedMessage }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Ticket submitted!');
        setForm({ subject: '', game_id: '', message: '' });
        setView('list');
        fetchTickets();
      } else {
        toast.error(data.error || 'Failed to submit');
      }
    } catch (e) {
      toast.error('Failed to submit');
    }
    setSubmitting(false);
  }

  const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '16px',
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '10px 14px',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    outline: 'none',
    marginBottom: '12px',
  };

  const btnStyle = (variant = 'primary') => ({
    padding: '10px 20px',
    borderRadius: '4px',
    fontSize: '13px',
    letterSpacing: '0.08em',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    border: 'none',
    background: variant === 'primary' ? 'var(--accent)' : 'var(--bg-card-hover)',
    color: variant === 'primary' ? '#000' : 'var(--text-primary)',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
      <Navbar />
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: 'var(--accent)', letterSpacing: '0.05em' }}>
              SUPPORT
            </h1>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              Having an issue? Submit a ticket and we'll get back to you.
            </div>
          </div>
          {wallet && view === 'list' && (
            <button style={btnStyle()} onClick={() => setView('new')}>NEW TICKET</button>
          )}
          {view !== 'list' && (
            <button style={btnStyle('secondary')} onClick={() => setView('list')}>← BACK</button>
          )}
        </div>

        {!wallet && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '48px' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
              Connect your wallet to submit or view support tickets
            </div>
            <WalletMultiButton />
          </div>
        )}

        {wallet && view === 'list' && (
          <div>
            {tickets.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                No tickets yet. Click NEW TICKET if you need help.
              </div>
            ) : (
              tickets.map(t => (
                <div
                  key={t.id}
                  style={{ ...cardStyle, cursor: 'pointer' }}
                  onClick={() => openTicket(t)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{t.subject}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(t.created_at).toLocaleDateString()}
                        {t.game_id && <span style={{ marginLeft: '12px' }}>Game: {t.game_id.slice(0, 8)}...</span>}
                        {t.reply_count > 0 && <span style={{ marginLeft: '12px' }}>{t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}</span>}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '10px',
                      padding: '3px 8px',
                      borderRadius: '3px',
                      letterSpacing: '0.05em',
                      background: STATUS_COLOR[t.status]?.bg,
                      color: STATUS_COLOR[t.status]?.color,
                    }}>{t.status.toUpperCase()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {wallet && view === 'new' && (
          <div style={cardStyle}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', marginBottom: '20px', letterSpacing: '0.05em' }}>
              NEW TICKET
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.05em' }}>SUBJECT</div>
            <input
              style={inputStyle}
              placeholder="Brief description of your issue"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              maxLength={100}
            />
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.05em' }}>
              GAME ID <span style={{ color: 'var(--text-muted)' }}>(optional — paste game # or address if related to a specific game)</span>
            </div>
            <input
              style={inputStyle}
              placeholder="e.g. #0042 or full game address"
              value={form.game_id}
              onChange={e => setForm({ ...form, game_id: e.target.value })}
            />
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.05em' }}>MESSAGE</div>
            <textarea
              style={{ ...inputStyle, minHeight: '140px', resize: 'vertical' }}
              placeholder="Describe your issue in detail"
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              maxLength={2000}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{form.message.length}/2000</div>
              <button style={btnStyle()} onClick={submitTicket} disabled={submitting}>
                {submitting ? 'SUBMITTING...' : 'SUBMIT TICKET'}
              </button>
            </div>
          </div>
        )}

        {wallet && view === 'ticket' && selectedTicket && (
          <div>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '0.05em' }}>{selectedTicket.subject}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    #{selectedTicket.id} · {new Date(selectedTicket.created_at).toLocaleDateString()}
                    {selectedTicket.game_id && <span style={{ marginLeft: '12px' }}>Game: {selectedTicket.game_id}</span>}
                  </div>
                </div>
                <span style={{
                  fontSize: '10px',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  letterSpacing: '0.05em',
                  background: STATUS_COLOR[selectedTicket.status]?.bg,
                  color: STATUS_COLOR[selectedTicket.status]?.color,
                }}>{selectedTicket.status.toUpperCase()}</span>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '4px', fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                {selectedTicket.message}
              </div>
            </div>

            {replies.map(r => (
              <div key={r.id} style={{
                ...cardStyle,
                borderColor: r.author === 'admin' ? 'var(--accent)' : 'var(--border)',
                marginLeft: r.author === 'admin' ? '0' : '32px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: r.author === 'admin' ? 'var(--accent)' : 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                    {r.author === 'admin' ? 'SUPPORT' : 'YOU'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>{r.message}</div>
              </div>
            ))}

            {selectedTicket.status === 'closed' && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '16px' }}>
                This ticket is closed.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
