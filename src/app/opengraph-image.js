import { ImageResponse } from 'next/og';
import fs from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const alt = 'The Crazy Game — last bettor wins on Solana';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function loadFont(filename) {
  return fs.readFile(path.join(process.cwd(), 'public', 'fonts', filename));
}

export default async function Image() {
  const bebas = await loadFont('BebasNeue-Regular.ttf');

  const ACCENT = '#00ff88';
  const BG = '#0a0a0a';
  const WHITE = '#ffffff';
  const DIM = '#aaaaaa';

  const pillStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 28px',
    border: `2px solid ${ACCENT}`,
    borderRadius: 999,
    fontSize: 26,
    color: WHITE,
    letterSpacing: '0.12em',
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: BG,
          display: 'flex',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ width: 12, height: '100%', background: ACCENT }} />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '70px 80px 70px 80px',
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: ACCENT,
              letterSpacing: '0.3em',
              display: 'flex',
            }}
          >
            THECRAZYGAME.FUN
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontFamily: 'Bebas',
                fontSize: 180,
                color: WHITE,
                lineHeight: 0.95,
                letterSpacing: '0.005em',
                display: 'flex',
              }}
            >
              THE CRAZY GAME
            </div>
            <div
              style={{
                fontSize: 36,
                color: DIM,
                marginTop: 24,
                display: 'flex',
              }}
            >
              The wildest betting game on Solana
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <div style={pillStyle}>LAST BETTOR WINS</div>
            <div style={pillStyle}>INSTANT PAYOUTS</div>
            <div style={pillStyle}>SOLANA</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Bebas', data: bebas, style: 'normal', weight: 400 },
      ],
    }
  );
}
