// node tools/make-animated-pfp.js — the eye avatar, animated
//   assets/banners/avatar-animated.gif   512x512, 6 s seamless loop, 25 fps (Discord, X, anywhere that takes GIFs)
//   assets/banners/avatar-animated.webp  same loop, smaller file
// The same drawing as avatar.png (make-banners.js): ring text + ticks, the two faint triangles,
// the lens eye. It looks around, blinks once, the pupil widens when it looks back at you,
// and the ring turns half a turn per loop (the ring text repeats twice, so the loop is seamless).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const R = path.resolve(__dirname, '..') + '/';
const OUT = R + 'assets/banners/';
const FRAMES_DIR = fs.mkdtempSync(require('os').tmpdir() + '/pfp-');
const SIZE = 512, FPS = 25, SECONDS = 6, N = FPS * SECONDS;

const b64 = (f) => fs.readFileSync(R + f).toString('base64');
const FG = '#ececec', MUTED = '#b4b4b4', LINE = '#3a3a3a', BG = '#060606';
const f1 = (n) => n.toFixed(1);

function svg() {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-512 -512 1024 1024" width="${SIZE}" height="${SIZE}">
  <style>@font-face{font-family:'IBM Plex Mono';font-weight:600;src:url(data:font/woff2;base64,${b64('assets/fonts/ibm-plex-mono-600-latin.woff2')}) format('woff2')}</style>
  <defs>
    <pattern id="grain" width="160" height="160" patternUnits="userSpaceOnUse" x="-512" y="-512"><image href="data:image/png;base64,${b64('assets/img/grain.png')}" width="160" height="160"/></pattern>
    <radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="vig" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
    <linearGradient id="lid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${FG}"/><stop offset="1" stop-color="#7a7a7a"/></linearGradient>
    <clipPath id="inside"><path id="clip-lens"/></clipPath>
  </defs>
  <rect x="-512" y="-512" width="1024" height="1024" fill="${BG}"/>
  <rect x="-512" y="-512" width="1024" height="1024" fill="url(#glow)"/>
  <g transform="scale(.96)">
    <g fill="none" stroke="${LINE}" stroke-width="3" opacity=".8"><path d="M0 -440 L381 220 L-381 220Z"/><path d="M0 440 L381 -220 L-381 -220Z"/></g>
    <circle r="495" fill="none" stroke="${LINE}" stroke-width="3"/>
    <g id="spin">
      <path id="ring" d="M0 0 m-430 0 a430 430 0 1 1 860 0 a430 430 0 1 1 -860 0" fill="none"/>
      <text font-family="IBM Plex Mono" font-weight="600" font-size="46" fill="${MUTED}"><textPath href="#ring" textLength="2650" lengthAdjust="spacing">SEES EVERYTHING · SHIPS REAL THINGS · SEES EVERYTHING · SHIPS REAL THINGS ·</textPath></text>
      <g stroke="${LINE}" stroke-width="3">`;
  for (let i = 0; i < 72; i++) {
    const a = i * 5 * Math.PI / 180, r1 = i % 6 ? 360 : 345, r2 = 380;
    s += `<line x1="${f1(Math.cos(a) * r1)}" y1="${f1(Math.sin(a) * r1)}" x2="${f1(Math.cos(a) * r2)}" y2="${f1(Math.sin(a) * r2)}"/>`;
  }
  s += `</g></g>
    <path id="lens-fill" fill="${BG}"/>
    <g clip-path="url(#inside)"><g id="iris">
      <circle r="104" fill="${BG}" stroke="${FG}" stroke-width="8"/>
      <g stroke="${FG}" stroke-width="2.4" opacity=".75">`;
  for (let i = 0; i < 96; i++) {
    const a = i * 3.75 * Math.PI / 180;
    s += `<line x1="${f1(Math.cos(a) * 76)}" y1="${f1(Math.sin(a) * 76)}" x2="${f1(Math.cos(a) * 97)}" y2="${f1(Math.sin(a) * 97)}"/>`;
  }
  s += `</g>
      <circle r="72" fill="${BG}" stroke="${FG}" stroke-width="5"/>
      <g id="pupil"><circle r="52" fill="${FG}"/><circle cx="-17" cy="-15" r="10" fill="${BG}"/></g>
    </g></g>
    <path id="lens" fill="none" stroke="url(#lid)" stroke-width="12" stroke-linejoin="round"/>
    <g id="lashes"><g stroke="${FG}" stroke-width="7" stroke-linecap="round" transform="translate(0 145)">`;
  for (const k of [-3, -2, -1, 0, 1, 2, 3]) {
    const a = (-90 + k * 13) * Math.PI / 180, r1 = 205, r2 = k === 0 ? 265 : 255 - Math.abs(k) * 6;
    s += `<line x1="${f1(Math.cos(a) * r1)}" y1="${f1(Math.sin(a) * r1 + 60)}" x2="${f1(Math.cos(a) * r2)}" y2="${f1(Math.sin(a) * r2 + 60)}"/>`;
  }
  s += `</g></g>
  </g>
  <rect x="-512" y="-512" width="1024" height="1024" fill="url(#grain)"/>
  <rect x="-512" y="-512" width="1024" height="1024" fill="url(#vig)"/>
</svg>`;
  return s;
}

// runs in the page: sets every moving part for time t (seconds) in the loop
function setFrame(t, T) {
  const ease = (x) => x * x * (3 - 2 * x);
  const lerp = (a, b, k) => a + (b - a) * k;
  // [time, x, y, pupil scale] keyframes for where it looks
  const gaze = [[0, 0, 0, 1], [0.6, 0, 0, 1], [1.1, -112, 12, 1], [2.0, -112, 12, 1], [2.6, 104, -22, 1],
    [3.4, 104, -22, 1], [4.0, 0, 0, 1.18], [5.0, 0, 0, 1.18], [5.6, 0, 0, 1], [T, 0, 0, 1]];
  let i = 0; while (i < gaze.length - 2 && t >= gaze[i + 1][0]) i++;
  const [ta, xa, ya, sa] = gaze[i], [tb, xb, yb, sb] = gaze[i + 1];
  const k = ease(Math.min(1, Math.max(0, (t - ta) / (tb - ta))));
  const gx = lerp(xa, xb, k), gy = lerp(ya, yb, k), ps = lerp(sa, sb, k);
  // one blink, mid-glance: close fast, hold a beat, open a little slower
  const b0 = 3.55, close = 0.09, hold = 0.06, open = 0.16;
  let o = 1;
  if (t >= b0 && t < b0 + close) o = 1 - ease((t - b0) / close);
  else if (t >= b0 + close && t < b0 + close + hold) o = 0;
  else if (t >= b0 + close + hold && t < b0 + close + hold + open) o = ease((t - b0 - close - hold) / open);
  const top = lerp(60, -290, o), bottom = lerp(60, 290, o);   // closed = a lid curving down
  const d = `M-300 0 Q0 ${top.toFixed(1)} 300 0 Q0 ${bottom.toFixed(1)} -300 0Z`;
  for (const id of ['lens', 'lens-fill', 'clip-lens']) document.getElementById(id).setAttribute('d', d);
  document.getElementById('iris').setAttribute('transform', `translate(${gx.toFixed(1)} ${gy.toFixed(1)})`);
  document.getElementById('pupil').setAttribute('transform', `scale(${ps.toFixed(3)})`);
  // lashes ride the top lid and flip to hang down when the eye is shut
  document.getElementById('lashes').setAttribute('transform', `translate(0 ${(top / 2).toFixed(1)}) scale(1 ${lerp(-0.7, 1, o).toFixed(3)})`);
  document.getElementById('spin').setAttribute('transform', `rotate(${(t / T * 180).toFixed(2)})`);
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: SIZE, height: SIZE } });
  await page.setContent(`<html><body style="margin:0;background:#060606">${svg()}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ content: setFrame.toString() });
  for (let f = 0; f < N; f++) {
    await page.evaluate(([t, T]) => setFrame(t, T), [f / FPS, SECONDS]);
    await page.screenshot({ path: `${FRAMES_DIR}/f${String(f).padStart(4, '0')}.png` });
  }
  await br.close();
  // frames -> GIF (one shared grey palette, so nothing flickers) and animated WebP, with Pillow
  execFileSync('python3', ['-I', '-c', `
import sys, glob
from PIL import Image
frames = [Image.open(p).convert('RGB') for p in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
pal = frames[0].quantize(colors=96, method=Image.Quantize.MEDIANCUT)
q = [fr.quantize(palette=pal, dither=Image.Dither.NONE) for fr in frames]
q[0].save(sys.argv[2] + 'avatar-animated.gif', save_all=True, append_images=q[1:], duration=int(1000/${FPS}), loop=0, optimize=True, disposal=1)
frames[0].save(sys.argv[2] + 'avatar-animated.webp', save_all=True, append_images=frames[1:], duration=int(1000/${FPS}), loop=0, quality=82, method=6)
`, FRAMES_DIR, OUT]);
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  for (const f of ['avatar-animated.gif', 'avatar-animated.webp']) console.log(f, (fs.statSync(OUT + f).size / 1024).toFixed(0) + ' KB');
})();
