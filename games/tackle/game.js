/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Tackle: arcade football. You play offense, the other team's drives are simulated in between.
   The ball is in one hand, picked at random every play, and only that hand's stick and trigger
   do anything. Hold the trigger to drop back, aim with the stick, let go to throw. With the ball
   in your hands: the stick runs, a quick flick sideways jukes, the trigger is a burst and stiff-arm.
   The other team is a seeded dummy. CPU vs CPU plays a whole game between two of them (newMatch in sim.js). */

import { Input } from '../shared/input.js';
import { loadSettings, reducedMotion } from '../shared/settings.js';
import * as look from '../shared/look.js';
import { newSeed, dummyLabel } from '../shared/seed.js';
import { FW, MID, DIFFS, PLAYS, newPlay, step, simDrive, simOT, makeTeam, kickSpec, newMatch, matchTick, offTeam, defTeam } from './sim.js';

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
  return { rec, len: LENGTHS[d.len] ? d.len : 'standard', watchDiff: DIFFS[d.watchDiff] ? d.watchDiff : 'pro' };
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

let mode = 'menu';   // menu | call | pre | live | dead | kick | card | paused | final | watch
let g = null;
let watch = false;   // CPU vs CPU: g is then a match from newMatch(), and g.phase says what is on the field
const phase = () => (watch && g ? g.phase : mode);
let pausedFrom = null;

function mainMenu() {
  mode = 'menu'; g = null; watch = false;
  const rows = Object.values(DIFFS).map((d) => {
    const r = data.rec[d.id], played = r.w + r.l + r.t;
    return `<button class="btn" data-go="play" data-arg="${d.id}">${d.name} <small>vs ${d.team}${played ? ` · ${r.w}-${r.l}${r.t ? '-' + r.t : ''}` : ''}</small></button>`;
  }).join('');
  const L = LENGTHS[data.len], WD = DIFFS[data.watchDiff];
  show(`<p class="label">Game file / Football / 7 on 7</p><h1 class="title">Tackle</h1>
    <div class="menu">${rows}
      <button class="btn" data-go="watch">CPU vs CPU <small>Dummy A vs Dummy B · watch</small></button>
      <button class="btn" data-go="wskill">CPU vs CPU skill <small>${WD.name}</small></button>
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
    <tr><td>Pause</td><td>Options / Start, P or Esc</td></tr>
    <tr><td>CPU vs CPU</td><td>Pick it on the menu and watch two seeded dummies play a whole game. Pause to quit.</td></tr></tbody></table>
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
  if (watch) {
    const [a, b] = g.teams;
    return show(`<p class="label">Paused · CPU vs CPU · ${g.diff.name} · ${clockText()}</p><h1 class="title">${a.score} <small>to</small> ${b.score}</h1>
    <ul class="blurbs"><li>${dummyLabel('dummy a', a.d)}</li><li>${dummyLabel('dummy b', b.d)}</li></ul>
    <div class="menu"><button class="btn btn--solid" data-go="resume">Resume</button><button class="btn" data-go="restart">New match</button>
    <button class="btn" data-go="menu">Quit to menu</button></div>`);
  }
  show(`<p class="label">Paused · ${clockText()}</p><h1 class="title">${g.you} <small>to</small> ${g.them}</h1>
    <p class="hint">${g.diff.team}: ${dummyLabel('dummy', g.cpu)}</p>
    <div class="menu"><button class="btn btn--solid" data-go="resume">Resume</button><button class="btn" data-go="controls">Controls</button>
    <button class="btn" data-go="restart">Restart game</button><button class="btn" data-go="menu">Quit to menu</button></div>`);
}
function go(what, arg) {
  audio();
  if (what === 'menu') mainMenu();
  else if (what === 'controls') controls();
  else if (what === 'length') { data.len = data.len === 'standard' ? 'quick' : 'standard'; persist(); mainMenu(); menuItems[5] && menuItems[5].focus(); }
  else if (what === 'wskill') { const ids = Object.keys(DIFFS); data.watchDiff = ids[(ids.indexOf(data.watchDiff) + 1) % ids.length]; persist(); mainMenu(); menuItems[4] && menuItems[4].focus(); }
  else if (what === 'play') startGame(arg);
  else if (what === 'watch') startWatch();
  else if (what === 'restart') { if (watch) startWatch(); else startGame(g.diff.id); }
  else if (what === 'pause') pause();
  else if (what === 'resume') { mode = pausedFrom || 'call'; hide(); }
  else if (what === 'next') { hide(); toCall(); }
}

/* ---------------- the game ---------------- */
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ord = (n) => ['', '1st', '2nd', '3rd', '4th'][n];
function spot(x) { const r = Math.round(x); return r === 50 ? 'midfield' : r < 50 ? `your ${r}` : `their ${100 - r}`; }
function spotShort(x) { const r = Math.round(x); return r === 50 ? 'MID' : r < 50 ? `OWN ${r}` : `${watch ? defTeam(g).abbr : g.diff.abbr} ${100 - r}`; }
function mmss(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function clockText() { return g.q >= 5 ? `OT ${g.ot.round}` : `Q${g.q} ${mmss(g.clock)}`; }
function downText() {
  const goal = g.firstX >= 100;
  return `${ord(g.down)} & ${goal ? 'goal' : Math.max(1, Math.round(g.firstX - g.x))}`;
}

function startGame(id) {
  const diff = DIFFS[id];
  watch = false;
  // a fresh dummy every game: the difficulty is how good it is, the seed is how it plays
  g = { diff, cpu: makeTeam(newSeed()), qLen: LENGTHS[data.len].secs, q: 1, clock: LENGTHS[data.len].secs, you: 0, them: 0,
    x: 25, y: MID, down: 1, firstX: 35, callIdx: 0, hand: 'R', play: null, preview: null, ot: null,
    stats: { pass: 0, comp: 0, yds: 0, td: 0 } };
  cam.x = null;
  hide(); toCall();
}

/* CPU vs CPU: two fresh dummies every match, nothing recorded */
function startWatch() {
  watch = true;
  g = newMatch({ secs: LENGTHS[data.len].secs, diff: DIFFS[data.watchDiff], seeds: [newSeed(), newSeed()] });
  cam.x = null; mode = 'watch';
  hide();
}
function watchUpdate(dt) {
  matchTick(g, dt);
  for (const c of g.cues) {
    if (c === 'snap' || c === 'kick') thump();
    if (c === 'tackle') { thump(); whistle(); }
    if (c === 'whistle') whistle();
    if (c === 'td') { thump(); fanfare(); }
  }
  if (g.phase === 'live' && g.play) for (const e of g.play.events) {
    if (e.type === 'throw') beep(520 + 300 * e.zip, 0.05, 'triangle', 0.14);
    if (e.type === 'catch') beep(330, 0.07, 'triangle', 0.2);
    if (e.type === 'juke') beep(760, 0.03, 'square', 0.07);
    if (e.type === 'missed') beep(e.how === 'stiff' ? 200 : 880, 0.06, e.how === 'stiff' ? 'sawtooth' : 'triangle', 0.12);
  }
  // the result stays up for a moment, then two new dummies take the field
  if (g.phase === 'final' && g.finalT > WATCH_FINAL) startWatch();
}
const WATCH_FINAL = 6;

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
  const still = () => 0.5;
  g.preview = newPlay(g.x, g.y, PLAYS.some((p) => p.id === c.id) ? c.id : 'slants', g.diff, still);
  g.play = null;
}
function confirmCall() {
  const c = g.calls[g.callIdx];
  if (c.id === 'punt') return punt();
  if (c.id === 'fg') return startKick();
  g.hand = Math.random() < 0.5 ? 'L' : 'R';
  g.play = newPlay(g.x, g.y, c.id, g.diff, Math.random, g.cpu.p, g.cpu.R);
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
  if (mode === 'watch') return watchUpdate(dt);
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
  g.kick = { kd, t: 0, ...kickSpec(kd), done: false };
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
    const d = simDrive(clamp(oppDist, 1, 99), g.diff, g.cpu.R, g.cpu.p);
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
  const pts = simOT(g.diff, g.cpu.R);
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
    <p class="hint">${g.diff.team}: ${dummyLabel('dummy', g.cpu)}</p>
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
function resize() { ({ W, H, dpr } = look.fit(canvas)); }
look.watch(canvas, resize); resize();

const FG = '#ececec', BG = '#060606', MUTED = 'rgba(236,236,236,.6)', STRONG = '#4d4d4d';
const mono = (px, w = 400) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`;
// a strip at the top for the stands, and one at the bottom for the play cards while you pick a play
const TOP = 48, CARDS = 96;
let BOTTOM = CARDS;
const cam = { x: null, y: 0 };
let ppy = 10, oy = 0, view = 40, viewY = FW, fits = true;
const sx = (x) => (x - cam.x) * ppy, sy = (y) => oy + (y - cam.y) * ppy;
const HUD = look.hud();
let lastMode = '', shownKick = null, pulseT = 0;
const faces = new WeakMap();

/* about 80 yards across on a laptop, never less than about 34 yards top to bottom */
function layout(dt) {
  const want = mode === 'call' || (mode === 'paused' && pausedFrom === 'call') ? CARDS : 14;
  BOTTOM = reducedMotion() ? want : BOTTOM + (want - BOTTOM) * Math.min(1, dt * 7);
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
  if (phase() === 'live' && p.play.kind === 'pass') return (p.off.QB.y + p.aim.y) / 2;
  return g.y;
}
function focusX() {
  const p = g.play || g.preview;
  if (!p) return g.x;
  if (p.carrier) return p.carrier.x + 6;
  if (p.ball.air) { const a = p.ball.air, u = Math.min(1, a.t / a.T); return a.from.x + (a.to.x - a.from.x) * u + 4; }
  if (phase() === 'live' && p.play.kind === 'pass') return (p.off.QB.x + p.aim.x) / 2 + 2;
  return g.x + 8;
}
function updateCam(dt) {
  const target = view > 124 ? 50 - view / 2 : clamp(focusX() - view * 0.42, -12, 112 - view);
  const ty = fits ? 0 : clamp(focusY() - viewY / 2, -1.5, FW + 1.5 - viewY);
  if (cam.x == null) { cam.x = target; cam.y = ty; }
  const k = Math.min(1, dt * (reducedMotion() ? 10 : 5));
  cam.x += (target - cam.x) * k; cam.y += (ty - cam.y) * k;
}
/* no game: the whole field sits quietly behind the menus */
function idleCam() { cam.x = 50 - view / 2; cam.y = fits ? 0 : (FW - viewY) / 2; }
/* where the far sideline meets the stands, so the crowd sits behind the field. When the field is
   taller than the stage the stands keep their strip and the field scrolls under it */
function horizonY() { return Math.max(TOP, Math.min(H, sy(-3))); }
function clipWorld() { const hz = horizonY(); ctx.save(); ctx.beginPath(); ctx.rect(0, hz, W, H - hz); ctx.clip(); }

function draw(dt) {
  pulseT += dt;
  HUD.tick(dt, input);
  layout(dt);
  if (!g) {
    idleCam(); look.arena(ctx, W, H, { horizon: horizonY(), dt }); clipWorld(); drawField(null); ctx.restore();
    board(); HUD.msg(''); menuBar(); lastMode = mode; return;
  }
  updateCam(dt);
  look.arena(ctx, W, H, { horizon: horizonY(), dt });
  // in CPU vs CPU the match says what is on the field (g.phase); otherwise the mode does
  const p = g.play || g.preview, ph = phase();
  board(); status(); stamps();
  clipWorld();
  drawField(p);
  if (p && (ph === 'call' || ph === 'pre')) drawRoutes(p);
  if (p && ph !== 'kick') {
    drawPlayers(p);
    if (p.ball.air) drawBall(p);
    if (ph === 'live' && p.play.kind === 'pass' && !p.carrier && !p.ball.air) drawAim(p);
  }
  ctx.restore();
  if (watch) drawSeeds();
  if (ph === 'kick' && g.kick) drawKick();
  if (mode === 'call') drawCalls();
  if (mode === 'menu' || mode === 'paused' || mode === 'card' || mode === 'final') menuBar(); else if (watch) watchBar(); else bar(p);
  lastMode = mode === 'paused' ? 'paused' : ph;
}

/* CPU vs CPU: one tag per dummy under the field, who it is, how it plays, its seed */
function drawSeeds() {
  if (W < 560) return;
  const y = H - Math.max(16, BOTTOM / 2 + 4);
  g.teams.forEach((t, i) => {
    const on = g.pos === i && g.phase !== 'final';
    look.tag(ctx, i === 0 ? 16 : W - 16, y, `${dummyLabel(`dummy ${t.abbr.toLowerCase()}`, t.d)}${on ? ' · ball' : ''}`, { size: 10, pad: 4, align: i === 0 ? 'left' : 'right' });
  });
}
function drawField(p) {
  const x0 = sx(-10), x1 = sx(110), y0 = sy(0), y1 = sy(FW);
  // a dark run-off around the field, then the field, then a pool of light where the ball is
  ctx.fillStyle = '#080808'; ctx.fillRect(sx(-16), sy(-3), sx(116) - sx(-16), sy(FW + 3) - sy(-3));
  ctx.strokeStyle = look.FLOOR.edge; ctx.lineWidth = 1.5; ctx.strokeRect(sx(-16), sy(-3), sx(116) - sx(-16), sy(FW + 3) - sy(-3));
  ctx.fillStyle = look.FLOOR.base; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  look.spot(ctx, sx(g ? focusX() : 50), sy(MID), Math.min(W * 0.75, 46 * ppy), FW * ppy * 0.62);
  ctx.restore();
  // end zones: hatched
  ctx.save(); ctx.beginPath(); ctx.rect(sx(-10), y0, 10 * ppy, y1 - y0); ctx.rect(sx(100), y0, 10 * ppy, y1 - y0); ctx.clip();
  ctx.strokeStyle = 'rgba(236,236,236,.06)'; ctx.lineWidth = 1;
  for (let i = -20; i < 140; i += 2) { ctx.beginPath(); ctx.moveTo(sx(i), y1); ctx.lineTo(sx(i + FW), y0); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.fillStyle = look.FLOOR.inner; ctx.font = mono(Math.max(12, ppy * 3.2), 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ends = watch && g ? [`DUMMY ${offTeam(g).abbr}`, `DUMMY ${defTeam(g).abbr}`] : ['HOME', g ? g.diff.abbr : 'AWAY'];
  for (const [x, txt, rot] of [[-5, ends[0], -Math.PI / 2], [105, ends[1], Math.PI / 2]]) {
    ctx.save(); ctx.translate(sx(x), sy(MID)); ctx.rotate(rot); ctx.fillText(txt, 0, 0); ctx.restore();
  }
  ctx.restore();
  // who is about to cross a line: the line brightens, slowly
  const c = p && phase() === 'live' ? p.carrier : null;
  const near = (lx) => c && lx - c.x < 4 && lx - c.x > -1;
  // yard lines
  for (let x = 0; x <= 100; x += 5) {
    const X = sx(x); if (X < -20 || X > W + 20) continue;
    const goal = x === 0 || x === 100;
    ctx.strokeStyle = goal ? look.FLOOR.line : x % 10 ? '#262626' : look.FLOOR.inner;
    ctx.lineWidth = goal ? 2.5 : 1;
    if (x === 100 && near(100)) { ctx.strokeStyle = look.FLOOR.hot; ctx.globalAlpha = look.pulse(pulseT); }
    ctx.beginPath(); ctx.moveTo(X, y0); ctx.lineTo(X, y1); ctx.stroke(); ctx.globalAlpha = 1;
    if (x % 10 === 0 && x > 0 && x < 100) {
      ctx.fillStyle = look.FLOOR.inner; ctx.font = mono(Math.max(10, ppy * 1.8), 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const n = String(x <= 50 ? x : 100 - x);
      ctx.fillText(n, X, sy(7)); ctx.fillText(n, X, sy(FW - 7));
    }
  }
  // hash marks
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1;
  for (let x = 1; x < 100; x++) {
    const X = sx(x); if (X < 0 || X > W) continue;
    for (const hy of [0.6, 23.58, 29.75, FW - 0.6]) { ctx.beginPath(); ctx.moveTo(X, sy(hy) - ppy * 0.4); ctx.lineTo(X, sy(hy) + ppy * 0.4); ctx.stroke(); }
  }
  // sidelines
  ctx.strokeStyle = look.FLOOR.line; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  if (!g) return;
  // line of scrimmage (solid) and the first down line (dashed, brighter)
  ctx.strokeStyle = look.FLOOR.mark; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx(g.x), y0); ctx.lineTo(sx(g.x), y1); ctx.stroke();
  if (g.firstX < 100) {
    ctx.strokeStyle = near(g.firstX) ? look.FLOOR.hot : look.FLOOR.line; ctx.lineWidth = 3; ctx.setLineDash([10, 7]);
    if (near(g.firstX)) ctx.globalAlpha = look.pulse(pulseT);
    ctx.beginPath(); ctx.moveTo(sx(g.firstX), y0); ctx.lineTo(sx(g.firstX), y1); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
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
function drawPlayers(p) {
  const r = Math.max(6, ppy * 0.9);
  const holder = p.carrier || (!p.ball.air ? p.off.QB : null), mine = holder && mode !== 'call';
  // your player: a faint ring on the grass under them
  if (mine) { const X = sx(holder.x), Y = sy(holder.y); look.ring(ctx, X, Y, r * 1.55, r * 1.55); }
  // defenders: dark, diamond shoulders. yours: light, round shoulders.
  // CPU vs CPU: each dummy keeps its tones all game, the shoulders still say who has the ball
  const swap = watch && g.pos === 1, T0 = look.team(swap ? 1 : 0), T1 = look.team(swap ? 0 : 1);
  for (const d of Object.values(p.def)) figure(d, T1, r, false, d.role[0], false);
  for (const o of Object.values(p.off)) figure(o, T0, r, true, o.role === 'OL' ? '' : o.role === 'RB' ? 'B' : o.role[0], mine && o === holder);
  // the ball and the hand it is in
  if (!mine) return;
  const X = sx(holder.x), Y = sy(holder.y);
  // facing down the field, the left hand is on the top side of the screen
  const side = g.hand === 'L' ? -1 : 1, s = Math.max(5, r * 0.6), bx = X + r * 0.3, by = Y + side * (r + 9);
  footballAt(bx, by, s);
  if (watch) return;
  look.tag(ctx, bx + s + 4, by, g.hand, { size: 10, pad: 3, align: 'left' });
  // the meter for what the trigger does right now, on the other side of the player
  if (mode !== 'live') return;
  const label = p.carrier ? 'burst' : p.play.kind === 'pass' ? 'zip' : '';
  if (!label) return;
  const v = p.carrier ? p.meter : p.qb.zip, bw = Math.max(34, r * 3.4), my = Y - side * (r + 11), mx = X - bw / 2 + 12;
  look.tag(ctx, mx - 4, my, label, { size: 9, pad: 3, align: 'right' });
  ctx.fillStyle = BG; ctx.fillRect(mx, my - 3.5, bw, 7);
  ctx.fillStyle = look.FLOOR.line; ctx.fillRect(mx, my - 3.5, bw * clamp(v, 0, 1), 7);
  ctx.strokeStyle = FG; ctx.lineWidth = 1; ctx.strokeRect(mx + 0.5, my - 3, bw - 1, 6);
}
/* one player from above: shoulders, helmet, arms, and the band at the gloves */
function figure(q, T, r, round, letter, isHolder) {
  const X = sx(q.x), Y = sy(q.y); if (X < -30 || X > W + 30) return;
  const speed = Math.hypot(q.vx, q.vy);
  let a = faces.has(q) ? faces.get(q) : (q.team === 'off' ? 0 : Math.PI);
  if (speed > 0.8) { const want = Math.atan2(q.vy, q.vx); let d = want - a; d = Math.atan2(Math.sin(d), Math.cos(d)); a += d * 0.3; }
  faces.set(q, a);
  const swing = speed > 0.8 && !reducedMotion() ? Math.sin((q.x + q.y) * 1.7) * r * 0.28 : 0;
  ctx.save(); ctx.translate(X, Y); ctx.rotate(a);
  const h1 = [r * 0.62 + swing, -r * 0.66], h2 = [r * 0.62 - swing, r * 0.66];
  look.strokeLimb(ctx, () => { ctx.moveTo(0, -r * 0.82); ctx.lineTo(h1[0], h1[1]); ctx.moveTo(0, r * 0.82); ctx.lineTo(h2[0], h2[1]); }, Math.max(2.5, r * 0.36), T, T.skin);
  for (const h of [h1, h2]) look.band(ctx, h[0], h[1], Math.max(1.8, r * 0.2), T);
  const shoulders = round ? () => ctx.ellipse(0, 0, r * 0.58, r * 0.98, 0, 0, Math.PI * 2)
    : () => { ctx.moveTo(r * 0.72, 0); ctx.lineTo(0, r * 1.02); ctx.lineTo(-r * 0.72, 0); ctx.lineTo(0, -r * 1.02); ctx.closePath(); };
  look.fillBody(ctx, shoulders, T, T.suit, [-r, -r, r, r]);
  look.ball(ctx, r * 0.08, 0, r * 0.42, T, T.skin);
  ctx.restore();
  if (letter && r >= 8 && !isHolder) look.tag(ctx, X, Y - r - 10, letter, { size: 9, pad: 3 });
  if (q.stun > 0) look.tag(ctx, X + r * 1.6, Y - r * 0.6, '?', { size: 9, pad: 3 });
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
function drawAim(p) {
  const qb = p.off.QB, X = sx(p.aim.x), Y = sy(p.aim.y), R = 1.35 * ppy;
  ctx.strokeStyle = 'rgba(236,236,236,.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.moveTo(sx(qb.x), sy(qb.y));
  const mx = (sx(qb.x) + X) / 2, my = (sy(qb.y) + Y) / 2 - Math.hypot(X - sx(qb.x), Y - sy(qb.y)) * (0.35 - 0.25 * p.qb.zip);
  ctx.quadraticCurveTo(mx, my, X, Y); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = FG; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X - R - 6, Y); ctx.lineTo(X - R + 4, Y); ctx.moveTo(X + R - 4, Y); ctx.lineTo(X + R + 6, Y);
  ctx.moveTo(X, Y - R - 6); ctx.lineTo(X, Y - R + 4); ctx.moveTo(X, Y + R - 4); ctx.lineTo(X, Y + R + 6); ctx.stroke();
}
/* the play cards sit in the strip under the field */
function drawCalls() {
  const n = g.calls.length, gap = 8, h = CARDS - 18, y = H - CARDS + 8;
  const w = Math.min(176, (W - 36 - gap * (n - 1)) / n), x0 = (W - (w * n + gap * (n - 1))) / 2;
  g.cardRects = [];
  g.calls.forEach((c, i) => {
    const x = x0 + i * (w + gap), on = i === g.callIdx;
    g.cardRects.push([x, y, w, h]);
    ctx.fillStyle = on ? FG : BG; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = on ? FG : STRONG; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = on ? BG : MUTED; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = mono(10); ctx.fillText((c.kind === 'run' ? '■ RUN' : c.kind === 'kick' ? '■ KICK' : '■ PASS'), x + 10, y + 18);
    ctx.fillStyle = on ? BG : FG; ctx.font = mono(w < 120 ? 13 : 16, 600); ctx.fillText(c.name, x + 10, y + 44);
    if (w >= 110) { ctx.fillStyle = on ? BG : MUTED; ctx.font = mono(11); ctx.fillText(c.blurb, x + 10, y + 66); }
  });
}
function drawKick() {
  const k = g.kick, cx = W / 2, cy = TOP + (H - TOP - BOTTOM) * 0.66, R = Math.min(W * 0.36, (H - TOP - BOTTOM) * 0.5);
  ctx.fillStyle = 'rgba(6,6,6,.82)'; ctx.fillRect(0, 0, W, H);
  // the arc runs from -1 (left) to 1 (right); 0 is straight up
  const ang = (v) => -Math.PI / 2 + v * 1.1;
  ctx.strokeStyle = look.FLOOR.inner; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, ang(-1), ang(1)); ctx.stroke();
  ctx.strokeStyle = look.FLOOR.line; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R, ang(-k.win), ang(k.win)); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = FG;
  for (const e of [-k.win, k.win]) { const a = ang(e); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14)); ctx.lineTo(cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14)); ctx.stroke(); }
  const v = k.done ? k.at : Math.sin(k.t * k.w), a = ang(v);
  ctx.strokeStyle = FG; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (R + 8), cy + Math.sin(a) * (R + 8)); ctx.stroke();
  ctx.fillStyle = FG; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
  look.tag(ctx, cx, cy - R - 24, watch ? `${offTeam(g).name} lines it up` : `${g.hand === 'L' ? 'left' : 'right'} hand · ${trigText(g.hand)} in the box`);
  if (k.done) look.tag(ctx, cx, cy + 30, k.good ? "it's good" : 'no good', { size: 14 });
}

/* ---------------- HUD: the scoreboard, calls and button bar live on the page, around the stage ---------------- */
function board() {
  if (!g) { HUD.board({ a: { name: 'you', sub: `${look.bandWord(0)} · offense`, score: 0 }, b: { name: 'cpu', sub: `${look.bandWord(1)} · defense`, score: 0 }, clock: '--' }); return; }
  if (watch) {
    const [a, b] = g.teams, on = g.phase !== 'final';
    HUD.board({
      a: { name: 'dummy a', sub: `${look.bandWord(0)} · ${a.d.style}`, score: a.score, has: on && g.pos === 0 },
      b: { name: 'dummy b', sub: `${look.bandWord(1)} · ${b.d.style}`, score: b.score, has: on && g.pos === 1 },
      clock: g.phase === 'final' ? 'final' : clockText(), low: (g.q === 2 || g.q === 4) && g.clock < 60
    });
    return;
  }
  const onField = mode === 'call' || mode === 'pre' || mode === 'live' || mode === 'kick' || mode === 'dead';
  HUD.board({
    a: { name: 'you', sub: `${look.bandWord(0)} · offense`, score: g.you, has: onField },
    b: { name: g.diff.team, sub: `${look.bandWord(1)} · ${g.diff.name}`, score: g.them },
    clock: clockText(), low: (g.q === 2 || g.q === 4) && g.clock < 60
  });
}
/* the stamp over the field: down and distance, or what went wrong */
function status() {
  let t = '';
  if (watch) {
    const ph = g.phase;
    if (ph === 'kick' && g.kick) t = `${g.kick.kd} yard field goal · ${offTeam(g).name.toLowerCase()}`;
    else if (ph === 'final') t = `new match in ${Math.max(1, Math.ceil(WATCH_FINAL - g.finalT))} · pause to quit`;
    else if (ph === 'pre' && g.play) t = `${offTeam(g).name.toLowerCase()} calls ${g.play.play.name.toLowerCase()} · ${downText()} · ${spotShort(g.x)}`;
    else t = `${downText()} · ${spotShort(g.x)}`;
    return HUD.msg(t);
  }
  if ((mode === 'pre' || mode === 'kick') && g.wrong > 0) t = `wrong hand. the ball is in your ${g.hand === 'L' ? 'left' : 'right'} hand`;
  else if (mode === 'live' && g.noteT > 0) t = g.note;
  else if (mode === 'kick') t = `${g.kick.kd} yard field goal`;
  else if (mode === 'call' || mode === 'pre' || mode === 'live' || mode === 'dead') t = `${downText()} · ${spotShort(g.x)}`;
  HUD.msg(t);
}
/* the big calls, stamped once when they happen */
function stamps() {
  if (watch) {
    const ph = g.phase, was = lastMode;
    if ((ph === 'dead' || ph === 'final') && was !== ph && was !== 'paused' && g.banner) {
      const big = g.banner === 'Touchdown' || ph === 'final';
      HUD.call(g.banner.replace(/\.$/, ''), g.sub, big);
      if (big) look.cheer(0.9); else if (/Intercepted|Safety|downs/.test(g.banner)) look.cheer(0.6);
    }
    if (ph === 'kick' && g.kick && g.kick.done && shownKick !== g.kick) {
      shownKick = g.kick;
      HUD.call(g.kick.good ? "It's good" : 'No good', `${g.kick.kd} yards · ${offTeam(g).name}`, g.kick.good);
      if (g.kick.good) look.cheer(0.8);
    }
    return;
  }
  if (mode === 'pre' && lastMode !== 'pre' && lastMode !== 'paused') HUD.call(`${g.hand === 'L' ? 'Left' : 'Right'} hand`, `pull ${trigText(g.hand)} to snap`);
  if (mode === 'dead' && lastMode !== 'dead' && lastMode !== 'paused') {
    const td = g.banner === 'Touchdown';
    HUD.call(g.banner.replace(/\.$/, ''), g.sub, td);
    if (td) look.cheer(0.9);
    else if (/Intercepted|Safety|downs/.test(g.banner)) look.cheer(0.6);
    else if (/First down/.test(g.sub)) look.cheer(0.5);
  }
  if (mode === 'kick' && g.kick.done && shownKick !== g.kick) {
    shownKick = g.kick;
    HUD.call(g.kick.good ? "It's good" : 'No good', `${g.kick.kd} yards`, g.kick.good);
    if (g.kick.good) look.cheer(0.8);
  }
}
/* what the buttons do right now */
const chip = (k, t, open) => ({ k, t, open });
function bar(p) {
  const pad = input.lastDevice === 'controller', h = g.hand, o = h === 'L' ? 'R' : 'L';
  const stick = (s) => (pad ? s : s === 'L' ? 'wasd' : 'arrows');
  const trig = (s) => (pad ? HAND[s].trig : s === 'L' ? 'l shift' : 'r shift');
  const side = `${h === 'L' ? 'left' : 'right'} hand`, off = chip(`${stick(o)} + ${trig(o)}`, 'off');
  if (mode === 'call') return HUD.bar('play call', pad ? [chip('◀ ▶', 'pick a play'), chip('✕', 'call it', true), chip('options', 'pause')] : [chip('← →', 'pick a play'), chip('enter', 'call it', true), chip('esc', 'pause')], 'or click a card, then click it again to call it');
  if (mode === 'pre') return HUD.bar(`${side} · ball`, [chip(trig(h), 'snap', true), off], 'only the side with the ball does anything');
  if (mode === 'kick') return HUD.bar(`${side} · kick`, [chip(trig(h), 'kick when the needle is in the box', !g.kick.done), off], 'longer kicks swing faster into a smaller box');
  if (mode === 'dead') return HUD.bar('whistle', [chip(pad ? '✕' : 'enter', 'next play', g.deadT > 0.4)]);
  if (!p) return HUD.bar(side, [off]);
  if (p.carrier) return HUD.bar(`${side} · ball carrier`, [chip(stick(h), 'run', true), chip(pad ? `flick ${h} ↕` : h === 'L' ? 'w w / s s' : '↑↑ / ↓↓', 'juke'), chip(trig(h), 'burst / stiff-arm', p.meter >= 0.15), off], 'juke right as a tackler reaches you');
  if (p.ball.air) return HUD.bar('ball in the air', [off], 'the receiver goes to the spot');
  if (p.play.kind === 'pass') return HUD.bar(`${side} · quarterback`, [chip(trig(h), p.qb.holding ? 'let go to throw' : 'hold to drop back', true), chip(stick(h), 'aim', p.qb.holding), off], 'hold longer and pull deeper for more zip');
  HUD.bar(`${side} · handoff`, [off]);
}
function watchBar() {
  const pad = input.lastDevice === 'controller';
  HUD.bar('watching', [chip(pad ? 'options' : 'P / esc', 'pause', true)], `cpu vs cpu · ${g.diff.name.toLowerCase()}. a new match starts by itself`);
}
function menuBar() {
  const pad = input.lastDevice === 'controller';
  const label = mode === 'paused' ? 'paused' : mode === 'card' ? 'their drive' : mode === 'final' ? 'final' : 'menu';
  HUD.bar(label, pad ? [chip('↕', 'pick'), chip('✕', 'choose', true), chip('○', 'back')] : [chip('↕', 'pick'), chip('enter', 'choose', true), chip('esc', 'back')]);
}

/* mouse or touch can pick plays too */
canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'call' || !g.cardRects) return;
  const b = canvas.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
  const i = g.cardRects.findIndex(([x, y, w, h]) => px >= x && px <= x + w && py >= y && py <= y + h);
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
addEventListener('blur', () => { if (g && ['call', 'pre', 'live', 'kick', 'dead', 'watch'].includes(mode)) pause(); });
mainMenu();
requestAnimationFrame(frame);

// test hook: lets an automated check drive the game without a controller
if (new URLSearchParams(location.search).has('debug')) window.__tackle = { get g() { return g; }, get mode() { return mode; }, get watch() { return watch; }, go, confirmCall, hands };
