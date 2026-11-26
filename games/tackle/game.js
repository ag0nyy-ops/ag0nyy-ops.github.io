/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Tackle: arcade football. You play offense, the other team's drives are simulated in between.
   The ball is in one hand, picked at random every play, and only that hand's stick and trigger
   do anything. Hold the trigger to drop back, aim with the stick, let go to throw. With the ball
   in your hands: the stick runs, a quick flick sideways jukes, the trigger is a burst and stiff-arm. */

import { Input } from '../shared/input.js';
import { loadSettings, palette, reducedMotion } from '../shared/settings.js';
import { FW, MID, DIFFS, PLAYS, newPlay, step, simDrive, simOT } from './sim.js';

const SAVE = 'jay.tackle.v1';
const LENGTHS = { standard: { name: 'Standard', secs: 300, blurb: '5 minute quarters' }, quick: { name: 'Quick', secs: 180, blurb: '3 minute quarters' } };

const input = new Input({
  A: ['Enter', 'Space'], B: ['Escape', 'Backspace'], START: ['KeyP'],
  L_UP: ['KeyW'], L_DOWN: ['KeyS'], L_LEFT: ['KeyA'], L_RIGHT: ['KeyD'], L_TRIG: ['ShiftLeft'],
  R_UP: ['ArrowUp', 'KeyI'], R_DOWN: ['ArrowDown', 'KeyK'], R_LEFT: ['ArrowLeft', 'KeyJ'], R_RIGHT: ['ArrowRight', 'KeyL'], R_TRIG: ['ShiftRight', 'Space']
});

/* ---------------- save data (this browser only) ---------------- */
function load() {
  let d = {}; try { d = JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) {}
  const rec = {};
  for (const id of Object.keys(DIFFS)) rec[id] = { w: 0, l: 0, t: 0, ...((d.rec || {})[id] || {}) };
  return { rec, len: LENGTHS[d.len] ? d.len : 'standard' };
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
function beep(freq, len = 0.08, type = 'square', vol = 0.25, delay = 0) {
  const a = audio(); const v = loadSettings().volume * vol; if (!a || v <= 0) return;
  const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + delay;
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(v, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + len);
}
function thump() {
  const a = audio(); const v = loadSettings().volume * 0.5; if (!a || v <= 0) return;
  const n = a.sampleRate * 0.12, buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
  const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 600; s.buffer = buf; g.gain.value = v;
  s.connect(f).connect(g).connect(a.destination); s.start();
}
const whistle = () => beep(1900, 0.28, 'sine', 0.1);
const fanfare = () => { beep(523, 0.12, 'triangle', 0.2); beep(659, 0.12, 'triangle', 0.2, 0.12); beep(784, 0.22, 'triangle', 0.2, 0.24); };

/* ---------------- the two hands ---------------- */
const HAND = {
  L: { x: 'lx', y: 'ly', t: 'lt', k: ['L_LEFT', 'L_RIGHT', 'L_UP', 'L_DOWN', 'L_TRIG'], pad: 'Left stick + L2', key: 'WASD + left Shift', trig: 'L2', keyTrig: 'left Shift', name: 'Left hand' },
  R: { x: 'rx', y: 'ry', t: 'rt', k: ['R_LEFT', 'R_RIGHT', 'R_UP', 'R_DOWN', 'R_TRIG'], pad: 'Right stick + R2', key: 'Arrows + right Shift', trig: 'R2', keyTrig: 'right Shift', name: 'Right hand' }
};
const handState = { L: { prevT: 0, prevY: 0, center: 0, up: -9, down: -9 }, R: { prevT: 0, prevY: 0, center: 0, up: -9, down: -9 } };
const hands = { L: null, R: null };
function readHands(now) {
  const s = input.state;
  for (const h of ['L', 'R']) {
    const H = HAND[h], st = handState[h], [kl, kr, ku, kd, kt] = H.k;
    let sx = s[H.x], sy = s[H.y];
    const padY = sy;
    const kx = (input.down(kr) ? 1 : 0) - (input.down(kl) ? 1 : 0), ky = (input.down(kd) ? 1 : 0) - (input.down(ku) ? 1 : 0);
    if (kx || ky) { const m = Math.hypot(kx, ky); sx = kx / m; sy = ky / m; }
    const trig = input.down(kt) ? 1 : s[H.t];
    let jukeDir = 0;
    // controller: a quick flick across, from centre to the edge in about a tenth of a second
    if (Math.abs(padY) < 0.35) st.center = now;
    if (Math.abs(padY) > 0.85 && Math.abs(st.prevY) <= 0.85 && now - st.center < 0.12) jukeDir = Math.sign(padY);
    st.prevY = padY;
    // keyboard: double tap up or down
    if (input.pressed(ku)) { if (now - st.up < 0.28) jukeDir = -1; st.up = now; }
    if (input.pressed(kd)) { if (now - st.down < 0.28) jukeDir = 1; st.down = now; }
    const edge = trig > 0.5 && st.prevT <= 0.5;
    st.prevT = trig;
    hands[h] = { sx, sy, trig, edge, jukeDir };
  }
}
const live = () => hands[g.hand];
const dead = () => hands[g.hand === 'L' ? 'R' : 'L'];
const handText = (h) => (input.lastDevice === 'controller' ? HAND[h].pad : HAND[h].key);
const trigText = (h) => (input.lastDevice === 'controller' ? HAND[h].trig : HAND[h].keyTrig);
function nav() {
  const n = input.nav();
  let { x, y } = n;
  if (input.pressed('L_UP') || input.pressed('R_UP')) y = -1;
  if (input.pressed('L_DOWN') || input.pressed('R_DOWN')) y = 1;
  if (input.pressed('L_LEFT') || input.pressed('R_LEFT')) x = -1;
  if (input.pressed('L_RIGHT') || input.pressed('R_RIGHT')) x = 1;
  return { x, y };
}

/* ---------------- screens (DOM overlay) ---------------- */
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

let mode = 'menu';   // menu | call | pre | live | dead | kick | card | paused | final
let g = null;
let pausedFrom = null;

function mainMenu() {
  mode = 'menu'; g = null;
  const rows = Object.values(DIFFS).map((d) => {
    const r = data.rec[d.id], played = r.w + r.l + r.t;
    return `<button class="btn" data-go="play" data-arg="${d.id}">${d.name} <small>vs ${d.team}${played ? ` · ${r.w}-${r.l}${r.t ? '-' + r.t : ''}` : ''}</small></button>`;
  }).join('');
  const L = LENGTHS[data.len];
  show(`<p class="label">Game file / Football / 7 on 7</p><h1 class="title">Tackle</h1>
    <div class="menu">${rows}
      <button class="btn" data-go="length">Game length <small>${L.name} · ${L.blurb}</small></button>
      <button class="btn" data-go="controls">Controls</button></div>
    <p class="hint">The ball is in one hand, picked at random every play. That hand's stick and trigger run the play, and the other side does nothing. Every player is the same on every team. You get better, they don't.</p>`);
}
function controls() {
  mode = mode === 'paused' ? 'paused' : 'menu';
  show(`<p class="label">Controls</p><h1 class="title">How to play</h1>
    <p class="hint">Before the snap the screen tells you which hand has the ball. Use that side only.</p>
    <table class="keys"><thead><tr><th></th><th>Ball in left hand</th><th>Ball in right hand</th></tr></thead><tbody>
    <tr><td>Controller</td><td>Left stick + L2</td><td>Right stick + R2</td></tr>
    <tr><td>Keyboard</td><td>WASD + left Shift</td><td>Arrows (or IJKL) + right Shift (or Space)</td></tr></tbody></table>
    <table class="keys"><thead><tr><th></th><th>What to do</th></tr></thead><tbody>
    <tr><td>Pick a play</td><td>Left and right on any stick, d-pad or keys, then Cross / A or Enter</td></tr>
    <tr><td>Snap</td><td>Pull the trigger</td></tr>
    <tr><td>Pass</td><td>Hold the trigger to drop back. The stick moves the target. Let go to throw.</td></tr>
    <tr><td>Zip</td><td>Hold longer and pull deeper for a faster ball. Slow balls float, fast balls are hard to catch up close.</td></tr>
    <tr><td>Run</td><td>The stick runs</td></tr>
    <tr><td>Juke</td><td>Flick the stick up or down fast, or double tap up or down on the keys</td></tr>
    <tr><td>Burst / stiff-arm</td><td>Hold the trigger. Uses the meter, which refills when you let go.</td></tr>
    <tr><td>Field goal</td><td>Pull the trigger when the needle is inside the box</td></tr>
    <tr><td>Pause</td><td>Options / Start, P or Esc</td></tr></tbody></table>
    <ul class="blurbs">
      <li><b>Juke</b> right as a tackler reaches you and he misses. Too early and he just tackles you.</li>
      <li><b>Stiff-arm</b> needs meter. With an empty meter, contact is a tackle.</li>
      <li><b>All-Pro</b> can switch the hand after a catch, so watch the carrier.</li>
    </ul>
    <p class="hint">Stick drifting? Raise the deadzone in the games settings on the <a href="../">games page</a>.</p>
    <div class="menu"><button class="btn" data-go="${mode === 'paused' ? 'pause' : 'menu'}">Back</button></div>`);
}
function pause() {
  if (mode !== 'paused') pausedFrom = mode;
  mode = 'paused';
  show(`<p class="label">Paused · ${clockText()}</p><h1 class="title">${g.you} <small>to</small> ${g.them}</h1>
    <div class="menu"><button class="btn btn--solid" data-go="resume">Resume</button><button class="btn" data-go="controls">Controls</button>
    <button class="btn" data-go="restart">Restart game</button><button class="btn" data-go="menu">Quit to menu</button></div>`);
}
function go(what, arg) {
  audio();
  if (what === 'menu') mainMenu();
  else if (what === 'controls') controls();
  else if (what === 'length') { data.len = data.len === 'standard' ? 'quick' : 'standard'; persist(); mainMenu(); menuItems[3] && menuItems[3].focus(); }
  else if (what === 'play') startGame(arg);
  else if (what === 'restart') startGame(g.diff.id);
  else if (what === 'pause') pause();
  else if (what === 'resume') { mode = pausedFrom || 'call'; hide(); }
  else if (what === 'next') { hide(); toCall(); }
}

/* ---------------- the game ---------------- */
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ord = (n) => ['', '1st', '2nd', '3rd', '4th'][n];
function spot(x) { const r = Math.round(x); return r === 50 ? 'midfield' : r < 50 ? `your ${r}` : `their ${100 - r}`; }
function spotShort(x) { const r = Math.round(x); return r === 50 ? 'MID' : r < 50 ? `OWN ${r}` : `${g.diff.abbr} ${100 - r}`; }
function mmss(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function clockText() { return g.q >= 5 ? `OT ${g.ot.round}` : `Q${g.q} ${mmss(g.clock)}`; }
function downText() {
  const goal = g.firstX >= 100;
  return `${ord(g.down)} & ${goal ? 'goal' : Math.max(1, Math.round(g.firstX - g.x))}`;
}

function startGame(id) {
  const diff = DIFFS[id];
  g = { diff, qLen: LENGTHS[data.len].secs, q: 1, clock: LENGTHS[data.len].secs, you: 0, them: 0,
    x: 25, y: MID, down: 1, firstX: 35, callIdx: 0, hand: 'R', play: null, preview: null, ot: null,
    stats: { pass: 0, comp: 0, yds: 0, td: 0 } };
  cam.x = null;
  hide(); toCall();
}

function callList() {
  const list = PLAYS.map((p) => ({ id: p.id, name: p.name, blurb: p.blurb, kind: p.kind }));
  if (g.down === 4) {
    const kd = Math.round(100 - g.x + 17);
    if (g.q < 5) list.push({ id: 'punt', name: 'Punt', blurb: 'Give it back deep', kind: 'kick' });
    if (kd <= 60) list.push({ id: 'fg', name: 'Field goal', blurb: `${kd} yard try`, kind: 'kick' });
  }
  return list;
}
function toCall() {
  mode = 'call';
  g.calls = callList();
  g.callIdx = clamp(g.callIdx, 0, g.calls.length - 1);
  previewPlay();
}
function previewPlay() {
  const c = g.calls[g.callIdx];
  g.preview = PLAYS.some((p) => p.id === c.id) ? newPlay(g.x, g.y, c.id, g.diff) : newPlay(g.x, g.y, 'slants', g.diff);
  g.play = null;
}
function confirmCall() {
  const c = g.calls[g.callIdx];
  if (c.id === 'punt') return punt();
  if (c.id === 'fg') return startKick();
  g.hand = Math.random() < 0.5 ? 'L' : 'R';
  g.play = newPlay(g.x, g.y, c.id, g.diff);
  g.preT = 0; g.wrong = 0; g.note = '';
  mode = 'pre';
}

function update(dt) {
  input.poll();
  const now = performance.now() / 1000;
  readHands(now);
  if (mode === 'menu' || mode === 'paused' || mode === 'card' || mode === 'final') return menuInput();
  if (!g) return;
  if (input.pressed('START') || input.pressed('B')) return pause();
  if (g.wrong > 0) g.wrong -= dt;

  if (mode === 'call') {
    const n = nav();
    const step1 = n.x || n.y;
    if (step1) { g.callIdx = (g.callIdx + step1 + g.calls.length) % g.calls.length; previewPlay(); beep(420, 0.02, 'square', 0.06); }
    if (input.pressed('A')) { confirmCall(); beep(300, 0.03, 'square', 0.08); }
    return;
  }
  if (mode === 'pre') {
    g.preT += dt;
    if (g.preT > 0.25 && dead().edge) g.wrong = 1.4;
    if (g.preT > 0.25 && live().edge) { mode = 'live'; thump(); }
    return;
  }
  if (mode === 'live') {
    const p = g.play, c = live();
    const res = step(p, dt, c);
    for (const e of p.events) {
      if (e.type === 'throw') { beep(520 + 300 * e.zip, 0.05, 'triangle', 0.14); g.stats.pass++; }
      if (e.type === 'catch') {
        beep(330, 0.07, 'triangle', 0.2); g.stats.comp++;
        if (g.diff.swap && Math.random() < 0.5) { g.hand = g.hand === 'L' ? 'R' : 'L'; g.note = `Switched to the ${g.hand === 'L' ? 'left' : 'right'} hand`; g.noteT = 1.6; }
      }
      if (e.type === 'ball') beep(250, 0.04, 'triangle', 0.1);
      if (e.type === 'juke') beep(760, 0.03, 'square', 0.07);
      if (e.type === 'missed') beep(e.how === 'stiff' ? 200 : 880, 0.06, e.how === 'stiff' ? 'sawtooth' : 'triangle', 0.12);
    }
    if (g.noteT > 0) g.noteT -= dt;
    if (res) playOver(res);
    return;
  }
  if (mode === 'kick') {
    const k = g.kick; k.t += dt;
    if (!k.done) {
      if (dead().edge) g.wrong = 1.4;
      if (live().edge && k.t > 0.3) {
        k.done = true; k.at = Math.sin(k.t * k.w); k.good = Math.abs(k.at) < k.win;
        k.doneT = 0; thump();
      }
    } else {
      k.doneT += dt;
      if (k.doneT > 1.3) kickOver();
    }
    return;
  }
  if (mode === 'dead') {
    g.deadT += dt;
    if (g.deadT > 1.6 || (g.deadT > 0.4 && input.pressed('A'))) { const n = g.next; g.next = null; n(); }
  }
}

/* what happens after a play */
function playOver(res) {
  const t = res.clock === 'run' ? rand(24, 36) : rand(5, 9);
  const before = g.x;
  const parts = res.text.split('. ');
  let banner = parts.shift(), sub = parts.length ? parts.join('. ') + ' ' : '', next = null;
  if (res.type === 'td') { thump(); fanfare(); }
  else if (res.type === 'tackle') thump();
  whistle();
  const gain = Math.round((res.type === 'inc' || res.type === 'int' ? before : res.x) - before);
  if (res.type !== 'inc' && res.type !== 'int' && res.type !== 'sack') g.stats.yds += Math.max(0, res.x - before);
  if (res.type === 'td') {
    g.you += 7; g.stats.td++; banner = 'Touchdown'; sub = 'Extra point is good.';
    next = () => change(['You scored a touchdown.'], 75, 'Touchdown');
  } else if (res.type === 'int') {
    banner = 'Intercepted';
    next = () => change([`Intercepted at ${spot(res.x)}.`], res.x >= 100 ? 80 : clamp(res.x, 1, 99), 'Intercepted');
  } else if (res.type === 'safety') {
    g.them += 2; banner = 'Safety'; sub = '2 points to them.';
    next = () => change(['Safety. 2 points to them, and they get the ball.'], 65, 'Safety');
  } else {
    const nx = res.type === 'inc' ? before : res.x;
    sub += res.type === 'inc' ? '' : gain > 0 ? `Gain of ${gain}.` : gain < 0 ? `Loss of ${-gain}.` : 'No gain.';
    g.x = clamp(nx, 1, 99); g.y = res.y;
    if (g.x >= g.firstX) { g.down = 1; g.firstX = Math.min(100, g.x + 10); sub += ' First down.'; }
    else if (g.down >= 4) { banner = 'Turnover on downs'; next = () => change([`Turned over on downs at ${spot(g.x)}.`], g.x, 'Turnover on downs'); }
    else g.down++;
    if (!next) next = toCall;
  }
  const clock = playClock(t);
  if (clock === 'half') next = () => { g.q = 3; g.clock = g.qLen; change(lines0(res, 'End of the half.'), 75, 'Halftime'); };
  if (clock === 'game') next = () => finish(lines0(res, 'That is the game.'));
  if (clock === 'quarter') sub += ` End of Q${g.q - 1}.`;
  g.banner = banner; g.sub = sub.trim(); g.deadT = 0; g.next = next; mode = 'dead';
}
function lines0(res, last) {
  const l = [];
  if (res.type === 'td') l.push('You scored a touchdown.');
  if (res.type === 'safety') l.push('Safety. 2 points to them.');
  l.push(last); return l;
}
function playClock(t) {
  if (g.q >= 5) return null;
  g.clock -= t;
  if (g.clock > 0) return null;
  if (g.q === 1 || g.q === 3) { g.q++; g.clock += g.qLen; return 'quarter'; }
  g.clock = 0; return g.q === 2 ? 'half' : 'game';
}
function oppClock(t) {
  if (g.q === 2 || g.q === 4) {
    if (t >= g.clock) { g.clock = 0; if (g.q === 2) { g.q = 3; g.clock = g.qLen; return 'half'; } return 'game'; }
    g.clock -= t; return null;
  }
  g.clock -= t; if (g.clock <= 0) { g.q++; g.clock += g.qLen; }
  return null;
}

function punt() {
  const land = g.x + 40 + rand(-6, 8);
  const dist = land >= 100 ? 80 : land;
  playClock(8);
  change([`You punted from ${spot(g.x)}.${land >= 100 ? ' Touchback.' : ''}`], dist, 'Punt');
}
function startKick() {
  g.hand = Math.random() < 0.5 ? 'L' : 'R'; g.wrong = 0;
  const kd = Math.round(100 - g.x + 17);
  g.kick = { kd, t: 0, w: 2.1 + (kd - 20) * 0.06, win: Math.max(0.07, 0.3 - (kd - 20) * 0.006), done: false };
  mode = 'kick';
}
function kickOver() {
  const k = g.kick;
  const clock = playClock(5);
  if (k.good) g.you += 3;
  const line = k.good ? `Field goal from ${k.kd} yards is good.` : `Field goal from ${k.kd} yards missed.`;
  if (clock === 'half') { g.q = 3; g.clock = g.qLen; return change([line, 'End of the half.'], 75, 'Halftime'); }
  if (clock === 'game') return finish([line, 'That is the game.']);
  change([line], k.good ? 75 : Math.min(80, g.x - 7), k.good ? 'Field goal' : 'No good');
}

/* the other team has the ball: simulate until it comes back to you */
function change(lines, oppDist, title) {
  if (g.q >= 5) return otTheirTurn(lines, title);
  for (let guard = 0; guard < 4; guard++) {
    const d = simDrive(clamp(oppDist, 1, 99), g.diff);
    const res = oppClock(d.time);
    let kind = d.kind, pts = d.pts;
    if (res && !((kind === 'td' || kind === 'fg') && Math.random() < 0.5)) { kind = 'clock'; pts = 0; }
    g.them += pts;
    lines.push(oppLine(d, kind));
    if (res === 'game') return finish(lines);
    if (res === 'half') { lines.push('Halftime. They get the ball to start the second half.'); oppDist = 75; continue; }
    g.x = nextX(d, kind); g.y = MID; g.down = 1; g.firstX = Math.min(100, g.x + 10);
    return card(title, lines);
  }
  return card(title, lines);
}
function oppLine(d, kind) {
  const what = { td: 'Touchdown.', fg: 'Field goal.', fgmiss: 'Missed a field goal.', punt: 'Punted.', int: 'Your defense picked it off.', downs: 'Stopped on fourth down.', clock: 'They ran out the clock.' }[kind];
  return `${g.diff.team}: ${d.plays} plays, ${d.yds} yards, ${mmss(d.time)}. ${what}`;
}
function nextX(d, kind) {
  if (kind === 'td' || kind === 'fg' || kind === 'clock') return 25;
  if (kind === 'punt') { const x = d.endDist - 40 + rand(-5, 5); return x <= 0 ? 20 : clamp(Math.round(x), 5, 60); }
  if (kind === 'fgmiss') return clamp(Math.round(d.endDist + 7), 20, 80);
  return clamp(Math.round(d.endDist), 5, 95);
}
function card(title, lines) {
  mode = 'card';
  show(`<p class="label">${clockText()} · ${g.diff.name}</p><h1 class="title">${title}</h1>
    ${scoreTable()}
    <ul class="blurbs">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    <p class="hint">Your ball, ${downText()} at ${spot(g.x)}.</p>
    <div class="menu"><button class="btn btn--solid" data-go="next">Take the ball</button></div>`);
}
function scoreTable() {
  return `<table class="board"><tbody><tr class="me"><td>You</td><td>${g.you}</td></tr><tr><td>${g.diff.team}</td><td>${g.them}</td></tr></tbody></table>`;
}

/* overtime: you from their 25, then them, until someone is ahead (three rounds at most) */
function finish(lines) {
  if (g.you === g.them && g.q < 5) {
    g.q = 5; g.ot = { round: 1 };
    lines.push('Tied. Overtime: you start at their 25, then they get the same chance.');
    g.x = 75; g.y = MID; g.down = 1; g.firstX = 85;
    return card('Overtime', lines);
  }
  return final(lines);
}
function otTheirTurn(lines, title) {
  const pts = simOT(g.diff);
  g.them += pts;
  lines.push(`${g.diff.team} from your 25: ${pts === 7 ? 'touchdown' : pts === 3 ? 'field goal' : 'no points'}.`);
  if (g.you !== g.them || g.ot.round >= 3) return final(lines);
  g.ot.round++;
  g.x = 75; g.y = MID; g.down = 1; g.firstX = 85;
  lines.push(`Still tied. Round ${g.ot.round}.`);
  return card(title || 'Overtime', lines);
}
function final(lines) {
  mode = 'final';
  const r = data.rec[g.diff.id];
  const out = g.you > g.them ? 'w' : g.you < g.them ? 'l' : 't';
  r[out]++; persist();
  const word = { w: 'You win', l: 'You lose', t: 'Tie game' }[out];
  const s = g.stats;
  show(`<p class="label">Final · ${g.diff.name} · ${g.diff.team}</p><h1 class="title">${word}</h1>
    ${scoreTable()}
    <ul class="blurbs">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    <p class="hint">${s.comp} of ${s.pass} passing · ${Math.round(s.yds)} yards · ${s.td} touchdown${s.td === 1 ? '' : 's'} · record ${r.w}-${r.l}${r.t ? '-' + r.t : ''} on ${g.diff.name}</p>
    <div class="menu"><button class="btn btn--solid" data-go="restart">Play again</button><button class="btn" data-go="menu">Menu</button></div>`);
}

function menuInput() {
  if (!menuItems.length) return;
  const n = nav();
  if (n.y || n.x) { menuIndex = (menuIndex + (n.y || n.x) + menuItems.length) % menuItems.length; menuItems[menuIndex].focus(); }
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

const FG = '#ececec', BG = '#060606', MUTED = 'rgba(236,236,236,.6)', DIM = 'rgba(236,236,236,.32)', LINE = 'rgba(236,236,236,.14)';
const mono = (px, w = 400) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`;
const TOP = 58, BOTTOM = 124;
const cam = { x: null, y: 0 };
let ppy = 10, oy = 0, view = 40, viewY = FW, fits = true;
const sx = (x) => (x - cam.x) * ppy, sy = (y) => oy + (y - cam.y) * ppy;

/* about 80 yards across on a laptop, never less than about 34 yards top to bottom */
function layout() {
  const fh = H - TOP - BOTTOM;
  ppy = Math.max(4, fh / FW, Math.min(W / 44, fh / 34));
  view = W / ppy; viewY = fh / ppy;
  fits = FW * ppy <= fh + 1;
  oy = fits ? TOP + (fh - FW * ppy) / 2 : TOP;
}
function focusY() {
  const p = g.play || g.preview;
  if (!p) return g.y;
  if (p.carrier) return p.carrier.y;
  if (p.ball.air) { const a = p.ball.air, u = Math.min(1, a.t / a.T); return a.from.y + (a.to.y - a.from.y) * u; }
  if (mode === 'live' && p.play.kind === 'pass') return (p.off.QB.y + p.aim.y) / 2;
  return g.y;
}
function focusX() {
  const p = g.play || g.preview;
  if (!p) return g.x;
  if (p.carrier) return p.carrier.x + 6;
  if (p.ball.air) { const a = p.ball.air, u = Math.min(1, a.t / a.T); return a.from.x + (a.to.x - a.from.x) * u + 4; }
  if (mode === 'live' && p.play.kind === 'pass') return (p.off.QB.x + p.aim.x) / 2 + 2;
  return g.x + 8;
}
function updateCam(dt) {
  const target = view > 124 ? 50 - view / 2 : clamp(focusX() - view * 0.42, -12, 112 - view);
  const ty = fits ? 0 : clamp(focusY() - viewY / 2, -1.5, FW + 1.5 - viewY);
  if (cam.x == null) { cam.x = target; cam.y = ty; }
  const k = Math.min(1, dt * (reducedMotion() ? 10 : 5));
  cam.x += (target - cam.x) * k; cam.y += (ty - cam.y) * k;
}

function draw(dt) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  layout();
  if (!g) return drawIdle();
  updateCam(dt);
  const pal = palette();
  drawField(pal);
  const p = g.play || g.preview;
  if (mode === 'call' || mode === 'pre') drawRoutes(p);
  if (mode === 'kick') {
    drawKick(pal); drawTop();
    if (g.wrong > 0) centerNote(`Wrong hand. The ball is in your ${g.hand === 'L' ? 'left' : 'right'} hand.`, H - BOTTOM + 30);
    return;
  }
  drawPlayers(p, pal);
  if (p.ball.air) drawBall(p);
  if (mode === 'live' && p.play.kind === 'pass' && !p.carrier && !p.ball.air) drawAim(p, pal);
  drawTop();
  if (mode === 'call') drawCalls(pal); else drawHands(pal, p);
  if (mode === 'dead') drawBanner();
  if (mode === 'pre') drawSnapPrompt(pal);
  if (mode === 'pre' && g.wrong > 0) centerNote(`Wrong hand. The ball is in your ${g.hand === 'L' ? 'left' : 'right'} hand.`, H * 0.5 + 44);
  if (mode === 'live' && g.noteT > 0) centerNote(g.note, TOP + 28);
}

function drawField(pal) {
  const x0 = sx(-10), x1 = sx(110), y0 = sy(0), y1 = sy(FW);
  ctx.fillStyle = 'rgba(236,236,236,.025)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // end zones: hatched
  ctx.save(); ctx.beginPath(); ctx.rect(sx(-10), y0, 10 * ppy, y1 - y0); ctx.rect(sx(100), y0, 10 * ppy, y1 - y0); ctx.clip();
  ctx.strokeStyle = 'rgba(236,236,236,.07)'; ctx.lineWidth = 1;
  for (let i = -20; i < 140; i += 2) { ctx.beginPath(); ctx.moveTo(sx(i), y1); ctx.lineTo(sx(i + FW), y0); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.fillStyle = DIM; ctx.font = mono(Math.max(12, ppy * 3.2), 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [x, txt, rot] of [[-5, 'HOME', -Math.PI / 2], [105, g.diff.abbr, Math.PI / 2]]) {
    ctx.save(); ctx.translate(sx(x), sy(MID)); ctx.rotate(rot); ctx.fillText(txt, 0, 0); ctx.restore();
  }
  ctx.restore();
  // yard lines
  for (let x = 0; x <= 100; x += 5) {
    const X = sx(x); if (X < -20 || X > W + 20) continue;
    ctx.strokeStyle = x === 0 || x === 100 ? FG : x % 10 ? LINE : 'rgba(236,236,236,.24)';
    ctx.lineWidth = x === 0 || x === 100 ? 2.5 : 1;
    ctx.beginPath(); ctx.moveTo(X, y0); ctx.lineTo(X, y1); ctx.stroke();
    if (x % 10 === 0 && x > 0 && x < 100) {
      ctx.fillStyle = DIM; ctx.font = mono(Math.max(10, ppy * 1.8), 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const n = String(x <= 50 ? x : 100 - x);
      ctx.fillText(n, X, sy(7)); ctx.fillText(n, X, sy(FW - 7));
    }
  }
  // hash marks
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  for (let x = 1; x < 100; x++) {
    const X = sx(x); if (X < 0 || X > W) continue;
    for (const hy of [0.6, 23.58, 29.75, FW - 0.6]) { ctx.beginPath(); ctx.moveTo(X, sy(hy) - ppy * 0.4); ctx.lineTo(X, sy(hy) + ppy * 0.4); ctx.stroke(); }
  }
  // sidelines
  ctx.strokeStyle = FG; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  // line of scrimmage (solid) and first down line (dashed, in the highlight colour)
  {
    ctx.strokeStyle = 'rgba(236,236,236,.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx(g.x), y0); ctx.lineTo(sx(g.x), y1); ctx.stroke();
    if (g.firstX < 100) {
      ctx.strokeStyle = pal.mark; ctx.lineWidth = 3; ctx.setLineDash([10, 7]);
      ctx.beginPath(); ctx.moveTo(sx(g.firstX), y0); ctx.lineTo(sx(g.firstX), y1); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}
function drawRoutes(p) {
  if (!p) return;
  ctx.strokeStyle = MUTED; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
  for (const k of ['X', 'Y', 'Z', 'RB']) {
    const r = p.off[k];
    if (p.play.kind === 'run' && k !== 'RB') continue;
    ctx.beginPath(); ctx.moveTo(sx(r.sx), sy(r.sy));
    let last = { x: r.sx, y: r.sy }, prev = last;
    for (const w of r.route) { ctx.lineTo(sx(w.x), sy(w.y)); prev = last; last = w; }
    let ex = last.x, ey = last.y;
    const lastWp = r.route[r.route.length - 1];
    if (!lastWp.stop) { const dx = last.x - prev.x, dy = last.y - prev.y, m = Math.hypot(dx, dy) || 1; ex = last.x + dx / m * 4; ey = last.y + dy / m * 4; ctx.lineTo(sx(ex), sy(ey)); }
    ctx.stroke();
    // arrow head or a bar for routes that stop
    ctx.setLineDash([]);
    const dx = ex - prev.x, dy = ey - prev.y, a = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(sx(ex), sy(ey)); ctx.rotate(a); ctx.beginPath();
    if (lastWp.stop) { ctx.moveTo(0, -5); ctx.lineTo(0, 5); } else { ctx.moveTo(-7, -4); ctx.lineTo(0, 0); ctx.lineTo(-7, 4); }
    ctx.stroke(); ctx.restore(); ctx.setLineDash([5, 5]);
  }
  ctx.setLineDash([]);
}
function drawPlayers(p, pal) {
  const r = Math.max(5, ppy * 0.85);
  for (const d of Object.values(p.def)) {
    const X = sx(d.x), Y = sy(d.y); if (X < -30 || X > W + 30) continue;
    ctx.save(); ctx.translate(X, Y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = BG; ctx.strokeStyle = pal.away; ctx.lineWidth = 2;
    if (d.stun > 0) ctx.setLineDash([3, 3]);
    ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
    ctx.restore();
    if (r >= 8) { ctx.fillStyle = pal.away; ctx.font = mono(Math.round(r * 0.9), 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.role[0], X, Y + 1); }
  }
  for (const o of Object.values(p.off)) {
    const X = sx(o.x), Y = sy(o.y); if (X < -30 || X > W + 30) continue;
    ctx.fillStyle = pal.home; ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
    if (r >= 8) { ctx.fillStyle = BG; ctx.font = mono(Math.round(r * 0.85), 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.role === 'OL' ? '' : o.role === 'RB' ? 'B' : o.role[0], X, Y + 1); }
  }
  // the ball and the hand it is in
  const holder = p.carrier || (!p.ball.air ? p.off.QB : null);
  if (holder && mode !== 'call') {
    const X = sx(holder.x), Y = sy(holder.y);
    ctx.strokeStyle = pal.mark; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, r + 4, 0, Math.PI * 2); ctx.stroke();
    // facing down the field, the left hand is on the top side of the screen
    const side = g.hand === 'L' ? -1 : 1, bx = X + r * 0.3, by = Y + side * (r + 9);
    footballAt(bx, by, Math.max(5, r * 0.6));
    ctx.fillStyle = pal.mark; ctx.font = mono(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(g.hand, bx + Math.max(5, r * 0.6) + 4, by);
  }
}
function footballAt(x, y, s, lift = 0) {
  ctx.save(); ctx.translate(x, y - lift);
  ctx.fillStyle = FG; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = BG; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-s * 0.4, 0); ctx.lineTo(s * 0.4, 0); ctx.stroke();
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.2, -s * 0.18); ctx.lineTo(i * s * 0.2, s * 0.18); ctx.stroke(); }
  ctx.restore();
}
function drawBall(p) {
  const a = p.ball.air, u = Math.min(1, a.t / a.T);
  const x = a.from.x + (a.to.x - a.from.x) * u, y = a.from.y + (a.to.y - a.from.y) * u;
  const lift = Math.sin(Math.PI * u) * Math.min(90, a.T * a.T * 9 * ppy * 0.25 + 10);
  ctx.fillStyle = 'rgba(236,236,236,.25)'; ctx.beginPath(); ctx.ellipse(sx(x), sy(y), 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  footballAt(sx(x), sy(y), Math.max(5, ppy * 0.55), lift);
  // the landing spot
  ctx.strokeStyle = MUTED; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.arc(sx(a.to.x), sy(a.to.y), 1.35 * ppy, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
}
function drawAim(p, pal) {
  const qb = p.off.QB, X = sx(p.aim.x), Y = sy(p.aim.y), R = 1.35 * ppy;
  ctx.strokeStyle = 'rgba(236,236,236,.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.moveTo(sx(qb.x), sy(qb.y));
  const mx = (sx(qb.x) + X) / 2, my = (sy(qb.y) + Y) / 2 - Math.hypot(X - sx(qb.x), Y - sy(qb.y)) * (0.35 - 0.25 * p.qb.zip);
  ctx.quadraticCurveTo(mx, my, X, Y); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = pal.mark; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X - R - 6, Y); ctx.lineTo(X - R + 4, Y); ctx.moveTo(X + R - 4, Y); ctx.lineTo(X + R + 6, Y);
  ctx.moveTo(X, Y - R - 6); ctx.lineTo(X, Y - R + 4); ctx.moveTo(X, Y + R - 4); ctx.lineTo(X, Y + R + 6); ctx.stroke();
}

function drawTop() {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, TOP - 6);
  ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(0, TOP - 6); ctx.lineTo(W, TOP - 6); ctx.stroke();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left'; ctx.font = mono(22, 600); ctx.fillStyle = FG;
  const sc = `YOU ${g.you}`, th = `${g.diff.abbr} ${g.them}`;
  ctx.fillText(sc, 18, 36);
  const w1 = ctx.measureText(sc).width;
  ctx.fillStyle = MUTED; ctx.fillText(th, 18 + w1 + 22, 36);
  ctx.textAlign = 'center'; ctx.font = mono(16, 600); ctx.fillStyle = FG;
  if (W > 560) ctx.fillText(clockText(), W / 2, 34);
  ctx.textAlign = 'right'; ctx.font = mono(15, 600);
  ctx.fillText(`${downText()} · ${spotShort(g.x)}`, W - 18, 34);
}
function drawCalls(pal) {
  ctx.fillStyle = BG; ctx.fillRect(0, H - BOTTOM - 18, W, BOTTOM + 18);
  const n = g.calls.length, gap = 8, y = H - BOTTOM + 8, h = BOTTOM - 18;
  const w = Math.min(176, (W - 36 - gap * (n - 1)) / n), x0 = (W - (w * n + gap * (n - 1))) / 2;
  g.cardRects = [];
  g.calls.forEach((c, i) => {
    const x = x0 + i * (w + gap), on = i === g.callIdx;
    g.cardRects.push([x, y, w, h]);
    ctx.fillStyle = on ? FG : BG; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = on ? FG : 'rgba(236,236,236,.32)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = on ? BG : MUTED; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = mono(10); ctx.fillText((c.kind === 'run' ? '■ RUN' : c.kind === 'kick' ? '■ KICK' : '■ PASS'), x + 10, y + 18);
    ctx.fillStyle = on ? BG : FG; ctx.font = mono(w < 120 ? 13 : 16, 600); ctx.fillText(c.name, x + 10, y + 44);
    if (w >= 110) { ctx.fillStyle = on ? BG : MUTED; ctx.font = mono(11); ctx.fillText(c.blurb, x + 10, y + 66); }
  });
  ctx.textAlign = 'center'; ctx.fillStyle = MUTED; ctx.font = mono(11);
  ctx.fillText(input.lastDevice === 'controller' ? 'Pick a play with the stick or d-pad · Cross / A to call it' : 'Pick a play with the arrows or A / D · Enter to call it', W / 2, H - BOTTOM - 2);
}
function drawHands(pal, p) {
  ctx.fillStyle = BG; ctx.fillRect(0, H - BOTTOM, W, BOTTOM);
  const y = H - BOTTOM + 10, h = BOTTOM - 22, bw = Math.min(260, W * 0.3);
  for (const side of ['L', 'R']) {
    const on = side === g.hand, x = side === 'L' ? 18 : W - 18 - bw;
    ctx.fillStyle = on ? FG : BG; ctx.fillRect(x, y, bw, h);
    ctx.strokeStyle = on ? FG : LINE; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, h - 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = on ? BG : DIM; ctx.font = mono(10);
    ctx.fillText(on ? `■ ${HAND[side].name.toUpperCase()} · BALL` : `${HAND[side].name.toUpperCase()} · OFF`, x + 12, y + 18);
    ctx.font = mono(bw < 200 ? 13 : 16, 600); ctx.fillText(on ? handText(side) : '—', x + 12, y + 44);
    if (on && mode === 'live' && p) {
      const label = p.carrier ? 'BURST' : p.play.kind === 'pass' ? 'ZIP' : '';
      const v = p.carrier ? p.meter : p.qb.zip;
      if (label) {
        ctx.font = mono(10); ctx.fillText(label, x + 12, y + 68);
        const bx = x + 64, bww = bw - 80;
        ctx.strokeStyle = BG; ctx.strokeRect(bx, y + 60, bww, 10);
        ctx.fillStyle = BG; ctx.fillRect(bx, y + 60, bww * v, 10);
      }
    }
  }
  // the middle: what to do now
  if (W < 640) return;
  ctx.textAlign = 'center'; ctx.fillStyle = MUTED; ctx.font = mono(12);
  const t = trigText(g.hand);
  let tip = '';
  if (mode === 'pre') tip = `Pull ${t} to snap`;
  else if (mode === 'live' && p.carrier) tip = 'Stick runs · flick sideways to juke · hold the trigger to burst';
  else if (mode === 'live' && p.play.kind === 'pass') tip = `Hold ${t} to drop back · aim with the stick · let go to throw`;
  else if (mode === 'live') tip = 'Handoff';
  const lines = wrap(tip, W - bw * 2 - 80);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 30 + i * 18));
}
function wrap(text, maxW) {
  const words = text.split(' '), out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out;
}
function drawSnapPrompt(pal) {
  const y = TOP + (H - TOP - BOTTOM) * 0.2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BG; const bw = Math.min(W - 40, 520); ctx.fillRect(W / 2 - bw / 2, y - 40, bw, 84);
  ctx.strokeStyle = pal.mark; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - bw / 2, y - 40, bw, 84);
  ctx.fillStyle = FG; ctx.font = mono(Math.min(30, W / 18), 600);
  ctx.fillText(`${g.hand === 'L' ? 'LEFT' : 'RIGHT'} HAND`, W / 2, y);
  ctx.fillStyle = MUTED; ctx.font = mono(14);
  ctx.fillText(`${handText(g.hand)} · pull ${trigText(g.hand)} to snap`, W / 2, y + 28);
}
function centerNote(text, y) {
  ctx.font = mono(14, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 28;
  ctx.fillStyle = BG; ctx.fillRect(W / 2 - w / 2, y - 16, w, 32);
  ctx.strokeStyle = FG; ctx.lineWidth = 1; ctx.strokeRect(W / 2 - w / 2, y - 16, w, 32);
  ctx.fillStyle = FG; ctx.fillText(text, W / 2, y + 1);
}
function drawBanner() {
  const y = TOP + (H - TOP - BOTTOM) * 0.42;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const bw = Math.min(W - 40, 620);
  ctx.fillStyle = BG; ctx.fillRect(W / 2 - bw / 2, y - 56, bw, g.sub ? 104 : 80);
  ctx.strokeStyle = FG; ctx.lineWidth = 1; ctx.strokeRect(W / 2 - bw / 2, y - 56, bw, g.sub ? 104 : 80);
  ctx.fillStyle = FG; ctx.font = mono(Math.min(44, W / 14), 600); ctx.fillText(g.banner.replace(/\.$/, ''), W / 2, y);
  if (g.sub) { ctx.fillStyle = MUTED; ctx.font = mono(15); ctx.fillText(g.sub, W / 2, y + 32); }
}
function drawKick(pal) {
  const k = g.kick, cx = W / 2, cy = TOP + (H - TOP - BOTTOM) * 0.62, R = Math.min(W * 0.36, (H - TOP - BOTTOM) * 0.5);
  ctx.fillStyle = 'rgba(6,6,6,.82)'; ctx.fillRect(0, TOP, W, H - TOP);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = FG; ctx.font = mono(Math.min(30, W / 18), 600);
  ctx.fillText(`${k.kd} yard field goal`, cx, cy - R - 34);
  ctx.fillStyle = MUTED; ctx.font = mono(14);
  ctx.fillText(`${g.hand === 'L' ? 'Left' : 'Right'} hand · pull ${trigText(g.hand)} when the needle is in the box`, cx, cy - R - 10);
  // the arc runs from -1 (left) to 1 (right); 0 is straight up
  const ang = (v) => -Math.PI / 2 + v * 1.1;
  ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, ang(-1), ang(1)); ctx.stroke();
  ctx.strokeStyle = pal.mark; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R, ang(-k.win), ang(k.win)); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = FG;
  for (const e of [-k.win, k.win]) { const a = ang(e); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14)); ctx.lineTo(cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14)); ctx.stroke(); }
  const v = k.done ? k.at : Math.sin(k.t * k.w), a = ang(v);
  ctx.strokeStyle = FG; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (R + 8), cy + Math.sin(a) * (R + 8)); ctx.stroke();
  ctx.fillStyle = FG; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
  if (k.done) { ctx.font = mono(Math.min(40, W / 14), 600); ctx.fillText(k.good ? "It's good" : 'No good', cx, cy + 50); }
}
function drawIdle() {
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  const top = H * 0.5, step1 = Math.max(30, W / 22);
  for (let i = 0; i * step1 < W + step1; i++) { ctx.beginPath(); ctx.moveTo(i * step1, top); ctx.lineTo(i * step1, H); ctx.stroke(); }
}

/* mouse or touch can pick plays too */
canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'call' || !g.cardRects) return;
  const i = g.cardRects.findIndex(([x, y, w, h]) => e.clientX >= x && e.clientX <= x + w && e.clientY >= y && e.clientY <= y + h);
  if (i < 0) return;
  audio();
  if (i === g.callIdx) confirmCall(); else { g.callIdx = i; previewPlay(); }
});

/* ---------------- loop ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  if (mode !== 'paused') update(dt); else { input.poll(); readHands(now / 1000); menuInput(); }
  draw(mode === 'paused' ? 0 : dt);
  requestAnimationFrame(frame);
}
addEventListener('gamepadconnected', () => { input.lastDevice = 'controller'; });
addEventListener('blur', () => { if (g && ['call', 'pre', 'live', 'kick', 'dead'].includes(mode)) pause(); });
mainMenu();
requestAnimationFrame(frame);

// test hook: lets an automated check drive the game without a controller
if (new URLSearchParams(location.search).has('debug')) window.__tackle = { get g() { return g; }, get mode() { return mode; }, go, confirmCall, hands };
