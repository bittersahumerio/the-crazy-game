import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'The Crazy Game';
export const size = { width: 300, height: 180 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
        padding: 14,
        boxSizing: 'border-box',
        fontFamily: 'sans-serif',
      }}>
        {/* Inner border frame for visibility on dark themes */}
        <div style={{
          position: 'absolute', inset: 6,
          border: '2px solid #00ff88',
          borderRadius: 2,
          display: 'flex',
          boxShadow: 'inset 0 0 24px rgba(0,255,136,0.18)',
        }} />

        {/* Brand top */}
        <div style={{
          fontSize: 12,
          color: '#00ff88',
          letterSpacing: 4,
          fontWeight: 700,
          marginBottom: 4,
          marginTop: 4,
          zIndex: 1,
          display: 'flex',
        }}>
          THE CRAZY GAME
        </div>

        {/* Main hook centered in remaining space */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}>
          <div style={{
            fontSize: 36,
            color: '#ffffff',
            letterSpacing: 2,
            fontWeight: 800,
            lineHeight: 1,
            display: 'flex',
          }}>
            LAST ONE
          </div>
          <div style={{
            fontSize: 36,
            color: '#00ff88',
            letterSpacing: 2,
            fontWeight: 800,
            lineHeight: 1,
            marginTop: 4,
            display: 'flex',
          }}>
            WINS.
          </div>
        </div>

        {/* Sub-tagline bottom */}
        <div style={{
          fontSize: 10,
          color: '#888',
          letterSpacing: 2,
          marginBottom: 4,
          zIndex: 1,
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          thecrazygame.fun
        </div>
      </div>
    ),
    { ...size }
  );
}
