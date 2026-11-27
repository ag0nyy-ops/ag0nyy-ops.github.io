/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Moves: a side-on floor routine. Left stick is your arms, right stick your legs, the triggers
   pull you into a tuck or a pike. Run, hurdle, punch, spin, open, stick it. The judges score
   what your body actually did. Nothing to unlock: every skill is there from the first pass. */

import { Input } from '../shared/input.js';
import { loadSettings, palette, reducedMotion } from '../shared/settings.js';
import { makeDummy, newSeed, dummyLabel } from '../shared/seed.js';
import {
  FLOOR, VMAX, HURDLE, TAU, STEP_AT, clamp, scoreRoutine, REQUIREMENTS, fmt, NO_INPUT,
  Performer, CpuGymnast, DUMMY_RANGES, DUMMY_STYLES, DUMMY_FALLBACK
} from './sim.js';

const SAVE = 'jay.moves.v1';
const PASSES = 4;

/* keyboard: WASD is the arms (left stick), arrows are the legs (right stick), F tuck, J pike */
const input = new Input({
  UP: ['KeyW'], DOWN: ['KeyS'], LEFT: ['KeyA'], RIGHT: ['KeyD'],
  LU: ['ArrowUp'], LD: ['ArrowDown'], LL: ['ArrowLeft'], LR: ['ArrowRight'],
  LT: ['KeyF'], RT: ['KeyJ'], A: ['Space', 'Enter'], B: ['Escape', 'Backspace'], START: ['KeyP']
});

/* ---------------- save data (this browser only) ---------------- */
function load() {
  let d = {}; try { d = JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) {}
  return { best: d.best || null };
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
function tone(freq, len = 0.08, type = 'sine', vol = 0.2) {
  const a = audio(); const v = loadSettings().volume * vol; if (!a || v <= 0) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(v, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + len);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + len);
}
const thud = (hard = 0.5) => tone(70 + 30 * (1 - hard), 0.18, 'sine', 0.25 + 0.3 * hard);

/* ---------------- legs stick: keyboard arrows or the right stick ---------------- */
function legsStick() {
  const s = input.state;
  const kx = (s.act.LR ? 1 : 0) - (s.act.LL ? 1 : 0), ky = (s.act.LD ? 1 : 0) - (s.act.LU ? 1 : 0);
  if (kx || ky) { const m = Math.hypot(kx, ky); return { x: kx / m, y: ky / m }; }
  return { x: s.rx, y: s.ry };
}
/* ---------------- screens (DOM overlay, driven by controller or keyboard) ---------------- */
const $ = (sel) => document.querySelector(sel);
const overlay = $('#overlay');
const backLink = document.querySelector('.back');
let menuItems = [], menuIndex = 0;
function show(html) {
  overlay.innerHTML = `<div class="panel">${html}</div>`; overlay.hidden = false; if (backLink) backLink.hidden = false;
  menuItems = [...overlay.querySelectorAll('button')];
  menuIndex = 0;
  if (menuItems[0]) menuItems[0].focus();
  menuItems.forEach((b, i) => b.addEventListener('focus', () => { menuIndex = i; }));
}
function hide() { overlay.hidden = true; overlay.innerHTML = ''; menuItems = []; if (backLink) backLink.hidden = true; }
overlay.addEventListener('click', (e) => { const b = e.target.closest('button[data-go]'); if (b) go(b.dataset.go, b.dataset.arg); });

let mode = 'menu';          // menu | play | paused | results
const WATCH_RESULT = 6;     // seconds a CPU vs CPU result stays up before the next match starts
let game = null;

function mainMenu() {
  mode = 'menu'; game = null;
  const best = data.best ? ` <small>best ${data.best.total.toFixed(2)}</small>` : '';
  show(`<p class="label">Game file / Gymnastics / Floor</p><h1 class="title">Moves</h1>
    <div class="menu">
      <button class="btn btn--solid" data-go="play" data-arg="routine">Routine${best}</button>
      <button class="btn" data-go="play" data-arg="free">Free floor <small>practice</small></button>
      <button class="btn" data-go="play" data-arg="slow">Free floor <small>half speed</small></button>
      <button class="btn" data-go="play" data-arg="watch">CPU vs CPU <small>watch</small></button>
      <button class="btn" data-go="skills">Move list</button>
      <button class="btn" data-go="controls">Controls</button>
      <button class="btn" data-go="home">All games</button>
    </div>
    <p class="hint">A routine is ${PASSES} passes across the floor. Judges score difficulty (D) for what you throw and execution (E) from 10 for how clean it is. Every skill is open from the start. CPU vs CPU: two seeded dummies take turns, ${PASSES} passes each, best score wins.</p>`);
}

function controls(back = 'menu') {
  mode = mode === 'paused' ? 'paused' : 'menu';
  show(`<p class="label">Controls</p><h1 class="title">How to move</h1>
    <table class="keys"><thead><tr><th></th><th>Controller</th><th>Keyboard</th></tr></thead><tbody>
    <tr><td>Run</td><td>Right stick toward the far side</td><td>Arrow toward the far side, held</td></tr>
    <tr><td>Hurdle</td><td>Left stick up (arms up)</td><td>W</td></tr>
    <tr><td>Punch</td><td>Let the right stick go, then flick it as the rings meet</td><td>Let go, then tap an arrow as the rings meet</td></tr>
    <tr><td>Back salto</td><td>Flick back, away from where you're going</td><td>Arrow back</td></tr>
    <tr><td>Front salto</td><td>Flick forward</td><td>Arrow forward</td></tr>
    <tr><td>Twist</td><td>Flick diagonally up and back (or up and forward)</td><td>Two arrows, back or forward plus up</td></tr>
    <tr><td>Jump</td><td>Flick straight up</td><td>Arrow up</td></tr>
    <tr><td>Tuck</td><td>L2, how far you pull is how tight</td><td>F</td></tr>
    <tr><td>Pike</td><td>R2</td><td>J</td></tr>
    <tr><td>Twist faster</td><td>Left stick down (arms in)</td><td>S</td></tr>
    <tr><td>Steady the landing</td><td>Left stick left or right</td><td>A or D</td></tr>
    <tr><td>Finish</td><td>Left stick up once you're still</td><td>W</td></tr>
    <tr><td>Pause</td><td>Options / Start</td><td>P or Esc</td></tr></tbody></table>
    <ul class="blurbs">
      <li><b>Spin comes from the takeoff.</b> Run faster and punch on time and you go higher and spin harder. After that it's fixed.</li>
      <li><b>Tuck to spin fast, open to slow down.</b> Watch the dial in the corner and open up before your feet come round, or you land short or tucked.</li>
      <li><b>Twists work like spin.</b> Arms in twists faster, arms out slows it. Land on a whole or half turn.</li>
      <li><b>Landing.</b> Anything you under or over rotated becomes lean. Push against it to stand still, then arms up to finish.</li>
      <li><b>Connect.</b> Flick again the instant you land a salto and you rebound straight into another skill. Each connection is worth 0.1.</li>
      <li><b>Run out of floor?</b> You walk back and try the pass again. A flick straight down does nothing.</li>
    </ul>
    <p class="hint">Stick drifting? Raise the deadzone in the games settings on the <a href="../">games page</a>. These controls are a first take and can change.</p>
    <div class="menu"><button class="btn" data-go="${back}">Back</button></div>`);
}

function skills(back = 'menu') {
  mode = mode === 'paused' ? 'paused' : 'menu';
  const row = (n, how, d) => `<tr><td>${n}</td><td>${how}</td><td>${d}</td></tr>`;
  show(`<p class="label">Move list</p><h1 class="title">What scores</h1>
    <table class="keys"><thead><tr><th>Skill</th><th>How</th><th>D</th></tr></thead><tbody>
    ${row('Straight, tuck, pike, split jump', 'Flick up. Tuck, pike, or hold the legs stick sideways', '0.0 to 0.1')}
    ${row('Back tuck / pike / layout', 'Flick back. Tuck, pike, or stay straight', '0.1 / 0.2 / 0.3')}
    ${row('Double back tuck / pike / layout', 'Full run, punch on time, stay tight for two turns', '0.4 / 0.5 / 0.7')}
    ${row('Triple back tuck', 'Everything perfect, open late', '0.9')}
    ${row('Front saltos', 'Flick forward. Same as back, worth 0.1 more', '+0.1')}
    ${row('Twists', 'Flick diagonal. Each half twist on a single', '+0.1')}
    ${row('Twists on a double or more', 'Each half twist', '+0.2')}
    ${row('Connection', 'Rebound straight into the next skill', '+0.1')}
    </tbody></table>
    <h2 class="label">Routine requirements, 0.5 each</h2>
    <ul class="blurbs">${REQUIREMENTS.map((r) => `<li>${r.name}</li>`).join('')}</ul>
    <h2 class="label">Common deductions</h2>
    <ul class="blurbs">
      <li><b>0.1:</b> step, loose tuck or pike, bent body, legs apart, low, twist not finished, no finish, out of bounds</li>
      <li><b>0.3:</b> large step, squat landing, landed off line, legs apart the whole way</li>
      <li><b>1.0:</b> fall</li>
    </ul>
    <div class="menu"><button class="btn" data-go="${back}">Back</button></div>`);
}

function pause() {
  mode = 'paused';
  const seeds = game.dummies ? `<ul class="blurbs">${game.dummies.map((d, i) => `<li>${dummyLabel(NAMES[i], d)}</li>`).join('')}</ul>` : '';
  show(`<p class="label">Paused${game.kind === 'watch' ? ' / CPU vs CPU' : ''}</p>${seeds}<div class="menu">
    <button class="btn btn--solid" data-go="resume">Resume</button>
    ${game.kind === 'free' || game.kind === 'slow' ? '<button class="btn" data-go="endfree">End practice</button>' : ''}
    <button class="btn" data-go="restart">${game.kind === 'watch' ? 'New match <small>new seeds</small>' : 'Restart'}</button>
    <button class="btn" data-go="pcontrols">Controls</button>
    <button class="btn" data-go="pskills">Move list</button>
    <button class="btn" data-go="menu">Quit to menu</button></div>`);
}

function go(what, arg) {
  audio();
  if (what === 'menu') mainMenu();
  else if (what === 'controls') controls();
  else if (what === 'skills') skills();
  else if (what === 'pcontrols') controls('pause');
  else if (what === 'pskills') skills('pause');
  else if (what === 'pause') pause();
  else if (what === 'home') location.href = '../';
  else if (what === 'play') newGame(arg);
  else if (what === 'restart' || what === 'again') newGame(game ? game.kind : 'routine');
  else if (what === 'resume') { mode = 'play'; hide(); }
  else if (what === 'endfree') results();
}

/* ---------------- game state ----------------
   The body and the pass logic live in sim.js (Performer). A person drives it from the pad here;
   in CPU vs CPU two seeded dummies (CpuGymnast) drive their own and take turns, pass by pass. */
const NAMES = ['dummy a', 'dummy b'];
function sounds(perf) {
  perf.on = (ev, v) => {
    if (ev === 'hurdle') tone(330, 0.05, 'triangle', 0.08);
    else if (ev === 'punch') tone(220 + 300 * v, 0.06, 'triangle', 0.12);
    else if (ev === 'thud') thud(v);
    else if (ev === 'finish') tone(520, 0.2, 'sine', 0.08);
  };
  return perf;
}
function newGame(kind) {
  const skipWalk = reducedMotion();
  game = { kind, slow: kind === 'slow', turn: 0, turnStart: 0, resultT: 0, dummies: null, cpus: null };
  if (kind === 'watch') {
    // fresh seeds every match, so no two matches tumble alike
    game.dummies = [0, 1].map(() => makeDummy(newSeed(), DUMMY_RANGES, DUMMY_STYLES, DUMMY_FALLBACK));
    game.cpus = game.dummies.map((d) => new CpuGymnast(d, PASSES));
    game.perfs = [0, 1].map(() => sounds(new Performer({ passes: PASSES, skipWalk, maxTries: 3 })));
  } else game.perfs = [sounds(new Performer({ passes: kind === 'routine' ? PASSES : null, skipWalk }))];
  mode = 'play'; hide();
}
const active = () => game.perfs[game.turn];

function update(dt) {
  input.poll();
  if (mode === 'results' && game && game.kind === 'watch') {
    game.resultT += dt;
    if (game.resultT >= WATCH_RESULT) return newGame('watch');
  }
  if (mode !== 'play') return menuInput();
  if (input.pressed('START') || input.pressed('B')) return pause();
  if (game.kind === 'watch') return watchStep(dt);
  if (game.slow) dt *= 0.5;
  const s = input.state, perf = game.perfs[0];
  perf.step(dt, { legs: legsStick(), lx: s.lx, ly: s.ly, lt: s.lt, rt: s.rt });
  if (perf.done) results();
}

/* CPU vs CPU: the dummy whose turn it is throws one pass, walks back, then the other goes */
function watchStep(dt) {
  const i = game.turn, perf = game.perfs[i];
  perf.step(dt, game.cpus[i].controls(perf, dt));
  if (perf.passes.length > game.turnStart && (perf.phase === 'ready' || perf.done)) {
    if (game.perfs.every((p) => p.done)) return results();
    const o = 1 - i;
    if (!game.perfs[o].done) game.turn = o;
    game.turnStart = game.perfs[game.turn].passes.length;
  }
}

function results() {
  const G_ = game;
  mode = 'results';
  if (G_.kind === 'watch') return watchResults();
  const perf = G_.perfs[0];
  G_.passes = perf.passes;
  const sc = scoreRoutine(G_.passes, { requirements: G_.kind === 'routine' });
  let note = '';
  if (G_.kind === 'routine') {
    const prev = data.best;
    if (!prev || sc.total > prev.total) { data.best = { total: sc.total, D: sc.D, E: sc.E }; persist(); note = prev ? `New best, up from ${prev.total.toFixed(2)}.` : 'First score on the board.'; }
    else note = `Your best is ${prev.total.toFixed(2)}.`;
  } else note = 'Practice, so nothing is saved.';
  const rows = G_.passes.map((p, i) => p.skills.map((s, j) => `<tr><td>${j ? '' : i + 1}</td><td>${j ? '+ ' : ''}${s.name}${s.recognized ? '' : ' <small>(not counted)</small>'}</td><td>${fmt(s.d)}</td><td>${s.ded.length ? s.ded.map(([w, v]) => `−${fmt(v)} ${w.toLowerCase()}`).join(', ') : 'clean'}</td></tr>`).join('')).join('');
  const req = G_.kind === 'routine' ? `<h2 class="label">Requirements</h2><ul class="blurbs">${sc.met.map((r) => `<li><b>${r.met ? 'Met +0.5' : 'Missing'}:</b> ${r.name}</li>`).join('')}</ul>` : '';
  const conn = G_.passes.reduce((a, p) => a + p.connections, 0);
  show(`<p class="label">${G_.kind === 'routine' ? 'Floor / routine' : 'Floor / practice'}</p>
    <h1 class="title">${sc.total.toFixed(2)} <small>D ${sc.D.toFixed(1)} · E ${sc.E.toFixed(2)}</small></h1>
    <p class="hint">${note}${conn ? ` ${conn} connection${conn > 1 ? 's' : ''}, +${fmt(conn * 0.1)}.` : ''}</p>
    ${rows ? `<table class="board"><thead><tr><td>Pass</td><td>Skill</td><td>D</td><td>Deductions</td></tr></thead><tbody>${rows}</tbody></table>` : '<p class="hint">No passes thrown.</p>'}
    ${req}
    <div class="menu"><button class="btn btn--solid" data-go="again">Go again</button><button class="btn" data-go="skills">Move list</button><button class="btn" data-go="menu">Menu</button></div>`);
}

/* a watch result: both scores, the winner, then the next match starts by itself. Nothing is saved. */
function watchResults() {
  const G_ = game; G_.resultT = 0;
  const sc = G_.perfs.map((p) => scoreRoutine(p.passes));
  const win = sc[0].total === sc[1].total ? -1 : sc[0].total > sc[1].total ? 0 : 1;
  const rows = G_.perfs.map((p, i) => p.passes.map((ps, k) => ps.skills.map((s, j) => `<tr><td>${j || k ? '' : NAMES[i].slice(-1).toUpperCase()}</td><td>${k + 1}</td><td>${j ? '+ ' : ''}${s.name}${s.recognized ? '' : ' <small>(not counted)</small>'}</td><td>${fmt(s.d)}</td><td>${s.ded.length ? s.ded.map(([w, v]) => `−${fmt(v)} ${w.toLowerCase()}`).join(', ') : 'clean'}</td></tr>`).join('')).join('')).join('');
  show(`<p class="label">Floor / CPU vs CPU</p>
    <h1 class="title">${win < 0 ? 'Tie' : `Dummy ${NAMES[win].slice(-1).toUpperCase()} wins`}</h1>
    <ul class="blurbs">${G_.dummies.map((d, i) => `<li><b>${sc[i].total.toFixed(2)}</b> <small>D ${sc[i].D.toFixed(1)} · E ${sc[i].E.toFixed(2)}</small> ${dummyLabel(NAMES[i], d)}</li>`).join('')}</ul>
    <p class="hint">Next match with new seeds in a few seconds. Watch games aren't saved.</p>
    <table class="board"><thead><tr><td></td><td>Pass</td><td>Skill</td><td>D</td><td>Deductions</td></tr></thead><tbody>${rows}</tbody></table>
    <div class="menu"><button class="btn btn--solid" data-go="again">Next match</button><button class="btn" data-go="menu">Quit to menu</button></div>`);
}

function menuInput() {
  if (!menuItems.length) return;
  const n = input.nav();
  let y = n.y || n.x;
  if (input.pressed('LU') || input.pressed('LL')) y = -1;
  if (input.pressed('LD') || input.pressed('LR')) y = 1;
  if (y) { menuIndex = (menuIndex + y + menuItems.length) % menuItems.length; menuItems[menuIndex].focus(); }
  // the input layer swallows Space/Enter, so A (or those keys) clicks the focused button here
  if (input.pressed('A')) { const b = menuItems[menuIndex]; b && b.click(); }
  if ((input.pressed('B') || input.pressed('START')) && mode === 'paused') go('resume');
}

/* ---------------- drawing ---------------- */
const canvas = $('#c'), ctx = canvas.getContext('2d');
let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize); resize();

const FG = '#ececec', BG = '#060606', MUTED = 'rgba(236,236,236,.62)', LINE = 'rgba(236,236,236,.16)', LINE2 = 'rgba(236,236,236,.32)';
const mono = (px, w = 400) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`;

function view() {
  const ppm = Math.max(18, Math.min((W - 40) / (FLOOR + 2), (H * 0.5) / 4.6));
  const ox = (W - FLOOR * ppm) / 2, floorY = Math.min(H - 150, H * 0.5 + 3.2 * ppm * 0.5 + 40);
  return { ppm, ox, floorY, sx: (x) => ox + x * ppm, sy: (y) => floorY - y * ppm };
}

function draw() {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  const v = view();
  drawFloor(v);
  if (!game || mode === 'menu') return;
  const pal = palette();
  if (game.kind === 'watch') {
    // the one waiting stands just off the floor by its corner; letters above the heads, so colour is never the only cue
    const cols = [pal.home, pal.away];
    game.perfs.forEach((perf, i) => {
      if (i === game.turn) return;
      const p = pose(perf, NO_INPUT); p.x = perf.g.x < FLOOR / 2 ? -0.7 : FLOOR + 0.7; p.face = perf.g.x < FLOOR / 2 ? 1 : -1;
      drawGymnast(v, p, cols[i], NAMES[i].slice(-1).toUpperCase(), true);
    });
    const perf = active();
    drawGymnast(v, pose(perf, perf.ctl), cols[game.turn], NAMES[game.turn].slice(-1).toUpperCase());
  } else { const perf = active(); drawGymnast(v, pose(perf, perf.ctl), pal.mark); }
  hud(v, pal);
}

function drawFloor(v) {
  const { ppm, ox, floorY } = v, w = FLOOR * ppm;
  ctx.fillStyle = 'rgba(236,236,236,.04)'; ctx.fillRect(ox - ppm, floorY, w + 2 * ppm, 18);
  ctx.strokeStyle = LINE2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ox - ppm, floorY + 0.5); ctx.lineTo(ox + w + ppm, floorY + 0.5); ctx.stroke();
  ctx.strokeStyle = FG; ctx.lineWidth = 3;
  for (const x of [ox, ox + w]) { ctx.beginPath(); ctx.moveTo(x, floorY); ctx.lineTo(x, floorY + 18); ctx.stroke(); }
  ctx.font = mono(10); ctx.fillStyle = MUTED; ctx.textAlign = 'center';
  for (let m = 2; m < FLOOR; m += 2) { const x = ox + m * ppm; ctx.fillRect(x, floorY + 6, 1, 6); }
  ctx.fillText('FLOOR 14 M', ox + w / 2, floorY + 36);
}

/* ---------------- the gymnast ---------------- */
// body frame: metres, hip at the origin, facing +x, y up
const THIGH = 0.45, SHIN = 0.45, TORSO = 0.55, UPPER = 0.3, FORE = 0.28, HEAD = 0.11;

function pose(G_, ctl) {
  const g = G_.g, p = { x: g.x, z: 0, ang: 0, face: g.face, sx: 1, tuck: 0, pike: 0, knee: 0.08,
    arm: 0.15, armB: null, elbow: 0.1, legA: 0, legB: 0, grounded: true };
  if (G_.phase === 'ready' || G_.phase === 'done' || (G_.phase === 'settle' && !G_.bal)) return p;
  if (G_.phase === 'run' || G_.phase === 'walk') {
    const amp = Math.min(1, g.v / 4) * (G_.phase === 'walk' ? 0.4 : 0.85) + 0.05;
    const sw = Math.sin(g.runPhase) * amp;
    Object.assign(p, { legA: sw, legB: -sw, knee: 0.35 + 0.4 * Math.max(0, Math.cos(g.runPhase)) * amp, arm: -sw * 1.1, armB: sw * 1.1, elbow: 1.2, ang: -0.18 * g.v / VMAX });
    return p;
  }
  if (G_.phase === 'hurdle') {
    const k = clamp(G_.hurdleT / HURDLE, 0, 1);
    Object.assign(p, { arm: Math.PI * Math.min(1, k * 2.2), elbow: 0.05, legA: 0.6 * (1 - k), legB: -0.25 * (1 - k), knee: 0.25,
      z: Math.sin(Math.min(1, k) * Math.PI) * 0.18, grounded: false, ang: -0.1 });
    return p;
  }
  if (G_.phase === 'air') {
    const f = G_.flight;
    const t = f.tuck, pk = f.pike;
    let arm = Math.PI, elbow = 0.05;
    if (t >= pk) { arm = Math.PI + (1.05 - Math.PI) * t; elbow = 0.4 * t; }
    else { arm = Math.PI + (2.5 - Math.PI) * pk; }
    if (f.arms > 0.05) { arm += (0.35 - arm) * f.arms; elbow += (2.3 - elbow) * f.arms; }
    const split = f.kind === 'jump' ? f.split * 1.3 : f.legs * 0.5;
    const ang = f.kind === 'jump' ? 0 : (f.dir === 'back' ? f.theta : -f.theta);
    const tw = Math.cos(TAU * f.tw);
    Object.assign(p, { z: f.z, ang, tuck: t, pike: pk, arm, elbow, legA: split, legB: -split * (f.kind === 'jump' ? 1 : 0.3),
      knee: 0.05 + 2.5 * t, grounded: false, sx: Math.sign(tw || 1) * Math.max(0.14, Math.abs(tw)) });
    return p;
  }
  if (G_.phase === 'land' || G_.phase === 'settle') {
    const b = G_.bal, lamFace = b ? b.lam * g.face : 0;
    const fell = b && b.fell;
    const soak = clamp(0.6 - G_.landT * 1.8, 0.08, 0.6);
    const up = ctl.ly < -0.6 || (b && b.shown);
    Object.assign(p, { ang: fell ? -Math.sign(lamFace || 1) * 1.35 : -lamFace, knee: fell ? 1.6 : soak + Math.abs(lamFace) * 0.8,
      tuck: G_.td && G_.td.squat && G_.landT < 0.4 ? 0.7 : 0, arm: up ? Math.PI * 0.92 : 1.45 + ctl.lx * g.face * 0.4,
      elbow: 0.1, legA: fell ? 0.9 : 0.05, legB: fell ? 0.6 : -0.05 });
    if (fell) p.tuck = 0.4;
    return p;
  }
  return p;
}

function skeleton(p) {
  // hips flex for tuck/pike; knees bend for tuck
  const hip = Math.max(2.2 * p.tuck, 2.6 * p.pike);
  const knee = Math.max(p.knee, 2.5 * p.tuck);
  const pt = (a, len, o) => [o[0] + Math.sin(a) * len, o[1] - Math.cos(a) * len];
  const O = [0, 0], S = [0, TORSO], Hd = [0, TORSO + 0.17];
  const leg = (off) => { const a = hip + off; const K = pt(a, THIGH, O); const F = pt(a - knee, SHIN, K); return [K, F]; };
  const [KA, FA] = leg(p.legA), [KB, FB] = leg(p.legB);
  const E = pt(p.arm, UPPER, S), Hn = pt(p.arm + p.elbow, FORE, E);
  const b = p.armB ?? p.arm - 0.12, E2 = pt(b, UPPER, S), Hn2 = pt(b + p.elbow, FORE, E2);
  return { O, S, Hd, KA, FA, KB, FB, E, Hn, E2, Hn2 };
}

function drawGymnast(v, p, color, letter = '', waiting = false) {
  const sk = skeleton(p);
  const c = Math.cos(p.ang), s = Math.sin(p.ang), fx = p.face * p.sx;
  const tf = ([x, y]) => [(x * c - y * s) * fx, x * s + y * c];
  const pts = {}; for (const k in sk) pts[k] = tf(sk[k]);
  // place on the floor: grounded feet touch it, airborne hip rides its height
  let ox = p.x, oy;
  if (p.grounded) {
    const lowY = Math.min(pts.FA[1], pts.FB[1]); oy = -lowY;
    const fxm = (pts.FA[0] + pts.FB[0]) / 2; ox = p.x - fxm;
  } else oy = THIGH + SHIN - 0.04 + p.z;
  const P = ([x, y]) => [v.sx(ox + x), v.sy(oy + y)];
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.5, v.ppm * 0.055);
  const line = (...ks) => { ctx.beginPath(); ks.forEach((k, i) => { const [x, y] = P(pts[k]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
  line('FB', 'KB', 'O'); line('FA', 'KA', 'O'); line('O', 'S'); line('S', 'E2', 'Hn2'); line('S', 'E', 'Hn');
  const [hx, hy] = P(pts.Hd); ctx.beginPath(); ctx.arc(hx, hy, HEAD * v.ppm, 0, TAU);
  if (waiting) ctx.stroke(); else ctx.fill();          // the one waiting has a hollow head
  if (letter) { ctx.font = mono(13, 600); ctx.textAlign = 'center'; ctx.fillText(letter, hx, hy - HEAD * v.ppm - 10); }
  ctx.restore();
}

/* ---------------- heads-up display ---------------- */
function hud(v, pal) {
  const G_ = active(), g = G_.g, watch = game.kind === 'watch', s = watch ? G_.ctl : input.state;
  const pad = input.lastDevice === 'controller';
  const fwd = g.travel > 0 ? '→' : '←', bwd = g.travel > 0 ? '←' : '→';
  // top left: where you are in the routine and the running score
  ctx.textAlign = 'left'; ctx.font = mono(12); ctx.fillStyle = MUTED;
  if (watch) {
    ctx.fillText(`CPU VS CPU · PASS ${Math.min(PASSES, G_.passNo)} OF ${PASSES} · ${NAMES[game.turn].toUpperCase()} UP`, 20, 28);
    // one chip per side: who it is, its style and seed, its running score
    game.perfs.forEach((p, i) => {
      const sc = scoreRoutine(p.passes), y = 42 + i * 40, on = i === game.turn;
      ctx.strokeStyle = on ? [pal.home, pal.away][i] : LINE; ctx.lineWidth = on ? 2 : 1; ctx.strokeRect(20, y, 320, 32);
      ctx.fillStyle = on ? FG : MUTED; ctx.font = mono(12, 600); ctx.textAlign = 'left';
      ctx.fillText(dummyLabel(NAMES[i], game.dummies[i]), 30, y + 20);
      ctx.textAlign = 'right'; ctx.fillText(sc.total.toFixed(2), 330, y + 20); ctx.textAlign = 'left';
    });
  } else {
    const title = game.kind === 'routine' ? `ROUTINE · PASS ${Math.min(PASSES, G_.passNo)} OF ${PASSES}` : `FREE FLOOR${game.slow ? ' · HALF SPEED' : ''} · PASS ${G_.passNo}`;
    ctx.fillText(title, 20, 28);
    const sc = scoreRoutine(G_.passes, { requirements: false });
    ctx.font = mono(30, 600); ctx.fillStyle = FG;
    ctx.fillText(`D ${sc.D.toFixed(1)}  E ${sc.E.toFixed(2)}`, 20, 64);
  }

  // top right: speed, then the spin dial
  dial(G_, W - 90, 84, pal);

  // centre: what you just did, or a message
  if (G_.callout && !G_.callout.old) calloutBox(G_.callout, watch ? 150 : 112);
  else if (G_.msg && !watch) { ctx.textAlign = 'center'; ctx.font = mono(15); ctx.fillStyle = FG; ctx.fillText(G_.msg, W / 2, 120); }

  // hurdle rings around the feet: the moving ring closes on the fixed one at the sweet spot
  if (G_.phase === 'hurdle' && !watch) {
    const k = HURDLE - G_.hurdleT, fx = v.sx(g.x), fy = v.floorY;
    ctx.strokeStyle = LINE2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, 16, 0, TAU); ctx.stroke();
    ctx.strokeStyle = pal.mark; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, 16 + Math.max(0, k) * 260, 0, TAU); ctx.stroke();
  }

  // bottom: shape gauges, balance, the hint for right now
  const y0 = H - 112;
  const air = G_.phase === 'air' ? G_.flight : null;
  gauge(20, y0, watch ? 'TUCK' : pad ? 'L2 TUCK' : 'F TUCK', air ? air.tuck : s.lt, pal);
  gauge(130, y0, watch ? 'PIKE' : pad ? 'R2 PIKE' : 'J PIKE', air ? air.pike : s.rt, pal);
  if (W > 520) speedBox(240, y0, g.v);
  if (G_.phase === 'land' && G_.bal && W > 700) balanceBar(380, y0, G_.bal, pal);
  ctx.textAlign = 'left'; ctx.font = mono(13); ctx.fillStyle = FG;
  ctx.fillText(watch ? watchHint(G_) : hint(G_, pad, fwd, bwd), 20, H - 2 - 8);
}

function watchHint(G_) {
  const who = `Dummy ${NAMES[game.turn].slice(-1).toUpperCase()}`;
  const what = { ready: 'chalking up', run: 'running', hurdle: 'hurdle', air: 'in the air', land: 'landing', settle: 'landing', walk: 'walking back' }[G_.phase] || '';
  return `${who} ${what} · ${input.lastDevice === 'controller' ? 'Options' : 'P or Esc'} to pause`;
}

function hint(G_, pad, fwd, bwd) {
  const ph = G_.phase;
  if (ph === 'ready') return pad ? `Push the right stick ${fwd} to run` : `Hold ${fwd} to run`;
  if (ph === 'run') return pad ? 'Left stick up to hurdle' : 'W to hurdle';
  if (ph === 'hurdle') return pad ? `Let go, then flick the right stick as the rings meet: ${bwd} back, ${fwd} front, ↑ jump, diagonal to twist`
    : `Let go, then tap as the rings meet: ${bwd} back, ${fwd} front, ↑ jump, two arrows to twist`;
  if (ph === 'air') return pad ? 'L2 tuck, R2 pike, let go to open before your feet come round. Left stick down twists faster'
    : 'F tuck, J pike, let go to open before your feet come round. S twists faster';
  if (ph === 'land') return pad ? 'Left stick left or right to steady, then up to finish' : 'A or D to steady, then W to finish';
  if (ph === 'walk' || ph === 'settle') return 'Walking back to the corner';
  return '';
}

function calloutBox(c, top = 112) {
  ctx.textAlign = 'center';
  let y = top;
  c.skills.forEach((sk, i) => {
    ctx.font = mono(Math.min(26, W / 30), 600); ctx.fillStyle = FG;
    ctx.fillText(`${i ? '+ ' : ''}${sk.name}${sk.recognized ? '' : ' (not counted)'}   D ${fmt(sk.d)}`, W / 2, y);
    y += 22; ctx.font = mono(13); ctx.fillStyle = MUTED;
    ctx.fillText(sk.ded.length ? sk.ded.map(([w, v]) => `−${fmt(v)} ${w.toLowerCase()}`).join(' · ') : 'Clean', W / 2, y);
    y += 30;
  });
  if (c.connections) { ctx.font = mono(13); ctx.fillStyle = FG; ctx.fillText(`Connected +${fmt(c.connections * 0.1)}`, W / 2, y); }
}

function gauge(x, y, name, v, pal) {
  ctx.strokeStyle = v > 0.05 ? pal.mark : LINE; ctx.lineWidth = v > 0.05 ? 2 : 1; ctx.strokeRect(x, y, 96, 76);
  ctx.fillStyle = 'rgba(236,236,236,.16)'; ctx.fillRect(x + 1, y + 75 - 74 * v, 94, 74 * v);
  ctx.fillStyle = v > 0.05 ? FG : MUTED; ctx.font = mono(12, 600); ctx.textAlign = 'center'; ctx.fillText(name, x + 48, y + 44);
}
function speedBox(x, y, vel) {
  ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.strokeRect(x, y, 124, 76);
  ctx.font = mono(10); ctx.fillStyle = MUTED; ctx.textAlign = 'left'; ctx.fillText('RUN', x + 8, y + 16);
  ctx.font = mono(22, 600); ctx.fillStyle = FG; ctx.fillText(`${vel.toFixed(1)}`, x + 8, y + 50);
  ctx.font = mono(11); ctx.fillStyle = MUTED; ctx.fillText('m/s', x + 72, y + 50);
  ctx.fillStyle = 'rgba(236,236,236,.16)'; ctx.fillRect(x + 8, y + 62, 108 * Math.min(1, vel / VMAX), 5);
}
function balanceBar(x, y, b, pal) {
  ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.strokeRect(x, y, 220, 76);
  ctx.font = mono(10); ctx.fillStyle = MUTED; ctx.textAlign = 'left'; ctx.fillText('BALANCE', x + 8, y + 16);
  const bx = x + 14, bw = 192, by = y + 44, k = bw / 2 / STEP_AT;
  ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
  // the still zone is a hollow box, you are a filled block, step lines at the ends
  ctx.strokeStyle = FG; ctx.strokeRect(bx + bw / 2 - 0.1 * k, by - 11, 0.2 * k, 22);
  ctx.fillStyle = MUTED; ctx.fillRect(bx, by - 14, 2, 28); ctx.fillRect(bx + bw - 2, by - 14, 2, 28);
  ctx.fillStyle = pal.mark; ctx.fillRect(bx + bw / 2 + clamp(b.lam, -STEP_AT, STEP_AT) * k - 3, by - 15, 6, 30);
  ctx.fillStyle = MUTED; ctx.font = mono(10); ctx.fillText(b.stable ? 'STILL · ARMS UP' : 'STEADY', x + 8, y + 70);
}

/* The spin dial: the line is where your head points, the notch at the top is feet down.
   Under it: turns and twists so far. */
function dial(G_, cx, cy, pal) {
  const f = G_.phase === 'air' || G_.phase === 'land' ? G_.flight : null, r = 46;
  ctx.strokeStyle = LINE2; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = FG; ctx.fillRect(cx - 1.5, cy - r - 8, 3, 14);
  const theta = f && f.kind === 'salto' ? f.theta : 0, sign = f && f.dir === 'back' ? 1 : -1;
  const a = sign * theta * G_.g.face;
  ctx.strokeStyle = pal.mark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx - Math.sin(a) * r * 0.9, cy - Math.cos(a) * r * 0.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx - Math.sin(a) * r * 0.9, cy - Math.cos(a) * r * 0.9, 5, 0, TAU); ctx.fillStyle = pal.mark; ctx.fill();
  // hollow ring: where your head ends up if you open now. Open when it reaches the top notch.
  if (f && f.kind === 'salto' && G_.phase === 'air') {
    const b = sign * f.predicted * G_.g.face;
    ctx.strokeStyle = FG; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx - Math.sin(b) * r, cy - Math.cos(b) * r, 8, 0, TAU); ctx.stroke();
  }
  ctx.textAlign = 'center'; ctx.font = mono(12, 600); ctx.fillStyle = FG;
  ctx.fillText(`${(theta / TAU).toFixed(1)} TURNS`, cx, cy + r + 22);
  if (f && f.twist) { ctx.font = mono(11); ctx.fillStyle = MUTED; ctx.fillText(`${f.tw.toFixed(1)} TWISTS`, cx, cy + r + 38); }
}

/* ---------------- loop ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  update(dt); draw();
  requestAnimationFrame(frame);
}
document.documentElement.classList.toggle('calm', reducedMotion());
addEventListener('gamepadconnected', () => { input.lastDevice = 'controller'; });
mainMenu();
requestAnimationFrame(frame);

