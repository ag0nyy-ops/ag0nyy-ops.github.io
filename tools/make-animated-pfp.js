// node tools/make-animated-pfp.js — the eye avatar, animated, built for tiny sizes
//   assets/banners/avatar-animated.gif   512x512, 3.2 s seamless loop, 30 fps (Discord, X, anywhere that takes GIFs)
//   assets/banners/avatar-animated.webp  same loop, smaller file
// A bold, simple eye (no ring text, grain or fine lines, which turn to mush at avatar size).
// Everything moves on damped springs, so it overshoots and settles: the eye hops and glances
// left, right and back (the pupil swells when it looks right), then blinks, and the lid
// snaps shut fast and pops back open past its normal height before settling.
// The springs wrap around the loop point, so the last move settles into the first frame.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const R = path.resolve(__dirname, '..') + '/';
const OUT = R + 'assets/banners/';
const FRAMES_DIR = fs.mkdtempSync(require('os').tmpdir() + '/pfp-');
const SIZE = 512, FPS = 30, T = 3.2, N = Math.round(FPS * T);
const FG = '#f2f2f2', BG = '#060606';

function svg() {
  let lashes = '';
  for (let i = 0; i < 5; i++) lashes += `<line class="lash" stroke="${FG}" stroke-width="15" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-256 -256 512 512" width="${SIZE}" height="${SIZE}">
  <defs>
    <radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity=".09"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <clipPath id="inside"><path id="clip"/></clipPath>
  </defs>
  <rect x="-256" y="-256" width="512" height="512" fill="${BG}"/>
  <rect x="-256" y="-256" width="512" height="512" fill="url(#glow)"/>
  <g id="eye">
    <path id="fill" fill="${BG}"/>
    <g clip-path="url(#inside)"><g id="iris">
      <circle r="96" fill="${BG}" stroke="${FG}" stroke-width="12"/>
      <g id="pupil"><circle r="50" fill="${FG}"/><circle cx="-17" cy="-17" r="12" fill="${BG}"/></g>
    </g></g>
    <path id="lens" fill="none" stroke="${FG}" stroke-width="16" stroke-linejoin="round"/>
    ${lashes}
  </g>
</svg>`;
}

// runs in the page: every moving part at time t (seconds) of the loop
function setFrame(t, T) {
  // underdamped spring step response: 0 before the event, then rises past 1 and settles on 1
  const step = (tau, w, z) => {
    if (tau <= 0) return 0;
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
  };
  // sum of deltas, each a spring step at its own time; repeated one loop back so it's seamless
  const track = (events) => events.reduce((sum, [ti, delta, w = 26, z = 0.38]) =>
    sum + delta * (step(t - ti, w, z) + step(t - ti + T, w, z)), 0);

  const gx = track([[0.35, -64], [1.15, 128], [1.95, -64]]);
  const gy = track([[0.35, 10], [1.15, -20], [1.95, 10]]);
  const hop = track([[0.35, -20, 30, 0.35], [0.47, 20, 30, 0.35], [1.15, -26, 30, 0.35], [1.27, 26, 30, 0.35],
    [1.95, -18, 30, 0.35], [2.07, 18, 30, 0.35]]);
  const pupil = 1 + track([[1.15, 0.3, 24, 0.4], [1.95, -0.3, 24, 0.4]]);
  // blink: slam shut, then spring open with a big overshoot (o > 1 stretches the eye taller)
  let o = 1 + track([[2.45, -1, 55, 0.9], [2.56, 1, 24, 0.3]]);
  o = Math.max(0, o);

  const half = 232, apex = 270 * o;     // lens half-width, control height (the visible apex is half of it)
  const d = `M${-half} 0 Q0 ${(-apex).toFixed(1)} ${half} 0 Q0 ${apex.toFixed(1)} ${-half} 0Z`;
  for (const id of ['lens', 'fill', 'clip']) document.getElementById(id).setAttribute('d', d);
  const squash = 1 + (o - 1) * 0.1;   // the whole eye stretches / flattens a touch with the lid
  document.getElementById('eye').setAttribute('transform', `translate(0 ${(hop + 14).toFixed(1)}) scale(${(0.88 / Math.sqrt(squash)).toFixed(3)} ${(0.88 * squash).toFixed(3)})`);
  document.getElementById('iris').setAttribute('transform', `translate(${gx.toFixed(1)} ${gy.toFixed(1)})`);
  document.getElementById('pupil').setAttribute('transform', `scale(${pupil.toFixed(3)})`);

  // lashes sit on the top lid, follow it down when it closes, and fan out along its curve
  const lashes = document.querySelectorAll('.lash');
  const xs = [-132, -66, 0, 66, 132];
  lashes.forEach((el, i) => {
    const x = xs[i], u = (x + half) / (2 * half);
    const y = -(2 * u * (1 - u) * apex);                   // lens top edge at x
    const slope = (-(2 * apex)) * (1 - 2 * u) / (2 * half) * -1;
    const len = Math.hypot(1, slope), nx = slope / len, ny = -1 / len;   // unit normal pointing up/out
    const r0 = 24, r1 = i === 2 ? 76 : 62;
    el.setAttribute('x1', (x + nx * r0).toFixed(1)); el.setAttribute('y1', (y + ny * r0).toFixed(1));
    el.setAttribute('x2', (x + nx * r1).toFixed(1)); el.setAttribute('y2', (y + ny * r1).toFixed(1));
    el.style.opacity = Math.min(1, o * 1.6).toFixed(2);     // they tuck away as the lid shuts
  });
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: SIZE, height: SIZE } });
  await page.setContent(`<html><body style="margin:0;background:#060606">${svg()}</body></html>`);
  await page.addScriptTag({ content: setFrame.toString() });
  for (let f = 0; f < N; f++) {
    await page.evaluate(([t, T]) => setFrame(t, T), [f / FPS, T]);
    await page.screenshot({ path: `${FRAMES_DIR}/f${String(f).padStart(4, '0')}.png` });
  }
  await br.close();
  // frames -> GIF (one shared palette so nothing flickers) and animated WebP, with Pillow
  execFileSync('python3', ['-I', '-c', `
import sys, glob
from PIL import Image
frames = [Image.open(p).convert('RGB') for p in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
pal = frames[0].quantize(colors=48, method=Image.Quantize.MEDIANCUT)
q = [fr.quantize(palette=pal, dither=Image.Dither.NONE) for fr in frames]
q[0].save(sys.argv[2] + 'avatar-animated.gif', save_all=True, append_images=q[1:], duration=int(round(1000/${FPS})), loop=0, optimize=True, disposal=1)
frames[0].save(sys.argv[2] + 'avatar-animated.webp', save_all=True, append_images=frames[1:], duration=int(round(1000/${FPS})), loop=0, quality=85, method=6)
`, FRAMES_DIR, OUT]);
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  for (const f of ['avatar-animated.gif', 'avatar-animated.webp']) console.log(f, (fs.statSync(OUT + f).size / 1024).toFixed(0) + ' KB');
})();
