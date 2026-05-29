// Generate the BTG promo banner as an animated GIF.
// Run: node scripts/build-banner-gif.cjs
// Output: public/banner-last-bettor.gif

const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const GIFEncoder = require('gif-encoder-2');
const fs = require('fs');
const path = require('path');

const W = 300, H = 180;
const BG = '#0a0a0a';
const ACCENT = '#00ff88';
const WHITE = '#ffffff';
const MUTED = '#888888';

function paintBackground(ctx) {
  // Fill bg
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Accent border (2px inset 6px from edge)
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.strokeRect(7, 7, W - 14, H - 14);

  // Inner accent glow (faint)
  ctx.save();
  ctx.shadowColor = 'rgba(0,255,136,0.4)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(0,255,136,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(9, 9, W - 18, H - 18);
  ctx.restore();
}

function paintBrand(ctx) {
  ctx.fillStyle = ACCENT;
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // letter-spaced manually for emphasis
  ctx.fillText('T H E   C R A Z Y   G A M E', W / 2, 18);
}

function paintFooter(ctx, text = 'thecrazygame.fun') {
  ctx.fillStyle = MUTED;
  ctx.font = '9px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, W / 2, H - 16);
}

// Frame 1 — hook
function drawHook() {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  paintBackground(ctx);
  paintBrand(ctx);

  ctx.fillStyle = WHITE;
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ONE PLAYER', W / 2, H / 2 - 8);

  ctx.fillStyle = ACCENT;
  ctx.fillText('WINS THE POT', W / 2, H / 2 + 22);

  paintFooter(ctx);   // URL footer
  return c;
}

// Frames 2-4 — countdown
function drawCountdown(n) {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  paintBackground(ctx);
  paintBrand(ctx);

  // Big countdown number
  ctx.fillStyle = ACCENT;
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('0' + n, W / 2, H / 2 + 6);

  // Sub-label
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.fillText('SECONDS LEFT', W / 2, H / 2 + 42);

  paintFooter(ctx);  // URL footer
  return c;
}

// Frame 5 — payoff
function drawPayoff() {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  paintBackground(ctx);
  paintBrand(ctx);

  ctx.fillStyle = WHITE;
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WINNER', W / 2, H / 2 - 6);

  ctx.fillStyle = ACCENT;
  ctx.fillText('TAKES ALL', W / 2, H / 2 + 24);

  paintFooter(ctx);  // URL footer
  return c;
}

// Build the GIF
const encoder = new GIFEncoder(W, H, 'neuquant', true);
encoder.setRepeat(0);          // loop forever
encoder.setQuality(8);          // 1 (best) - 20
encoder.start();

const frames = [
  { delay: 3500, canvas: drawHook() },
  { delay: 1000, canvas: drawCountdown(3) },
  { delay: 1000, canvas: drawCountdown(2) },
  { delay: 1000, canvas: drawCountdown(1) },
  { delay: 3500, canvas: drawPayoff() },
];

for (const f of frames) {
  encoder.setDelay(f.delay);
  encoder.addFrame(f.canvas.getContext('2d'));
}
encoder.finish();

const out = path.join(__dirname, '..', 'public', 'banner-last-bettor.gif');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, encoder.out.getData());

const size = fs.statSync(out).size;
console.log('Wrote', out, 'size:', (size / 1024).toFixed(1) + 'KB');
if (size > 2 * 1024 * 1024) {
  console.warn('WARNING: GIF exceeds 2MB cap. Consider lower quality or fewer frames.');
}
