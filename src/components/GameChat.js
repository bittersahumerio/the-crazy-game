'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://thecrazygame.fun';
const DOMAIN = 'thecrazygame.fun';
const MAX_LEN = 200;

const shortAddr = (w) => (w ? `${w.slice(0, 4)}…${w.slice(-4)}` : '');
const fmtTime = (t) => { try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

export default function GameChat({ gameId }) {
  const { publicKey, signMessage, connected } = useWallet();
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [token, setToken] = useState(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false); // set if backend says "not a participant"
  const [isMod, setIsMod] = useState(false);
  const listRef = useRef(null);
  const lastTsRef = useRef(0);

  const wallet = publicKey ? publicKey.toString() : null;
  const tokenKey = wallet ? `chat_token_${gameId}_${wallet}` : null;

  useEffect(() => {
    setBlocked(false);
    if (!tokenKey) { setToken(null); setIsMod(false); return; }
    try {
      const raw = localStorage.getItem(tokenKey);
      if (raw) { const s = JSON.parse(raw); setToken(s.t || null); setIsMod(!!s.m); }
      else { setToken(null); setIsMod(false); }
    } catch { setToken(null); setIsMod(false); }
  }, [tokenKey]);

  const fetchMessages = useCallback(async () => {
    try {
      const url = `${API_URL}/api/games/${gameId}/chat${lastTsRef.current ? `?since=${lastTsRef.current}` : ''}`;
      const r = await fetch(url);
      if (!r.ok) return;
      const d = await r.json();
      if (!d.messages || !d.messages.length) return;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = d.messages.filter((m) => !seen.has(m.id));
        if (!fresh.length) return prev;
        const all = [...prev, ...fresh];
        lastTsRef.current = new Date(all[all.length - 1].created_at).getTime();
        return all;
      });
    } catch { /* ignore transient */ }
  }, [gameId]);

  useEffect(() => {
    fetchMessages();
    const iv = setInterval(fetchMessages, 3000);
    return () => clearInterval(iv);
  }, [fetchMessages]);

  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages]);

  // Sign once → session token. Returns token string or null.
  async function ensureToken() {
    if (token) return token;
    if (!connected || !publicKey || !signMessage) { toast.error('Connect your wallet'); return null; }
    const nr = await fetch(`${API_URL}/api/auth/nonce`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, purpose: 'game_chat' }),
    });
    const nd = await nr.json();
    if (!nr.ok) throw new Error(nd.error || 'Could not start chat');
    const msg = ['game_chat', `Wallet: ${wallet}`, `Game: ${gameId}`, `Nonce: ${nd.nonce}`, `Exp: ${nd.exp}`, `Domain: ${DOMAIN}`].join('\n');
    const sig = await signMessage(new TextEncoder().encode(msg));
    const sr = await fetch(`${API_URL}/api/games/${gameId}/chat/session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, signature: bs58.encode(sig), message: msg }),
    });
    const sd = await sr.json();
    if (sr.status === 403) { setBlocked(true); throw new Error(sd.error || 'Only players who bet in this game can chat'); }
    if (!sr.ok) throw new Error(sd.error || 'Could not join chat');
    setToken(sd.token);
    setIsMod(!!sd.isModerator);
    try { localStorage.setItem(tokenKey, JSON.stringify({ t: sd.token, m: !!sd.isModerator })); } catch { /* */ }
    return sd.token;
  }

  async function deleteMessage(id) {
    if (!token) return;
    try {
      const r = await fetch(`${API_URL}/api/games/${gameId}/chat/${id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Delete failed'); }
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e) { toast.error(e.message || 'Could not delete'); }
  }

  async function send() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const t = await ensureToken();
      if (!t) return;
      const r = await fetch(`${API_URL}/api/games/${gameId}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t, body: text }),
      });
      const d = await r.json();
      if (r.status === 401) { setToken(null); try { localStorage.removeItem(tokenKey); } catch {} ; toast.error('Session expired — send again to re-join'); return; }
      if (r.status === 403) { setBlocked(true); toast.error(d.error || 'Only players can chat'); return; }
      if (!r.ok) throw new Error(d.error || 'Could not send');
      setBody('');
      setMessages((prev) => { const all = [...prev, d.message]; lastTsRef.current = new Date(d.message.created_at).getTime(); return all; });
    } catch (e) { toast.error(e.message || 'Could not send'); }
    finally { setBusy(false); }
  }

  const card = { border: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: 8, display: 'flex', flexDirection: 'column' };

  return (
    <div style={card}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
        💬 GAME CHAT <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', letterSpacing: 0 }}>· players only</span>
      </div>

      <div ref={listRef} style={{ maxHeight: 320, minHeight: 120, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No messages yet. Be the first.</div>
        ) : messages.map((m) => (
          <div key={m.id} style={{ fontSize: 13, lineHeight: 1.45 }}>
            <span style={{ color: m.wallet === wallet ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 600 }}>
              {m.username ? `@${m.username}` : shortAddr(m.wallet)}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>{fmtTime(m.created_at)}</span>
            {isMod && (
              <button onClick={() => deleteMessage(m.id)} title="Delete message (mod)"
                style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
            )}
            <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{m.body}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
        {!connected ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>Connect your wallet to chat.</div>
        ) : blocked ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>Only players who bet in this game can chat.</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={body}
              maxLength={MAX_LEN}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={token ? 'Say something…' : 'Sign once to join, then chat…'}
              rows={1}
              style={{ flex: 1, resize: 'none', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: 13, maxHeight: 80 }}
            />
            <button
              onClick={send}
              disabled={busy || !body.trim()}
              style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 6, padding: '9px 16px', fontWeight: 700, cursor: busy || !body.trim() ? 'default' : 'pointer', opacity: busy || !body.trim() ? 0.5 : 1, fontFamily: 'var(--font-body)', fontSize: 13 }}
            >
              {busy ? '…' : 'Send'}
            </button>
          </div>
        )}
        <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{body.length}/{MAX_LEN}</div>
      </div>
    </div>
  );
}
