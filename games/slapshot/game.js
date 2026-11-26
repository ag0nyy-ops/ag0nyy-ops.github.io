/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Slapshot: 3-on-3 arcade hockey. The left stick skates, the right stick is your hockey stick.
   Hold the stick back to wind up and flick it forward to shoot: a short wind-up is a quick wrist
   shot, a long one is a slapshot that is harder but easier to read. No stat training: every
   skater is the same, so the only thing that gets better is you. */

import { Input } from '../shared/input.js';
import { loadSettings, palette, reducedMotion } from '../shared/settings.js';
import { Game, LEVELS, RINK, SK, PUCK_R, WRIST_MAX, SLAP_FULL, blankCmd } from './sim.js';

const SAVE = 'jay.slapshot.v1';
const LENGTHS = [60, 120, 180, 240];   // period length options, seconds
const LOAD = 0.14;                     // hold the stick back this long and the shot is loaded
const FLICK_WINDOW = 0.25;             // after letting go, this long to flick it forward

const input = new Input({
  UP: ['KeyW'], DOWN: ['KeyS'], LEFT: ['KeyA'], RIGHT: ['KeyD'],
  A: ['Space', 'Enter'], B: ['Escape', 'Backspace'], START: ['KeyP'],
  LT: ['ShiftLeft', 'ShiftRight'], LB: ['KeyQ'], RB: ['KeyE'], RT: ['KeyR'],
  SU: ['ArrowUp'], SD: ['ArrowDown'], SL: ['ArrowLeft'], SR: ['ArrowRight'], ESC: ['Escape']
});

/* ---------------- save data (this browser only) ---------------- */
function load() {
  let d = {}; try { d = JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) {}
  const rec = {}; for (const l of LEVELS) rec[l.id] = { w: 0, l: 0, t: 0, ...((d.rec || {})[l.id] || {}) };
  return { periodLen: LENGTHS.includes(d.periodLen) ? d.periodLen : 120, rec };
}
const data = load();
const persist = () => { try { localStorage.setItem(SAVE, JSON.stringify(data)); } catch (e) {} };

/* ---------------- sound: tiny synth, no files ---------------- */
let ac = null;
function audio() {
  if (!ac) { try { ac = new AudioContext(); } catch (e) { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(freq, len = 0.08, type = 'sine', vol = 0.2, slide = 0) {
  const a = audio(); const v = loadSettings().volume * vol; if (!a || v <= 0) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + len);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + len);
}
function noise(len = 0.06, vol = 0.3, hp = 1200) {
  const a = audio(); const v = loadSettings().volume * vol; if (!a || v <= 0) return;
  const n = Math.floor(a.sampleRate * len), buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = 'highpass'; f.frequency.value = hp; s.buffer = buf; g.gain.value = v;
  s.connect(f).connect(g).connect(a.destination); s.start();
}
function sounds(events) {
  for (const e of events) {
    if (e.type === 'shot') noise(e.kind === 'slap' ? 0.1 : 0.05, e.kind === 'slap' ? 0.5 : 0.3, e.kind === 'slap' ? 600 : 1500);
    else if (e.type === 'pass' || e.type === 'saucer') noise(0.03, 0.15, 2500);
    else if (e.type === 'pickup') tone(900, 0.02, 'triangle', 0.04);
    else if (e.type === 'post') { tone(1250, 0.35, 'triangle', 0.18); tone(1870, 0.25, 'sine', 0.08); }
    else if (e.type === 'save') noise(0.08, 0.28, 300);
    else if (e.type === 'boards') noise(0.09, Math.min(0.35, e.v / 1500), 200);
    else if (e.type === 'hit') { noise(0.14, 0.45, 120); tone(90, 0.16, 'sine', 0.3, 0.6); }
    else if (e.type === 'steal' || e.type === 'tip') noise(0.03, 0.2, 2000);
    else if (e.type === 'goal') { tone(196, 1.1, 'sawtooth', 0.12); tone(247, 1.1, 'sawtooth', 0.08); }
    else if (e.type === 'whistle' || e.type === 'drop') tone(2100, e.type === 'drop' ? 0.12 : 0.4, 'sine', 0.08);
  }
}

/* ---------------- the right stick: hold back, flick forward ---------------- */
class Gesture {
  constructor() { this.prevMag = 0; this.reset(); }
  reset() { this.hold = null; this.holdT = 0; this.relT = -1; }
  update(dt, x, y) {
    const out = { windup: 0, wdx: 0, wdy: 0, shoot: null, quick: false };
    const m = Math.hypot(x, y);
    if (m > 0.8) {
      const dx = x / m, dy = y / m;
      if (this.hold) {
        const dot = dx * this.hold[0] + dy * this.hold[1];
        if (dot > 0.7) { this.holdT += dt; if (this.relT >= 0) this.relT = -1; }
        else if (dot < -0.5 && this.holdT >= LOAD) { out.shoot = { dx, dy, power: Math.min(SLAP_FULL, this.holdT) }; this.reset(); this.hold = [dx, dy]; this.holdT = -1; }
        else { this.hold = [dx, dy]; this.holdT = 0; this.relT = -1; }
      } else { this.hold = [dx, dy]; this.holdT = 0; }
    } else if (this.hold && this.holdT >= LOAD) {
      if (this.relT < 0) this.relT = 0;
      this.relT += dt; if (this.relT > FLICK_WINDOW) this.reset();
    } else if (m < 0.5) this.reset();
    out.quick = this.prevMag < 0.35 && m > 0.85;   // a fast push from the middle: a poke check
    this.prevMag = m;
    if (this.hold && this.holdT >= LOAD) { out.windup = Math.min(SLAP_FULL, this.holdT); out.wdx = this.hold[0]; out.wdy = this.hold[1]; }
    return out;
  }
}
const gesture = new Gesture();

/* arrows as a stick: the newest key on each axis wins, so hold Left and tap Right to flick */
const stamp = {};
addEventListener('keydown', (e) => { if (e.code.startsWith('Arrow') && !e.repeat) stamp[e.code] = performance.now(); });
function arrowStick() {
  const L = input.down('SL'), R = input.down('SR'), U = input.down('SU'), D = input.down('SD');
  let x = L && R ? ((stamp.ArrowRight || 0) > (stamp.ArrowLeft || 0) ? 1 : -1) : R ? 1 : L ? -1 : 0;
  let y = U && D ? ((stamp.ArrowDown || 0) > (stamp.ArrowUp || 0) ? 1 : -1) : D ? 1 : U ? -1 : 0;
  if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return [x, y];
}

/* the mouse as a stick: the blade points at the cursor, hold the button to wind up, let go to shoot */
const mouse = { x: 0, y: 0, t: -1e9, down: false, downT: 0, release: null, rclick: false, click: false };
const canvas = document.querySelector('#c'), ctx = canvas.getContext('2d');
canvas.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = performance.now(); });
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse') return;
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = performance.now();
  if (e.button === 0) { mouse.down = true; mouse.downT = performance.now(); mouse.click = true; }
  if (e.button === 2) mouse.rclick = true;
});
addEventListener('pointerup', (e) => { if (e.button === 0 && mouse.down) { mouse.down = false; mouse.release = (performance.now() - mouse.downT) / 1000; } });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
const mouseActive = () => performance.now() - mouse.t < 2500;

/* ---------------- screens (DOM overlay, driven by controller or keyboard) ---------------- */
const $ = (sel) => document.querySelector(sel);
const overlay = $('#overlay'), backLink = $('.back');
let menuItems = [], menuIndex = 0;
function show(html) {
  overlay.innerHTML = `<div class="panel">${html}</div>`; overlay.hidden = false; if (backLink) backLink.hidden = false;
  menuItems = [...overlay.querySelectorAll('button')]; menuIndex = 0;
  if (menuItems[0]) menuItems[0].focus();
  menuItems.forEach((b, i) => b.addEventListener('focus', () => { menuIndex = i; }));
}
function hide() { overlay.hidden = true; overlay.innerHTML = ''; menuItems = []; if (backLink) backLink.hidden = true; }
overlay.addEventListener('click', (e) => { const b = e.target.closest('button[data-go]'); if (b) go(b.dataset.go, b.dataset.arg); });

const recText = (r) => (r.w || r.l || r.t ? `${r.w}-${r.l}-${r.t}` : 'no games');
const minutes = (s) => `${s / 60} min`;

function mainMenu() {
  mode = 'menu'; demo = reducedMotion() ? null : new Game({ level: 'pro', humanIdx: -1, periodLen: 9999 });
  const lv = LEVELS.map((l) => `<button class="btn" data-go="play" data-arg="${l.id}">Play: ${l.name} <small>${recText(data.rec[l.id])}</small></button>`).join('');
  show(`<p class="label">Game file / Hockey / 3 on 3</p><h1 class="title">Slapshot</h1>
    <div class="menu">${lv}<button class="btn" data-go="practice">Practice <small>you and a goalie</small></button>
    <button class="btn" data-go="length">Periods <small>3 × ${minutes(data.periodLen)}</small></button>
    <button class="btn" data-go="controls">Controls</button></div>
    <p class="hint">Arcade 3 on 3 with computer goalies. Every skater is the same, so there is nothing to train: you win on how you skate, handle and shoot. Records are W-L-T, saved in this browser only.</p>`);
}
function controls(from) {
  mode = from === 'pause' ? 'paused' : 'menu';
  show(`<p class="label">Controls</p><h1 class="title">How to play</h1>
    <table class="keys"><thead><tr><th></th><th>Controller</th><th>Keyboard</th></tr></thead><tbody>
    <tr><td>Skate</td><td>Left stick</td><td>W A S D</td></tr>
    <tr><td>Hard stop</td><td>L2</td><td>Shift</td></tr>
    <tr><td>Stickhandle</td><td>Right stick: move the blade around you</td><td>Arrow keys, or the mouse</td></tr>
    <tr><td>Shoot</td><td>Right stick: hold it back, then flick it forward</td><td>Hold an arrow, then tap the opposite one. Mouse: hold the button, let go</td></tr>
    <tr><td>Pass</td><td>R1, toward where you push the left stick</td><td>E</td></tr>
    <tr><td>Saucer pass</td><td>R2, lifts over sticks</td><td>R</td></tr>
    <tr><td>Body check</td><td>L1</td><td>Q</td></tr>
    <tr><td>Poke check</td><td>Right stick: a quick push at the puck</td><td>Tap an arrow toward the puck, or click</td></tr>
    <tr><td>Switch player</td><td>Cross / A</td><td>Space</td></tr>
    <tr><td>Pause</td><td>Options / Start</td><td>P or Esc</td></tr></tbody></table>
    <ul class="blurbs">
      <li><b>Wrist shot:</b> a short wind-up, under ${WRIST_MAX.toFixed(1)} s. Quick and accurate, the goalie barely sees it coming.</li>
      <li><b>Slapshot:</b> keep holding. It gets harder up to ${SLAP_FULL.toFixed(0)} s, but you slow down, defenders step into the lane and the goalie reads it.</li>
      <li><b>Aim:</b> the puck goes the way you flick. The dashed line shows where while you're wound up.</li>
      <li><b>One-timer:</b> wind up before a pass reaches you and flick as it arrives.</li>
      <li><b>Stickhandling:</b> keep the blade moving and poke checks miss more often. Hold the puck on the far side of your body from a defender.</li>
      <li><b>Checks:</b> land one and they drop the puck. Miss and you stumble for a moment.</li>
      <li><b>Goalies</b> slide late on quick shots. Pass across the crease and shoot before they get there.</li>
    </ul>
    <p class="hint">Stick drifting? Raise the deadzone in the games settings on the <a href="../">games page</a>. Colour-vision modes are there too.</p>
    <div class="menu"><button class="btn" data-go="${from === 'pause' ? 'pause' : 'menu'}">Back</button></div>`);
}

/* ---------------- game state ---------------- */
let mode = 'menu';     // menu | play | paused | results
let game = null, demo = null, gameOpts = null, endT = 0;

function newGame(opts) {
  gameOpts = opts;
  game = new Game({ ...opts, humanIdx: 0 });
  gesture.reset(); pending = null;
  mode = 'play'; hide(); endT = 0;
}
function go(what, arg) {
  audio();
  if (what === 'menu') mainMenu();
  else if (what === 'controls') controls(mode === 'paused' ? 'pause' : 'menu');
  else if (what === 'length') { data.periodLen = LENGTHS[(LENGTHS.indexOf(data.periodLen) + 1) % LENGTHS.length]; persist(); mainMenu(); menuItems[LEVELS.length + 1].focus(); }
  else if (what === 'play') newGame({ level: arg, periodLen: data.periodLen });
  else if (what === 'practice') newGame({ level: 'pro', practice: true });
  else if (what === 'again') newGame(gameOpts);
  else if (what === 'pause') pause();
  else if (what === 'resume') { mode = 'play'; hide(); }
}
function pause() {
  mode = 'paused';
  show(`<p class="label">Paused${game.practice ? ' / Practice' : ` / ${game.level.name}`}</p><h1 class="title">${game.practice ? `${game.score[0]} <small>goals</small>` : `${game.score[0]} – ${game.score[1]}`}</h1>
    <div class="menu"><button class="btn btn--solid" data-go="resume">Resume</button><button class="btn" data-go="again">Restart</button><button class="btn" data-go="controls">Controls</button><button class="btn" data-go="menu">Quit to menu</button></div>`);
}
function results() {
  mode = 'results';
  const [a, b] = game.score, r = data.rec[game.level.id];
  const res = a > b ? 'w' : a < b ? 'l' : 't'; r[res]++; persist();
  const head = res === 'w' ? 'You win' : res === 'l' ? 'You lose' : 'Tie game';
  const ot = game.ot ? (res === 't' ? ' after overtime' : ' in overtime') : '';
  show(`<p class="label">${game.level.name} / Final${ot}</p><h1 class="title">${head} <small>${a} – ${b}</small></h1>
    <table class="board"><tbody>
      <tr><td></td><td>You</td><td>CPU</td></tr>
      <tr><td>Goals</td><td>${a}</td><td>${b}</td></tr>
      <tr><td>Shots on goal</td><td>${game.sog[0]}</td><td>${game.sog[1]}</td></tr>
      <tr><td>Hits</td><td>${game.hits[0]}</td><td>${game.hits[1]}</td></tr></tbody></table>
    <p class="hint">Record at ${game.level.name}: ${recText(r)}.</p>
    <div class="menu"><button class="btn btn--solid" data-go="again">Play again</button><button class="btn" data-go="menu">Menu</button></div>`);
}

/* ---------------- your inputs → a command for your skater ---------------- */
let pending = null;   // a flick with no puck yet: becomes a one-timer if a pass lands in time
function humanCommand(dt) {
  const s = input.state, h = game.human, P = game.puck, c = blankCmd();
  const hasPuck = P.owner === h;
  c.mx = s.lx; c.my = s.ly; c.stop = s.lt;
  let [sx, sy] = arrowStick();
  if (!sx && !sy) { sx = s.rx; sy = s.ry; }
  const useMouse = !sx && !sy && mouseActive() && input.lastDevice === 'keyboard';
  const toPuck = [P.x - h.x, P.y - h.y], dPuck = Math.hypot(...toPuck);
  if (useMouse) {
    const [wx, wy] = toWorld(mouse.x, mouse.y), dx = wx - h.x, dy = wy - h.y, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / (SK.reach * 2.2)); c.sx = dx / d * k; c.sy = dy / d * k;
    if (mouse.down) { const held = (performance.now() - mouse.downT) / 1000; c.windup = Math.min(SLAP_FULL, held); c.wdx = -dx / d; c.wdy = -dy / d; }
    if (mouse.click && !hasPuck) c.poke = { dx, dy };
    if (mouse.release != null) {
      const sh = { dx, dy, power: Math.min(SLAP_FULL, mouse.release) };
      if (hasPuck) c.shoot = sh; else pending = { sh, t: 0.18 };
    }
    if (mouse.rclick) c.pass = { dx, dy, saucer: false };
    gesture.reset();
  } else {
    c.sx = sx; c.sy = sy;
    const g = gesture.update(dt, sx, sy);
    c.windup = g.windup; c.wdx = g.wdx; c.wdy = g.wdy;
    if (g.shoot) { if (hasPuck) c.shoot = g.shoot; else pending = { sh: g.shoot, t: 0.18 }; }
    // a quick push at a nearby puck you don't have is a poke check
    if (g.quick && !hasPuck && dPuck < 48) {
      const m = Math.hypot(sx, sy) || 1;
      if ((sx * toPuck[0] + sy * toPuck[1]) / (m * (dPuck || 1)) > 0.35) c.poke = { dx: sx, dy: sy };
    }
  }
  mouse.click = false; mouse.release = null; mouse.rclick = false;
  if (pending) {
    pending.t -= dt;
    if (hasPuck) { c.shoot = pending.sh; pending = null; }
    else if (pending.t <= 0) pending = null;
    else { c.windup = Math.max(c.windup, 0.05); }
  }
  if (input.pressed('RB')) c.pass = { dx: s.lx, dy: s.ly, saucer: false };
  if (input.pressed('RT')) c.pass = { dx: s.lx, dy: s.ly, saucer: true };
  if (input.pressed('LB')) c.check = true;
  if (input.pressed('A') && game.switchPlayer()) { gesture.reset(); pending = null; }
  return c;
}

function update(dt) {
  input.poll();
  if (mode !== 'play') { if (demo && mode === 'menu') { demo.step(dt); if (demo.over || demo.t > 240) demo = new Game({ level: 'pro', humanIdx: -1, periodLen: 9999 }); } return menuInput(); }
  if (input.pressed('START') || input.pressed('ESC')) return pause();
  const h = game.human;
  h.cmd = humanCommand(dt);
  game.step(dt);
  // a pass to a teammate of yours hands you control of them when it arrives
  for (const e of game.events) if (e.type === 'pickup' && e.s.team === 0 && !e.s.human && e.intended) { game.setHuman(e.s); gesture.reset(); pending = null; }
  sounds(game.events);
  if (game.over) { endT += dt; if (endT > (game.phase === 'goal' ? 2.4 : 0.6)) results(); }
}
function menuInput() {
  if (!menuItems.length) return;
  const n = input.nav();
  let step = n.y || n.x;
  if (input.pressed('SU') || input.pressed('SL')) step = -1;
  if (input.pressed('SD') || input.pressed('SR')) step = 1;
  if (step) { menuIndex = (menuIndex + step + menuItems.length) % menuItems.length; menuItems[menuIndex].focus(); }
  // the input layer swallows Space/Enter, so A (or those keys) clicks the focused button here
  if (input.pressed('A')) { const b = menuItems[menuIndex]; b && b.click(); }
  else if (input.pressed('B') || input.pressed('START')) {
    if (mode === 'paused') { const back = overlay.querySelector('[data-go="pause"]'); back ? pause() : go('resume'); }
    else { const back = overlay.querySelector('[data-go="menu"]'); if (back && !overlay.querySelector('[data-go="play"]')) back.click(); }
  }
}
addEventListener('blur', () => { if (mode === 'play') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pause(); });

/* ---------------- drawing ---------------- */
let W = 0, H = 0, dpr = 1, sc = 1, ox = 0, oy = 0;
const TOP = 70, BOTTOM = 40;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sc = Math.max(0.3, Math.min((W - 24) / (RINK.HX * 2), (H - TOP - BOTTOM) / (RINK.HY * 2)));
  ox = W / 2; oy = TOP + (H - TOP - BOTTOM) / 2;
}
addEventListener('resize', resize); resize();
const X = (x) => ox + x * sc, Y = (y) => oy + y * sc;
function toWorld(px, py) { return [(px - ox) / sc, (py - oy) / sc]; }

const FG = '#ececec', BG = '#060606', ICE = '#0e0e0e';
const fg = (a) => `rgba(236,236,236,${a})`;
const mono = (px, w = 400) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`;

function rinkPath() {
  const { HX, HY, CR } = RINK, r = CR * sc;
  ctx.beginPath(); ctx.roundRect(X(-HX), Y(-HY), HX * 2 * sc, HY * 2 * sc, r);
}
function drawRink() {
  const { HY, GX, GW, GD, BLUE, CREASE } = RINK;
  rinkPath(); ctx.fillStyle = ICE; ctx.fill();
  ctx.save(); rinkPath(); ctx.clip();
  ctx.lineWidth = Math.max(2, 4 * sc);
  // blue lines solid, centre line dashed: told apart by pattern, not colour
  ctx.strokeStyle = fg(0.3);
  for (const x of [-BLUE, BLUE]) { ctx.beginPath(); ctx.moveTo(X(x), Y(-HY)); ctx.lineTo(X(x), Y(HY)); ctx.stroke(); }
  ctx.setLineDash([10 * sc, 7 * sc]); ctx.strokeStyle = fg(0.22);
  ctx.beginPath(); ctx.moveTo(X(0), Y(-HY)); ctx.lineTo(X(0), Y(HY)); ctx.stroke(); ctx.setLineDash([]);
  ctx.lineWidth = Math.max(1, 1.5 * sc); ctx.strokeStyle = fg(0.3);
  for (const x of [-GX, GX]) { ctx.beginPath(); ctx.moveTo(X(x), Y(-HY)); ctx.lineTo(X(x), Y(HY)); ctx.stroke(); }
  ctx.strokeStyle = fg(0.16); ctx.lineWidth = Math.max(1, 1.2 * sc);
  ctx.beginPath(); ctx.arc(X(0), Y(0), 60 * sc, 0, Math.PI * 2); ctx.stroke();
  for (const fx of [-(GX - 90), GX - 90]) for (const fy of [-70, 70]) {
    ctx.beginPath(); ctx.arc(X(fx), Y(fy), 45 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = fg(0.25); ctx.beginPath(); ctx.arc(X(fx), Y(fy), 3 * sc, 0, Math.PI * 2); ctx.fill();
  }
  for (const fx of [-(BLUE - 25), BLUE - 25]) for (const fy of [-70, 70]) { ctx.fillStyle = fg(0.2); ctx.beginPath(); ctx.arc(X(fx), Y(fy), 3 * sc, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = fg(0.3); ctx.beginPath(); ctx.arc(X(0), Y(0), 3 * sc, 0, Math.PI * 2); ctx.fill();
  // creases
  for (const side of [-1, 1]) {
    ctx.fillStyle = fg(0.06); ctx.strokeStyle = fg(0.3); ctx.lineWidth = Math.max(1, 1.2 * sc);
    ctx.beginPath(); ctx.arc(X(side * GX), Y(0), CREASE * sc, side < 0 ? -Math.PI / 2 : Math.PI / 2, side < 0 ? Math.PI / 2 : Math.PI * 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // nets: a box with mesh
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -GX - GD : GX, w = GD;
    ctx.fillStyle = fg(0.05); ctx.fillRect(X(x0), Y(-GW), w * sc, GW * 2 * sc);
    ctx.strokeStyle = fg(0.12); ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { const y = -GW + (GW * 2 * i) / 6; ctx.beginPath(); ctx.moveTo(X(x0), Y(y)); ctx.lineTo(X(x0 + w), Y(y)); ctx.stroke(); }
    ctx.strokeStyle = FG; ctx.lineWidth = Math.max(1.5, 2 * sc);
    ctx.beginPath();
    if (side < 0) { ctx.moveTo(X(-GX), Y(-GW)); ctx.lineTo(X(-GX - GD), Y(-GW)); ctx.lineTo(X(-GX - GD), Y(GW)); ctx.lineTo(X(-GX), Y(GW)); }
    else { ctx.moveTo(X(GX), Y(-GW)); ctx.lineTo(X(GX + GD), Y(-GW)); ctx.lineTo(X(GX + GD), Y(GW)); ctx.lineTo(X(GX), Y(GW)); }
    ctx.stroke();
  }
  rinkPath(); ctx.strokeStyle = FG; ctx.lineWidth = 2; ctx.stroke();
}

/* home skaters are circles, away skaters are diamonds: colour is never the only cue */
function bodyPath(team, x, y, r) {
  ctx.beginPath();
  if (team === 0) ctx.arc(x, y, r, 0, Math.PI * 2);
  else { const d = r * 1.18; ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath(); }
}
function drawSkater(s, pal, calm, dim) {
  const x = X(s.x), y = Y(s.y), r = SK.r * sc, col = s.team === 0 ? pal.home : pal.away;
  if (s.spray > 0 && !calm) {
    ctx.fillStyle = fg(0.35 * Math.min(1, s.spray / 0.15));
    for (let i = 0; i < 5; i++) { const a = Math.atan2(s.vy, s.vx) + (i - 2) * 0.4; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5, 1.2, 0, Math.PI * 2); ctx.fill(); }
  }
  if (s.spray > 0) s.spray -= 1 / 60;
  // stick
  const [bx, by] = s.blade, px = X(bx), py = Y(by);
  ctx.strokeStyle = fg(dim ? 0.35 : 0.7); ctx.lineWidth = Math.max(1.5, 2 * sc); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + (px - x) * 0.35, y + (py - y) * 0.35); ctx.lineTo(px, py); ctx.stroke();
  const ang = Math.atan2(by - s.y, bx - s.x) + Math.PI / 2, bl = 5 * sc;
  ctx.lineWidth = Math.max(2.5, 3.2 * sc);
  ctx.beginPath(); ctx.moveTo(px - Math.cos(ang) * bl, py - Math.sin(ang) * bl); ctx.lineTo(px + Math.cos(ang) * bl, py + Math.sin(ang) * bl); ctx.stroke();
  // body
  ctx.globalAlpha = dim ? 0.45 : s.stun ? 0.5 : 1;
  bodyPath(s.team, x, y, r); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = BG; ctx.stroke();
  // facing notch
  ctx.fillStyle = BG; ctx.beginPath(); ctx.arc(x + s.fx * r * 0.62, y + s.fy * r * 0.62, Math.max(1.2, r * 0.18), 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  if (s.stun) { // down on the ice: a dashed ring, no flashing
    ctx.setLineDash([3, 3]); ctx.strokeStyle = FG; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.fillStyle = BG; ctx.font = mono(Math.max(8, r * 0.95), 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(s.num), x, y + 0.5);
  ctx.textBaseline = 'alphabetic';
}
function drawYou(s, pal) {
  const x = X(s.x), y = Y(s.y), r = SK.r * sc;
  ctx.strokeStyle = pal.mark; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r + 6, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = pal.mark; ctx.beginPath(); ctx.moveTo(x, y - r - 9); ctx.lineTo(x - 6, y - r - 17); ctx.lineTo(x + 6, y - r - 17); ctx.closePath(); ctx.fill();
  ctx.font = mono(10, 600); ctx.textAlign = 'center'; ctx.fillText('YOU', x, y - r - 21);
}
function drawGoalie(g, pal, dim) {
  const x = X(g.x), y = Y(g.y), col = g.team === 0 ? pal.home : pal.away, rx = g.size * 0.75 * sc, ry = g.size * 1.1 * sc;
  ctx.globalAlpha = dim ? 0.45 : 1;
  ctx.beginPath();
  if (g.team === 0) ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  else { ctx.moveTo(x, y - ry * 1.1); ctx.lineTo(x + rx * 1.2, y); ctx.lineTo(x, y + ry * 1.1); ctx.lineTo(x - rx * 1.2, y); ctx.closePath(); }
  ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = BG; ctx.stroke();
  ctx.fillStyle = BG; ctx.font = mono(Math.max(8, g.size * 0.85 * sc), 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('G', x, y + 0.5); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
}
let trail = [];
function drawPuck(P, calm) {
  const lift = P.z * 10 * sc, x = X(P.x), y = Y(P.y) - lift, r = Math.max(2.5, PUCK_R * sc) * (1 + P.z * 0.35);
  const v = Math.hypot(P.vx, P.vy);
  if (!calm && !P.owner && v > 300) { trail.push([x, y]); if (trail.length > 6) trail.shift(); } else trail.length = 0;
  trail.forEach(([tx, ty], i) => { ctx.fillStyle = fg(0.05 + i * 0.03); ctx.beginPath(); ctx.arc(tx, ty, r * 0.8, 0, Math.PI * 2); ctx.fill(); });
  if (P.z > 0.02) { ctx.fillStyle = fg(0.15); ctx.beginPath(); ctx.ellipse(X(P.x), Y(P.y), r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = fg(0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = FG; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = BG; ctx.lineWidth = 1.5; ctx.stroke();
}
function drawAim(h, P, pal) {
  if (!(h.windup > 0) || pending) return;
  const dx = -h.wdx, dy = -h.wdy, slap = h.windup >= WRIST_MAX, L = (70 + 150 * (h.windup / SLAP_FULL)) * sc;
  const sx = X(P.owner === h ? P.x : h.x), sy = Y(P.owner === h ? P.y : h.y);
  ctx.strokeStyle = fg(0.5); ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]);
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + dx * L, sy + dy * L); ctx.stroke(); ctx.setLineDash([]);
  // wind-up meter: a ring that fills, with a tick where a wrist shot becomes a slapshot
  const x = X(h.x), y = Y(h.y), r = SK.r * sc + 11, frac = h.windup / SLAP_FULL, a0 = -Math.PI / 2;
  ctx.strokeStyle = fg(0.18); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = pal.mark; ctx.beginPath(); ctx.arc(x, y, r, a0, a0 + frac * Math.PI * 2); ctx.stroke();
  const ta = a0 + (WRIST_MAX / SLAP_FULL) * Math.PI * 2;
  ctx.strokeStyle = FG; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(ta) * (r - 4), y + Math.sin(ta) * (r - 4)); ctx.lineTo(x + Math.cos(ta) * (r + 4), y + Math.sin(ta) * (r + 4)); ctx.stroke();
  ctx.fillStyle = FG; ctx.font = mono(10, 600); ctx.textAlign = 'left'; ctx.fillText(slap ? 'SLAP' : 'WRIST', x + r + 6, y + 4);
}
function shape(team, x, y, r, pal) { bodyPath(team, x, y, r); ctx.fillStyle = team === 0 ? pal.home : pal.away; ctx.fill(); }
function clock(s) { const t = Math.ceil(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }

function hud(g, pal) {
  ctx.textBaseline = 'alphabetic';
  if (g.practice) {
    ctx.textAlign = 'center'; ctx.fillStyle = FG; ctx.font = mono(26, 600);
    ctx.fillText(`${g.score[0]} / ${g.sog[0]}`, W / 2, 38);
    ctx.font = mono(11); ctx.fillStyle = fg(0.6); ctx.fillText('PRACTICE · GOALS / SHOTS ON GOAL', W / 2, 56);
  } else {
    const cx = W / 2;
    ctx.font = mono(30, 600); ctx.fillStyle = FG; ctx.textAlign = 'right'; ctx.fillText(String(g.score[0]), cx - 22, 40);
    ctx.textAlign = 'left'; ctx.fillText(String(g.score[1]), cx + 22, 40);
    ctx.textAlign = 'center'; ctx.fillStyle = fg(0.5); ctx.fillText('–', cx, 38);
    shape(0, cx - 78, 29, 8, pal); shape(1, cx + 78, 29, 8, pal);
    ctx.font = mono(11, 600); ctx.fillStyle = FG; ctx.textAlign = 'right'; ctx.fillText('YOU', cx - 92, 33); ctx.textAlign = 'left'; ctx.fillText('CPU', cx + 92, 33);
    ctx.textAlign = 'center'; ctx.font = mono(12); ctx.fillStyle = fg(0.7);
    ctx.fillText(`${g.ot ? 'OT' : 'P' + g.period} · ${clock(g.clock)}`, cx, 58);
    if (W > 700) {
      ctx.textAlign = 'left'; ctx.fillStyle = fg(0.6); ctx.font = mono(11);
      ctx.fillText(g.level.name.toUpperCase(), 18, 32); ctx.fillText(`SHOTS ${g.sog[0]} – ${g.sog[1]}`, 18, 50);
    }
  }
  // the big call: faceoff, goal, end of period
  let big = '', small = '';
  if (g.phase === 'faceoff') big = 'Faceoff';
  else if (g.phase === 'goal') {
    big = 'Goal';
    const lg = g.lastGoal; if (lg && !g.practice) small = lg.team === 0 ? (lg.by && lg.by.team === 0 ? `You scored · #${lg.by.num}` : 'You scored') : (lg.by ? `CPU scored · #${lg.by.num}` : 'CPU scored');
  } else if (g.phase === 'break') big = g.msg;
  if (big) {
    ctx.textAlign = 'center'; ctx.fillStyle = FG; ctx.font = mono(Math.min(64, W / 12), 600); ctx.fillText(big, W / 2, oy - 40 * sc);
    if (small) { ctx.font = mono(14); ctx.fillStyle = fg(0.75); ctx.fillText(small, W / 2, oy - 40 * sc + 28); }
  }
  // controls hint for what you're doing now
  if (W > 640) {
    const h = g.human, hasPuck = g.puck.owner === h, pad = input.lastDevice === 'controller';
    const tip = hasPuck
      ? (pad ? 'R stick: hold back, flick forward to shoot · R1 pass · R2 saucer · L2 stop' : 'Hold an arrow, tap the opposite one to shoot · E pass · R saucer · Shift stop')
      : (pad ? 'Cross switch · L1 check · push the R stick at the puck to poke · L2 stop' : 'Space switch · Q check · tap an arrow at the puck to poke · Shift stop');
    ctx.textAlign = 'center'; ctx.font = mono(11); ctx.fillStyle = fg(0.55); ctx.fillText(tip, W / 2, H - 14);
  }
}

function drawGame(g, dim) {
  const pal = palette(), calm = reducedMotion();
  drawRink();
  for (const gl of g.goalies) if (gl) drawGoalie(gl, pal, dim);
  for (const s of g.skaters) drawSkater(s, pal, calm, dim);
  drawPuck(g.puck, calm || dim);
  if (!dim && g.human) { drawYou(g.human, pal); drawAim(g.human, g.puck, pal); }
  if (!dim) hud(g, pal);
}
function draw() {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  if (mode === 'menu') { if (demo) drawGame(demo, true); else drawRink(); return; }
  if (game) drawGame(game, false);
}

/* ---------------- loop ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  update(dt); draw();
  requestAnimationFrame(frame);
}
addEventListener('gamepadconnected', () => { input.lastDevice = 'controller'; });
mainMenu();
requestAnimationFrame(frame);
