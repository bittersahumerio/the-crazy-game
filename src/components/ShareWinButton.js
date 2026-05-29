'use client';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://thecrazygame.fun';

/**
 * Renders a SHARE ON X button that opens Twitter intent with pre-filled text.
 * The text contains the canonical /win/<gameNumber> URL with the winner's
 * referral code, so the OG card auto-previews on Twitter and the link is
 * attribution-traceable.
 */
export default function ShareWinButton({ gameNumber, gameName, refCode, jackpotAmount, pnlPercent, size = 'md' }) {
  const winUrl = SITE_URL + '/win/' + gameNumber + (refCode ? '?ref=' + refCode : '');
  const NL = String.fromCharCode(10) + String.fromCharCode(10);
  const gn = gameName || ('game #' + String(gameNumber).padStart(4, '0'));
  const text = 'Won ' + gn + ' on The Crazy Game.' + NL + winUrl;
  const tweetUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);

  const padding = size === 'sm' ? '8px 14px' : '14px 28px';
  const fontSize = size === 'sm' ? '11px' : '13px';
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <a
      href={tweetUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        background: '#000',
        color: '#fff',
        border: '1px solid var(--text-muted)',
        padding,
        textDecoration: 'none',
        fontWeight: '700',
        fontSize,
        letterSpacing: '0.08em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#000'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.622 5.905-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
      SHARE ON X
    </a>
  );
}
