// Fetch a nonce from the backend, build a canonical signed-message envelope,
// and sign it with the connected wallet. The envelope is returned for the
// caller to spread into a POST body alongside any other fields it needs.
//
// Canonical message format matches backend/src/signedMessage.js. Do not change
// one without the other.
import bs58 from 'bs58';

const DOMAIN = 'thecrazygame.fun';

export async function buildSignedEnvelope({ apiUrl, publicKey, signMessage, purpose, payload = {} }) {
  if (!publicKey || typeof signMessage !== 'function') {
    throw new Error('Wallet not connected');
  }
  const wallet = publicKey.toString();

  const nonceRes = await fetch(`${apiUrl}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, purpose }),
  });
  if (!nonceRes.ok) {
    const err = await nonceRes.json().catch(() => ({}));
    throw new Error(err.error || 'Could not obtain nonce');
  }
  const { nonce, exp } = await nonceRes.json();

  const payloadLines = Object.entries(payload).map(([k, v]) => `${k}: ${v}`).join('\n');
  const parts = [purpose, `Wallet: ${wallet}`];
  if (payloadLines) parts.push(payloadLines);
  parts.push(`Nonce: ${nonce}`, `Exp: ${exp}`, `Domain: ${DOMAIN}`);
  const message = parts.join('\n');

  const sigBytes = await signMessage(new TextEncoder().encode(message));
  const signature = bs58.encode(sigBytes);

  return { wallet, signature, message };
}
