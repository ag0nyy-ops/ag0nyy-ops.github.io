/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Moves: a side-on floor routine. Left stick is your arms, right stick your legs, the triggers
   pull you into a tuck or a pike. Run, hurdle, punch, spin, open, stick it. The judges score
   what your body actually did. Nothing to unlock: every skill is there from the first pass. */

import { Input } from '../shared/input.js';
import { loadSettings, reducedMotion } from '../shared/settings.js';
import * as look from '../shared/look.js';
import {
  FLOOR, VMAX, HURDLE, WINDOW, REBOUND, TAU, STEP_AT, clamp, classifyFlick, punchQuality,
  Flight, touchdown, Balance, judgeSkill, landingDeductions, scoreRoutine, REQUIREMENTS, fmt
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
/* A flick: the stick goes from near the middle to well out. The direction is read over the next
   50 ms so two arrow keys pressed a hair apart still make a diagonal. */
const flick = { armed: true, at: null, best: null };
function readFlick(now) {
  const l = legsStick(), m = Math.hypot(l.x, l.y);
  if (m < 0.35) { flick.armed = true; if (flick.at == null) return null; }
  if (flick.at == null && flick.armed && m > 0.7) { flick.at = now; flick.best = { ...l, m }; flick.armed = false; }
  if (flick.at != null) {
    if (m >= flick.best.m - 0.01) flick.best = { ...l, m };
    if (now - flick.at >= 0.05) { const out = { at: flick.at, x: flick.best.x, y: flick.best.y }; flick.at = null; return out; }
  }
  return null;
}
const resetFlick = () => { const l = legsStick(); flick.armed = Math.hypot(l.x, l.y) < 0.35; flick.at = null; };

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
let game = null;

function mainMenu() {
  mode = 'menu'; game = null;
  const best = data.best ? ` <small>best ${data.best.total.toFixed(2)}</small>` : '';
  show(`<p class="label">Game file / Gymnastics / Floor</p><h1 class="title">Moves</h1>
    <div class="menu">
      <button class="btn btn--solid" data-go="play" data-arg="routine">Routine${best}</button>
      <button class="btn" data-go="play" data-arg="free">Free floor <small>practice</small></button>
      <button class="btn" data-go="play" data-arg="slow">Free floor <small>half speed</small></button>
      <button class="btn" data-go="skills">Move list</button>
      <button class="btn" data-go="controls">Controls</button>
      <button class="btn" data-go="home">All games</button>
    </div>
    <p class="hint">A routine is ${PASSES} passes across the floor. Judges score difficulty (D) for what you throw and execution (E) from 10 for how clean it is. Every skill is open from the start.</p>`);
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
  show(`<p class="label">Paused</p><div class="menu">
    <button class="btn btn--solid" data-go="resume">Resume</button>
    ${game.kind === 'routine' ? '' : '<button class="btn" data-go="endfree">End practice</button>'}
    <button class="btn" data-go="restart">Restart</button>
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

/* ---------------- game state ---------------- */
function newGame(kind) {
  game = {
    kind, slow: kind === 'slow', passes: [], pass: null, phase: 'ready', t: 0,
    g: { x: 0.6, face: 1, travel: 1, v: 0, runPhase: 0 }, flight: null, td: null, bal: null,
    hurdleT: 0, armsWasUp: true, legsWasOut: true, callout: null, msg: '', rebound: null, stepCool: 0,
    stepShift: 0, landT: 0, walkTo: null, presented: 0
  };
  newPass();
  mode = 'play'; hide();
}
function newPass() { game.linkNext = false; game.pass = { skills: [], connections: 0 }; game.phase = 'ready'; game.g.v = 0; resetFlick(); }
const passNo = () => game.passes.length + 1;

function update(dt) {
  input.poll();
  if (mode !== 'play') return menuInput();
  if (input.pressed('START') || input.pressed('B')) return pause();
  if (game.slow) dt *= 0.5;
  const G_ = game, g = G_.g, s = input.state, legs = legsStick();
  G_.t += dt;
  const armsUp = s.ly < -0.6, armsUpEdge = armsUp && !G_.armsWasUp;
  G_.armsWasUp = armsUp;
  const toward = legs.x * g.travel;                      // how hard the legs push toward the far side
  G_.stepCool = Math.max(0, G_.stepCool - dt);

  if (G_.phase === 'ready' || G_.phase === 'run') {
    if (toward > 0.3 && G_.phase === 'ready') { G_.phase = 'run'; G_.callout = G_.callout && { ...G_.callout, old: true }; }
    if (G_.phase === 'run') {
      if (toward > 0.3) g.v += 8.5 * (1 - g.v / VMAX) * Math.min(1, toward) * dt;
      else g.v = Math.max(0, g.v - 3 * dt);
      g.x += g.travel * g.v * dt; g.runPhase += g.v * dt * 1.9;
      const far = g.travel > 0 ? g.x > FLOOR - 0.5 : g.x < 0.5;
      if (far) return ranOut('Ran out of floor. Hurdle before the far corner.');
    }
    if (armsUpEdge) { G_.phase = 'hurdle'; G_.hurdleT = 0; resetFlick(); tone(330, 0.05, 'triangle', 0.08); }
    return;
  }
  if (G_.phase === 'hurdle') {
    G_.hurdleT += dt;
    g.x += g.travel * g.v * 0.6 * dt;
    const f = readFlick(G_.hurdleT);
    if (f) {
      const c = classifyFlick(f.x * g.travel, -f.y);
      if (!c) return ranOut('That flick was straight down. Flick back, forward or up.');
      return takeoff(c, g.v, punchQuality(f.at - HURDLE));
    }
    if (G_.hurdleT > HURDLE + WINDOW + 0.12) return ranOut(G_.legsHeldMsg || 'No takeoff. Let the legs stick go, then flick it as the rings meet.');
    if (G_.hurdleT < 0.05 && Math.hypot(legs.x, legs.y) > 0.35) G_.legsHeldMsg = 'No takeoff. Let go of the legs stick during the hurdle, then flick it.';
    return;
  }
  if (G_.phase === 'air') {
    const f = G_.flight;
    const tuck = s.lt, pike = s.rt, armsIn = Math.max(0, s.ly);
    const done = f.step(dt, { tuck, pike, armsIn, legs: Math.hypot(legs.x, legs.y), split: legs.x });
    g.x = f.x;
    if (done) land();
    return;
  }
  if (G_.phase === 'land') {
    G_.landT += dt;
    // connection: flick again right after a salto lands
    if (G_.rebound && G_.landT < REBOUND.open) {
      const fl = readFlick(G_.landT);
      if (fl) {
        const c = classifyFlick(fl.x * g.travel, -fl.y);
        const same = c && (c.kind === 'jump' || c.dir === G_.flight.dir);
        if (same) {
          const q = punchQuality(fl.at - REBOUND.at, REBOUND.window);
          const carry = clamp(G_.flight.speed * 0.55 + 3.4 * (1 - Math.min(1, Math.abs(G_.td.e) / 0.35)), 0, VMAX);
          finishSkill(true);
          G_.linkNext = true;
          return takeoff(c, carry, q, true);
        }
      }
    } else if (G_.rebound) { G_.rebound = null; }
    const u = s.lx;
    const legsOut = Math.hypot(legs.x, legs.y) > 0.5;
    const stepped = !G_.rebound && legsOut && !G_.legsWasOut && G_.stepCool <= 0;
    G_.legsWasOut = legsOut;
    if (stepped) G_.stepCool = 0.4;
    const ev = G_.bal.step(dt, u, armsUp, stepped);
    if (ev === 'step') { G_.stepShift += Math.sign(G_.bal.lam || g.face) * 0.25; g.x += Math.sign(G_.bal.lam || g.face) * 0.25; thud(0.2); }
    if (ev === 'fall') thud(1);
    if (G_.bal.done) { finishSkill(false); endPass(); }
    return;
  }
  if (G_.phase === 'walk') {
    const dir = Math.sign(G_.walkTo - g.x);
    g.face = dir || g.face; g.v = 2.6;
    g.x += dir * 2.6 * dt; g.runPhase += 2.6 * dt * 1.9;
    if (Math.sign(G_.walkTo - g.x) !== dir || reducedMotion()) arrive();
  }
}

function ranOut(msg) {
  const G_ = game; G_.msg = msg; G_.legsHeldMsg = null;
  walkTo(G_.g.travel > 0 ? 0.6 : FLOOR - 0.6);
}
function walkTo(x) { game.phase = 'walk'; game.walkTo = x; game.g.v = 0; }
function arrive() {
  const G_ = game, g = G_.g;
  g.x = G_.walkTo; g.travel = g.x < FLOOR / 2 ? 1 : -1; g.face = g.travel; g.v = 0;
  if (G_.kind === 'routine' && G_.passes.length >= PASSES) return results();
  newPass();
}

function takeoff(c, speed, q, rebound = false) {
  const G_ = game, g = G_.g;
  G_.flight = new Flight({ kind: c.kind, dir: c.dir, twist: c.twist, speed, q, travel: g.travel, x: g.x });
  g.face = c.dir === 'back' ? -g.travel : g.travel;     // a round-off turns you around for back skills
  G_.phase = 'air'; G_.q = q; G_.msg = ''; G_.legsHeldMsg = null; G_.rebound = null;
  tone(220 + 300 * q, 0.06, 'triangle', 0.12);
  if (!rebound) G_.callout = null;
}

function land() {
  const G_ = game, f = G_.flight, g = G_.g;
  const td = touchdown(f);
  G_.td = td; G_.phase = 'land'; G_.landT = 0; G_.legsWasOut = true; G_.stepShift = 0; G_.landX = g.x;
  const lamScreen = td.lean * g.face, velScreen = td.leanVel * g.face;
  G_.bal = new Balance(td.fall ? Math.sign(lamScreen || 1) * 0.9 : lamScreen, velScreen);
  if (td.fall) { G_.bal.done = true; G_.bal.fell = true; }
  G_.rebound = f.kind === 'salto' && !td.fall && !td.squat && Math.abs(td.e) < 0.35 ? { open: true } : null;
  resetFlick();
  thud(clamp(Math.abs(td.e), 0, 1));
}

function finishSkill(connected) {
  const G_ = game, f = G_.flight, td = G_.td;
  const sk = judgeSkill(f, td);
  const out = G_.landX < -0.05 || G_.landX > FLOOR + 0.05;
  const landDed = connected ? landingDeductions({ ...td, squat: false }, null, out).filter(([w]) => w !== 'No finish')
    : landingDeductions(td, G_.bal, out);
  sk.ded = [...sk.air, ...landDed];
  sk.connected = connected; sk.q = G_.q;
  sk.linked = !!G_.linkNext; G_.linkNext = false;              // rebounded into from the skill before
  if (sk.linked && sk.recognized) G_.pass.connections++;      // a connection only counts if the second skill does
  G_.pass.skills.push(sk);
  G_.callout = { skills: G_.pass.skills.slice(), connections: G_.pass.connections };
}

function endPass() {
  const G_ = game, g = G_.g;
  G_.passes.push(G_.pass);
  if (G_.bal && G_.bal.shown) tone(520, 0.2, 'sine', 0.08);
  G_.phase = 'settle'; G_.settleT = 0;
  setTimeout(() => {
    if (!game || game !== G_) return;
    walkTo(g.x > FLOOR / 2 ? FLOOR - 0.6 : 0.6);
  }, reducedMotion() ? 300 : 700);
}

function results() {
  const G_ = game;
  mode = 'results';
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
  drawGymnast(v, pose());
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
  const G_ = game, g = G_.g;
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

function pose() {
  const G_ = game, g = G_.g, p = { x: g.x, z: 0, ang: 0, face: g.face, sx: 1, tuck: 0, pike: 0, knee: 0.08,
    arm: 0.15, armB: null, elbow: 0.1, legA: 0, legB: 0, grounded: true };
  if (G_.phase === 'ready' || (G_.phase === 'settle' && !G_.bal) ) return p;
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
    const up = input.state.ly < -0.6 || (b && b.shown);
    Object.assign(p, { ang: fell ? -Math.sign(lamFace || 1) * 1.35 : -lamFace, knee: fell ? 1.6 : soak + Math.abs(lamFace) * 0.8,
      tuck: G_.td && G_.td.squat && G_.landT < 0.4 ? 0.7 : 0, arm: up ? Math.PI * 0.92 : 1.45 + input.state.lx * g.face * 0.4,
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

function drawGymnast(v, p) {
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
  const T = look.team(0), k = v.ppm;
  // your gymnast: a faint ring on the floor under you
  look.ring(ctx, v.sx(p.x), v.floorY, Math.max(10, 0.5 * k));
  ctx.save();
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
  ctx.restore();
}
const BACK = { suit: ['#d0d0d0', '#a8a8a8', '#6a6a6a'], skin: ['#a8a8a8', '#7c7c7c', '#3e3e3e'] };

/* ---------------- heads-up display: scoreboard, calls and the button bar live on the page ---------------- */
function board(G_) {
  const a = { name: 'you', sub: `${look.bandWord(0)} · difficulty` }, b = { name: 'judges', sub: `${look.bandWord(1)} · execution` };
  if (!G_) { HUD.board({ a: { ...a, score: '0.0' }, b: { ...b, score: '10.00' }, clock: '--' }); return; }
  const final = mode === 'results', sc = scoreRoutine(G_.passes, { requirements: final && G_.kind === 'routine' });
  const routine = G_.kind === 'routine';
  HUD.board({
    a: { ...a, score: sc.D.toFixed(1) }, b: { ...b, score: sc.E.toFixed(2) },
    clock: final ? sc.total.toFixed(2) : routine ? `${Math.min(PASSES, passNo())}/${PASSES}` : `#${passNo()}`,
    low: !final && routine && passNo() >= PASSES
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
  const G_ = game, g = G_.g, s = input.state, pad = input.lastDevice === 'controller';
  const fwd = g.travel > 0 ? '→' : '←', bwd = g.travel > 0 ? '←' : '→';
  board(G_);
  const c = G_.callout, sk = c ? c.skills[c.skills.length - 1] : null;
  if (sk && sk !== shownSkill) stamp(c);
  shownSkill = sk;
  HUD.msg(G_.msg);
  const air = G_.phase === 'air' ? G_.flight : null;
  const tuck = clamp(air ? air.tuck : s.lt, 0, 1), pike = clamp(air ? air.pike : s.rt, 0, 1);
  HUD.meters([{ label: pad ? 'L2 tuck' : 'F tuck', v: tuck }, { label: pad ? 'R2 pike' : 'J pike', v: pike }]);

  // top right: the spin dial
  dial(W - 90, 84);

  // hurdle rings around the feet: the moving ring closes on the fixed one at the sweet spot
  if (G_.phase === 'hurdle') {
    const k = HURDLE - G_.hurdleT, fx = v.sx(g.x), fy = v.floorY;
    ctx.strokeStyle = look.FLOOR.mark; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, 16, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, 16 + Math.max(0, k) * 260, 0, TAU); ctx.stroke();
  }

  // bottom left: run speed, then balance once you land
  const y0 = H - 62;
  speedBox(20, y0, g.v);
  if (G_.phase === 'land' && G_.bal && W > 420) balanceBar(164, y0, G_.bal);

  if (mode === 'play') bar(G_, pad, fwd, bwd, tuck, pike);
}

/* what the buttons do right now */
function bar(G_, pad, fwd, bwd, tuck, pike) {
  const ph = G_.phase, ch = (k, t, open) => ({ k, t, open });
  const where = G_.kind === 'routine' ? `routine · pass ${Math.min(PASSES, passNo())} of ${PASSES}` : `free floor${G_.slow ? ' · half speed' : ''} · pass ${passNo()}`;
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
function dial(cx, cy) {
  const G_ = game, f = G_.phase === 'air' || G_.phase === 'land' ? G_.flight : null, r = 46;
  ctx.fillStyle = 'rgba(6,6,6,.7)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = look.FLOOR.inner; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = FG; ctx.fillRect(cx - 1.5, cy - r - 8, 3, 14);
  const theta = f && f.kind === 'salto' ? f.theta : 0, sign = f && f.dir === 'back' ? 1 : -1;
  const a = sign * theta * game.g.face;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx - Math.sin(a) * r * 0.9, cy - Math.cos(a) * r * 0.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx - Math.sin(a) * r * 0.9, cy - Math.cos(a) * r * 0.9, 5, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
  // hollow ring: where your head ends up if you open now. Open when it reaches the top notch.
  if (f && f.kind === 'salto' && game.phase === 'air') {
    const b = sign * f.predicted * game.g.face;
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

