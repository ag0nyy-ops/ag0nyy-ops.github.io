/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Southpaw: side-on arcade boxing. The triggers are your hands: a light pull is a quick shot,
   a full pull lands heavy and leaves you open. The right stick picks the punch, the left stick
   moves your feet, the bumpers are your guard. Five computer fighters, no stats to grind. */

import { Input } from '../shared/input.js';
import { loadSettings, palette, reducedMotion } from '../shared/settings.js';
import * as look from '../shared/look.js';
import { Bout, STYLES, SPARRING, PUNCHES, RING, COUNT_STEP } from './sim.js';

const SAVE = 'jay.southpaw.v1';
const ROUNDS = 3, ROUND_LEN = 75;
const KB_FULL = 0.32;   // seconds of holding F or J for a full-power punch

const input = new Input({
  A: ['Enter'], B: ['Backspace'], START: ['KeyP', 'Escape'],
  LB: ['KeyE'], RB: ['KeyU'], LS: ['KeyQ'],
  LEFT: ['KeyA'], RIGHT: ['KeyD'], UP: ['KeyW'], DOWN: ['KeyS'],
  aL: ['ArrowLeft'], aR: ['ArrowRight'], aU: ['ArrowUp'], aD: ['ArrowDown'],
  slip: ['Space'], pL: ['KeyF'], pR: ['KeyJ']
});

/* ---------------- save data (this browser only) ---------------- */
function load() {
  let d = {}; try { d = JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) {}
  return { record: { ...(d.record || {}) } };
}
const data = load();
const persist = () => { try { localStorage.setItem(SAVE, JSON.stringify(data)); } catch (e) {} };
const rec = (id) => data.record[id] || { w: 0, l: 0, d: 0 };

/* ---------------- sound: tiny synth, no files ---------------- */
let ac = null;
function audio() {
  if (!ac) { try { ac = new AudioContext(); } catch (e) { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function noise(len, freq, vol, type = 'lowpass') {
  const a = audio(); const v = loadSettings().volume * vol; if (!a || v <= 0) return;
  const n = Math.floor(a.sampleRate * len), buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = buf; f.type = type; f.frequency.value = freq; g.gain.value = v;
  s.connect(f).connect(g).connect(a.destination); s.start();
}
function tone(freq, len, vol, type = 'sine') {
  const a = audio(); const v = loadSettings().volume * vol; if (!a || v <= 0) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(v, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + len);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + len);
}
const sfx = {
  hit: (p, body) => { noise(0.12 + 0.08 * p, body ? 260 : 420 + 500 * p, 0.35 + 0.35 * p); tone(body ? 70 : 95, 0.12, 0.25 * p); },
  block: () => noise(0.06, 1400, 0.22, 'bandpass'),
  miss: () => noise(0.14, 900, 0.08, 'bandpass'),
  slip: () => noise(0.1, 2200, 0.07, 'highpass'),
  bell: () => { tone(880, 1.4, 0.18); tone(1320, 1.1, 0.08); tone(1760, 0.8, 0.04); },
  count: () => tone(330, 0.08, 0.12, 'triangle'),
  down: () => { noise(0.35, 180, 0.5); tone(55, 0.4, 0.3); }
};

/* ---------------- screens (DOM overlay, driven by controller or keyboard) ---------------- */
const $ = (sel) => document.querySelector(sel);
const overlay = $('#overlay');
const backLink = $('.back');
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

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const recText = (id) => { const r = rec(id); return r.w + r.l + r.d ? `${r.w}–${r.l}${r.d ? '–' + r.d : ''}` : 'not fought'; };

function mainMenu() {
  mode = 'menu'; fight = null;
  show(`<p class="label">Game file / Boxing / ${ROUNDS} rounds × ${ROUND_LEN} s</p><h1 class="title">Southpaw</h1>
    <div class="menu">
      <button class="btn" data-go="pick">Fight <small>pick an opponent</small></button>
      <button class="btn" data-go="practice">Practice <small>no clock, partner never punches</small></button>
      <button class="btn" data-go="controls">Controls</button>
    </div>
    <p class="hint">Your triggers are your hands. Pull a little for a quick shot, all the way for a heavy one that leaves you open.
    Nothing to unlock and nothing to train: every fighter is open from the start, and you only get better by boxing better.</p>`);
}
function pickMenu() {
  mode = 'menu';
  const b = STYLES.map((s, i) => `<button class="btn" data-go="fight" data-arg="${s.id}">${i + 1}. ${esc(s.name)} <small>${esc(s.tag)} · ${recText(s.id)}</small></button>`).join('');
  show(`<p class="label">Fight card</p><h1 class="title">Opponents</h1>
    <div class="menu">${b}<button class="btn" data-go="menu">Back</button></div>
    <ul class="blurbs">${STYLES.map((s) => `<li><b>${esc(s.name)}:</b> ${esc(s.blurb)}${s.stance === 'southpaw' ? ' Southpaw.' : ''}</li>`).join('')}</ul>
    <p class="hint">Listed easiest first. They play by your rules: they only see your punch once it starts, and they react about as fast as a person.</p>`);
}
function controls(back = 'menu') {
  mode = mode === 'paused' ? 'paused' : 'menu';
  show(`<p class="label">Controls</p><h1 class="title">How to box</h1>
    <table class="keys"><thead><tr><th></th><th>Controller</th><th>Keyboard</th></tr></thead><tbody>
    <tr><td>Left hand / right hand</td><td>L2 / R2. Pull depth sets power</td><td>F / J. Hold longer for power</td></tr>
    <tr><td>Pick the punch</td><td>Right stick when you throw: centre straight, sideways hook, down uppercut</td><td>Arrows when you throw: none straight, left or right hook, down uppercut</td></tr>
    <tr><td>Go to the body</td><td>Hold the left stick down while you throw</td><td>Hold S while you throw</td></tr>
    <tr><td>Feet</td><td>Left stick, in and out</td><td>A back, D in</td></tr>
    <tr><td>High guard / low guard</td><td>L1 / R1. Both is the shell</td><td>E / U. Both is the shell</td></tr>
    <tr><td>Slip</td><td>Flick the right stick and let go, or press Circle</td><td>Space</td></tr>
    <tr><td>Switch stance</td><td>Click the left stick</td><td>Q</td></tr>
    <tr><td>Pause</td><td>Options</td><td>P or Esc</td></tr></tbody></table>
    <ul class="blurbs">
      <li><b>Lead and rear:</b> orthodox, your left hand is the lead. The lead jab is fast and light, the rear cross is slower and hurts. Switch stance and the hands swap.</li>
      <li><b>Range:</b> straights reach furthest. Hooks and uppercuts need you close, and up close straights get smothered.</li>
      <li><b>Guards:</b> high guard stops head shots, low guard stops the body. The uppercut comes up under a high guard and splits the shell, so a turtle can still be opened.</li>
      <li><b>Slip:</b> slip a straight or hook to the head and your next punch is a counter for a moment. Slipping into an uppercut gets you caught.</li>
      <li><b>Counters:</b> hit them while they're missing, recovering or winding up something big and it lands harder.</li>
      <li><b>Stamina:</b> every punch costs some, misses cost more. Tired arms are slow and soft. Stop throwing to get it back; body shots slow theirs down.</li>
      <li><b>Knockdowns:</b> you go down when your health runs out. Three knockdowns and the referee stops it.</li>
    </ul>
    <p class="hint">Stick drifting? Raise the deadzone in the settings on the <a href="../">games page</a>. Everything works on the keyboard too.</p>
    <div class="menu"><button class="btn" data-go="${back}">Back</button></div>`);
}

/* ---------------- fight state ---------------- */
let mode = 'menu';          // menu | fight | paused | corner | results
let fight = null;
const canvas = $('#c'), ctx = canvas.getContext('2d');

function newFight(id) {
  const practice = id === 'sparring';
  const style = practice ? SPARRING : STYLES.find((s) => s.id === id);
  const bout = new Bout(style, { practice });
  fight = { id, style, bout, practice, round: 1, clock: ROUND_LEN, phase: 'intro', phaseT: 0, cards: [], msg: '', endT: 0,
    ghost: { me: 100, foe: 100 }, last: '' };
  resetPlayer();
  mode = 'fight'; hide();
}
function nextRound() {
  const f = fight, b = f.bout;
  f.round++; f.clock = ROUND_LEN; f.phase = 'intro'; f.phaseT = 0;
  for (const p of [b.me, b.foe]) { p.resetRound(); p.hp = Math.min(100, p.hp + 12); }
  if (f.style.switches) b.foe.stance = b.foe.stance === 'orthodox' ? 'southpaw' : 'orthodox';
  b.brain.newRound();
  resetPlayer();
  mode = 'fight'; hide();
}

function go(what, arg) {
  audio();
  if (what === 'menu') mainMenu();
  else if (what === 'pick') pickMenu();
  else if (what === 'controls') controls(mode === 'paused' ? 'pause' : 'menu');
  else if (what === 'pause') pauseMenu();
  else if (what === 'fight') newFight(arg);
  else if (what === 'practice') newFight('sparring');
  else if (what === 'again') newFight(fight.id);
  else if (what === 'next') nextRound();
  else if (what === 'resume') { mode = 'fight'; hide(); resetPlayer(); }
}

function pauseMenu() {
  mode = 'paused';
  const f = fight;
  show(`<p class="label">Paused / ${f.practice ? 'practice' : `round ${f.round} of ${ROUNDS}`}</p><h1 class="title">Timeout</h1>
    <div class="menu">
      <button class="btn" data-go="resume">Resume</button>
      <button class="btn" data-go="again">${f.practice ? 'Restart practice' : 'Restart fight'}</button>
      <button class="btn" data-go="controls">Controls</button>
      <button class="btn" data-go="${f.practice ? 'menu' : 'pick'}">${f.practice ? 'End practice' : 'Quit fight'}</button>
    </div>`);
}

/* round scoring: 10 to whoever did more damage, 9 to the other, a point off per knockdown */
function scoreRound() {
  const b = fight.bout, me = b.me.roundDmg, foe = b.foe.roundDmg;
  let a = 10, c = 10;
  if (me - foe > 1.5) c = 9; else if (foe - me > 1.5) a = 9;
  a -= b.me.roundKd; c -= b.foe.roundKd;
  fight.cards.push([a, c]);
}
const total = (i) => fight.cards.reduce((s, r) => s + r[i], 0);

function corner() {
  mode = 'corner';
  const f = fight, b = f.bout;
  const rows = f.cards.map((r, i) => `<tr><td>Round ${i + 1}</td><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  show(`<p class="label">End of round ${f.round} / ${ROUNDS}</p><h1 class="title">Corner</h1>
    <table class="board"><tbody><tr><td></td><td>You</td><td>${esc(f.style.name)}</td></tr>${rows}
    <tr class="me"><td>Total</td><td>${total(0)}</td><td>${total(1)}</td></tr></tbody></table>
    <ul class="blurbs"><li><b>Landed:</b> ${b.me.stats.landed} of ${b.me.stats.thrown} so far.</li>
      <li><b>Corner says:</b> ${esc(f.style.tip)}</li></ul>
    <div class="menu"><button class="btn" data-go="next">Round ${f.round + 1}</button></div>`);
}

function finish(winner, how) {
  const f = fight, b = f.bout;
  mode = 'results';
  if (!f.practice) {
    const r = rec(f.id); if (winner === 'me') r.w++; else if (winner === 'foe') r.l++; else r.d++;
    data.record[f.id] = r; persist();
  }
  const mm = Math.floor((ROUND_LEN - f.clock) / 60), ss = Math.floor((ROUND_LEN - f.clock) % 60);
  const method = how === 'decision' ? `Decision, ${total(0)}–${total(1)}` : `${how}, round ${f.round} at ${mm}:${String(ss).padStart(2, '0')}`;
  const title = winner === 'me' ? 'You win' : winner === 'foe' ? 'You lose' : 'Draw';
  const row = (name, a, c) => `<tr><td>${name}</td><td>${a}</td><td>${c}</td></tr>`;
  const pct = (s) => (s.thrown ? Math.round(100 * s.landed / s.thrown) + '%' : '–');
  const m = b.me.stats, o = b.foe.stats;
  show(`<p class="label">Result / ${esc(f.style.name)}</p><h1 class="title">${title}</h1>
    <p class="hint">${esc(method)}.</p>
    <table class="board"><tbody><tr><td></td><td>You</td><td>${esc(f.style.name)}</td></tr>
      ${row('Landed / thrown', `${m.landed} / ${m.thrown}`, `${o.landed} / ${o.thrown}`)}
      ${row('Accuracy', pct(m), pct(o))}
      ${row('Power punches thrown', m.power, o.power)}
      ${row('Counters', m.counters, o.counters)}
      ${row('Punches slipped', m.slips, o.slips)}
      ${row('Punches blocked', m.blocked, o.blocked)}
      ${row('Knockdowns scored', m.kds, o.kds)}</tbody></table>
    <div class="menu"><button class="btn" data-go="again">Rematch</button><button class="btn" data-go="pick">Pick an opponent</button><button class="btn" data-go="menu">Menu</button></div>`);
}

/* ---------------- your hands: triggers, keys, stick ---------------- */
const kb = { L: null, R: null }, kbDone = { L: false, R: false }, kbQueue = [];
const HAND_KEY = { KeyF: 'L', KeyJ: 'R' };
addEventListener('keydown', (e) => {
  const h = HAND_KEY[e.code]; if (!h || e.repeat || kb[h] != null) return;
  kb[h] = performance.now(); kbDone[h] = false;
});
addEventListener('keyup', (e) => {
  const h = HAND_KEY[e.code]; if (!h || kb[h] == null) return;
  const held = (performance.now() - kb[h]) / 1000; kb[h] = null;
  if (!kbDone[h] && mode === 'fight') kbQueue.push({ hand: h, p: Math.min(1, 0.2 + 0.8 * held / KB_FULL) });
  kbDone[h] = false;
});
addEventListener('blur', () => { kb.L = kb.R = null; });

const trig = { L: freshTrig(), R: freshTrig() };
function freshTrig() { return { armed: true, active: false, start: 0, max: 0 }; }
let flick = { out: false, t: 0, threw: false };
let pending = null;  // a punch waiting for your hands to be free (short buffer for combos)

function resetPlayer() {
  trig.L = freshTrig(); trig.R = freshTrig(); kbQueue.length = 0; pending = null;
  flick = { out: false, t: 0, threw: false }; kbDone.L = kbDone.R = !!(kb.L || kb.R);
}
function padTrigger(i) {
  const p = input.pad; if (!p || !p.buttons[i]) return 0;
  const v = p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0), dz = input.settings.triggerDeadzone;
  return v <= dz ? 0 : Math.min(1, (v - dz) / (1 - dz));
}
/* a punch goes on the trigger's peak: a light pull fires as soon as it stops rising, a full pull at the bottom */
function readTrig(tr, v, now) {
  if (tr.armed && v >= 0.1) { tr.armed = false; tr.active = true; tr.start = now; tr.max = v; }
  if (tr.active) {
    tr.max = Math.max(tr.max, v);
    if (v >= 0.95 || v < tr.max - 0.07 || now - tr.start > 0.09) { tr.active = false; return Math.min(1, (tr.max - 0.1) / 0.85); }
  }
  if (!tr.armed && !tr.active && v < 0.06) tr.armed = true;
  return null;
}
function punchShape() {
  const s = input.state;
  let rx = s.rx, ry = s.ry;
  if (input.down('aL')) rx = -1; if (input.down('aR')) rx = 1; if (input.down('aD')) ry = 1;
  const kind = Math.abs(rx) > 0.45 && Math.abs(rx) >= ry ? 'hook' : ry > 0.45 ? 'upper' : 'straight';
  return { kind, body: kind !== 'upper' && s.ly > 0.5 };
}

function myIntent(now) {
  const s = input.state;
  const it = { move: s.lx, guard: 'none', punch: null, slip: false, stance: input.pressed('LS') };
  const hi = input.down('LB'), lo = input.down('RB');
  it.guard = hi && lo ? 'shell' : hi ? 'high' : lo ? 'low' : 'none';

  const fired = [];
  const L = readTrig(trig.L, padTrigger(6), now), R = readTrig(trig.R, padTrigger(7), now);
  if (L != null) fired.push({ hand: 'L', p: L });
  if (R != null) fired.push({ hand: 'R', p: R });
  for (const h of ['L', 'R']) if (kb[h] != null && !kbDone[h] && (now * 1000 - kb[h]) / 1000 >= KB_FULL) { kbDone[h] = true; fired.push({ hand: h, p: 1 }); }
  fired.push(...kbQueue.splice(0));
  if (fired.length) {
    const shape = punchShape();
    const f = fired[fired.length - 1];
    pending = { hand: f.hand, kind: shape.kind, body: shape.body, p: f.p, age: 0 };
    flick.threw = true;
  }

  // slip: flick the right stick out and let it come back, without throwing; or circle / space
  const m = Math.hypot(s.rx, s.ry);
  if (!flick.out && m > 0.8) { flick = { out: true, t: now, threw: false }; }
  if (flick.out && m < 0.3) { if (!flick.threw && now - flick.t < 0.25) it.slip = true; flick.out = false; }
  if (input.pressed('slip') || (input.pad && input.pressed('B'))) it.slip = true;

  if (pending) it.punch = pending;
  return it;
}

/* ---------------- main loop ---------------- */
const STEP = 1 / 120;
let acc = 0, lastT = performance.now();
function frame(t) {
  const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  input.poll();
  if (mode === 'fight') runFight(dt, t / 1000);
  else menuInput();
  draw(dt);
  requestAnimationFrame(frame);
}

function menuInput() {
  if (!menuItems.length) return;
  const n = input.nav();
  let step = n.y || n.x;
  if (input.pressed('aU') || input.pressed('aL')) step = -1;
  if (input.pressed('aD') || input.pressed('aR')) step = 1;
  if (step) { menuIndex = (menuIndex + step + menuItems.length) % menuItems.length; menuItems[menuIndex].focus(); }
  if (input.pressed('A') || input.pressed('slip')) { const b = menuItems[menuIndex]; b && b.click(); }
  if (input.pressed('B') || input.pressed('START')) {
    if (mode === 'paused' && overlay.querySelector('[data-go="resume"]')) go('resume');
    else { const back = menuItems.find((b) => b.textContent.trim() === 'Back'); if (back) back.click(); }
  }
}

function runFight(dt, now) {
  const f = fight, b = f.bout;
  if (input.pressed('START')) { pauseMenu(); return; }
  const it = myIntent(now);
  f.phaseT += dt;
  const acting = f.phase === 'live';
  acc += dt;
  while (acc >= STEP) {
    acc -= STEP;
    b.step(STEP, it, acting);
    if (it.punch && it.punch.taken) { pending = null; it.punch = null; }
    it.slip = false; it.stance = false;
    if (pending) { pending.age += STEP; if (pending.age > 0.18) { pending = null; it.punch = null; } }
    if (acting && !b.downed && !f.practice) f.clock = Math.max(0, f.clock - STEP);
  }
  for (const e of b.events.splice(0)) onEvent(e);

  if (f.phase === 'intro' && f.phaseT > 1.6) { f.phase = 'live'; f.phaseT = 0; sfx.bell(); }
  if (f.phase === 'live' && b.over) { f.phase = 'stopped'; f.phaseT = 0; f.result = b.over; sfx.bell(); }
  if (f.phase === 'live' && !f.practice && f.clock <= 0 && !b.downed) { f.phase = 'bell'; f.phaseT = 0; sfx.bell(); scoreRound(); }
  if (f.phase === 'stopped' && f.phaseT > 2.2) return finish(f.result.winner, f.result.how);
  if (f.phase === 'bell' && f.phaseT > 1.6) {
    if (f.round < ROUNDS) return corner();
    const a = total(0), c = total(1);
    return finish(a > c ? 'me' : c > a ? 'foe' : 'draw', 'decision');
  }
}

function onEvent(e) {
  const b = fight.bout;
  if (e.type === 'hit') {
    sfx.hit(e.p, e.body);
    if (e.counter || e.p > 0.85) { look.cheer(0.5); if (e.p > 0.85) shake = Math.max(shake, 3); }
    if (e.who === b.foe) fight.last = describe(b.me.lastThrow);
  } else if (e.type === 'block') sfx.block();
  else if (e.type === 'miss') sfx.miss();
  else if (e.type === 'slipped') sfx.slip();
  else if (e.type === 'down') { sfx.down(); look.cheer(0.9); shake = 5; }
  else if (e.type === 'count') sfx.count();
}
function describe(a) { return a ? `${PUNCHES[a.key].name}${a.body ? ' to the body' : ''}, ${Math.round(a.p * 100)}% power` : ''; }

/* ---------------- drawing: the Folkstyle look, the canvas fills the stage ---------------- */
let W = 0, H = 0, dpr = 1;
function resize() { ({ W, H, dpr } = look.fit(canvas)); }
look.watch(canvas, resize); resize();

const FG = '#ececec';
const HUD = look.hud();
const MAT = 0.3;   // how deep the ring canvas looks, in metres either side of the fighters' feet
let ppm = 100, floorY = 0, cx = 0, farY = 0, shake = 0, shownMsg = '', downSeen = null;
const X = (x) => cx + x * ppm, Y = (y) => floorY - y * ppm;

function layout() {
  ppm = Math.max(48, Math.min(W / 6.9, (H - 70) / 2.45));
  floorY = H - Math.max(34, 0.5 * ppm); cx = W / 2; farY = floorY - MAT * ppm;
}

function draw(dt) {
  HUD.tick(dt, input);
  layout();
  const calm = look.calm();
  shake = Math.max(0, shake - 30 * dt);
  // the crowd sits behind the far ropes
  look.arena(ctx, W, H, { horizon: farY, dt });
  const f = fight;
  ctx.save();
  if (shake > 0 && !calm) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawRing(f && f.bout);
  if (!f) { ctx.restore(); return idle(); }
  const b = f.bout;
  // draw the one who's punching on top, so the glove is always visible
  const order = b.foe.is('punch') && !b.me.is('punch') ? [b.me, b.foe] : [b.foe, b.me];
  for (const p of order) drawFighter(p, b.other(p), p === b.me ? 0 : 1, f);
  drawFx(b, calm);
  if (mode === 'fight' && !f.watch) drawHands();
  ctx.restore();
  drawHud(f, b);
}

/* the ring: dark canvas, a pool of light in the middle, ropes on the far side, apron in front */
function drawRing(b) {
  const L = -RING - 0.4, R = RING + 0.4, k = 0.94, nearY = floorY + MAT * ppm;
  const fx = (x) => cx + x * ppm * k;
  const t = performance.now() / 1000;
  // apron face under the near edge
  ctx.fillStyle = look.FLOOR.edge; ctx.fillRect(X(L), nearY, (R - L) * ppm, Math.max(6, 0.1 * ppm));
  // the canvas
  ctx.fillStyle = look.FLOOR.base;
  ctx.beginPath(); ctx.moveTo(fx(L), farY); ctx.lineTo(fx(R), farY); ctx.lineTo(X(R), nearY); ctx.lineTo(X(L), nearY); ctx.closePath(); ctx.fill();
  look.spot(ctx, cx, floorY, RING * 0.85 * ppm, MAT * ppm * 1.4);
  // edges of the canvas
  ctx.lineCap = 'butt';
  ctx.strokeStyle = look.FLOOR.line; ctx.lineWidth = Math.max(1, ppm / 110);
  ctx.beginPath(); ctx.moveTo(fx(L), farY); ctx.lineTo(fx(R), farY); ctx.moveTo(X(L), nearY); ctx.lineTo(X(R), nearY); ctx.stroke();
  // where the ropes stand on the canvas: brightens, slowly, when someone is backed onto them
  for (const s of [-1, 1]) {
    const hot = b && [b.me, b.foe].some((p) => p.x * s > RING - 0.4);
    ctx.strokeStyle = hot ? look.FLOOR.hot : look.FLOOR.inner; ctx.globalAlpha = hot ? look.pulse(t) : 1;
    ctx.lineWidth = hot ? Math.max(1.5, ppm / 90) : 1;
    ctx.beginPath(); ctx.moveTo(fx(s * RING), farY); ctx.lineTo(X(s * RING), nearY); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // centre mark
  ctx.strokeStyle = look.FLOOR.mark; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(X(-0.12), floorY); ctx.lineTo(X(0.12), floorY); ctx.moveTo(X(0), floorY - 0.05 * ppm); ctx.lineTo(X(0), floorY + 0.05 * ppm); ctx.stroke();
  // far posts and ropes
  const ph = 1.35 * ppm * k;
  ctx.strokeStyle = '#565656'; ctx.lineWidth = Math.max(1.5, ppm / 120);
  ctx.beginPath();
  for (const h of [0.5, 0.85]) { ctx.moveTo(fx(-RING - 0.2), farY - h * ppm * k); ctx.lineTo(fx(RING + 0.2), farY - h * ppm * k); }
  ctx.stroke();
  ctx.strokeStyle = look.FLOOR.mark;
  ctx.beginPath(); ctx.moveTo(fx(-RING - 0.2), farY - 1.2 * ppm * k); ctx.lineTo(fx(RING + 0.2), farY - 1.2 * ppm * k); ctx.stroke();
  const pw = Math.max(4, 0.05 * ppm);
  for (const x of [-RING - 0.2, RING + 0.2]) {
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(fx(x) - pw / 2, farY - ph, pw, ph);
    ctx.fillStyle = look.FLOOR.mark; ctx.fillRect(fx(x) - pw / 2 - 1, farY - ph, pw + 2, Math.max(6, 0.12 * ppm));
  }
  // near corner stubs, so the ring reads as a square without ropes in front of the fighters
  for (const x of [-RING - 0.2, RING + 0.2]) {
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(X(x) - pw / 2, nearY - 0.18 * ppm, pw, 0.18 * ppm);
    ctx.fillStyle = look.FLOOR.mark; ctx.fillRect(X(x) - pw / 2 - 1, nearY - 0.18 * ppm, pw + 2, Math.max(4, 0.06 * ppm));
  }
}
function idle() {
  HUD.board({ a: { name: 'you', sub: look.bandWord(0), score: 0 }, b: { name: 'cpu', sub: look.bandWord(1), score: 0 }, clock: '--' });
  HUD.msg('');
  meters([{ label: 'you · health', v: 1 }, { label: 'cpu · health', v: 1 }], [{ label: 'you · stamina', v: 1 }, { label: 'cpu · stamina', v: 1 }]);
  menuBar();
}

/* two-bone arm: shoulder S to glove G, elbow bends down (or up for a hook) */
function elbow(S, G, up, len = 0.36) {
  let dx = G.x - S.x, dy = G.y - S.y, d = Math.hypot(dx, dy);
  const max = len * 2 - 0.001;
  if (d > max) { G = { x: S.x + dx / d * max, y: S.y + dy / d * max }; dx = G.x - S.x; dy = G.y - S.y; d = max; }
  const h = Math.sqrt(Math.max(0, len * len - (d / 2) * (d / 2)));
  let nx = -dy / d, ny = dx / d;            // perpendicular
  if ((ny < 0) !== !up) { nx = -nx; ny = -ny; }
  return { E: { x: S.x + dx / 2 + nx * h, y: S.y + dy / 2 + ny * h }, G };
}
const lerp = (a, b, k) => a + (b - a) * k;
const lp = (A, B, k) => ({ x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k) });
const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 2);
function quad(A, C, B, k) { return lp(lp(A, C, k), lp(C, B, k), k); }

function pose(p, o) {
  const dir = p.face, a = p.act;
  let dip = p.guard === 'low' ? 0.04 : p.guard === 'shell' ? 0.06 : 0, slipK = 0, lean = 0, back = 0;
  if (a && a.type === 'punch') {
    const k = a.phase === 'startup' ? ease(a.t / a.s) : a.phase === 'active' ? 1 : 1 - ease((a.t - a.s - a.a) / (a.r + a.extra));
    if (a.body) dip = 0.15 * k;
    lean = (a.kind === 'straight' ? 0.12 : 0.06) * (a.phase === 'startup' ? 0 : k);
  }
  if (a && a.type === 'slip') slipK = Math.sin(Math.PI * Math.min(1, a.t / a.dur));
  if (a && a.type === 'stun') back = 0.07 * Math.sin(Math.PI * Math.min(1, a.t / a.dur));
  const x = p.x;
  const hip = { x: x - dir * back * 0.5, y: 0.98 - dip * 0.6 - slipK * 0.06 };
  const sh = { x: x + dir * (0.05 + lean - back), y: 1.42 - dip - slipK * 0.1 };
  const head = { x: sh.x + dir * (0.04 + slipK * 0.08), y: 1.63 - dip - slipK * 0.2 };
  const S = { lead: { x: sh.x + dir * 0.07, y: sh.y }, rear: { x: sh.x - dir * 0.07, y: sh.y + 0.01 } };
  const g = p.guard;
  const rest = {
    lead: g === 'high' || g === 'shell' ? { x: x + dir * 0.24, y: head.y - 0.03 } : g === 'low' ? { x: x + dir * 0.3, y: 1.15 - dip } : { x: x + dir * 0.34, y: 1.42 - dip },
    rear: g === 'high' ? { x: x + dir * 0.18, y: head.y - 0.07 } : g === 'low' || g === 'shell' ? { x: x + dir * 0.2, y: 1.2 - dip } : { x: x + dir * 0.2, y: 1.5 - dip }
  };
  const gloves = { lead: rest.lead, rear: rest.rear }, up = { lead: false, rear: false }, trail = {};
  if (a && a.type === 'punch') {
    const R = a.role, r0 = rest[R], Sx = S[R];
    const oHead = 1.62 - (o.is('slip') ? 0.18 : 0);
    const tgt = { x: o.x + o.face * 0.14, y: a.body ? 1.2 : a.kind === 'upper' ? oHead - 0.08 : oHead };
    const dx = tgt.x - Sx.x, dy = tgt.y - Sx.y, dd = Math.hypot(dx, dy), far = 0.72 + (a.kind === 'straight' ? 0.04 : 0);
    const end = a.missed && dd > far ? { x: Sx.x + dir * far * 0.98, y: tgt.y } : dd > far ? { x: Sx.x + dx / dd * far, y: Sx.y + dy / dd * far } : tgt;
    const wind = a.kind === 'straight' ? { x: r0.x - dir * 0.1, y: Math.max(r0.y, 1.4 - dip) }
      : a.kind === 'hook' ? { x: x + dir * 0.02, y: 1.47 - dip } : { x: x + dir * 0.1, y: 1.06 - dip };
    const ctrl = a.kind === 'hook' ? { x: lerp(wind.x, end.x, 0.5) - dir * 0.02, y: Math.max(wind.y, end.y) + 0.16 }
      : a.kind === 'upper' ? { x: end.x - dir * 0.02, y: wind.y } : lp(wind, end, 0.5);
    let G;
    if (a.phase === 'startup') G = lp(r0, wind, ease(a.t / a.s));
    else if (a.phase === 'active') G = quad(wind, ctrl, end, ease((a.t - a.s) / a.a * 1.4));
    else G = lp(end, r0, ease((a.t - a.s - a.a) / (a.r + a.extra)));
    gloves[R] = G; up[R] = a.kind === 'hook';
    if (a.phase !== 'startup') trail[R] = { wind, ctrl, end, k: a.phase === 'active' ? 1 : Math.max(0, 1 - (a.t - a.s - a.a) / 0.18) };
    if (a.phase === 'startup') trail.wind = { at: G, p: a.p, k: a.t / a.s };
  }
  const foot = { lead: { x: x + dir * 0.24, y: 0 }, rear: { x: x - dir * 0.24, y: 0 } };
  return { dir, hip, sh, head, S, gloves, up, trail, foot };
}

/* the far-side arm and leg sit in shadow: a step darker than the near side */
const FAR = [
  { skin: ['#c4c4c4', '#909090', '#454545'], suit: ['#d8d8d8', '#b4b4b4', '#6a6a6a'] },
  { skin: ['#7e7e7e', '#5a5a5a', '#242424'], suit: ['#3a3a3a', '#1e1e1e', '#090909'] }
];
const path = (...pts) => () => { pts.forEach((q, i) => (i ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y)))); };
/* who's who, in words: you and the card's name, or the two dummies when you watch */
function sideNames(f) { return f.watch ? ['dummy a', 'dummy b'] : ['you', f.style.name.toLowerCase()]; }

/* a boxer: light skin and white gloves and trunks for your side, darker with a light rim for theirs.
   The band at the ankle is the only colour in the ring */
function drawFighter(p, o, side, f) {
  const T = look.team(side), D = { ...T, ...FAR[side] }, isMe = side === 0 && !f.watch;
  const w = Math.max(4, 0.11 * ppm), gr = Math.max(4, 0.1 * ppm), br = Math.max(2, 0.035 * ppm);
  if (isMe) look.ring(ctx, X(p.x), Y(0), 0.45 * ppm, MAT * 0.55 * ppm);
  if (p.down()) return drawDown(p, T, w, gr, br);
  const P = pose(p, o);
  // trails show the punch's shape: straight line, wide arc for a hook, rising arc for an uppercut
  if (!look.calm()) for (const role of ['lead', 'rear']) {
    const t = P.trail[role]; if (!t || t.k <= 0) continue;
    ctx.globalAlpha = 0.3 * t.k; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, 0.05 * ppm); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(X(t.wind.x), Y(t.wind.y)); ctx.quadraticCurveTo(X(t.ctrl.x), Y(t.ctrl.y), X(t.end.x), Y(t.end.y)); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const knee = (F) => ({ x: lerp(P.hip.x, F.x, 0.5) + P.dir * 0.06, y: lerp(P.hip.y, 0, 0.5) + 0.02 });
  const leg = (F, tt) => {
    const K = knee(F);
    look.strokeLimb(ctx, path(P.hip, K, F), w * 1.1, tt, tt.skin);
    look.strokeLimb(ctx, path({ x: F.x - P.dir * 0.02, y: 0.03 }, { x: F.x + P.dir * 0.09, y: 0.03 }), w * 0.95, tt, look.TONE.shoe);
    look.band(ctx, X(F.x), Y(0.1), br, T);
    // trunks down to mid thigh
    look.strokeLimb(ctx, path(P.hip, lp(P.hip, K, 0.75)), w * 1.55, tt, tt.suit);
  };
  const arm = (role, tt) => {
    const { E, G } = elbow(P.S[role], P.gloves[role], P.up[role]);
    look.strokeLimb(ctx, path(P.S[role], E, G), w * 0.9, tt, tt.skin);
    look.ball(ctx, X(G.x), Y(G.y), gr, tt, tt.suit);
    return G;
  };
  // far side first: rear leg and rear arm sit behind the body
  leg(P.foot.rear, D);
  arm('rear', D);
  leg(P.foot.lead, T);
  // torso, shaded, lit from the top left
  const torso = [{ x: P.hip.x - 0.1, y: P.hip.y }, { x: P.hip.x + 0.1, y: P.hip.y }, { x: P.sh.x + 0.13, y: P.sh.y + 0.02 }, { x: P.sh.x - 0.13, y: P.sh.y + 0.02 }];
  look.fillBody(ctx, () => { path(...torso)(); ctx.closePath(); }, T, T.skin, [X(P.sh.x - 0.13), Y(P.sh.y), X(P.hip.x + 0.1), Y(P.hip.y)]);
  look.strokeLimb(ctx, path({ x: P.hip.x - 0.1, y: P.hip.y + 0.02 }, { x: P.hip.x + 0.1, y: P.hip.y + 0.02 }), w * 0.7, T, T.suit);
  // head
  look.ball(ctx, X(P.head.x), Y(P.head.y), Math.max(5, 0.13 * ppm), T, T.skin);
  arm('lead', T);
  // windup ring: grows with the power that's coming, so heavy shots are readable before they land
  const wd = P.trail.wind;
  if (wd && wd.p > 0.45) {
    ctx.strokeStyle = 'rgba(236,236,236,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X(wd.at.x), Y(wd.at.y), (0.1 + 0.08 * wd.p) * ppm, 0, Math.PI * 2); ctx.stroke();
  }
  // name tag, and what's going on with them
  const ty = Y(1.76) - 16;
  look.tag(ctx, X(p.x), ty, isMe ? 'you' : sideNames(f)[side], { size: 10, pad: 4 });
  const note = p.is('stun') && p.act.dur > 0.22 ? 'rocked' : isMe && p.counterT > 0 ? 'counter' : '';
  if (note) look.tag(ctx, X(p.x), ty - 20, note, { size: 10, pad: 4 });
}
function drawDown(p, T, w, gr, br) {
  const d = -p.face, x = p.x;
  const pts = { head: { x: x + d * 0.72, y: 0.13 }, sh: { x: x + d * 0.5, y: 0.14 }, hip: { x: x, y: 0.12 }, foot: { x: x - d * 0.75, y: 0.06 } };
  look.strokeLimb(ctx, path(pts.hip, pts.foot), w * 1.1, T, T.skin);
  look.band(ctx, X(pts.foot.x + d * 0.08), Y(0.07), br, T);
  look.fillBody(ctx, () => { path({ x: x, y: 0.02 }, { x: x + d * 0.52, y: 0.04 }, { x: x + d * 0.52, y: 0.26 }, { x: x, y: 0.22 })(); ctx.closePath(); }, T, T.skin,
    [X(x), Y(0.26), X(x + d * 0.52), Y(0.02)]);
  look.strokeLimb(ctx, path(pts.hip, { x: x - d * 0.2, y: 0.1 }), w * 1.55, T, T.suit);
  look.ball(ctx, X(pts.head.x), Y(pts.head.y), Math.max(5, 0.13 * ppm), T, T.skin);
  look.ball(ctx, X(pts.sh.x - d * 0.1), Y(0.3), gr, T, T.suit);
}

/* impact rings and the word for what happened, in a label box */
function drawFx(b, calm) {
  for (const f of b.fx) {
    const k = f.t / f.life;
    ctx.globalAlpha = 1 - k;
    if (f.tone !== 'quiet' || f.text === 'BLOCKED') {
      const r = calm ? 0.16 * ppm : (0.06 + 0.22 * ease(k)) * ppm;
      ctx.strokeStyle = f.tone === 'quiet' ? 'rgba(236,236,236,.5)' : 'rgba(236,236,236,.9)'; ctx.lineWidth = f.tone === 'mark' ? 3 : f.tone === 'quiet' ? 1.5 : 2.5;
      ctx.beginPath(); ctx.arc(X(f.x), Y(f.y), r, 0, Math.PI * 2); ctx.stroke();
    }
    look.tag(ctx, X(f.x), Y(f.y + 0.26) - (calm ? 0 : 18 * ease(k)), f.text, { size: f.tone === 'mark' ? 12 : 11 });
    ctx.globalAlpha = 1;
  }
}

/* your triggers: how far each one is pulled, bottom left of the ring */
function pull(h, i) { return kb[h] != null ? Math.min(1, (performance.now() - kb[h]) / 1000 / KB_FULL) : padTrigger(i); }
function drawHands() {
  const kbd = input.lastDevice === 'keyboard';
  const bh = Math.min(46, H * 0.1), by = H - 12;
  [['L', 6, kbd ? 'F' : 'L2'], ['R', 7, kbd ? 'J' : 'R2']].forEach(([h, i, key], n) => {
    const x = 14 + n * 58, v = pull(h, i);
    ctx.strokeStyle = 'rgba(236,236,236,.5)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, by - bh + 0.5, 12, bh);
    ctx.fillStyle = FG; ctx.fillRect(x + 2, by - 1 - (bh - 3) * v, 9, (bh - 3) * v);
    look.tag(ctx, x + 18, by - bh + 8, key, { size: 10, align: 'left', pad: 4 });
  });
}

/* ---------------- HUD: scoreboard, meters, calls and the button bar live on the page ---------------- */
const fmt = (s) => { const c = Math.max(0, Math.ceil(s)); return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`; };
const unit = (v) => Math.max(0, Math.min(1, v));
const GAS = document.getElementById('gas');
/* health goes through the shared HUD, stamina into the second row the same way */
function meters(hp, st) {
  HUD.meters(hp);
  if (!GAS) return;
  [...GAS.children].forEach((t, i) => {
    const m = st[i], v = Math.round(m.v * 100), key = `${m.label}${v}`;
    if (t.dataset.k === key) return; t.dataset.k = key;
    t.querySelector('span').firstChild.textContent = m.label + ' ';
    t.querySelector('b').textContent = String(v);
    t.querySelector('i').style.width = v + '%';
  });
}
function drawHud(f, b) {
  const me = b.me, foe = b.foe, [na, nb] = sideNames(f);
  const sub = (i, p) => `${look.bandWord(i)} · ${f.watch && f.styles ? f.styles[i].name : p.stance}${p.kd ? ` · down ${p.kd}` : ''}`;
  HUD.board({
    a: { name: na, sub: f.practice ? `${look.bandWord(0)} · landed` : sub(0, me), score: f.practice ? me.stats.landed : total(0) },
    b: { name: nb, sub: f.practice ? `${look.bandWord(1)} · thrown` : sub(1, foe), score: f.practice ? me.stats.thrown : total(1) },
    clock: f.practice ? '--' : `r${f.round} ${fmt(f.clock)}`, low: f.phase === 'live' && !f.practice && f.clock < 10
  });
  meters([{ label: `${na} · health`, v: unit(me.hp / 100) }, { label: `${nb} · health`, v: unit(foe.hp / 100) }],
    [{ label: `${na} · stamina`, v: unit(me.stam / 100) }, { label: `${nb} · stamina`, v: unit(foe.stam / 100) }]);

  // the big calls, stamped once when they change
  const who = (p) => (p === me ? na : nb);
  let msg = '', sub2 = '', title = false;
  if (f.phase === 'intro') { msg = f.practice ? 'Practice' : f.phaseT < 1 ? `Round ${f.round}` : 'Box'; title = msg !== 'Box'; }
  if (f.phase === 'bell') msg = 'Bell';
  if (f.phase === 'stopped') {
    msg = f.result.how; title = true;
    sub2 = f.watch ? `${who(f.result.winner === 'me' ? me : foe)} wins` : f.result.winner === 'me' ? 'you win' : 'you lose';
  }
  if (msg && msg !== shownMsg) HUD.call(msg, sub2, title);
  shownMsg = msg;
  if (b.downed && b.downed !== downSeen) HUD.call('Knockdown', `${who(b.downed.who)} ${who(b.downed.who) === 'you' ? 'are' : 'is'} down`, true);
  downSeen = b.downed;
  HUD.msg(b.downed ? `count ${Math.max(1, b.downed.count)} · ${who(b.downed.who)} down` : '');

  // what the buttons do right now
  if (mode !== 'fight') return menuBar();
  const pad = input.lastDevice === 'controller', c = (k, t, open) => ({ k, t, open });
  if (f.watch) {
    const dl = (n, brain, st) => (brain && brain.d ? `${n}: ${brain.d.style}, seed ${brain.d.tag}` : `${n}: ${st}`);
    HUD.bar('watching', [c('', dl('dummy a', b.meBrain, f.styles ? f.styles[0].name : '')), c('', dl('dummy b', b.brain, f.style.name))], pad ? 'options or circle pauses' : 'p or esc pauses');
    return;
  }
  const shape = punchShape(), free = f.phase === 'live' && !b.downed && !me.act;
  const pn = (h) => PUNCHES[`${me.role(h)}-${shape.kind}`].name.toLowerCase() + (shape.body ? ' · body' : '');
  const hi = me.guard === 'high' || me.guard === 'shell', lo = me.guard === 'low' || me.guard === 'shell';
  const label = b.downed ? (b.downed.who === me ? 'you are down' : 'neutral corner') : f.phase === 'intro' ? 'get ready' : f.phase !== 'live' ? 'bell' : me.counterT > 0 ? 'counter ready' : 'boxing';
  const chips = pad
    ? [c('L2', pn('L'), free), c('R2', pn('R'), free), c('L1', 'high guard', hi), c('R1', 'low guard', lo), c('○', 'slip', free), c('L3', `stance: ${me.stance}`)]
    : [c('F', pn('L'), free), c('J', pn('R'), free), c('E', 'high guard', hi), c('U', 'low guard', lo), c('space', 'slip', free), c('Q', `stance: ${me.stance}`)];
  const note = f.practice && f.last ? `last landed: ${f.last}`
    : pad ? 'right stick picks the punch · left stick down for the body · left stick moves you · options pauses'
      : 'arrows pick the punch · hold S for the body · A D move you · P pauses';
  HUD.bar(label, chips, note);
}
function menuBar() {
  const pad = input.lastDevice === 'controller';
  const label = mode === 'paused' ? 'paused' : mode === 'corner' ? 'corner' : mode === 'results' ? 'result' : 'menu';
  HUD.bar(label, pad ? [{ k: '↕', t: 'pick' }, { k: '✕', t: 'choose', open: true }, { k: '○', t: 'back' }] : [{ k: '↕', t: 'pick' }, { k: 'enter', t: 'choose', open: true }, { k: 'esc', t: 'back' }]);
}

requestAnimationFrame(frame);
mainMenu();
