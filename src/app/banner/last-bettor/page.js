import Navbar from '@/components/Navbar';

export const metadata = { title: 'Banner preview', robots: { index: false } };

export default function BannerPreview() {
  const png = '/banner/last-bettor/opengraph-image';
  const gif = '/banner-last-bettor.gif';
  return (
    <>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 8vw, 64px)', marginBottom: '8px' }}>BANNER PREVIEW</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '14px' }}>
          300×180. Animated GIF (5 frames, ~5.6s loop) and static PNG side by side. Right-click → Save As to download.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px', marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '12px', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: '8px' }}>ANIMATED GIF (30KB)</h2>
            <div style={{ background: '#0a0a0f', padding: '32px', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gif} alt="Banner gif on dark" width={300} height={180} style={{ display: 'block' }} />
            </div>
            <div style={{ background: '#f0f0f8', padding: '32px', display: 'flex', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gif} alt="Banner gif on light" width={300} height={180} style={{ display: 'block' }} />
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: '12px', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px' }}>STATIC PNG (fallback)</h2>
            <div style={{ background: '#0a0a0f', padding: '32px', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={png} alt="Banner png on dark" width={300} height={180} style={{ display: 'block' }} />
            </div>
            <div style={{ background: '#f0f0f8', padding: '32px', display: 'flex', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={png} alt="Banner png on light" width={300} height={180} style={{ display: 'block' }} />
            </div>
          </div>
        </div>

        <div style={{ padding: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          <div style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', marginBottom: '8px', letterSpacing: '0.05em' }}>FRAMES</div>
          1. ONE PLAYER WINS THE POT (3.5s — hook + static fallback)<br/>
          2. 03 SECONDS LEFT (1s)<br/>
          3. 02 SECONDS LEFT (1s)<br/>
          4. 01 SECONDS LEFT (1s)<br/>
          5. WINNER TAKES ALL (3.5s)<br/>
          URL footer (thecrazygame.fun) on every frame. Total: 10s, loops infinitely.
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '16px' }}>
          GIF direct URL: <a href={gif} style={{ color: 'var(--accent)' }}>{gif}</a><br/>
          PNG direct URL: <a href={png} style={{ color: 'var(--accent)' }}>{png}</a><br/>
          Regenerate after design changes: <code style={{ background: 'var(--bg)', padding: '2px 6px' }}>node scripts/build-banner-gif.cjs</code>
        </p>
      </main>
    </>
  );
}
