/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Slapshot: 3-on-3 arcade hockey. The left stick skates, the right stick is your hockey stick.
   Hold the stick back to wind up and flick it forward to shoot: a short wind-up is a quick wrist
   shot, a long one is a slapshot that is harder but easier to read. Big hits make skaters angry, and
   once a game one of them can drop the gloves: squeeze both triggers to take him on. No stat
   training: every skater is the same, so the only thing that gets better is you. */

import { Input } from '../shared/input.js';
import { loadSettings, palette, reducedMotion } from '../shared/settings.js';
import * as look from '../shared/look.js';
import { dummyLabel } from '../shared/seed.js';
import { Game, LEVELS, RINK, SK, PUCK_R, WRIST_MAX, SLAP_FULL, ANGER, FIGHT, blankCmd } from './sim.js?v=4';

const SAVE = 'jay.slapshot.v1';
const LENGTHS = [60, 120, 180, 240];   // period length options, seconds
const LOAD = 0.14;                     // hold the stick back this long and the shot is loaded
const FLICK_WINDOW = 0.25;             // after letting go, this long to flick it forward
const WATCH_NEXT = 6;                  // CPU vs CPU: seconds the result shows before the next match
const FIGHT_ZOOM = 2.6;                // how close the camera comes in on a fight (not with reduced motion)
const SWING_READ = 0.09;               // a punch's power is how deep the trigger got in this long

const input = new Input({
  UP: ['KeyW'], DOWN: ['KeyS'], LEFT: ['KeyA'], RIGHT: ['KeyD'],
  A: ['Space', 'Enter'], B: ['Escape', 'Backspace'], START: ['KeyP'],
  LT: ['ShiftLeft', 'ShiftRight'], LB: ['KeyQ'], RB: ['KeyE'], RT: ['KeyR'],
  SU: ['ArrowUp'], SD: ['ArrowDown'], SL: ['ArrowLeft'], SR: ['ArrowRight'], ESC: ['Escape']
});

/* ---------------- save data (this browser only) ---------------- */
function saved() { try { return localStorage.getItem(SAVE); } catch (e) { return null; } }
function load() {
  let d = {}; try { d = JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) {}
  const rec = {}; for (const l of LEVELS) rec[l.id] = { w: 0, l: 0, t: 0, ...((d.rec || {})[l.id] || {}) };
  const watchLevel = LEVELS.some((l) => l.id === d.watchLevel) ? d.watchLevel : 'pro';
  return { periodLen: LENGTHS.includes(d.periodLen) ? d.periodLen : 120, watchLevel, rec, fresh: !saved() };
}
const data = load();
const persist = () => { try { const { fresh, ...keep } = data; localStorage.setItem(SAVE, JSON.stringify(keep)); } catch (e) {} };

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
    else if (e.type === 'prompt') { tone(520, 0.12, 'square', 0.07); tone(780, 0.22, 'square', 0.05); }
    else if (e.type === 'letgo') tone(300, 0.12, 'triangle', 0.08, 0.7);
    else if (e.type === 'fight') { noise(1.1, 0.22, 300); tone(2100, 0.5, 'sine', 0.08); }
    else if (e.type === 'swing') noise(0.025, 0.05 + 0.05 * e.power, 3000);
    else if (e.type === 'dodge') noise(0.06, 0.1, 2500);
    else if (e.type === 'punch') { noise(0.07, 0.22 + 0.35 * e.power, 150); tone(130 - 50 * e.power, 0.11, 'sine', 0.16 + 0.26 * e.power, 0.55); }
    else if (e.type === 'knockout') { tone(70, 0.5, 'sine', 0.42, 0.5); noise(0.7, 0.34, 200); }
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
const levelName = (id) => (LEVELS.find((l) => l.id === id) || LEVELS[1]).name;
/* team names and seed lines: "dummy a: cannon, seed 3F2A" */
const teamName = (g, t) => (g.watch ? (t === 0 ? 'Dummy A' : 'Dummy B') : t === 0 ? 'You' : 'CPU');
const seedLine = (g, t) => dummyLabel(g.watch ? (t === 0 ? 'dummy a' : 'dummy b') : t === 0 ? 'your line' : 'cpu', g.dummies[t]);

function mainMenu() {
  mode = 'menu'; demo = reducedMotion() ? null : new Game({ level: 'pro', watch: true, periodLen: 9999, noFights: true });
  const lv = LEVELS.map((l) => `<button class="btn" data-go="play" data-arg="${l.id}">Play: ${l.name} <small>${recText(data.rec[l.id])}</small></button>`).join('');
  show(`<p class="label">Game file / Hockey / 3 on 3</p><h1 class="title">Slapshot</h1>
    <div class="menu">${lv}<button class="btn" data-go="watch">CPU vs CPU <small>watch two dummies</small></button>
    <button class="btn" data-go="watchlevel">CPU vs CPU level <small>${levelName(data.watchLevel)}</small></button>
    <button class="btn" data-go="practice">Practice <small>you and a goalie</small></button>
    <button class="btn" data-go="length">Periods <small>3 × ${minutes(data.periodLen)}</small></button>
    <button class="btn" data-go="controls">Controls</button></div>
    <p class="hint">Arcade 3 on 3 with computer goalies. Every skater is the same, so there is nothing to train: you win on how you skate, handle and shoot. Each computer team is a dummy rolled from a seed, so no two play alike. Records are W-L-T, saved in this browser only.</p>`);
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
    <tr><td>Take the fight</td><td>Squeeze L2 + R2 when asked</td><td>Shift + R</td></tr>
    <tr><td>Punch</td><td>L2 and R2 are your hands. Pull deeper to hit harder</td><td>Q jab, E heavy</td></tr>
    <tr><td>Lean away</td><td>Left stick away from him</td><td>A or D, away from him</td></tr>
    <tr><td>Pause</td><td>Options / Start</td><td>P or Esc</td></tr></tbody></table>
    <ul class="blurbs">
      <li><b>Wrist shot:</b> a short wind-up, under ${WRIST_MAX.toFixed(1)} s. Quick and accurate, the goalie barely sees it coming.</li>
      <li><b>Slapshot:</b> keep holding. It gets harder up to ${SLAP_FULL.toFixed(0)} s, but you slow down, defenders step into the lane and the goalie reads it.</li>
      <li><b>Aim:</b> the puck goes the way you flick. The dashed line shows where while you're wound up.</li>
      <li><b>One-timer:</b> wind up before a pass reaches you and flick as it arrives.</li>
      <li><b>Stickhandling:</b> keep the blade moving and poke checks miss more often. Hold the puck on the far side of your body from a defender.</li>
      <li><b>Checks:</b> land one and they drop the puck. Miss and you stumble for a moment.</li>
      <li><b>Anger:</b> taking a big hit, getting poked off the puck and being scored on fill it. It drains on its own, and every team has its own temper.</li>
      <li><b>Fights:</b> only a big hit starts one, and only if the skater who took it is over half angry. You get ${ANGER.prompt} s to answer. Ignore it to play on. One fight a game.</li>
      <li><b>Goalies</b> slide late on quick shots. Pass across the crease and shoot before they get there.</li>
    </ul>
    <p class="hint">Stick drifting? Raise the deadzone in the games settings on the <a href="../">games page</a>. Colour-vision modes are there too.</p>
    <div class="menu"><button class="btn" data-go="${from === 'pause' ? 'pause' : 'menu'}">Back</button></div>`);
}

/* ---------------- game state ---------------- */
let mode = 'menu';     // menu | play | paused | results  (CPU vs CPU is play with game.watch)
let game = null, demo = null, gameOpts = null, endT = 0, nextT = 0;

/* every new game rolls fresh seeds for its dummies */
function newGame(opts) {
  gameOpts = opts;
  game = new Game({ ...opts, humanIdx: opts.watch ? -1 : 0 });
  gesture.reset(); pending = null; resetSwings(); cam.z = 1; hits.length = 0; downT = 0;
  mode = 'play'; hide(); endT = 0; nextT = 0;
}
const watchGame = () => newGame({ level: data.watchLevel, periodLen: data.periodLen, watch: true });
function go(what, arg) {
  audio();
  if (what === 'menu') mainMenu();
  else if (what === 'controls') controls(mode === 'paused' ? 'pause' : 'menu');
  else if (what === 'length') { data.periodLen = LENGTHS[(LENGTHS.indexOf(data.periodLen) + 1) % LENGTHS.length]; persist(); mainMenu(); refocus('length'); }
  else if (what === 'watchlevel') { const i = LEVELS.findIndex((l) => l.id === data.watchLevel); data.watchLevel = LEVELS[(i + 1) % LEVELS.length].id; persist(); mainMenu(); refocus('watchlevel'); }
  else if (what === 'play') newGame({ level: arg, periodLen: data.periodLen });
  else if (what === 'watch') watchGame();
  else if (what === 'practice') newGame({ level: 'pro', practice: true });
  else if (what === 'again') newGame(gameOpts);
  else if (what === 'pause') pause();
  else if (what === 'resume') { mode = 'play'; hide(); }
}
function refocus(go) { const i = menuItems.findIndex((b) => b.dataset.go === go); if (i >= 0) { menuIndex = i; menuItems[i].focus(); } }
function seedHint(g) {
  if (g.practice) return '';
  return `<p class="hint">${g.watch ? `${seedLine(g, 0)}<br>${seedLine(g, 1)}` : seedLine(g, 1)}</p>`;
}
function pause() {
  mode = 'paused';
  const where = game.practice ? ' / Practice' : `${game.watch ? ' / CPU vs CPU' : ''} / ${game.level.name}`;
  show(`<p class="label">Paused${where}</p><h1 class="title">${game.practice ? `${game.score[0]} <small>goals</small>` : `${game.score[0]} – ${game.score[1]}`}</h1>
    ${seedHint(game)}
    <div class="menu"><button class="btn btn--solid" data-go="resume">Resume</button><button class="btn" data-go="again">${game.watch ? 'New match <small>new seeds</small>' : 'Restart'}</button><button class="btn" data-go="controls">Controls</button><button class="btn" data-go="menu">Quit to menu</button></div>`);
}
function results() {
  mode = 'results';
  const [a, b] = game.score, w = game.watch, r = data.rec[game.level.id];
  const res = a > b ? 'w' : a < b ? 'l' : 't';
  if (!w) { r[res]++; persist(); }   // watch games are not recorded
  const head = w ? (res === 't' ? 'Tie game' : `${teamName(game, res === 'w' ? 0 : 1)} wins`) : res === 'w' ? 'You win' : res === 'l' ? 'You lose' : 'Tie game';
  const ot = game.ot ? (res === 't' ? ' after overtime' : ' in overtime') : '';
  nextT = w ? WATCH_NEXT : 0;
  show(`<p class="label">${w ? 'CPU vs CPU / ' : ''}${game.level.name} / Final${ot}</p><h1 class="title">${head} <small>${a} – ${b}</small></h1>
    <table class="board"><tbody>
      <tr><td></td><td>${teamName(game, 0)}</td><td>${teamName(game, 1)}</td></tr>
      <tr><td>Goals</td><td>${a}</td><td>${b}</td></tr>
      <tr><td>Shots on goal</td><td>${game.sog[0]}</td><td>${game.sog[1]}</td></tr>
      <tr><td>Hits</td><td>${game.hits[0]}</td><td>${game.hits[1]}</td></tr></tbody></table>
    ${seedHint(game)}
    <p class="hint">${w ? `Next match with new seeds in <span id="next">${WATCH_NEXT}</span> s. Watch games are not recorded.` : `Record at ${game.level.name}: ${recText(r)}.`}</p>
    <div class="menu"><button class="btn btn--solid" data-go="again">${w ? 'Next match' : 'Play again'}</button><button class="btn" data-go="menu">Menu</button></div>`);
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
    if (mouse.click && !hasPuck && dPuck < 60) c.poke = { dx, dy };
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
    if (g.quick && !g.shoot && !hasPuck && dPuck < 48) {
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
  // while you're being asked to fight, the triggers answer that and R2 does not pass
  if (game.prompt) c.squeeze = s.lt > 0.5 && s.rt > 0.5;
  else if (input.pressed('RT')) c.pass = { dx: s.lx, dy: s.ly, saucer: true };
  if (input.pressed('LB')) c.check = true;
  if (input.pressed('A') && game.switchPlayer()) { gesture.reset(); pending = null; }
  return c;
}

/* ---------------- your fists ---------------- */
let swings, leanHeld = true;
/* a trigger has to come back up before it throws again, so the squeeze that took the fight is not a punch.
   "Up" is the lowest it has read, so a trigger that rests a little pulled in still throws. */
function resetSwings() { swings = [0, 1].map(() => ({ armed: false, t: -1, peak: 0, rest: 0.3 })); leanHeld = true; }
resetSwings();
function fightCommand(dt) {
  const s = input.state, c = blankCmd(), me = game.fight.f.find((m) => m.s === game.human);
  if (!me) return c;
  swings.forEach((w, hand) => {
    const v = hand ? s.rt : s.lt;
    w.rest = Math.min(w.rest, v);
    if (w.t < 0 && w.armed && v > w.rest + 0.15) { w.t = 0; w.peak = v; w.armed = false; }
    if (w.t >= 0) {
      w.t += dt; w.peak = Math.max(w.peak, v);
      if (w.t >= SWING_READ || v < w.peak - 0.1) { c.punch = { hand, power: (w.peak - w.rest) / (1 - w.rest) }; w.t = -1; }
    }
    if (v < w.rest + 0.1) w.armed = true;
  });
  if (input.pressed('LB')) c.punch = { hand: 0, power: 0.35 };
  if (input.pressed('RB')) c.punch = { hand: 1, power: 1 };
  const away = s.lx * me.side > 0.6;
  c.lean = away && !leanHeld; leanHeld = away;
  return c;
}

function update(dt) {
  input.poll();
  if (mode !== 'play') {
    if (demo && mode === 'menu') { demo.step(dt); if (demo.over || demo.t > 240) demo = new Game({ level: 'pro', watch: true, periodLen: 9999, noFights: true }); }
    if (mode === 'results' && game && game.watch && nextT > 0) { // CPU vs CPU rolls on by itself
      nextT -= dt; const el = overlay.querySelector('#next'); if (el) el.textContent = String(Math.max(0, Math.ceil(nextT)));
      if (nextT <= 0) return watchGame();
    }
    return menuInput();
  }
  if (input.pressed('START') || input.pressed('ESC') || (game.watch && input.pressed('B'))) return pause();
  if (game.watch) { // CPU vs CPU: both teams think for themselves, your input only pauses
    game.step(dt); sounds(game.events);
    if (game.over) { endT += dt; if (endT > (game.phase === 'goal' ? 2.4 : 0.6)) results(); }
    return;
  }
  const h = game.human;
  if (game.fight) { h.cmd = fightCommand(dt); gesture.reset(); pending = null; mouse.click = mouse.rclick = false; mouse.release = null; }
  else { h.cmd = humanCommand(dt); resetSwings(); }
  game.step(dt);
  // a pass to a teammate of yours hands you control of them when it arrives
  // (not while you're being asked to fight: the question is for the skater you're on)
  for (const e of game.events) if (e.type === 'pickup' && e.s.team === 0 && !e.s.human && e.intended && !game.prompt) { game.setHuman(e.s); gesture.reset(); pending = null; }
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
let W = 0, H = 0, dpr = 1, sc = 1, ox = 0, oy = 0, base = null;
const cam = { z: 1, x: 0, y: 0 };
const hits = [];     // punches that landed, for the little ring where they hit
let downT = 0;
const TOP = 26, BOTTOM = 12, BOARDS = 9;   // the boards stand this far outside the ice, in rink units
function resize() {
  ({ W, H, dpr } = look.fit(canvas));
  const bx = RINK.HX + BOARDS, by = RINK.HY + BOARDS;
  sc = Math.max(0.3, Math.min((W - 24) / (bx * 2), (H - TOP - BOTTOM) / (by * 2)));
  // spare height goes mostly above the rink, so the crowd has room behind the far boards
  const free = Math.max(0, H - TOP - BOTTOM - by * 2 * sc);
  ox = W / 2; oy = TOP + free * 0.7 + by * sc;
  base = { sc, ox, oy };
}
look.watch(canvas, resize); resize();
/* the camera eases in on a fight and back out again: one slow move each way, no shake */
function camera(g, dt) {
  const F = g && g.fight, want = F && !reducedMotion() ? FIGHT_ZOOM : 1;
  if (F) { cam.x = F.cx; cam.y = F.cy; }
  cam.z += (want - cam.z) * (1 - Math.exp(-3.2 * dt));
  if (Math.abs(cam.z - want) < 0.002) cam.z = want;
  const k = (cam.z - 1) / (FIGHT_ZOOM - 1);
  sc = base.sc * cam.z;
  ox = base.ox + (W / 2 - cam.x * sc - base.ox) * k;
  oy = base.oy + (H * 0.56 - cam.y * sc - base.oy) * k;
}
const X = (x) => ox + x * sc, Y = (y) => oy + y * sc;
/* the pointer gives page coordinates; the canvas now sits inside the stage, so take its box off first */
function toWorld(px, py) { const r = canvas.getBoundingClientRect(); return [(px - r.left - ox) / sc, (py - r.top - oy) / sc]; }

const FG = '#ececec', BG = '#060606', ICE = '#161616', BOARD = '#090909';
const fg = (a) => `rgba(236,236,236,${a})`;
const HUD = look.hud();
let shownCall = '', callGame = null;

function rinkPath(pad = 0) {
  const { HX, HY, CR } = RINK, r = (CR + pad) * sc;
  ctx.beginPath(); ctx.roundRect(X(-HX - pad), Y(-HY - pad), (HX + pad) * 2 * sc, (HY + pad) * 2 * sc, r);
}
/* a line someone is about to cross brightens a little, slowly */
function nearLine(g, x) {
  if (!g || g.phase !== 'play') return false;
  const P = g.puck, o = P.owner;
  return !!o && Math.abs(P.x - x) < 22 && Math.sign(o.vx || 0) === Math.sign(x - P.x);
}
function drawRink(g) {
  const { HY, GX, GW, GD, BLUE, CREASE } = RINK;
  // the boards: a dark band round the ice with a grey edge
  rinkPath(BOARDS); ctx.fillStyle = BOARD; ctx.fill();
  ctx.strokeStyle = look.FLOOR.edge; ctx.lineWidth = 1.5; ctx.stroke();
  // the ice: a slightly lighter grey than the boards, lit in the middle
  rinkPath(); ctx.fillStyle = ICE; ctx.fill();
  ctx.save(); rinkPath(); ctx.clip();
  look.spot(ctx, X(0), Y(0), RINK.HX * 0.95 * sc, RINK.HY * 1.1 * sc);
  // blue lines solid, centre line dashed: told apart by pattern, not colour
  ctx.lineWidth = Math.max(2, 4 * sc);
  for (const x of [-BLUE, BLUE]) {
    const hot = nearLine(g, x);
    ctx.strokeStyle = hot ? look.FLOOR.hot : look.FLOOR.line; ctx.globalAlpha = hot ? look.pulse(performance.now() / 1000) : 0.8;
    ctx.beginPath(); ctx.moveTo(X(x), Y(-HY)); ctx.lineTo(X(x), Y(HY)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([10 * sc, 7 * sc]); ctx.strokeStyle = look.FLOOR.line; ctx.lineWidth = Math.max(1.5, 3 * sc);
  ctx.beginPath(); ctx.moveTo(X(0), Y(-HY)); ctx.lineTo(X(0), Y(HY)); ctx.stroke(); ctx.setLineDash([]);
  // goal lines and circles: the quieter lines
  ctx.lineWidth = Math.max(1, 1.5 * sc); ctx.strokeStyle = look.FLOOR.inner;
  for (const x of [-GX, GX]) { ctx.beginPath(); ctx.moveTo(X(x), Y(-HY)); ctx.lineTo(X(x), Y(HY)); ctx.stroke(); }
  ctx.lineWidth = Math.max(1, 1.2 * sc);
  ctx.beginPath(); ctx.arc(X(0), Y(0), 60 * sc, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = look.FLOOR.mark;
  for (const fx of [-(GX - 90), GX - 90]) for (const fy of [-70, 70]) {
    ctx.beginPath(); ctx.arc(X(fx), Y(fy), 45 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(fx), Y(fy), 3 * sc, 0, Math.PI * 2); ctx.fill();
  }
  for (const fx of [-(BLUE - 25), BLUE - 25]) for (const fy of [-70, 70]) { ctx.beginPath(); ctx.arc(X(fx), Y(fy), 3 * sc, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#a9a9a9'; ctx.beginPath(); ctx.arc(X(0), Y(0), 3 * sc, 0, Math.PI * 2); ctx.fill();
  // creases
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#1f1f1f'; ctx.strokeStyle = look.FLOOR.mark; ctx.lineWidth = Math.max(1, 1.2 * sc);
    ctx.beginPath(); ctx.arc(X(side * GX), Y(0), CREASE * sc, side < 0 ? -Math.PI / 2 : Math.PI / 2, side < 0 ? Math.PI / 2 : Math.PI * 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // nets: a box with mesh
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -GX - GD : GX, w = GD;
    ctx.fillStyle = '#101010'; ctx.fillRect(X(x0), Y(-GW), w * sc, GW * 2 * sc);
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { const y = -GW + (GW * 2 * i) / 6; ctx.beginPath(); ctx.moveTo(X(x0), Y(y)); ctx.lineTo(X(x0 + w), Y(y)); ctx.stroke(); }
    ctx.strokeStyle = FG; ctx.lineWidth = Math.max(1.5, 2 * sc);
    ctx.beginPath();
    if (side < 0) { ctx.moveTo(X(-GX), Y(-GW)); ctx.lineTo(X(-GX - GD), Y(-GW)); ctx.lineTo(X(-GX - GD), Y(GW)); ctx.lineTo(X(-GX), Y(GW)); }
    else { ctx.moveTo(X(GX), Y(-GW)); ctx.lineTo(X(GX + GD), Y(-GW)); ctx.lineTo(X(GX + GD), Y(GW)); ctx.lineTo(X(GX), Y(GW)); }
    ctx.stroke();
  }
  // the boundary: the top of the boards
  rinkPath(); ctx.strokeStyle = look.FLOOR.line; ctx.lineWidth = 2; ctx.stroke();
}
/* where the far boards meet the stands, so the crowd sits behind the rink */
const horizonY = () => Math.max(0, Y(-RINK.HY - BOARDS));

/* home skaters are circles, away skaters are diamonds: shape and shade tell the teams apart, not just the band */
function bodyPath(team, x, y, r) {
  ctx.beginPath();
  if (team === 0) ctx.arc(x, y, r, 0, Math.PI * 2);
  else { const d = r * 1.18; ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath(); }
}
/* a shaded body in a side's suit tones, the dark side with its light rim behind it */
function body(team, x, y, r, T, path = bodyPath) {
  if (T.rim) { path(team, x, y, r); ctx.strokeStyle = T.rim; ctx.lineWidth = 2.5; ctx.stroke(); }
  const gr = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * 1.2);
  gr.addColorStop(0, T.suit[0]); gr.addColorStop(.6, T.suit[1]); gr.addColorStop(1, T.suit[2]);
  path(team, x, y, r); ctx.fillStyle = gr; ctx.fill();
}
function drawSkater(s, calm, dim) {
  const x = X(s.x), y = Y(s.y), r = SK.r * sc, T = look.team(s.team);
  if (s.spray > 0 && !calm) {
    ctx.fillStyle = `rgba(210,210,210,${0.35 * Math.min(1, s.spray / 0.15)})`;
    for (let i = 0; i < 5; i++) { const a = Math.atan2(s.vy, s.vx) + (i - 2) * 0.4; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5, 1.2, 0, Math.PI * 2); ctx.fill(); }
  }
  if (s.spray > 0) s.spray -= 1 / 60;
  ctx.globalAlpha = dim ? 0.45 : s.stun ? 0.5 : 1;
  // stick: shaft from the gloves, the band on the gloves, then the blade
  const [bx, by] = s.blade, px = X(bx), py = Y(by);
  const gx = x + (px - x) * 0.35, gy = y + (py - y) * 0.35;
  const ang = Math.atan2(by - s.y, bx - s.x) + Math.PI / 2, bl = 5 * sc;
  look.strokeLimb(ctx, () => { ctx.moveTo(gx, gy); ctx.lineTo(px, py); }, Math.max(2.5, 2.6 * sc), T, T.suit);
  look.strokeLimb(ctx, () => { ctx.moveTo(px - Math.cos(ang) * bl, py - Math.sin(ang) * bl); ctx.lineTo(px + Math.cos(ang) * bl, py + Math.sin(ang) * bl); }, Math.max(3.5, 4 * sc), T, T.suit);
  // body
  body(s.team, x, y, r, T);
  look.band(ctx, gx, gy, Math.max(2.2, 2.6 * sc), T);
  // facing notch
  ctx.fillStyle = T.light ? BG : FG; ctx.beginPath(); ctx.arc(x + s.fx * r * 0.62, y + s.fy * r * 0.62, Math.max(1.2, r * 0.18), 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  if (s.stun) { // down on the ice: a dashed ring, no flashing
    ctx.setLineDash([3, 3]); ctx.strokeStyle = FG; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.globalAlpha = dim ? 0.45 : 1;
  ctx.fillStyle = T.light ? BG : FG; ctx.font = look.mono(Math.max(8, r * 0.95)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(s.num), x, y + 0.5);
  ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
}
/* a fighter: no stick, two fists with the team band at the wrist */
const ease = (u) => u * u * (3 - 2 * u);
function reach(m, hand) {
  const p = m.punch;
  if (p && p.hand === hand) {
    const u = Math.min(1, p.t / p.dur), back = -0.45 * p.power;   // a big one is drawn back further first
    return u < 0.4 ? back * ease(u / 0.4) : back + (1 - back) * ease((u - 0.4) / 0.6);
  }
  return !p && m.last === hand && m.rest > 0 ? m.rest / 0.16 : 0;
}
function drawFighter(m, F) {
  const s = m.s, x = X(s.x), y = Y(s.y), r = SK.r * sc, T = look.team(s.team);
  const fall = s.down ? ease(Math.min(1, F.overT / 0.45)) : 0;
  const face = -m.side;
  if (!fall) for (const hand of [0, 1]) {
    const lat = (hand ? 1 : -1) * face, e = reach(m, hand);
    const gx = 11, gy = lat * 6, tx = FIGHT.gap - SK.r * 0.9, ty = lat * 1;
    const fx = x + face * (gx + (tx - gx) * e) * sc, fy = y + (gy + (ty - gy) * Math.max(0, e)) * sc;
    const sx = x + face * 2.5 * sc, sy = y + lat * 6.5 * sc;
    look.strokeLimb(ctx, () => { ctx.moveTo(sx, sy); ctx.lineTo(fx, fy); }, Math.max(3, 3.4 * sc), T, T.suit);
    look.band(ctx, sx + (fx - sx) * 0.72, sy + (fy - sy) * 0.72, Math.max(2.2, 2.4 * sc), T);
    look.ball(ctx, fx, fy, Math.max(2.8, 3 * sc), T);
  }
  ctx.save(); ctx.translate(x, y);
  ctx.globalAlpha = 1 - 0.3 * fall;
  ctx.scale(1 + 0.5 * fall, 1 - 0.28 * fall);
  body(s.team, 0, 0, r, T);
  ctx.fillStyle = T.light ? BG : FG; ctx.font = look.mono(Math.max(8, r * 0.95)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(s.num), 0, 0.5); ctx.textBaseline = 'alphabetic';
  ctx.restore(); ctx.globalAlpha = 1;
  if (fall) { ctx.setLineDash([3, 3]); ctx.strokeStyle = fg(0.8 * fall); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, r * 1.85, r * 1.25, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
}
/* sticks and gloves left on the ice: they slide out as the fight starts */
function drawGear(F, calm) {
  const k = calm ? 1 : ease(Math.min(1, F.t / 0.6));
  for (const m of F.f) {
    const T = look.team(m.s.team), side = m.side;
    const at = (dx, dy) => [X(F.cx + side * (8 + dx * k)), Y(F.cy + dy * k)];
    const [ax, ay] = at(14, 20), [bx, by] = at(38, 27);
    ctx.globalAlpha = 0.8;
    look.strokeLimb(ctx, () => { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx + side * 5 * sc, by - 4 * sc); }, Math.max(2, 2.2 * sc), T, T.suit);
    // two gloves: a mitt with a cuff, lying where they landed
    [[at(31, -9), 0.7], [at(44, 7), -1.1]].forEach(([[gx, gy], turn]) => {
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(turn * side * (0.4 + 0.6 * k));
      const u = Math.max(0.7, sc);
      ctx.fillStyle = '#242424'; ctx.strokeStyle = fg(0.75); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(-3.4 * u, -2.6 * u, 6.2 * u, 5.2 * u, 2.2 * u); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-5.4 * u, -2.1 * u, 2.2 * u, 4.2 * u, 0.6 * u); ctx.fill(); ctx.stroke();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }
}
function drawHealth(F) {
  const w = 64, h = 6;
  for (const m of F.f) {
    const x = X(m.s.x) + m.side * 36 - w / 2, y = Y(m.s.y) - SK.r * sc - 24;
    ctx.fillStyle = BG; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.strokeStyle = fg(0.7); ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    // both bars empty toward the middle
    const len = w * m.hp / 100; ctx.fillStyle = FG; ctx.fillRect(m.side < 0 ? x : x + w - len, y, len, h);
    look.tag(ctx, x + w / 2, y - 12, m.s.human ? `you #${m.s.num}` : `#${m.s.num}`, { size: 10, pad: 4 });
  }
}
function drawHits(dt, calm) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i]; h.t += dt;
    if (h.t > 0.3) { hits.splice(i, 1); continue; }
    if (calm) continue;
    const u = h.t / 0.3;
    ctx.strokeStyle = fg(0.55 * (1 - u)); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(X(h.x), Y(h.y), (3 + (4 + 9 * h.power) * u) * sc, 0, Math.PI * 2); ctx.stroke();
  }
}
/* a short bar under anyone angry enough to snap, and under you as soon as there's any */
function drawAnger(g) {
  if (g.noFights || g.fought) return;
  for (const s of g.skaters) {
    if (!(s.anger > ANGER.snap || (s.human && s.anger >= 1))) continue;
    const w = Math.max(18, 20 * sc), x = X(s.x) - w / 2, y = Y(s.y) + SK.r * sc + 8;
    ctx.fillStyle = BG; ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = s.anger > ANGER.snap ? FG : '#777'; ctx.fillRect(x, y, w * s.anger / ANGER.max, 3);
    ctx.fillStyle = FG; ctx.fillRect(x + w * ANGER.snap / ANGER.max, y - 2, 1, 7);
  }
}
/* the question: one second, both triggers */
function drawPrompt(g) {
  const q = g.prompt; if (!q || !q.me.human) return;
  const pad = input.lastDevice === 'controller', w = 236, h = 84;
  const x = Math.max(8, Math.min(W - w - 8, X(q.me.x) - w / 2));
  let y = Y(q.me.y) - SK.r * sc - h - 30; if (y < 8) y = Y(q.me.y) + SK.r * sc + 22;
  ctx.fillStyle = 'rgba(4,4,4,.92)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = FG; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a9a9a9'; ctx.font = look.mono(10); ctx.fillText((q.theirs ? `#${q.foe.num} wants to go` : `drop them on #${q.foe.num}?`).toUpperCase(), x + w / 2, y + 18);
  ctx.fillStyle = FG; ctx.font = look.mono(16); ctx.fillText(pad ? 'SQUEEZE L2 + R2' : 'PRESS SHIFT + R', x + w / 2, y + 40);
  // how far each trigger is in
  [input.state.lt, input.state.rt].forEach((v, i) => {
    const bx = x + (i ? w / 2 + 6 : 16), bw = w / 2 - 22;
    ctx.strokeStyle = fg(0.45); ctx.lineWidth = 1; ctx.strokeRect(bx, y + 52, bw, 9);
    ctx.fillStyle = FG; ctx.fillRect(bx, y + 52, bw * v, 9);
  });
  // time left
  ctx.fillStyle = '#333'; ctx.fillRect(x + 16, y + 70, w - 32, 4);
  ctx.fillStyle = FG; ctx.fillRect(x + 16, y + 70, (w - 32) * Math.max(0, q.t / ANGER.prompt), 4);
}
function drawYou(s) {
  const x = X(s.x), y = Y(s.y), r = SK.r * sc;
  ctx.strokeStyle = 'rgba(236,236,236,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 6, 0, Math.PI * 2); ctx.stroke();
  look.tag(ctx, x, y - r - 16, 'YOU', { size: 10, pad: 4 });
}
function goaliePath(team, x, y, rx) {
  const ry = rx / 0.75 * 1.1;
  ctx.beginPath();
  if (team === 0) ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  else { ctx.moveTo(x, y - ry * 1.1); ctx.lineTo(x + rx * 1.2, y); ctx.lineTo(x, y + ry * 1.1); ctx.lineTo(x - rx * 1.2, y); ctx.closePath(); }
}
function drawGoalie(g, dim) {
  const x = X(g.x), y = Y(g.y), T = look.team(g.team), rx = g.size * 0.75 * sc, ry = g.size * 1.1 * sc;
  ctx.globalAlpha = dim ? 0.45 : 1;
  body(g.team, x, y, rx, T, goaliePath);
  // the band on the catching glove, out toward the play
  look.band(ctx, x + g.out * rx * 0.55, y - ry * 0.7, Math.max(2.2, 2.6 * sc), T);
  ctx.fillStyle = T.light ? BG : FG; ctx.font = look.mono(Math.max(8, g.size * 0.85 * sc)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('G', x, y + 0.5); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
}
let trail = [];
function drawPuck(P, calm) {
  const lift = P.z * 10 * sc, x = X(P.x), y = Y(P.y) - lift, r = Math.max(2.5, PUCK_R * sc) * (1 + P.z * 0.35);
  const v = Math.hypot(P.vx, P.vy);
  if (!calm && !P.owner && v > 300) { trail.push([x, y]); if (trail.length > 6) trail.shift(); } else trail.length = 0;
  trail.forEach(([tx, ty], i) => { ctx.fillStyle = `rgba(255,255,255,${0.05 + i * 0.03})`; ctx.beginPath(); ctx.arc(tx, ty, r * 0.8, 0, Math.PI * 2); ctx.fill(); });
  if (P.z > 0.02) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(X(P.x), Y(P.y), r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = fg(0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, Math.PI * 2); ctx.stroke();
  look.ball(ctx, x, y, r, null, look.TONE.white);
  ctx.strokeStyle = BG; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}
function drawAim(h, P) {
  if (!(h.windup > 0) || pending) return;
  const dx = -h.wdx, dy = -h.wdy, slap = h.windup >= WRIST_MAX, L = (70 + 150 * (h.windup / SLAP_FULL)) * sc;
  const sx = X(P.owner === h ? P.x : h.x), sy = Y(P.owner === h ? P.y : h.y);
  ctx.strokeStyle = fg(0.5); ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]);
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + dx * L, sy + dy * L); ctx.stroke(); ctx.setLineDash([]);
  // wind-up meter: a ring that fills, with a tick where a wrist shot becomes a slapshot
  const x = X(h.x), y = Y(h.y), r = SK.r * sc + 11, frac = h.windup / SLAP_FULL, a0 = -Math.PI / 2;
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = FG; ctx.beginPath(); ctx.arc(x, y, r, a0, a0 + frac * Math.PI * 2); ctx.stroke();
  const ta = a0 + (WRIST_MAX / SLAP_FULL) * Math.PI * 2;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(ta) * (r - 4), y + Math.sin(ta) * (r - 4)); ctx.lineTo(x + Math.cos(ta) * (r + 4), y + Math.sin(ta) * (r + 4)); ctx.stroke();
  look.tag(ctx, x + r + 6, y, slap ? 'slap' : 'wrist', { size: 10, pad: 4, align: 'left' });
}
function clock(s) { const t = Math.ceil(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }

/* ---------------- HUD: the scoreboard, calls and button bar live on the page, around the stage ---------------- */
function board(g) {
  if (!g) { HUD.board({ a: { name: 'you', sub: look.bandWord(0), score: 0 }, b: { name: 'cpu', sub: look.bandWord(1), score: 0 }, clock: '--' }); return; }
  if (g.practice) {
    HUD.board({ a: { name: 'practice', sub: 'goals', score: g.score[0] }, b: { name: 'goalie', sub: 'shots on goal', score: g.sog[0] }, clock: '--' });
    return;
  }
  const own = g.phase === 'play' && g.puck.owner ? g.puck.owner.team : -1;
  HUD.board({
    a: { name: teamName(g, 0).toLowerCase(), sub: `${look.bandWord(0)} · shots ${g.sog[0]}`, score: g.score[0], has: own === 0 },
    b: { name: teamName(g, 1).toLowerCase(), sub: `${look.bandWord(1)} · ${g.level.name} · shots ${g.sog[1]}`, score: g.score[1], has: own === 1 },
    clock: `${g.ot ? 'OT' : 'P' + g.period} ${clock(g.clock)}`, low: g.clock <= 10 && g.phase === 'play'
  });
}
function calls(g) {
  // the big call: faceoff, goal, end of period, stamped in once when it changes
  if (g !== callGame) { callGame = g; shownCall = ''; }
  let key = '', big = '', small = '', title = false;
  if (g.phase === 'faceoff') { key = 'faceoff' + g.period + g.score.join(); big = 'Faceoff'; }
  else if (g.phase === 'goal') {
    big = 'Goal'; title = true;
    const lg = g.lastGoal; if (lg && !g.practice) small = `${teamName(g, lg.team).toLowerCase()} scored${lg.by && lg.by.team === lg.team ? ` · #${lg.by.num}` : ''}`;
    key = 'goal' + g.score.join();
  } else if (g.phase === 'break') { key = 'break' + g.period + g.msg; big = g.msg; }
  else if (g.phase === 'fight') {
    const F = g.fight, [a, b] = F.f;
    if (F.winner) {
      key = 'scrap won'; big = `#${F.winner.num} wins`;
      const side = F.winner.team === 0 ? 'your line takes' : 'cpu takes';
      small = F.winner === g.human ? 'you take the scrap' : `${g.watch ? `${teamName(g, F.winner.team).toLowerCase()} takes` : side} the scrap`;
    }
    else { key = 'scrap'; big = 'Fight'; title = true; small = `#${a.s.num} vs #${b.s.num} · gloves off`; }
  }
  if (key && key !== shownCall) HUD.call(big, small, title);
  shownCall = key;
  for (const e of g.events) {
    if (e.type === 'goal') look.cheer(0.9);
    else if (e.type === 'hit') look.cheer(0.5);
    else if (e.type === 'post') look.cheer(0.6);
    else if (e.type === 'fight') look.cheer(0.9);
    else if (e.type === 'punch') { look.cheer(0.2 + 0.3 * e.power); hits.push({ x: (e.by.x + e.on.x * 2) / 3, y: (e.by.y + e.on.y * 2) / 3, power: e.power, t: 0 }); }
    else if (e.type === 'knockout') look.cheer(1);
    else if (e.type === 'letgo') HUD.call('Play on', 'you let it go');
  }
  HUD.msg(g.phase === 'fight' ? 'the clock is stopped' : g.ot && g.phase === 'play' ? 'sudden death' : '');
}
function seeds(g) {
  // seed tags: the CPU team's style and seed, or both dummies when watching
  if (g.practice || W < 520) return;
  const lines = g.watch ? [seedLine(g, 0), seedLine(g, 1)] : [seedLine(g, 1)];
  lines.reverse().forEach((l, i) => look.tag(ctx, 14, H - 22 - i * 22, l, { size: 10, align: 'left', pad: 4 }));
}
function playBar(g) {
  const pad = input.lastDevice === 'controller', c = (k, t, open) => ({ k, t, open });
  if (g.fight && g.human && g.fight.f.some((m) => m.s === g.human)) {
    HUD.bar('fighting', pad ? [c('L2', 'left', true), c('R2', 'right', true), c('L', 'away: lean', true)] : [c('Q', 'jab', true), c('E', 'heavy', true), c('A / D', 'away: lean', true)], pad ? 'pull deeper to hit harder. harder is slower' : 'the heavy one is slower: he can lean off it');
    return;
  }
  if (g.fight) { HUD.bar('fight', [], 'play stops until someone goes down'); return; }
  if (g.prompt && g.prompt.me.human) { HUD.bar('your call', pad ? [c('L2 + R2', 'fight', true)] : [c('shift + R', 'fight', true)], 'do nothing to play on'); return; }
  if (g.watch) {
    HUD.bar('watching', [{ k: pad ? 'options' : 'P / esc', t: 'pause', open: true }], 'two seeded dummies. the next game starts by itself');
    return;
  }
  const h = g.human; if (!h) return;
  const P = g.puck, hasPuck = P.owner === h;
  if (g.phase !== 'play') { HUD.bar(g.phase === 'goal' ? 'goal' : g.phase === 'faceoff' ? 'faceoff' : 'break', [], 'play stops for a moment'); return; }
  if (h.windup > 0 && !pending) {
    const slap = h.windup >= WRIST_MAX;
    HUD.bar('winding up', pad ? [c('R', 'flick forward: shoot', true), c('L', 'skate')] : [c('arrows', 'tap the opposite one: shoot', true), c('mouse', 'or let go of the button', true)], slap ? 'slapshot: harder, but the goalie reads it' : 'wrist shot: quick, the goalie sees it late');
    return;
  }
  const dPuck = Math.hypot(P.x - h.x, P.y - h.y), them = P.owner && P.owner.team !== h.team;
  const near = them && Math.hypot(P.owner.x - h.x, P.owner.y - h.y) < 45;
  if (hasPuck) HUD.bar('on the puck', pad ? [c('R', 'hold back, flick: shoot', true), c('R1', 'pass', true), c('R2', 'saucer'), c('L2', 'stop')] : [c('arrows', 'hold one, tap the opposite: shoot', true), c('E', 'pass', true), c('R', 'saucer'), c('shift', 'stop')], 'pass goes where you push to skate');
  else HUD.bar(them ? 'defense' : P.owner ? 'support' : 'loose puck', pad ? [c('✕', 'switch', true), c('L1', 'check', near), c('R', 'push at the puck: poke', !P.owner || them ? dPuck < 48 : false), c('L2', 'stop')] : [c('space', 'switch', true), c('Q', 'check', near), c('arrows', 'tap at the puck: poke', !P.owner || them ? dPuck < 48 : false), c('shift', 'stop')], them ? 'land a check and they drop it. miss and you stumble' : 'wind up early for a one-timer');
}
function menuBar() {
  const pad = input.lastDevice === 'controller';
  HUD.bar(mode === 'paused' ? 'paused' : mode === 'results' ? 'final' : 'menu', pad ? [{ k: '↕', t: 'pick' }, { k: '✕', t: 'choose', open: true }, { k: '○', t: 'back' }] : [{ k: '↕', t: 'pick' }, { k: 'enter', t: 'choose', open: true }, { k: 'esc', t: 'back' }]);
}

function drawGame(g, dim) {
  const calm = reducedMotion();
  drawRink(dim ? null : g);
  for (const gl of g.goalies) if (gl) drawGoalie(gl, dim);
  const F = g.fight, men = F ? F.f.map((m) => m.s) : [];
  if (F) drawGear(F, calm);
  for (const s of g.skaters) if (!men.includes(s)) drawSkater(s, calm, dim);
  if (!F) drawPuck(g.puck, calm || dim);   // the officials have the puck during a fight
  if (F) {
    // the one on the ice goes underneath
    for (const m of [...F.f].sort((a, b) => b.s.down - a.s.down)) drawFighter(m, F);
    drawHits(frameDt, calm); drawHealth(F);
    return;
  }
  if (dim) return;
  drawAnger(g);
  if (g.human) { drawYou(g.human); drawAim(g.human, g.puck); drawPrompt(g); }
}
let frameDt = 1 / 60;
function draw(dt) {
  HUD.tick(dt, input);
  frameDt = mode === 'paused' ? 0 : dt;
  camera(mode === 'menu' ? null : game, frameDt);
  look.arena(ctx, W, H, { horizon: horizonY(), dt });
  if (mode === 'menu') { if (demo) drawGame(demo, true); else drawRink(null); board(null); HUD.msg(''); menuBar(); return; }
  if (game) {
    drawGame(game, false); seeds(game); board(game);
    if (mode === 'play') { calls(game); playBar(game); } else { HUD.msg(''); menuBar(); }
  }
}

/* ---------------- loop ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  update(dt); draw(dt);
  requestAnimationFrame(frame);
}
document.documentElement.classList.toggle('calm', reducedMotion());
addEventListener('gamepadconnected', () => { input.lastDevice = 'controller'; });
mainMenu();
// phones can't play without a pad: on a first visit from a touch screen, open straight into CPU vs CPU
if (data.fresh && matchMedia('(pointer: coarse)').matches) watchGame();
requestAnimationFrame(frame);
