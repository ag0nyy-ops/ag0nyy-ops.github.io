/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Moves: a side-on floor routine. Left stick is your arms, right stick your legs, the triggers
   pull you into a tuck or a pike. Run, hurdle, punch, spin, open, stick it. The judges score
   what your body actually did. Nothing to unlock: every skill is there from the first pass. */

import { Input } from '../shared/input.js';
import { loadSettings, reducedMotion } from '../shared/settings.js';
import * as look from '../shared/look.js';
import { makeDummy, newSeed, dummyLabel } from '../shared/seed.js';
import {
  FLOOR, VMAX, HURDLE, WINDOW, REBOUND, TAU, STEP_AT, clamp, scoreRoutine, REQUIREMENTS, fmt, NO_INPUT,
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
function resize() { ({ W, H, dpr } = look.fit(canvas)); }
look.watch(canvas, resize); resize();

const FG = '#ececec', MUTED = 'rgba(236,236,236,.62)', STRONG = look.INK.strong;
const mono = (px, w = 400) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`;
const HUD = look.hud();
let shownSkill = null, clock = 0;

function view() {
  const ppm = Math.max(18, Math.min((W - 40) / (FLOOR + 2), (H * 0.5) / 4.6));
  const ox = (W - FLOOR * ppm) / 2, floorY = Math.min(H - 96, H * 0.5 + 3.2 * ppm * 0.5 + 40);
  // the floor is a strip seen a little from above: far edge, the line you run on, near edge
  return { ppm, ox, floorY, far: floorY - 0.55 * ppm, near: floorY + 0.45 * ppm, sx: (x) => ox + x * ppm, sy: (y) => floorY - y * ppm };
}

function draw(dt) {
  clock += dt;
  HUD.tick(dt, input);
  const v = view();
  look.arena(ctx, W, H, { horizon: v.far, dt });
  drawFloor(v);
  judges(v);
  if (!game || mode === 'menu') { board(null); HUD.meters([{ label: 'tuck', v: 0 }, { label: 'pike', v: 0 }]); HUD.msg(''); menuBar(); return; }
  if (game.kind === 'watch') {
    // the one waiting stands just off the floor by its corner, faded; name tags over the heads, so colour is never the only cue
    game.perfs.forEach((perf, i) => {
      if (i === game.turn) return;
      const p = pose(perf, NO_INPUT); p.x = perf.g.x < FLOOR / 2 ? -0.7 : FLOOR + 0.7; p.face = perf.g.x < FLOOR / 2 ? 1 : -1;
      drawGymnast(v, p, i, NAMES[i], true);
    });
    const perf = active();
    drawGymnast(v, pose(perf, perf.ctl), game.turn, NAMES[game.turn]);
  } else { const perf = active(); drawGymnast(v, pose(perf, perf.ctl), 0); }
  hud(v);
  if (mode !== 'play') menuBar();
}
function menuBar() {
  const pad = input.lastDevice === 'controller', paused = mode === 'paused';
  const chips = pad ? [{ k: '↕', t: 'pick' }, { k: '✕', t: 'choose', open: true }] : [{ k: '↕', t: 'pick' }, { k: 'enter', t: 'choose', open: true }];
  if (paused) chips.push(pad ? { k: '○', t: 'resume' } : { k: 'esc', t: 'resume' });
  HUD.bar(paused ? 'paused' : mode === 'results' ? 'results' : 'menu', chips, pad ? 'left stick or d-pad to pick' : 'arrows or W S to pick');
}

/* the end of the floor you are heading for lights up when you get close to it */
function hotEnd() {
  if (!game || mode !== 'play') return null;
  const G_ = active(), g = G_.g;
  if (!['run', 'hurdle', 'air', 'land'].includes(G_.phase)) return null;
  const dir = G_.phase === 'land' ? Math.sign(g.x - FLOOR / 2) : g.travel;
  const left = dir > 0 ? FLOOR - g.x : g.x;
  return left < 1.5 ? (dir > 0 ? FLOOR : 0) : null;
}
function drawFloor(v) {
  const { ppm, ox, floorY, far, near } = v, w = FLOOR * ppm;
  // run-off, the floor, and a pool of light in the middle of it
  ctx.fillStyle = '#080808'; ctx.fillRect(ox - ppm, far - 0.15 * ppm, w + 2 * ppm, near - far + 0.35 * ppm);
  ctx.strokeStyle = look.FLOOR.edge; ctx.lineWidth = 1; ctx.strokeRect(ox - ppm + 0.5, far - 0.15 * ppm + 0.5, w + 2 * ppm - 1, near - far + 0.35 * ppm - 1);
  ctx.fillStyle = look.FLOOR.base; ctx.fillRect(ox, far, w, near - far);
  look.spot(ctx, ox + w / 2, floorY, w * 0.55, (near - far) * 0.9);
  // the line you run on, and a mark every two metres
  ctx.strokeStyle = look.FLOOR.inner; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ox, floorY + 0.5); ctx.lineTo(ox + w, floorY + 0.5); ctx.stroke();
  ctx.fillStyle = look.FLOOR.mark;
  for (let m = 2; m < FLOOR; m += 2) ctx.fillRect(Math.round(ox + m * ppm), near - 7, 1, 6);
  // the boundary
  ctx.strokeStyle = look.FLOOR.line; ctx.lineWidth = 2; ctx.strokeRect(ox, far, w, near - far);
  const hot = hotEnd();
  if (hot != null) {
    const x = ox + hot * ppm;
    ctx.save(); ctx.globalAlpha = look.pulse(clock); ctx.strokeStyle = look.FLOOR.hot; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, far); ctx.lineTo(x, near); ctx.stroke(); ctx.restore();
  }
  look.tag(ctx, ox + w, near + 0.2 * ppm + 14, 'floor 14 m', { size: 10, align: 'right', pad: 4 });
}

/* the judges' table behind the far edge: the other side of the scoreboard */
function judges(v) {
  const T = look.team(1), k = v.ppm, cx = v.ox + FLOOR * k / 2, ty = v.far - 0.5 * k;
  const r = Math.max(3, 0.1 * k);
  for (let i = -1; i <= 1; i++) {
    const x = cx + i * 1.3 * k, tw = 0.11 * k, top = ty - 0.34 * k;
    look.fillBody(ctx, () => ctx.rect(x - tw, top, tw * 2, 0.36 * k), T, T.suit, [x - tw, top, x + tw, ty]);
    look.ball(ctx, x, top - r * 1.2, r, T, T.skin);
  }
  ctx.fillStyle = '#121212'; ctx.fillRect(cx - 2.1 * k, ty, 4.2 * k, 0.3 * k);
  ctx.strokeStyle = look.FLOOR.edge; ctx.lineWidth = 1; ctx.strokeRect(cx - 2.1 * k + 0.5, ty + 0.5, 4.2 * k - 1, 0.3 * k - 1);
  for (let i = -1; i <= 1; i++) look.band(ctx, cx + i * 1.3 * k + 0.12 * k, ty + 0.06 * k, Math.max(1.5, 0.035 * k), T);
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

function drawGymnast(v, p, side = 0, label = '', waiting = false) {
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
  const T = look.team(side), BACK = FAR[side], k = v.ppm;
  // the one on the floor: a faint ring under them
  if (!waiting) look.ring(ctx, v.sx(p.x), v.floorY, Math.max(10, 0.5 * k));
  ctx.save();
  if (waiting) ctx.globalAlpha = 0.55;
  const path = (...ks) => () => ks.forEach((key, i) => { const [x, y] = P(pts[key]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  const legW = Math.max(3, k * 0.11), armW = Math.max(2.5, k * 0.085), band = Math.max(2, k * 0.04);
  const ankle = (key) => { const [x, y] = P(pts[key]); look.band(ctx, x, y, band, T); };
  // the far leg and arm first, a shade darker so the body reads in depth
  look.strokeLimb(ctx, path('O', 'KB'), legW, T, BACK.suit);
  look.strokeLimb(ctx, path('KB', 'FB'), legW * 0.9, T, BACK.skin);
  ankle('FB');
  look.strokeLimb(ctx, path('S', 'E2', 'Hn2'), armW, T, BACK.skin);
  // torso: a shaded leotard from hip to shoulder
  const [hx, hy] = P(pts.O), [sx, sy] = P(pts.S);
  const L = Math.hypot(sx - hx, sy - hy) || 1, nx = -(sy - hy) / L, ny = (sx - hx) / L, hw = 0.075 * k, sw = 0.095 * k;
  const quad = [[hx + nx * hw, hy + ny * hw], [sx + nx * sw, sy + ny * sw], [sx - nx * sw, sy - ny * sw], [hx - nx * hw, hy - ny * hw]];
  look.ball(ctx, hx, hy, hw, T, T.suit); look.ball(ctx, sx, sy, sw, T, T.suit);
  look.fillBody(ctx, () => { quad.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }, T, T.suit,
    [Math.min(...quad.map((q) => q[0])), Math.min(...quad.map((q) => q[1])), Math.max(...quad.map((q) => q[0])), Math.max(...quad.map((q) => q[1]))]);
  const [qx, qy] = P(pts.Hd); look.ball(ctx, qx, qy, Math.max(3.5, HEAD * k * 1.15), T, T.skin);
  // the near leg and arm on top
  look.strokeLimb(ctx, path('O', 'KA'), legW, T, T.suit);
  look.strokeLimb(ctx, path('KA', 'FA'), legW * 0.9, T, T.skin);
  ankle('FA');
  look.strokeLimb(ctx, path('S', 'E', 'Hn'), armW, T, T.skin);
  if (label) look.tag(ctx, qx, qy - HEAD * k * 1.15 - 16, label, { size: 10, pad: 4 });
  ctx.restore();
}
/* the far leg and arm, a shade darker than the near ones, per side */
const FAR = [
  { suit: ['#d0d0d0', '#a8a8a8', '#6a6a6a'], skin: ['#a8a8a8', '#7c7c7c', '#3e3e3e'] },
  { suit: ['#3a3a3a', '#1e1e1e', '#090909'], skin: ['#7e7e7e', '#5a5a5a', '#242424'] }
];

/* ---------------- heads-up display: scoreboard, calls and the button bar live on the page ---------------- */
function board() {
  if (game && game.kind === 'watch' && mode !== 'menu') {
    const sc = game.perfs.map((p) => scoreRoutine(p.passes)), final = mode === 'results';
    const side = (i) => ({ name: NAMES[i], sub: `${look.bandWord(i)} · ${game.dummies[i].style}`, score: sc[i].total.toFixed(2) });
    HUD.board({ a: side(0), b: side(1), clock: final ? 'final' : `${Math.min(PASSES, active().passNo)}/${PASSES}` });
    return;
  }
  const a = { name: 'you', sub: `${look.bandWord(0)} · difficulty` }, b = { name: 'judges', sub: `${look.bandWord(1)} · execution` };
  if (!game || mode === 'menu') { HUD.board({ a: { ...a, score: '0.0' }, b: { ...b, score: '10.00' }, clock: '--' }); return; }
  const G_ = active(), final = mode === 'results', routine = game.kind === 'routine';
  const sc = scoreRoutine(G_.passes, { requirements: final && routine });
  HUD.board({
    a: { ...a, score: sc.D.toFixed(1) }, b: { ...b, score: sc.E.toFixed(2) },
    clock: final ? sc.total.toFixed(2) : routine ? `${Math.min(PASSES, G_.passNo)}/${PASSES}` : `#${G_.passNo}`,
    low: !final && routine && G_.passNo >= PASSES
  });
}
/* a skill just landed: stamp its name, value and deductions on the stage once */
function stamp(c) {
  const sk = c.skills[c.skills.length - 1];
  const name = `${c.skills.length > 1 ? '+ ' : ''}${sk.name}${sk.recognized ? '' : ' (not counted)'}`;
  const ded = sk.ded.length ? sk.ded.map(([w, x]) => `−${fmt(x)} ${w.toLowerCase()}`).join(' · ') : 'clean';
  const big = sk.recognized && sk.d >= 0.4;
  HUD.call(name, `D ${fmt(sk.d)} · ${ded}${c.connections ? ` · connected +${fmt(c.connections * 0.1)}` : ''}`, big);
  if (big) look.cheer(0.9); else if (!sk.ded.length) look.cheer(0.6);
}
function lastSkill(c) {
  if (!c) return '';
  const sk = c.skills[c.skills.length - 1];
  return `last: ${sk.name}, D ${fmt(sk.d)}, ${sk.ded.length ? sk.ded.map(([w, x]) => `−${fmt(x)} ${w.toLowerCase()}`).join(', ') : 'clean'}`;
}

function hud(v) {
  const G_ = active(), g = G_.g, watch = game.kind === 'watch', s = watch ? G_.ctl : input.state;
  const pad = input.lastDevice === 'controller';
  const fwd = g.travel > 0 ? '→' : '←', bwd = g.travel > 0 ? '←' : '→';
  board();
  const c = G_.callout, sk = c ? c.skills[c.skills.length - 1] : null;
  if (sk && sk !== shownSkill) stamp(c);
  shownSkill = sk;
  HUD.msg(watch ? '' : G_.msg);
  const air = G_.phase === 'air' ? G_.flight : null;
  const tuck = clamp(air ? air.tuck : s.lt, 0, 1), pike = clamp(air ? air.pike : s.rt, 0, 1);
  HUD.meters([{ label: watch ? 'tuck' : pad ? 'L2 tuck' : 'F tuck', v: tuck }, { label: watch ? 'pike' : pad ? 'R2 pike' : 'J pike', v: pike }]);

  // top right: the spin dial
  dial(G_, W - 90, 84);

  // hurdle rings around the feet: the moving ring closes on the fixed one at the sweet spot
  if (G_.phase === 'hurdle' && !watch) {
    const k = HURDLE - G_.hurdleT, fx = v.sx(g.x), fy = v.floorY;
    ctx.strokeStyle = look.FLOOR.mark; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, 16, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, 16 + Math.max(0, k) * 260, 0, TAU); ctx.stroke();
  }

  // bottom left: run speed, then balance once you land
  const y0 = H - 62;
  speedBox(20, y0, g.v);
  if (G_.phase === 'land' && G_.bal && W > 420) balanceBar(164, y0, G_.bal);

  if (watch) seedTags();
  if (mode === 'play') { if (watch) watchBar(G_, pad); else bar(G_, pad, fwd, bwd, tuck, pike); }
}

/* CPU vs CPU: both dummies' style and seed, bottom right */
function seedTags() {
  if (W < 520) return;
  game.dummies.map((d, i) => dummyLabel(NAMES[i], d)).reverse().forEach((l, i) => look.tag(ctx, W - 14, H - 22 - i * 22, l, { size: 10, align: 'right', pad: 4 }));
}
function watchBar(G_, pad) {
  const what = { ready: 'chalking up', run: 'running', hurdle: 'hurdle', air: 'in the air', land: 'landing', settle: 'landing', walk: 'walking back' }[G_.phase] || '';
  HUD.bar('watching', [{ k: pad ? 'options' : 'P / esc', t: 'pause', open: true }], `${NAMES[game.turn]} ${what} · pass ${Math.min(PASSES, G_.passNo)} of ${PASSES}. the next match starts by itself`);
}

/* what the buttons do right now */
function bar(G_, pad, fwd, bwd, tuck, pike) {
  const ph = G_.phase, ch = (k, t, open) => ({ k, t, open });
  const where = game.kind === 'routine' ? `routine · pass ${Math.min(PASSES, G_.passNo)} of ${PASSES}` : `free floor${game.slow ? ' · half speed' : ''} · pass ${G_.passNo}`;
  const pause = pad ? ch('options', 'pause') : ch('P', 'pause');
  if (ph === 'ready') HUD.bar('ready', [pad ? ch('R' + fwd, 'run', true) : ch(fwd, 'hold to run', true), pause], [where, lastSkill(G_.callout)].filter(Boolean).join(' · '));
  else if (ph === 'run') HUD.bar('run', [pad ? ch('R' + fwd, 'run') : ch(fwd, 'run'), pad ? ch('L↑', 'hurdle', true) : ch('W', 'hurdle', true)], `${where} · hurdle before the far corner`);
  else if (ph === 'hurdle') {
    const now = Math.abs(G_.hurdleT - HURDLE) < WINDOW;
    HUD.bar('hurdle', [ch(pad ? 'R' + bwd : bwd, 'back salto', now), ch(pad ? 'R' + fwd : fwd, 'front salto', now), ch(pad ? 'R↑' : '↑', 'jump', now), ch(pad ? 'R diagonal' : 'two arrows', 'twist', now)],
      `${where} · let go, then flick as the rings meet`);
  } else if (ph === 'air') HUD.bar('in the air', [ch(pad ? 'L2' : 'F', 'tuck', tuck > 0.05), ch(pad ? 'R2' : 'J', 'pike', pike > 0.05), ch(pad ? 'L↓' : 'S', 'twist faster')],
    `${where} · let go to open before your feet come round`);
  else if (ph === 'land') {
    const b = G_.bal, chips = [ch(pad ? 'L◀▶' : 'A D', 'steady', b && !b.stable), ch(pad ? 'L↑' : 'W', 'finish', !!(b && b.stable))];
    if (G_.rebound && G_.landT < REBOUND.open) chips.unshift(ch(pad ? 'R' : 'arrow', 'flick again: connect', true));
    HUD.bar('landing', chips, `${where} · steady, then arms up to finish`);
  } else HUD.bar('walking back', [pause], `${where} · ${lastSkill(G_.callout) || 'walking back to the corner'}`);
}

/* a canvas panel: dark box, hairline, its name in a tag on the top edge */
function panel(x, y, w, h, label) {
  ctx.fillStyle = 'rgba(6,6,6,.85)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = STRONG; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  look.tag(ctx, x + 6, y, label, { size: 10, align: 'left', pad: 4 });
}
function speedBox(x, y, vel) {
  panel(x, y, 128, 52, 'run');
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = mono(20, 600); ctx.fillStyle = FG; ctx.fillText(`${vel.toFixed(1)}`, x + 10, y + 34);
  ctx.font = mono(11); ctx.fillStyle = MUTED; ctx.fillText('m/s', x + 62, y + 34);
  ctx.fillStyle = look.FLOOR.inner; ctx.fillRect(x + 10, y + 41, 108, 4);
  ctx.fillStyle = FG; ctx.fillRect(x + 10, y + 41, 108 * Math.min(1, vel / VMAX), 4);
}
function balanceBar(x, y, b) {
  panel(x, y, 220, 52, 'balance');
  look.tag(ctx, x + 214, y, b.stable ? 'still · arms up' : 'steady', { size: 10, align: 'right', pad: 4 });
  const bx = x + 14, bw = 192, by = y + 30, k = bw / 2 / STEP_AT;
  ctx.strokeStyle = look.FLOOR.inner; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
  // the still zone is a hollow box, you are a filled block, step lines at the ends
  ctx.strokeStyle = FG; ctx.strokeRect(bx + bw / 2 - 0.1 * k, by - 9, 0.2 * k, 18);
  ctx.fillStyle = look.FLOOR.mark; ctx.fillRect(bx, by - 12, 2, 24); ctx.fillRect(bx + bw - 2, by - 12, 2, 24);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + bw / 2 + clamp(b.lam, -STEP_AT, STEP_AT) * k - 3, by - 13, 6, 26);
}

/* The spin dial: the line is where your head points, the notch at the top is feet down.
   Under it: turns and twists so far. */
function dial(G_, cx, cy) {
  const f = G_.phase === 'air' || G_.phase === 'land' ? G_.flight : null, r = 46;
  ctx.fillStyle = 'rgba(6,6,6,.7)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = look.FLOOR.inner; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = FG; ctx.fillRect(cx - 1.5, cy - r - 8, 3, 14);
  const theta = f && f.kind === 'salto' ? f.theta : 0, sign = f && f.dir === 'back' ? 1 : -1;
  const a = sign * theta * G_.g.face;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx - Math.sin(a) * r * 0.9, cy - Math.cos(a) * r * 0.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx - Math.sin(a) * r * 0.9, cy - Math.cos(a) * r * 0.9, 5, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
  // hollow ring: where your head ends up if you open now. Open when it reaches the top notch.
  if (f && f.kind === 'salto' && G_.phase === 'air') {
    const b = sign * f.predicted * G_.g.face;
    ctx.strokeStyle = look.FLOOR.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx - Math.sin(b) * r, cy - Math.cos(b) * r, 8, 0, TAU); ctx.stroke();
  }
  look.tag(ctx, cx, cy + r + 18, `${(theta / TAU).toFixed(1)} turns`);
  if (f && f.twist) look.tag(ctx, cx, cy + r + 40, `${f.tw.toFixed(1)} twists`, { size: 10 });
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
requestAnimationFrame(frame);

