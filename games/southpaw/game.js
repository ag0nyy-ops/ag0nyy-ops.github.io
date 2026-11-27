/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Southpaw: side-on arcade boxing. The triggers are your hands: a light pull is a quick shot,
   a full pull lands heavy and leaves you open. The right stick picks the punch, the left stick
   moves your feet, the bumpers are your guard. Five computer fighters, no stats to grind.
   Every computer fighter is a seeded dummy, and CPU vs CPU puts two of them in the ring to watch. */

import { Input } from '../shared/input.js';
import { loadSettings, palette, reducedMotion } from '../shared/settings.js';
import { dummyLabel } from '../shared/seed.js';
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
  const w = d.watch || {};
  return { record: { ...(d.record || {}) }, watch: { a: w.a || 'random', b: w.b || 'random' } };
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
function show(html, focus = 0) {
  overlay.innerHTML = `<div class="panel">${html}</div>`; overlay.hidden = false; if (backLink) backLink.hidden = false;
  menuItems = [...overlay.querySelectorAll('button')];
  menuIndex = Math.min(focus, Math.max(0, menuItems.length - 1));
  if (menuItems[menuIndex]) menuItems[menuIndex].focus();
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
      <button class="btn" data-go="watch">CPU vs CPU <small>two seeded dummies, you watch</small></button>
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
/* CPU vs CPU setup: which opponent card each dummy boxes as (the card is the skill, the seed the style) */
const CARDS = ['random', ...STYLES.map((s) => s.id)];
const cardName = (id) => (id === 'random' ? 'Random' : STYLES.find((s) => s.id === id).name);
function watchMenu(focus = 0) {
  mode = 'menu'; fight = null;
  const w = data.watch;
  show(`<p class="label">Game file / Boxing / CPU vs CPU</p><h1 class="title">Dummy vs dummy</h1>
    <div class="menu">
      <button class="btn" data-go="watchgo">Start <small>${esc(cardName(w.a))} vs ${esc(cardName(w.b))}</small></button>
      <button class="btn" data-go="card" data-arg="a">Dummy A boxes as <small>${esc(cardName(w.a))}</small></button>
      <button class="btn" data-go="card" data-arg="b">Dummy B boxes as <small>${esc(cardName(w.b))}</small></button>
      <button class="btn" data-go="menu">Back</button>
    </div>
    <p class="hint">Both corners are computer fighters with their own seed, so no two bouts go the same way.
    The fight runs by itself and a new one starts after the result. Options, Circle, P or Esc pauses. Nothing here counts toward your record.</p>`, focus);
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
  canvas.setAttribute('aria-label', FIGHT_ARIA);
  fight = { id, style, bout, practice, round: 1, clock: ROUND_LEN, phase: 'intro', phaseT: 0, cards: [], msg: '', endT: 0,
    ghost: { me: 100, foe: 100 }, last: '' };
  resetPlayer();
  mode = 'fight'; hide();
}
/* CPU vs CPU: new seeds every bout, and a fresh card for a side set to Random */
function newWatch() {
  const card = (id) => (id === 'random' ? STYLES[Math.floor(Math.random() * STYLES.length)] : STYLES.find((s) => s.id === id));
  const a = card(data.watch.a), style = card(data.watch.b);
  const bout = new Bout(style, { watch: a });
  fight = { id: 'watch', watch: true, styles: [a, style], style, bout, practice: false, round: 1, clock: ROUND_LEN, phase: 'intro', phaseT: 0,
    cards: [], msg: '', endT: 0, ghost: { me: 100, foe: 100 }, last: '', nextT: 0 };
  canvas.setAttribute('aria-label', `CPU vs CPU. Dummy A, boxing as ${a.name}, is on the left, drawn solid. Dummy B, boxing as ${style.name}, is on the right, drawn in outline.`);
  resetPlayer();
  mode = 'fight'; hide();
}
const FIGHT_ARIA = canvas.getAttribute('aria-label');
function nextRound() {
  const f = fight, b = f.bout;
  f.round++; f.clock = ROUND_LEN; f.phase = 'intro'; f.phaseT = 0;
  for (const p of [b.me, b.foe]) { p.resetRound(); p.hp = Math.min(100, p.hp + 12); }
  if (f.style.switches) b.foe.stance = b.foe.stance === 'orthodox' ? 'southpaw' : 'orthodox';
  if (f.watch && f.styles[0].switches) b.me.stance = b.me.stance === 'orthodox' ? 'southpaw' : 'orthodox';
  for (const br of b.brains()) br.newRound();
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
  else if (what === 'watch') watchMenu();
  else if (what === 'watchgo') newWatch();
  else if (what === 'card') {
    const w = data.watch; w[arg] = CARDS[(CARDS.indexOf(w[arg]) + 1) % CARDS.length]; persist();
    watchMenu(arg === 'a' ? 1 : 2);
  }
  else if (what === 'again') fight.watch ? newWatch() : newFight(fight.id);
  else if (what === 'next') nextRound();
  else if (what === 'resume') { mode = 'fight'; hide(); resetPlayer(); }
}

/* "dummy a: brawler, seed 3F2A"; against you the computer fighter goes by its card's name */
function seedLine(side) {
  const f = fight, b = f.bout;
  if (side === 'me') return f.watch ? dummyLabel('dummy a', b.meBrain.d) : '';
  return dummyLabel(f.watch ? 'dummy b' : f.style.name.toLowerCase(), b.brain.d);
}
function pauseMenu() {
  mode = 'paused';
  const f = fight;
  if (f.watch) {
    return show(`<p class="label">Paused / CPU vs CPU / round ${f.round} of ${ROUNDS}</p><h1 class="title">Timeout</h1>
    <div class="menu">
      <button class="btn" data-go="resume">Resume</button>
      <button class="btn" data-go="again">New bout <small>new seeds</small></button>
      <button class="btn" data-go="menu">Quit to menu</button>
    </div>
    <ul class="blurbs"><li><b>Dummy A (${esc(f.styles[0].name)}):</b> ${esc(seedLine('me'))}</li><li><b>Dummy B (${esc(f.style.name)}):</b> ${esc(seedLine('foe'))}</li></ul>`);
  }
  show(`<p class="label">Paused / ${f.practice ? 'practice' : `round ${f.round} of ${ROUNDS}`}</p><h1 class="title">Timeout</h1>
    <div class="menu">
      <button class="btn" data-go="resume">Resume</button>
      <button class="btn" data-go="again">${f.practice ? 'Restart practice' : 'Restart fight'}</button>
      <button class="btn" data-go="controls">Controls</button>
      <button class="btn" data-go="${f.practice ? 'menu' : 'pick'}">${f.practice ? 'End practice' : 'Quit fight'}</button>
    </div>
    <p class="hint">Opponent ${esc(seedLine('foe'))}.</p>`);
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
  if (f.watch) return watchResult(winner, how);
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

/* CPU vs CPU: the result stays up for a few seconds, then the next bout starts with new seeds */
const WATCH_NEXT = 6;
function watchResult(winner, how) {
  const f = fight, b = f.bout;
  f.nextT = WATCH_NEXT;
  const mm = Math.floor((ROUND_LEN - f.clock) / 60), ss = Math.floor((ROUND_LEN - f.clock) % 60);
  const method = how === 'decision' ? `Decision, ${total(0)}–${total(1)}` : `${how}, round ${f.round} at ${mm}:${String(ss).padStart(2, '0')}`;
  const title = winner === 'me' ? 'Dummy A wins' : winner === 'foe' ? 'Dummy B wins' : 'Draw';
  const row = (name, a, c) => `<tr><td>${name}</td><td>${a}</td><td>${c}</td></tr>`;
  const pct = (s) => (s.thrown ? Math.round(100 * s.landed / s.thrown) + '%' : '–');
  const m = b.me.stats, o = b.foe.stats;
  show(`<p class="label">Result / CPU vs CPU</p><h1 class="title">${title}</h1>
    <p class="hint">${esc(method)}. Next bout in <span id="next-in">${WATCH_NEXT}</span> s.</p>
    <table class="board"><tbody><tr><td></td><td>Dummy A · ${esc(f.styles[0].name)}</td><td>Dummy B · ${esc(f.style.name)}</td></tr>
      ${row('Style, seed', esc(`${b.meBrain.d.style}, ${b.meBrain.d.tag}`), esc(`${b.brain.d.style}, ${b.brain.d.tag}`))}
      ${row('Landed / thrown', `${m.landed} / ${m.thrown}`, `${o.landed} / ${o.thrown}`)}
      ${row('Accuracy', pct(m), pct(o))}
      ${row('Counters', m.counters, o.counters)}
      ${row('Punches slipped', m.slips, o.slips)}
      ${row('Knockdowns scored', m.kds, o.kds)}</tbody></table>
    <div class="menu"><button class="btn" data-go="again">Next bout now</button><button class="btn" data-go="menu">Quit to menu</button></div>`);
}
function watchCountdown(dt) {
  const f = fight;
  f.nextT -= dt;
  const el = document.getElementById('next-in'); if (el) el.textContent = String(Math.max(0, Math.ceil(f.nextT)));
  if (f.nextT <= 0) newWatch();
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
  else {
    menuInput();
    if (mode === 'results' && fight && fight.watch) watchCountdown(dt);
  }
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
  if (input.pressed('START') || (f.watch && input.pressed('B'))) { pauseMenu(); return; }
  if (f.watch) kbQueue.length = 0;   // your buttons do nothing while you watch
  const it = f.watch ? { move: 0, guard: 'none', punch: null, slip: false, stance: false } : myIntent(now);
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
    if (f.round < ROUNDS) return f.watch ? nextRound() : corner();
    const a = total(0), c = total(1);
    return finish(a > c ? 'me' : c > a ? 'foe' : 'draw', 'decision');
  }
}

function onEvent(e) {
  const b = fight.bout;
  if (e.type === 'hit') {
    sfx.hit(e.p, e.body);
    if (e.who === b.foe) fight.last = describe(b.me.lastThrow);
  } else if (e.type === 'block') sfx.block();
  else if (e.type === 'miss') sfx.miss();
  else if (e.type === 'slipped') sfx.slip();
  else if (e.type === 'down') sfx.down();
  else if (e.type === 'count') sfx.count();
}
function describe(a) { return a ? `${PUNCHES[a.key].name}${a.body ? ' to the body' : ''}, ${Math.round(a.p * 100)}% power` : ''; }

/* ---------------- drawing ---------------- */
let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize); resize();

const FG = '#ececec', BG = '#060606', MUTED = 'rgba(236,236,236,.55)', FAINT = 'rgba(236,236,236,.16)';
const mono = (px, w = 400) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`;
let ppm = 100, floorY = 0, cx = 0;
const X = (x) => cx + x * ppm, Y = (y) => floorY - y * ppm;

function draw(dt) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ppm = Math.max(60, Math.min(W / 6.9, (H - 230) / 1.75));
  floorY = H - Math.max(110, H * 0.17); cx = W / 2;
  drawRing();
  if (!fight) return drawIdle();
  const f = fight, b = f.bout, pal = palette();
  const rm = reducedMotion();
  // draw the one who's punching on top, so the glove is always visible
  const order = b.foe.is('punch') && !b.me.is('punch') ? [b.me, b.foe] : [b.foe, b.me];
  for (const p of order) drawFighter(p, b.other(p), p === b.me ? pal.home : pal.away, p === b.me, f);
  drawFx(b, pal, rm);
  drawHud(f, b, pal, dt);
}

function drawRing() {
  ctx.strokeStyle = FAINT; ctx.lineWidth = 1;
  // apron and canvas
  ctx.beginPath(); ctx.moveTo(X(-RING - 0.4), Y(0)); ctx.lineTo(X(RING + 0.4), Y(0)); ctx.stroke();
  ctx.fillStyle = 'rgba(236,236,236,.035)'; ctx.fillRect(X(-RING - 0.4), Y(0), (2 * RING + 0.8) * ppm, Math.max(8, 0.12 * ppm));
  // ropes and posts
  for (const h of [0.5, 0.85, 1.2]) { ctx.beginPath(); ctx.moveTo(X(-RING - 0.2), Y(h)); ctx.lineTo(X(RING + 0.2), Y(h)); ctx.stroke(); }
  ctx.fillStyle = 'rgba(236,236,236,.22)';
  for (const x of [-RING - 0.2, RING + 0.2]) ctx.fillRect(X(x) - 3, Y(1.35), 6, 1.35 * ppm);
}
function drawIdle() {
  ctx.font = mono(11); ctx.fillStyle = MUTED; ctx.textAlign = 'center';
  ctx.fillText('SOUTHPAW / BOUT FILE', W / 2, Y(-0.35));
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

function drawFighter(p, o, color, isMe, f) {
  const w = Math.max(3, 0.085 * ppm);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (p.down()) return drawDown(p, color, isMe, w);
  const P = pose(p, o);
  const hollow = !isMe;   // you are solid, they are drawn in outline, so it never rests on colour
  const limb = (A, B, width, alpha = 1) => {
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(X(A.x), Y(A.y)); ctx.lineTo(X(B.x), Y(B.y)); ctx.stroke();
    if (hollow && width > 4) { ctx.strokeStyle = BG; ctx.lineWidth = width - 4; ctx.stroke(); }
    ctx.globalAlpha = 1;
  };
  const arm = (role, alpha) => {
    const { E, G } = elbow(P.S[role], P.gloves[role], P.up[role]);
    limb(P.S[role], E, w, alpha); limb(E, G, w * 0.9, alpha);
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(X(G.x), Y(G.y), 0.085 * ppm, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    return G;
  };
  // trails show the punch's shape: straight line, wide arc for a hook, rising arc for an uppercut
  for (const role of ['lead', 'rear']) {
    const t = P.trail[role]; if (!t || t.k <= 0) continue;
    ctx.globalAlpha = 0.28 * t.k; ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, 0.05 * ppm);
    ctx.beginPath(); ctx.moveTo(X(t.wind.x), Y(t.wind.y)); ctx.quadraticCurveTo(X(t.ctrl.x), Y(t.ctrl.y), X(t.end.x), Y(t.end.y)); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // far side first: rear arm and rear leg sit behind the body
  const knee = (F) => ({ x: lerp(P.hip.x, F.x, 0.5) + P.dir * 0.06, y: lerp(P.hip.y, 0, 0.5) + 0.02 });
  limb(P.hip, knee(P.foot.rear), w * 1.1, 0.55); limb(knee(P.foot.rear), P.foot.rear, w, 0.55);
  arm('rear', 0.6);
  limb(P.hip, knee(P.foot.lead), w * 1.15); limb(knee(P.foot.lead), P.foot.lead, w * 1.05);
  limb(P.hip, P.sh, Math.max(8, 0.24 * ppm));
  // head
  ctx.fillStyle = hollow ? BG : color; ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(X(P.head.x), Y(P.head.y), 0.12 * ppm, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  arm('lead', 1);
  // windup ring: grows with the power that's coming, so heavy shots are readable before they land
  const wd = P.trail.wind;
  if (wd && wd.p > 0.45) {
    ctx.globalAlpha = 0.5; ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X(wd.at.x), Y(wd.at.y), (0.1 + 0.08 * wd.p) * ppm, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  // name tag
  ctx.font = mono(Math.max(10, Math.min(13, ppm * 0.1)), 600); ctx.textAlign = 'center'; ctx.fillStyle = isMe ? FG : color;
  const tag = f.watch ? (isMe ? 'DUMMY A' : 'DUMMY B') : isMe ? 'YOU' : f.style.name.toUpperCase();
  ctx.fillText(tag, X(p.x), Y(2.1));
  if (p.is('stun') && p.act.dur > 0.22) { ctx.font = mono(11); ctx.fillStyle = MUTED; ctx.fillText('ROCKED', X(p.x), Y(2.23)); }
}
function drawDown(p, color, isMe, w) {
  const d = -p.face, x = p.x;
  const pts = { head: { x: x + d * 0.72, y: 0.13 }, sh: { x: x + d * 0.5, y: 0.14 }, hip: { x: x, y: 0.12 }, foot: { x: x - d * 0.75, y: 0.05 } };
  ctx.strokeStyle = color; ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(8, 0.22 * ppm); ctx.beginPath(); ctx.moveTo(X(pts.hip.x), Y(pts.hip.y)); ctx.lineTo(X(pts.sh.x), Y(pts.sh.y)); ctx.stroke();
  ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(X(pts.hip.x), Y(pts.hip.y)); ctx.lineTo(X(pts.foot.x), Y(pts.foot.y)); ctx.stroke();
  ctx.fillStyle = isMe ? color : BG; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(X(pts.head.x), Y(pts.head.y), 0.12 * ppm, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(pts.sh.x - d * 0.1), Y(0.3), 0.085 * ppm, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawFx(b, pal, rm) {
  for (const f of b.fx) {
    const k = f.t / f.life;
    const col = f.tone === 'mark' ? pal.mark : f.tone === 'quiet' ? MUTED : FG;
    ctx.globalAlpha = 1 - k;
    if (f.tone !== 'quiet' || f.text === 'BLOCKED') {
      const r = rm ? 0.16 * ppm : (0.06 + 0.22 * ease(k)) * ppm;
      ctx.strokeStyle = col; ctx.lineWidth = f.tone === 'quiet' ? 1.5 : 2.5;
      ctx.beginPath(); ctx.arc(X(f.x), Y(f.y), r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = col; ctx.font = mono(Math.max(11, Math.min(15, ppm * 0.11)), 600); ctx.textAlign = 'center';
    ctx.fillText(f.text, X(f.x), Y(f.y + 0.26) - (rm ? 0 : 18 * ease(k)));
    ctx.globalAlpha = 1;
  }
}

function bar(x, y, w, h, frac, fill, ghost, alignRight) {
  ctx.strokeStyle = 'rgba(236,236,236,.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  const fw = (v) => Math.max(0, Math.min(1, v)) * (w - 4);
  if (ghost != null && ghost > frac) { ctx.fillStyle = 'rgba(236,236,236,.25)'; ctx.fillRect(alignRight ? x + w - 2 - fw(ghost) : x + 2, y + 2, fw(ghost), h - 4); }
  ctx.fillStyle = fill; ctx.fillRect(alignRight ? x + w - 2 - fw(frac) : x + 2, y + 2, fw(frac), h - 4);
}

function drawHud(f, b, pal, dt) {
  const m = 22, bw = Math.min(380, W * 0.33), me = b.me, foe = b.foe;
  f.ghost.me = Math.max(me.hp, f.ghost.me - 22 * dt); f.ghost.foe = Math.max(foe.hp, f.ghost.foe - 22 * dt);
  if (me.hp > f.ghost.me) f.ghost.me = me.hp; if (foe.hp > f.ghost.foe) f.ghost.foe = foe.hp;
  ctx.textAlign = 'left'; ctx.font = mono(11, 600); ctx.fillStyle = FG;
  const nameA = f.watch ? `DUMMY A · ${f.styles[0].name.toUpperCase()}` : 'YOU', nameB = f.watch ? `DUMMY B · ${f.style.name.toUpperCase()}` : f.style.name.toUpperCase();
  ctx.fillText(`${nameA} · ${me.stance.toUpperCase()}`, m, 30);
  bar(m, 38, bw, 16, me.hp / 100, pal.home, f.ghost.me / 100, false);
  bar(m, 58, bw * 0.8, 7, me.stam / 100, 'rgba(236,236,236,.6)', null, false);
  ctx.font = mono(10); ctx.fillStyle = MUTED; ctx.fillText('HEALTH', m, 80); ctx.fillText('STAMINA', m + 64, 80);
  if (me.kd) ctx.fillText('DOWN ×' + me.kd, m + 136, 80);
  if (f.watch) ctx.fillText(seedLine('me').toUpperCase(), m, 96);

  ctx.textAlign = 'right'; ctx.font = mono(11, 600); ctx.fillStyle = pal.away;
  ctx.fillText(`${nameB} · ${foe.stance.toUpperCase()}`, W - m, 30);
  bar(W - m - bw, 38, bw, 16, foe.hp / 100, pal.away, f.ghost.foe / 100, true);
  bar(W - m - bw * 0.8, 58, bw * 0.8, 7, foe.stam / 100, 'rgba(236,236,236,.6)', null, true);
  ctx.font = mono(10); ctx.fillStyle = MUTED; ctx.fillText('HEALTH', W - m, 80); ctx.fillText('STAMINA', W - m - 70, 80);
  if (foe.kd) ctx.fillText('DOWN ×' + foe.kd, W - m - 150, 80);
  ctx.fillText(seedLine('foe').toUpperCase(), W - m, 96);

  // clock
  ctx.textAlign = 'center'; ctx.fillStyle = FG;
  if (f.practice) { ctx.font = mono(11); ctx.fillStyle = MUTED; ctx.fillText('PRACTICE', W / 2, 30); }
  else {
    ctx.font = mono(11); ctx.fillStyle = MUTED; ctx.fillText(`ROUND ${f.round} / ${ROUNDS}`, W / 2, 30);
    const c = Math.ceil(f.clock); ctx.font = mono(30, 600); ctx.fillStyle = FG;
    ctx.fillText(`${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`, W / 2, 62);
  }

  // big messages
  let msg = '', sub = '';
  if (f.phase === 'intro') { msg = f.practice ? 'PRACTICE' : f.phaseT < 1 ? `ROUND ${f.round}` : 'BOX'; }
  if (f.phase === 'bell') msg = 'BELL';
  if (b.downed) { msg = String(Math.max(1, b.downed.count)); sub = f.watch ? `DUMMY ${b.downed.who === me ? 'A' : 'B'} IS DOWN` : b.downed.who === me ? 'YOU ARE DOWN' : `${f.style.name.toUpperCase()} IS DOWN`; }
  if (f.phase === 'stopped') { msg = f.result.how; sub = f.watch ? `DUMMY ${f.result.winner === 'me' ? 'A' : 'B'} WINS` : f.result.winner === 'me' ? 'YOU WIN' : 'YOU LOSE'; }
  if (msg) {
    ctx.font = mono(Math.min(84, W / 9), 600); ctx.fillStyle = FG; ctx.fillText(msg, W / 2, H * 0.3);
    if (sub) { ctx.font = mono(13); ctx.fillStyle = MUTED; ctx.fillText(sub, W / 2, H * 0.3 + 30); }
  }
  if (f.watch) {   // nothing of yours to show: just how to get out
    ctx.textAlign = 'right'; ctx.font = mono(10); ctx.fillStyle = MUTED;
    ctx.fillText('CPU VS CPU · ' + (input.lastDevice === 'keyboard' ? 'P OR ESC PAUSE' : 'OPTIONS OR CIRCLE PAUSE'), W - m, H - 26);
    return;
  }
  if (me.counterT > 0) { ctx.font = mono(12, 600); ctx.fillStyle = pal.mark; ctx.textAlign = 'left'; ctx.fillText('COUNTER READY', m, 100); }

  // your hands: what each trigger throws right now, and how far it's pulled
  const kbd = input.lastDevice === 'keyboard';
  const shape = punchShape();
  const now = performance.now();
  const pull = (h, i) => kb[h] != null ? Math.min(1, (now - kb[h]) / 1000 / KB_FULL) : padTrigger(i);
  const names = (h) => { const role = me.role(h); const P = PUNCHES[`${role}-${shape.kind}`]; return (shape.kind === 'straight' ? P.name : role.toUpperCase() + ' ' + (shape.kind === 'hook' ? 'HOOK' : 'UPPER')).toUpperCase() + (shape.body ? ' · BODY' : ''); };
  const by = H - 26, bh = Math.min(70, H * 0.08);
  [['L', 6, kbd ? 'F' : 'L2'], ['R', 7, kbd ? 'J' : 'R2']].forEach(([h, i, key], n) => {
    const x = m + n * 150;
    ctx.strokeStyle = 'rgba(236,236,236,.35)'; ctx.strokeRect(x + 0.5, by - bh + 0.5, 12, bh);
    const v = pull(h, i); ctx.fillStyle = FG; ctx.fillRect(x + 2, by - 1 - (bh - 3) * v, 9, (bh - 3) * v);
    ctx.textAlign = 'left'; ctx.font = mono(12, 600); ctx.fillStyle = FG; ctx.fillText(key, x + 22, by - bh + 12);
    ctx.font = mono(10); ctx.fillStyle = MUTED; ctx.fillText(names(h), x + 22, by - bh + 28);
  });
  if (f.practice && f.last) { ctx.textAlign = 'left'; ctx.font = mono(11); ctx.fillStyle = MUTED; ctx.fillText('LAST LANDED: ' + f.last.toUpperCase(), m, by - bh - 14); }

  ctx.textAlign = 'right'; ctx.font = mono(10); ctx.fillStyle = MUTED;
  const hint = kbd ? 'F / J PUNCH · ARROWS PICK · S BODY · A D FEET · E HIGH · U LOW · SPACE SLIP · Q STANCE · P PAUSE'
    : 'L2 / R2 PUNCH · RIGHT STICK PICKS · L1 HIGH · R1 LOW · FLICK OR CIRCLE SLIP · L3 STANCE · OPTIONS PAUSE';
  if (W > 900) ctx.fillText(hint, W - m, by);
}

requestAnimationFrame(frame);
mainMenu();
