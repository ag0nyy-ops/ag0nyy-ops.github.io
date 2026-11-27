/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Bucket: half-court arcade basketball. This file draws the court, reads the controller or
   keyboard, plays the sounds and runs the menus. The rules live in sim.js. */

import { Input } from '../shared/input.js';
import { loadSettings, palette, reducedMotion } from '../shared/settings.js';
import * as look from '../shared/look.js';
import { COURT, CPU, SHOTS, createMatch, step, cpuIntent, blankIntent, handler, handOdds } from './sim.js';

const SAVE = 'jay.bucket.v1';
const { RIM } = COURT;
const input = new Input({
  UP: ['KeyW'], DOWN: ['KeyS'], LEFT: ['KeyA'], RIGHT: ['KeyD'],
  A: ['Enter'], B: ['Escape', 'Backspace'], START: ['KeyP'],
  X: ['Space'], RB: ['KeyE'], LB: ['KeyQ'],
  hUp: ['ArrowUp', 'KeyI'], hDown: ['ArrowDown', 'KeyK'], hLeft: ['ArrowLeft', 'KeyJ'], hRight: ['ArrowRight', 'KeyL']
});

/* ---------------- save data (this browser only) ---------------- */
function load() {
  let d = {}; try { d = JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) {}
  return { opts: { size: 1, cpu: 'pro', to: 11, ...(d.opts || {}) }, record: { ...(d.record || {}) }, best: { ...(d.best || {}) } };
}
const data = load();
const persist = () => { try { localStorage.setItem(SAVE, JSON.stringify(data)); } catch (e) {} };
const recKey = (o) => `${o.size}v${o.size}-${o.cpu}`;

/* ---------------- sound: tiny synth, no files ---------------- */
let ac = null;
function audio() {
  if (!ac) { try { ac = new AudioContext(); } catch (e) { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(freq, len = 0.08, type = 'square', vol = 0.2, slide = 0) {
  const a = audio(); const v = loadSettings().volume * vol; if (!a || v <= 0) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + len);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(a.destination); o.start(); o.stop(t + len);
}
function noise(len = 0.2, vol = 0.3, hp = 1800) {
  const a = audio(); const v = loadSettings().volume * vol; if (!a || v <= 0) return;
  const n = (a.sampleRate * len) | 0, buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = v;
  s.connect(f).connect(g).connect(a.destination); s.start();
}
const SFX = {
  dribble: () => tone(90, 0.07, 'sine', 0.35, -40),
  bounce: () => tone(110, 0.08, 'sine', 0.3, -50),
  swish: () => noise(0.32, 0.35, 2600),
  rim: () => { tone(420, 0.18, 'triangle', 0.22); tone(640, 0.12, 'triangle', 0.12); },
  release: () => noise(0.06, 0.15, 900),
  buzzer: () => tone(140, 0.6, 'sawtooth', 0.14),
  steal: () => tone(300, 0.1, 'square', 0.12, 200),
  block: () => tone(200, 0.16, 'square', 0.16, -120),
  ankles: () => tone(70, 0.2, 'sine', 0.4, -30),
  move: () => tone(150, 0.04, 'sine', 0.2),
  check: () => tone(520, 0.06, 'square', 0.08),
  win: () => { tone(392, 0.15, 'triangle', 0.2); setTimeout(() => tone(523, 0.3, 'triangle', 0.2), 150); }
};

/* ---------------- screens (DOM overlay, driven by controller or keyboard) ---------------- */
const $ = (sel) => document.querySelector(sel);
const overlay = $('#overlay');
const backLink = $('.back');
let menuItems = [], menuIndex = 0;
function show(html) {
  overlay.innerHTML = `<div class="panel">${html}</div>`; overlay.hidden = false; if (backLink) backLink.hidden = false;
  menuItems = [...overlay.querySelectorAll('button')]; menuIndex = 0;
  if (menuItems[0]) menuItems[0].focus();
  menuItems.forEach((b, i) => b.addEventListener('focus', () => { menuIndex = i; }));
}
function hide() { overlay.hidden = true; overlay.innerHTML = ''; menuItems = []; if (backLink) backLink.hidden = true; }
overlay.addEventListener('click', (e) => { const b = e.target.closest('button[data-go]'); if (b) go(b.dataset.go, b.dataset.arg); });

let mode = 'menu';          // menu | play | paused | over
let match = null, me = 0;
const OPTS = {
  size: { label: 'Mode', vals: [1, 2, 3], show: (v) => `${v} on ${v}` },
  cpu: { label: 'CPU', vals: Object.keys(CPU), show: (v) => CPU[v].name },
  to: { label: 'Game to', vals: [11, 15, 21], show: (v) => String(v) }
};

function mainMenu() {
  mode = 'menu'; match = null;
  const rec = Object.entries(data.record).filter(([, r]) => r.w + r.l > 0)
    .map(([k, r]) => `<li><b>${k.replace('-', ' vs ')}:</b> ${r.w} won, ${r.l} lost</li>`).join('');
  show(`<p class="label">Game file / Basketball / half court</p><h1 class="title">Bucket</h1>
    <p class="hint">Street rules, half court. Aim the shot with both sticks. No meter, no green line.</p>
    <div class="menu"><button class="btn btn--solid" data-go="setup">Play</button>
    <button class="btn" data-go="practice">Shoot around <small>no defense</small></button>
    <button class="btn" data-go="shooting">How shooting works</button>
    <button class="btn" data-go="controls">Controls</button></div>
    ${rec ? `<h2 class="label">Record</h2><ul class="blurbs">${rec}</ul>` : ''}`);
}
function setup() {
  mode = 'menu';
  const row = (k) => `<button class="btn" data-go="opt" data-arg="${k}">${OPTS[k].label} <small>◀ ${OPTS[k].show(data.opts[k])} ▶</small></button>`;
  show(`<p class="label">Play</p><h1 class="title">Run it</h1>
    <div class="menu">${row('size')}${row('cpu')}${row('to')}<button class="btn btn--solid" data-go="start">Check ball</button><button class="btn" data-go="menu">Back</button></div>
    <ul class="blurbs"><li><b>Make it, lose it:</b> after a bucket the other side checks it at the top.</li>
    <li><b>Take it back:</b> after a steal or a defensive rebound, get the ball outside the arc before you shoot.</li>
    <li><b>Twos and threes:</b> 2 inside the arc, 3 outside. ${data.opts.size > 1 ? 'You run the ball handler, and on defense whoever you switch to.' : ''}</li></ul>`);
  const i = setup.focus ? menuItems.findIndex((b) => b.dataset.arg === setup.focus) : -1; if (i >= 0) { menuIndex = i; menuItems[i].focus(); }
  setup.focus = null;
}
function cycle(k, dir = 1) {
  const o = OPTS[k], i = o.vals.indexOf(data.opts[k]);
  data.opts[k] = o.vals[(i + dir + o.vals.length) % o.vals.length]; persist(); setup.focus = k; setup();
}
function controls() {
  mode = 'menu';
  show(`<p class="label">Controls</p><h1 class="title">The keys</h1>
    <table class="keys"><thead><tr><th></th><th>Controller</th><th>Keyboard</th></tr></thead><tbody>
    <tr><td>Move</td><td>Left stick</td><td>W A S D</td></tr>
    <tr><td>Dribble moves</td><td>Flick the right stick: sideways crossover, back step-back, forward hesi</td><td>Arrow keys (or I J K L)</td></tr>
    <tr><td>Shoot</td><td>Hold square, L2 or R2. Let go to release</td><td>Hold space. Let go to release</td></tr>
    <tr><td>Aim in the air</td><td>Left stick guide hand, right stick shooting hand</td><td>W A S D guide hand, arrows or I J K L shooting hand, or the mouse</td></tr>
    <tr><td>Pass</td><td>R1 or cross, aim with the left stick</td><td>E, aim with W A S D</td></tr>
    <tr><td>Call a screen</td><td>L1 or triangle</td><td>Q</td></tr>
    <tr><td>Defense: hands up</td><td>Hold the right stick up</td><td>Hold the up arrow (or I)</td></tr>
    <tr><td>Defense: jump, block, rebound</td><td>Square, L2 or R2</td><td>Space</td></tr>
    <tr><td>Defense: steal</td><td>R1 or cross</td><td>E</td></tr>
    <tr><td>Defense: switch player</td><td>L1 or triangle</td><td>Q</td></tr>
    <tr><td>Pause</td><td>Options</td><td>P or Esc</td></tr></tbody></table>
    <ul class="blurbs">
      <li>Crossovers work when the defender is leaning the other way. A defender who just reached for a steal is easy to beat.</li>
      <li>Four moves in a row with someone on you and you can lose the handle.</li>
      <li>Reaching for steals leaves you off balance for a moment.</li>
      <li>Hands up slows you down, so only put them up when you're close.</li>
    </ul>
    <p class="hint">Stick drifting? Raise the deadzone in the games settings on the <a href="../">games page</a>.</p>
    <div class="menu"><button class="btn" data-go="menu">Back</button></div>`);
}
function shooting() {
  mode = 'menu';
  show(`<p class="label">How shooting works</p><h1 class="title">Aim it</h1>
    <ul class="blurbs">
      <li><b>Rise:</b> hold shoot. The view drops into your eyes, looking at the rim, and the world slows down.</li>
      <li><b>Two hands:</b> the hollow circle is your guide hand (left stick, or W A S D). The filled circle is your shooting hand (right stick, arrows, or the mouse).</li>
      <li><b>The ring on the rim is the drop zone.</b> Both hands have to sit inside it for the ball to go down. The closer to the middle, the better. The ring turns solid when both hands are in.</li>
      <li><b>Let go to shoot.</b> There is no timing. Release whenever both hands are where you want them.</li>
      <li><b>The hands drift.</b> The longer you hang, the harder they pull, and you can't hang forever: you come down and the ball goes wherever your hands are.</li>
      <li><b>Defense shrinks the ring.</b> A hand in your face or a defender in the air makes it smaller. Wait for them to come down, or get your shot off first.</li>
      <li><b>Moving and deep shots</b> start your hands further off. Layups and dunks have a bigger ring and less time.</li>
      <li><b>Misses go where you missed:</b> shooting hand low means short, off to the side means it rims out that way.</li>
    </ul>
    <div class="menu"><button class="btn btn--solid" data-go="practice">Try it in shoot around</button><button class="btn" data-go="menu">Back</button></div>`);
}

function newMatch(practice) {
  const o = data.opts;
  match = createMatch(practice ? { practice: true, cpu: o.cpu } : { size: o.size, cpu: o.cpu, to: o.to });
  me = 0; camBlend = 0; fpHold = 0; lastShot = null; result = null;
  mode = 'play'; hide();
}
function pause() {
  mode = 'paused';
  const pr = match.practice;
  const zones = pr ? Object.entries(pr.zones).map(([z, r]) => `<li><b>${z}:</b> ${r.m} of ${r.a}</li>`).join('') : '';
  show(`<p class="label">Paused</p>
    ${pr ? `<h2 class="label">Shoot around</h2><ul class="blurbs"><li><b>Made:</b> ${pr.made} of ${pr.att}</li>${zones}</ul>` : `<p class="hint">You ${match.score[0]}, CPU ${match.score[1]}. Game to ${match.cfg.to}.</p>`}
    <div class="menu"><button class="btn btn--solid" data-go="resume">Resume</button><button class="btn" data-go="again">Restart</button><button class="btn" data-go="controls-pause">Controls</button><button class="btn" data-go="menu">Quit to menu</button></div>`);
}
function gameOver() {
  mode = 'over';
  const won = match.winner === 0, k = recKey(match.cfg);
  const r = data.record[k] || (data.record[k] = { w: 0, l: 0 }); won ? r.w++ : r.l++; persist();
  if (won) SFX.win();
  show(`<p class="label">Final / game to ${match.cfg.to}</p><h1 class="title">${won ? 'You win' : 'CPU wins'}</h1>
    <p class="hint">${match.score[0]} to ${match.score[1]}. ${match.cfg.size} on ${match.cfg.size}, ${CPU[match.cfg.cpu].name} CPU. You are ${r.w} and ${r.l} at this setting.</p>
    <div class="menu"><button class="btn btn--solid" data-go="again">Run it back</button><button class="btn" data-go="setup">Change it up</button><button class="btn" data-go="menu">Menu</button></div>`);
}
function go(what, arg) {
  audio();
  if (what === 'menu') mainMenu();
  else if (what === 'setup') setup();
  else if (what === 'opt') cycle(arg, 1);
  else if (what === 'controls') controls();
  else if (what === 'controls-pause') { controls(); mode = 'paused'; overlay.querySelector('[data-go="menu"]').dataset.go = 'pause'; menuItems = [...overlay.querySelectorAll('button')]; }
  else if (what === 'pause') pause();
  else if (what === 'shooting') shooting();
  else if (what === 'start') newMatch(false);
  else if (what === 'practice') newMatch(true);
  else if (what === 'again') newMatch(!!(match && match.practice));
  else if (what === 'resume') { mode = 'play'; hide(); }
}
function menuInput() {
  if (!menuItems.length) return;
  const n = input.nav();
  const ay = (input.pressed('hUp') ? -1 : 0) + (input.pressed('hDown') ? 1 : 0), ax = (input.pressed('hLeft') ? -1 : 0) + (input.pressed('hRight') ? 1 : 0);
  const y = n.y || ay, x = n.x || ax;
  const cur = menuItems[menuIndex];
  if (x && cur && cur.dataset.go === 'opt') { cycle(cur.dataset.arg, x); return; }
  if (y || x) { menuIndex = (menuIndex + (y || x) + menuItems.length) % menuItems.length; menuItems[menuIndex].focus(); }
  if (input.pressed('A') || input.pressed('X')) { const b = menuItems[menuIndex]; if (b) b.click(); return; }
  if (input.pressed('B') || input.pressed('START')) {
    if (mode === 'paused') { const back = menuItems.find((b) => b.dataset.go === 'pause'); back ? back.click() : go('resume'); }
    else { const back = menuItems.find((b) => b.dataset.go === 'menu' && b.textContent === 'Back'); if (back) back.click(); }
  }
}

/* ---------------- turning the controller into an intent ---------------- */
let flickArmed = true, mouseAim = [0, 0];
addEventListener('mousemove', (e) => { if (mode === 'play' && match && match.shot && match.shot.human) { mouseAim[0] += e.movementX; mouseAim[1] += e.movementY; } });

function humanIntent(m) {
  const it = blankIntent(), s = input.state, p = m.players[me];
  it.human = true;
  it.mx = s.lx; it.my = s.ly;
  it.shoot = input.down('X') || s.lt > 0.5 || s.rt > 0.5;
  it.pass = input.pressed('RB') || input.pressed('A');
  it.passDir = Math.hypot(s.lx, s.ly) > 0.3 ? [s.lx, s.ly] : null;
  it.call = input.pressed('LB') || input.pressed('Y');
  const kx = (input.down('hRight') ? 1 : 0) - (input.down('hLeft') ? 1 : 0), ky = (input.down('hDown') ? 1 : 0) - (input.down('hUp') ? 1 : 0);
  // right stick or arrows: a flick is a dribble move
  const rx = s.rx || kx, ry = s.ry || ky, rm = Math.hypot(rx, ry);
  if (rm < 0.35) flickArmed = true;
  if (flickArmed && rm > 0.75) { flickArmed = false; it.flick = Math.abs(rx) > Math.abs(ry) ? (rx < 0 ? 'left' : 'right') : (ry < 0 ? 'up' : 'down'); }
  it.hands = ry < -0.45 ? 1 : 0;
  // in the air: each stick steers one hand. Keys are digital, so they move a little slower.
  const keySpeed = input.lastDevice === 'keyboard' ? 2.6 : 4.2;
  const kgx = (input.down('RIGHT') ? 1 : 0) - (input.down('LEFT') ? 1 : 0), kgy = (input.down('DOWN') ? 1 : 0) - (input.down('UP') ? 1 : 0);
  const padG = input.lastDevice === 'controller' && (s.lx || s.ly);
  it.aimG = padG ? [s.lx * 4.2, s.ly * 4.2] : [kgx * keySpeed, kgy * keySpeed];
  it.aimS = s.rx || s.ry ? [s.rx * 4.2, s.ry * 4.2] : [kx * keySpeed, ky * keySpeed];
  it.aimNudge = [mouseAim[0] * 0.012, mouseAim[1] * 0.012]; mouseAim = [0, 0];
  if (p.team !== m.poss && it.call) it.call = 'switch';
  return it;
}

/* who you control: the ball handler on offense, your man on defense (switch with L1) */
function pickControl(m, it) {
  const b = m.ball, h = handler(m);
  if (h && h.team === 0) { me = h.id; return; }
  if (it && it.call === 'switch') {
    const mine = m.players.filter((p) => p.team === 0 && p.id !== me);
    const tx = b.x, ty = b.y;
    mine.sort((a, c) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(c.x - tx, c.y - ty));
    if (mine[0]) me = mine[0].id;
    return;
  }
  if (m.lastPoss !== m.poss && m.poss === 1) {
    const guard = m.players.find((p) => p.team === 0 && h && p.mark === h.id);
    if (guard) me = guard.id;
  }
  m.lastPoss = m.poss;
}

/* ---------------- 3D: one little camera, used for the broadcast view and the shooter's eyes ---------------- */
const canvas = $('#c'), ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
const cam = { p: [0, 0, 0], f: [0, 1, 0], r: [1, 0, 0], u: [0, 0, 1], fl: 800, cx: 0, cy: 0 };
let broad = { fl: 800, cx: 0, cy: 0 };
function resize() {
  ({ W, H, dpr: DPR } = look.fit(canvas));
  fitBroadcast();
}
look.watch(canvas, resize);
const BPOS = [0, 47, 17], BTGT = [0, 12, 3];
function fitBroadcast() {
  aim(cam, BPOS, BTGT); cam.fl = 1; cam.cx = 0; cam.cy = 0;
  const pts = [[-25, 0, 0], [25, 0, 0], [-25, 34, 0], [25, 34, 0], [0, 4, 13], [-3, 4, 12.5], [3, 4, 12.5]];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const q of pts) { const s = proj(q[0], q[1], q[2]); x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); }
  const top = 34, bottom = 22;
  const fl = Math.min((W * 0.96) / (x1 - x0), (H - top - bottom) / (y1 - y0));
  broad = { fl, cx: W / 2 - fl * (x0 + x1) / 2, cy: top + (H - top - bottom) / 2 - fl * (y0 + y1) / 2 };
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => a + (b - a) * t;
function aim(c, pos, tgt) { c.p = pos; c.f = unit(sub(tgt, pos)); c.r = unit(cross([0, 0, 1], c.f)); c.u = cross(c.f, c.r); }
function proj(x, y, z) {
  const rel = [x - cam.p[0], y - cam.p[1], z - cam.p[2]], d = dot(rel, cam.f);
  if (d < 0.4) return null;
  return [cam.cx + dot(rel, cam.r) * cam.fl / d, cam.cy - dot(rel, cam.u) * cam.fl / d, d];
}
function toCam(q) { const rel = [q[0] - cam.p[0], q[1] - cam.p[1], q[2] - cam.p[2]]; return [dot(rel, cam.r), dot(rel, cam.u), dot(rel, cam.f)]; }
/* a line in the world, clipped at the near plane */
function seg(a, b) {
  let A = toCam(a), B = toCam(b); const n = 0.4;
  if (A[2] < n && B[2] < n) return;
  if (A[2] < n) { const t = (n - A[2]) / (B[2] - A[2]); A = [mix(A[0], B[0], t), mix(A[1], B[1], t), n]; }
  if (B[2] < n) { const t = (n - B[2]) / (A[2] - B[2]); B = [mix(B[0], A[0], t), mix(B[1], A[1], t), n]; }
  ctx.moveTo(cam.cx + A[0] * cam.fl / A[2], cam.cy - A[1] * cam.fl / A[2]);
  ctx.lineTo(cam.cx + B[0] * cam.fl / B[2], cam.cy - B[1] * cam.fl / B[2]);
}
function poly(pts, close = false) { for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1]); if (close) seg(pts[pts.length - 1], pts[0]); }
function fillPoly(pts) {
  // clip against the near plane first, so the floor still fills when it runs behind the camera
  const n = 0.4, c = pts.map(toCam), out = [];
  for (let i = 0; i < c.length; i++) {
    const A = c[i], B = c[(i + 1) % c.length];
    if (A[2] >= n) out.push(A);
    if ((A[2] >= n) !== (B[2] >= n)) { const t = (n - A[2]) / (B[2] - A[2]); out.push([mix(A[0], B[0], t), mix(A[1], B[1], t), n]); }
  }
  if (out.length < 3) return false;
  ctx.beginPath(); out.forEach((q, i) => { const x = cam.cx + q[0] * cam.fl / q[2], y = cam.cy - q[1] * cam.fl / q[2]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.closePath(); ctx.fill(); return true;
}
const arc = (cx, cy, z, r, a0, a1, n = 32) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]; });
const scale = (d) => cam.fl / d;

/* ---------------- drawing ---------------- */
const FG = '#ececec', BG = '#060606', MUTED = 'rgba(236,236,236,.74)', DIM = 'rgba(236,236,236,.42)', LINE = 'rgba(236,236,236,.2)';
const FLOOR = look.FLOOR.base, PAINT = '#151515';
const mono = (px, w = 400) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`;
const HUD = look.hud();
let shownMsg = '', shownT = 0, shownResult = null;
let camBlend = 0, fpHold = 0, lastShot = null, result = null, fpCam = null;

function draw(dt) {
  const m = match;
  HUD.tick(dt, input);
  if (!m) { aim(cam, BPOS, BTGT); cam.fl = broad.fl; cam.cx = broad.cx; cam.cy = broad.cy; look.arena(ctx, W, H, { horizon: horizonY(), dt }); idle(); board(null); menuBar(); return; }
  const pal = palette(loadSettings());
  const s = m.shot && m.shot.human ? m.shot : null;
  if (s) { const p = m.players[s.id]; fpCam = { p: [p.x, p.y, 6.1 + p.z], kind: s.kind }; }
  const want = s || fpHold > 0 ? 1 : 0;
  const rate = reducedMotion() ? 1 : dt / 0.24;
  camBlend += Math.max(-rate, Math.min(rate, want - camBlend));
  setCamera(m, camBlend);
  look.arena(ctx, W, H, { horizon: horizonY(), dt });
  drawWorld(m, pal, camBlend > 0.5 && fpCam ? fpCam : null);
  if (camBlend > 0.9 && s) aimHud(m, s, pal);
  else if (camBlend < 0.5) hud(m, pal);
  if (result && result !== shownResult) HUD.call(result);
  shownResult = result;
  if (mode !== 'play') menuBar();
}
function menuBar() {
  const pad = input.lastDevice === 'controller';
  HUD.bar(mode === 'paused' ? 'paused' : 'menu', pad ? [{ k: '↕', t: 'pick' }, { k: '✕', t: 'choose', open: true }, { k: '○', t: 'back' }] : [{ k: '↕', t: 'pick' }, { k: 'enter', t: 'choose', open: true }, { k: 'esc', t: 'back' }], '◀ ▶ changes a setting');
}
/* where the floor meets the stands, so the crowd sits behind the baseline */
function horizonY() { const q = proj(0, -14, 0); return q ? Math.max(0, Math.min(H, q[1])) : H * 0.3; }
function setCamera(m, t) {
  const bx = Math.max(-8, Math.min(8, m.ball.x * 0.3));
  const bp = [bx, BPOS[1], BPOS[2]], bt = [bx * 0.8, BTGT[1], BTGT[2]];
  if (t <= 0 || !fpCam) { aim(cam, bp, bt); cam.fl = broad.fl; cam.cx = broad.cx; cam.cy = broad.cy; return; }
  const e = t * t * (3 - 2 * t);
  const fp = fpCam.p, ft = [RIM.x, RIM.y, RIM.z];
  const dist = Math.hypot(fp[0] - ft[0], fp[1] - ft[1], fp[2] - ft[2]);
  const rimPx = Math.min(W, H) * (fpCam.kind === 'jumper' ? 0.075 : 0.1);
  const ffl = rimPx * dist / COURT.RIM_R;
  const pos = [mix(bp[0], fp[0], e), mix(bp[1], fp[1], e), mix(bp[2], fp[2], e)];
  const tgt = [mix(bt[0], ft[0], e), mix(bt[1], ft[1], e), mix(bt[2], ft[2], e)];
  aim(cam, pos, tgt);
  // blend focal length in log space so the zoom feels even
  cam.fl = Math.exp(mix(Math.log(broad.fl), Math.log(ffl), e));
  cam.cx = mix(broad.cx, W / 2, e); cam.cy = mix(broad.cy, H * 0.42, e);
}

function drawWorld(m, pal, fp) {
  // floor
  floor();
  ctx.fillStyle = PAINT; fillPoly([[-8, 0, 0], [8, 0, 0], [8, 19, 0], [-8, 19, 0]]);
  courtLines();
  // shadows
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  for (const p of m.players) if (!(fp && p.id === fpShooter(m))) shadow(p.x, p.y, 1.1);
  shadow(m.ball.x, m.ball.y, 0.45 * Math.max(0.4, 1 - m.ball.z / 25));
  // things that stand up, back to front
  const items = [];
  const rim = proj(RIM.x, RIM.y, RIM.z); if (rim) items.push({ d: rim[2] + 0.5, f: () => hoop(m) });
  for (const p of m.players) {
    if (fp && p.id === fpShooter(m)) continue;
    const q = proj(p.x, p.y, p.z + 3); if (q) items.push({ d: q[2], f: () => figure(m, p, pal, fp) });
  }
  const bq = proj(m.ball.x, m.ball.y, m.ball.z); if (bq && m.ball.mode !== 'dead') items.push({ d: bq[2] - 0.3, f: () => ball(m.ball) });
  items.sort((a, b) => b.d - a.d).forEach((i) => i.f());
}
/* the floor: a dark run-off, the court on it, and a pool of light around the paint */
function floor() {
  ctx.fillStyle = '#080808'; fillPoly([[-31, -6, 0], [31, -6, 0], [31, 53, 0], [-31, 53, 0]]);
  ctx.fillStyle = FLOOR; fillPoly([[-25, 0, 0], [25, 0, 0], [25, 47, 0], [-25, 47, 0]]);
  const c = proj(0, 16, 0), e = proj(17, 16, 0), f = proj(0, 30, 0);
  if (c && e && f) look.spot(ctx, c[0], c[1], Math.abs(e[0] - c[0]) * 1.3, Math.max(8, Math.abs(f[1] - c[1]) * 0.9));
}
function fpShooter(m) { return m.shot ? m.shot.id : lastShot; }
function shadow(x, y, r) {
  const pts = arc(x, y, 0.01, r, 0, Math.PI * 2, 14).map((q) => proj(q[0], q[1], q[2]));
  if (pts.some((q) => !q)) return;
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.fill();
}
function courtLines() {
  ctx.lineCap = 'round';
  ctx.strokeStyle = look.FLOOR.edge; ctx.lineWidth = Math.max(1, cam.fl / 900);
  ctx.beginPath(); poly([[-31, 53, 0], [-31, -6, 0], [31, -6, 0], [31, 53, 0]]); ctx.stroke();
  ctx.strokeStyle = look.FLOOR.line; ctx.lineWidth = Math.max(1, cam.fl / 1400);
  ctx.beginPath();
  poly([[-25, 47, 0], [-25, 0, 0], [25, 0, 0], [25, 47, 0], [-25, 47, 0]]);
  poly([[-8, 0, 0], [-8, 19, 0], [8, 19, 0], [8, 0, 0]]);
  poly(arc(0, 19, 0, 6, 0, Math.PI, 24));                                     // free-throw circle, top half
  const a = Math.asin((COURT.CORNER_Y - RIM.y) / COURT.ARC);
  poly([[-22, 0, 0], [-22, COURT.CORNER_Y, 0]]); poly([[22, 0, 0], [22, COURT.CORNER_Y, 0]]);
  poly(arc(RIM.x, RIM.y, 0, COURT.ARC, a, Math.PI - a, 48));               // three-point arc
  poly(arc(RIM.x, RIM.y, 0, 4, 0, Math.PI, 16));                             // restricted area
  poly(arc(0, 47, 0, 6, Math.PI, Math.PI * 2, 24));                          // center circle
  for (const y of [7, 8, 11, 14]) { poly([[-8, y, 0], [-8.7, y, 0]]); poly([[8, y, 0], [8.7, y, 0]]); }   // lane marks
  ctx.stroke();
  // the dashed bottom of the free-throw circle
  ctx.beginPath(); for (let i = 0; i < 8; i++) { const a0 = Math.PI + i * Math.PI / 8; poly(arc(0, 19, 0, 6, a0, a0 + Math.PI / 16, 3)); } ctx.stroke();
}
function hoop(m) {
  const lw = (k) => Math.max(1, k * scale(Math.max(1, proj(0, 4, 10)?.[2] || 40)));
  ctx.lineCap = 'round';
  // stanchion and arm
  ctx.strokeStyle = 'rgba(236,236,236,.35)'; ctx.lineWidth = lw(0.25);
  ctx.beginPath(); poly([[0, -3, 0], [0, -3, 11.5], [0, 4, 11.5]]); ctx.stroke();
  // backboard
  ctx.fillStyle = '#121212'; fillPoly([[-3, 4, 9], [3, 4, 9], [3, 4, 12.5], [-3, 4, 12.5]]);
  ctx.strokeStyle = FG; ctx.lineWidth = lw(0.08);
  ctx.beginPath(); poly([[-3, 4, 9], [3, 4, 9], [3, 4, 12.5], [-3, 4, 12.5]], true); poly([[-1, 4, 10.1], [1, 4, 10.1], [1, 4, 11.6], [-1, 4, 11.6]], true); ctx.stroke();
  // net, then the rim on top
  const made = m.ball.mode === 'net';
  ctx.strokeStyle = 'rgba(236,236,236,.5)'; ctx.lineWidth = lw(0.03);
  const top = arc(RIM.x, RIM.y, RIM.z, COURT.RIM_R, 0, Math.PI * 2, 12), bot = arc(RIM.x, RIM.y, RIM.z - (made ? 1.8 : 1.5), made ? 0.55 : 0.42, 0.26, Math.PI * 2 + 0.26, 12);
  ctx.beginPath(); for (let i = 0; i < 12; i++) { seg(top[i], bot[i]); seg(top[i], bot[(i + 1) % 12]); } poly(bot); ctx.stroke();
  ctx.strokeStyle = FG; ctx.lineWidth = lw(0.09);
  ctx.beginPath(); poly(arc(RIM.x, RIM.y, RIM.z, COURT.RIM_R, 0, Math.PI * 2, 28)); seg([0, 4, RIM.z], [0, RIM.y - COURT.RIM_R, RIM.z]); ctx.stroke();
}
function ball(b) {
  const q = proj(b.x, b.y, b.z); if (!q) return;
  const r = Math.max(2.5, 0.39 * scale(q[2]));
  look.ball(ctx, q[0], q[1], r, null, look.TONE.white);
  if (r > 4) {
    ctx.strokeStyle = BG; ctx.lineWidth = Math.max(1, r / 7); const sp = performance.now() / 160;
    ctx.beginPath(); ctx.moveTo(q[0] - r, q[1]); ctx.lineTo(q[0] + r, q[1]);
    ctx.ellipse(q[0], q[1], Math.abs(Math.cos(sp)) * r, r, 0, 0, Math.PI * 2); ctx.stroke();
  }
}

/* a player: built in 3D and projected, so the same figure works from the stands or in your face */
function figure(m, p, pal, fp) {
  const isMe = p.id === me;
  const T = look.team(p.team);
  const z = p.z, cf = Math.cos(p.face), sf = Math.sin(p.face), sx = -sf, sy = cf;
  const moving = Math.hypot(p.vx, p.vy) > 1;
  const ph = p.stride * 0.55, sw = moving && z === 0 ? Math.sin(ph) : 0;
  const stun = p.stun > 0 ? 0.6 : 0;
  const tilt = stun ? [cf * -1.2, sf * -1.2] : [0, 0];
  const J = (f, s, h, lean = 1) => [p.x + cf * f + sx * s + tilt[0] * (h / 6) * lean, p.y + sf * f + sy * s + tilt[1] * (h / 6) * lean, z + h - stun * (h / 6) * 0.7];
  const hip = J(0, 0, 3.1), hipL = J(0, -0.4, 3.1), hipR = J(0, 0.4, 3.1);
  const footL = J(sw * 0.9, -0.5, 0.05), footR = J(-sw * 0.9, 0.5, 0.05);
  const shL = J(0, -0.75, 5.1), shR = J(0, 0.75, 5.1), head = J(0, 0, 5.95);
  let handL = J(-sw * 0.6, -0.95, 3.3), handR = J(sw * 0.6, 0.95, 3.3);
  const b = m.ball, holding = b.holder === p.id, shooting = m.shot && m.shot.id === p.id;
  if (p.hands > 0.05 && !holding) { const k = p.hands; handL = J(0.3, -0.9, mix(3.3, 7.6, k)); handR = J(0.3, 0.9, mix(3.3, 7.6, k)); }
  if (holding && !shooting) { handR = [b.x, b.y, Math.max(b.z + 0.35, z + 2.2)]; handL = J(0.6, -0.6, 4); }
  if (shooting) { handL = [b.x - sx * 0.35, b.y - sy * 0.35, b.z]; handR = [b.x + sx * 0.35, b.y + sy * 0.35, b.z - 0.2]; }
  if (p.lunge > 0) handR = J(1.6, 0.6, 3.4);
  const hq = proj(hip[0], hip[1], hip[2]); if (!hq) return;
  const k = scale(hq[2]), near = fp && hq[2] < 9;
  ctx.save();
  if (near) ctx.globalAlpha = 0.38;
  // your player: a faint ring on the floor
  if (isMe && !fp) {
    ctx.strokeStyle = 'rgba(236,236,236,.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); poly(arc(p.x, p.y, 0.02, 1.6, 0, Math.PI * 2, 24)); ctx.stroke();
  }
  // legs and arms: light suit for your side, dark suit with a light rim for theirs
  const limbW = Math.max(2.5, 0.6 * k), skinW = Math.max(2, 0.45 * k);
  look.strokeLimb(ctx, () => { seg(hip, footL); seg(hip, footR); }, limbW, T, T.suit);
  look.strokeLimb(ctx, () => { seg(shL, handL); seg(shR, handR); }, skinW, T, T.skin);
  // ankle bands: the only colour on the court
  for (const f of [J(sw * 0.9 * 0.9, -0.5, 0.45), J(-sw * 0.9 * 0.9, 0.5, 0.45)]) {
    const q = proj(f[0], f[1], f[2]); if (q) look.band(ctx, q[0], q[1], Math.max(2, 0.2 * scale(q[2])), T);
  }
  // torso: shaded jersey, square-cut for theirs so the shape differs too
  const torso = [hipL, hipR, shR, shL];
  const tq = [shL, hipR].map((q) => proj(q[0], q[1], q[2]));
  const box = tq[0] && tq[1] ? [tq[0][0], tq[0][1], tq[1][0], tq[1][1]] : null;
  if (T.rim) { ctx.strokeStyle = T.rim; ctx.lineWidth = 2.5; ctx.beginPath(); poly(torso, true); ctx.stroke(); }
  if (box) { const g = ctx.createLinearGradient(...box); g.addColorStop(0, T.suit[0]); g.addColorStop(.55, T.suit[1]); g.addColorStop(1, T.suit[2]); ctx.fillStyle = g; } else ctx.fillStyle = T.suit[1];
  fillPoly(torso);
  const hd = proj(head[0], head[1], head[2]);
  if (hd) {
    const r = Math.max(3, 0.42 * scale(hd[2]));
    look.ball(ctx, hd[0], hd[1], r, T, T.skin);
    // labels: YOU over yours, numbers in team games
    if (!fp) {
      const label = isMe ? 'YOU' : m.cfg.size > 1 || m.practice ? '' : 'CPU';
      const ty = hd[1] - r - 13;
      if (label) look.tag(ctx, hd[0], ty, label, { size: 10, pad: 4 });
      else if (m.cfg.size > 1) look.tag(ctx, hd[0], ty, String(p.slot + 1), { size: 10, pad: 4 });
      if (p.stun > 0) look.tag(ctx, hd[0] + r * 2.4, hd[1] - r, '?', { size: 10, pad: 4 });
    }
  }
  ctx.restore();
}

/* ---------------- HUD: the scoreboard, calls and button bar live on the page, around the stage ---------------- */
function board(m) {
  if (!m) { HUD.board({ a: { name: 'you', sub: look.bandWord(0), score: 0 }, b: { name: 'cpu', sub: look.bandWord(1), score: 0 }, clock: '--' }); return; }
  if (m.practice) {
    HUD.board({ a: { name: 'shoot around', sub: 'made', score: m.practice.made }, b: { name: 'no defense', sub: 'shots', score: m.practice.att }, clock: '--' });
    return;
  }
  const live = m.phase !== 'dead';
  HUD.board({
    a: { name: 'you', sub: `${look.bandWord(0)} · to ${m.cfg.to}`, score: m.score[0], has: live && m.poss === 0 },
    b: { name: 'cpu', sub: `${look.bandWord(1)} · ${CPU[m.cfg.cpu].name}`, score: m.score[1], has: live && m.poss === 1 },
    clock: Math.max(0, Math.ceil(m.clock)), low: m.clock < 5
  });
}
function hud(m, pal) {
  board(m);
  // the big call, stamped in when it changes
  if (m.msg && m.msgT > 0 && (m.msg !== shownMsg || m.msgT > shownT + 0.05)) HUD.call(m.msg);
  shownMsg = m.msgT > 0 ? m.msg : ''; shownT = m.msgT;
  HUD.msg(!m.cleared && m.poss === 0 && m.phase === 'live' && handler(m)?.team === 0 ? 'take it back past the arc' : '');
  // what the buttons do right now
  const pad = input.lastDevice === 'controller', h = handler(m);
  const c = (k, t, open) => ({ k, t, open });
  if (m.practice) HUD.bar('shoot around', pad ? [c('□', 'hold to rise, let go to shoot', true), c('L', 'guide hand'), c('R', 'shooting hand')] : [c('space', 'hold to rise, let go to shoot', true), c('wasd', 'guide hand'), c('arrows', 'shooting hand')], 'no defense. aim with both hands');
  else if (h && h.id === me) HUD.bar('on the ball', pad ? [c('□', 'shoot', true), c('R', 'flick: moves'), c('R1', 'pass'), c('L1', 'screen')] : [c('space', 'shoot', true), c('arrows', 'moves'), c('E', 'pass'), c('Q', 'screen')], m.cleared ? 'twos inside, threes outside' : 'take it back past the arc first');
  else if (m.poss !== 0 && m.ball.mode === 'held') HUD.bar('defense', pad ? [c('R↑', 'hands up'), c('□', 'jump'), c('R1', 'steal'), c('L1', 'switch')] : [c('↑', 'hands up'), c('space', 'jump'), c('E', 'steal'), c('Q', 'switch')], 'hands up slows you down');
  else HUD.bar('loose ball', pad ? [c('□', 'jump for the board', true), c('R1', 'call for it')] : [c('space', 'jump for the board', true), c('E', 'call for it')]);
}

const c2 = (k, t, open) => ({ k, t, open });
function aimHud(m, s, pal) {
  const rim = proj(RIM.x, RIM.y - COURT.RIM_R * 0.2, RIM.z); if (!rim) return;
  const rimPx = COURT.RIM_R * scale(rim[2]), unitPx = rimPx * 0.7;
  const cx = rim[0], cy = rim[1] - rimPx * 0.25;
  const o = handOdds(s), R = s.targetR * unitPx;
  // the drop zone: dashed until both hands are in, then solid
  ctx.save();
  ctx.strokeStyle = FG; ctx.lineWidth = 2;
  ctx.setLineDash(o.inside ? [] : [6, 6]);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6); ctx.stroke();
  // hands
  const hx = (h) => cx + h[0] * unitPx, hy = (h) => cy + h[1] * unitPx;
  const gx = hx(s.g), gy = hy(s.g), sx = hx(s.s), sy = hy(s.s);
  ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(cx, cy); ctx.moveTo(sx, sy); ctx.lineTo(cx, cy); ctx.stroke();
  const r = Math.max(9, Math.min(15, unitPx * 0.28));
  ctx.lineWidth = 3; ctx.strokeStyle = FG; ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = pal.mark; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  ctx.font = mono(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = FG; ctx.fillText('L', gx, gy); ctx.fillStyle = BG; ctx.fillText('R', sx, sy);
  ctx.textBaseline = 'alphabetic';
  // words, not colours
  look.tag(ctx, cx, cy - R - 18, SHOTS[s.kind].name + (s.three ? ' · three' : ''));
  if (s.contest > 0.3) look.tag(ctx, cx, cy + R + 20, s.contest > 0.65 ? 'heavily contested' : 'contested');
  const pad = input.lastDevice === 'controller';
  HUD.bar('in the air', pad ? [c2('L', 'left stick: guide hand'), c2('R', 'right stick: shooting hand'), c2('□', 'let go to shoot', o.inside)] : [c2('wasd', 'guide hand'), c2('arrows', 'shooting hand, or the mouse'), c2('space', 'let go to shoot', o.inside)], o.inside ? 'both hands in. let go' : 'get both hands inside the ring');
  ctx.restore();
}
function idle() {
  // the court sits quietly behind the menus
  aim(cam, BPOS, BTGT); cam.fl = broad.fl; cam.cx = broad.cx; cam.cy = broad.cy;
  floor(); ctx.fillStyle = PAINT; fillPoly([[-8, 0, 0], [8, 0, 0], [8, 19, 0], [-8, 19, 0]]);
  courtLines(); hoop({ ball: {} });
}

/* ---------------- loop ---------------- */
let last = performance.now(), dribbleT = 0;
function update(dt) {
  input.poll();
  if (mode !== 'play') { menuInput(); return; }
  if (input.pressed('START') || input.pressed('B')) { pause(); return; }
  const m = match;
  const hit = humanIntent(m);
  pickControl(m, hit);
  for (const p of m.players) p.human = p.id === me;
  const intents = {};
  const wdt = dt * m.timeScale;
  for (const p of m.players) intents[p.id] = p.id === me ? humanIntent2(hit, m) : cpuIntent(m, p, wdt);
  step(m, dt, intents);
  for (const e of m.events) onEvent(m, e);
  if (fpHold > 0) fpHold -= dt;
  // dribble sound while someone has it on the move
  const h = handler(m);
  if (h && !m.shot && m.phase === 'live' && Math.hypot(h.vx, h.vy) > 1) { dribbleT -= dt; if (dribbleT <= 0) { dribbleT = 0.48; if (h.team === 0) SFX.dribble(); } }
  if (m.phase === 'over' && mode === 'play') gameOver();
}
function humanIntent2(it, m) { return it.call === 'switch' ? { ...it, call: false } : it; }
function onEvent(m, e) {
  const t = e.type;
  if (t === 'make' || t === 'block' || t === 'ankles') look.cheer(t === 'make' ? 0.6 : 0.8);
  if (t === 'make') { SFX.swish(); if (fpHold > 0) result = e.pts === 3 ? 'Three, good' : 'Good'; }
  else if (t === 'rim') { SFX.rim(); if (fpHold > 0) result = 'Off the iron'; }
  else if (t === 'airball') { if (fpHold > 0) result = 'Air ball'; }
  else if (t === 'bounce') SFX.bounce();
  else if (t === 'release') { SFX.release(); if (e.human) { lastShot = e.id; fpHold = (m.ball.flight ? m.ball.flight.T : 0.4) + 0.6; result = null; } }
  else if (t === 'violation') SFX.buzzer();
  else if (t === 'steal' || t === 'pick') SFX.steal();
  else if (t === 'block') { SFX.block(); if (lastShot != null) result = 'Blocked'; }
  else if (t === 'ankles') SFX.ankles();
  else if (t === 'move') SFX.move();
  else if (t === 'live') SFX.check();
}

function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  update(dt); draw(dt);
  requestAnimationFrame(frame);
}
document.documentElement.classList.toggle('calm', reducedMotion());
addEventListener('gamepadconnected', () => { input.lastDevice = 'controller'; });
resize();
mainMenu();
requestAnimationFrame(frame);
