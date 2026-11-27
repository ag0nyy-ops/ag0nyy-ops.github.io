/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Sprint: 100 m in the browser. Alternate the triggers to stride, set your lean with the left
   stick, dip at the line. Training drills grade your starts, rhythm and lean, and your best grade
   in each builds your athlete, so getting better means training well, not training a lot.
   The other lanes are seeded dummies (see sim.js). CPU vs CPU fills all eight lanes with them and
   runs race after race on its own, with new seeds each time. */

import { Input } from '../shared/input.js';
import { loadSettings, palette, reducedMotion } from '../shared/settings.js';
import * as look from '../shared/look.js';
import { dummyLabel } from '../shared/seed.js';
import { Runner, CpuRunner, rollDummy, athlete, idealLean, LEVELS, DIST } from './sim.js';

const SAVE = 'jay.sprint.v1';
const DRILLS = [
  { id: 'blocks', name: 'Starts', blurb: 'Five gun starts. Graded on reaction and your first strides.', dist: 10, reps: 5 },
  { id: 'cadence', name: 'Rhythm', blurb: 'Sixty metres. Graded on stride rhythm and full trigger pulls.', dist: 60, reps: 1 },
  { id: 'lean', name: 'Lean', blurb: 'Forty metres of drive phase. Graded on holding the right lean.', dist: 40, reps: 1 }
];

const input = new Input({
  LT: ['KeyF'], RT: ['KeyJ'], A: ['Space', 'Enter'], B: ['Escape', 'Backspace'], START: ['KeyP'],
  UP: ['KeyW', 'ArrowUp'], DOWN: ['KeyS', 'ArrowDown'], LEFT: ['ArrowLeft', 'KeyA'], RIGHT: ['ArrowRight', 'KeyD']
});

/* ---------------- save data (this browser only) ---------------- */
function load() {
  let d = {}; try { d = JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) {}
  return { best: { blocks: 0, cadence: 0, lean: 0, ...(d.best || {}) }, pb: { ...(d.pb || {}) } };
}
const data = load();
const persist = () => { try { localStorage.setItem(SAVE, JSON.stringify(data)); } catch (e) {} };
// a drill score of 0.4 builds nothing, 0.95 builds everything
const gradeToStat = (s) => Math.max(0, Math.min(1, (s - 0.4) / 0.55));
const stats = () => ({ blocks: gradeToStat(data.best.blocks), cadence: gradeToStat(data.best.cadence), lean: gradeToStat(data.best.lean) });
const letter = (s) => (s >= 0.93 ? 'S' : s >= 0.85 ? 'A' : s >= 0.74 ? 'B' : s >= 0.6 ? 'C' : s > 0 ? 'D' : '–');

/* ---------------- sound: tiny synth, no files ---------------- */
let ac = null;
function audio() {
  if (!ac) { try { ac = new AudioContext(); } catch (e) { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function beep(freq, len = 0.08, type = 'square', vol = 0.25) {
  const a = audio(); const v = loadSettings().volume * vol; if (!a || v <= 0) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(v, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + len);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + len);
}
function gun() {
  const a = audio(); const v = loadSettings().volume * 0.6; if (!a || v <= 0) return;
  const n = a.sampleRate * 0.25, buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const s = a.createBufferSource(), g = a.createGain(); s.buffer = buf; g.gain.value = v;
  s.connect(g).connect(a.destination); s.start();
}

/* ---------------- screens (DOM overlay, driven by controller or keyboard) ---------------- */
const $ = (sel) => document.querySelector(sel);
const overlay = $('#overlay');
let menuItems = [], menuIndex = 0;
const backLink = document.querySelector('.back');
function show(html, focusFirst = true) {
  overlay.innerHTML = `<div class="panel">${html}</div>`; overlay.hidden = false; if (backLink) backLink.hidden = false;
  menuItems = [...overlay.querySelectorAll('button')];
  menuIndex = 0;
  if (focusFirst && menuItems[0]) menuItems[0].focus();
  menuItems.forEach((b, i) => b.addEventListener('focus', () => { menuIndex = i; }));
}
function hide() { overlay.hidden = true; overlay.innerHTML = ''; menuItems = []; if (backLink) backLink.hidden = true; }
overlay.addEventListener('click', (e) => { const b = e.target.closest('button[data-go]'); if (b) go(b.dataset.go, b.dataset.arg); });

function statBars() {
  const s = stats();
  const row = (k, name) => `<li><span>${name}</span><span class="bar"><i style="width:${Math.round(s[k] * 100)}%"></i></span><b>${letter(data.best[k])}</b></li>`;
  return `<ul class="stats">${row('blocks', 'Starts')}${row('cadence', 'Top speed')}${row('lean', 'Drive')}</ul>`;
}

function mainMenu() {
  mode = 'menu';
  const lv = LEVELS.map((l) => `<button class="btn" data-go="race" data-arg="${l.id}">${l.name}${data.pb[l.id] ? ` <small>PB ${data.pb[l.id].toFixed(2)}</small>` : ''}</button>`).join('');
  show(`<p class="label">Game file / Track / 100 m</p><h1 class="title">Sprint</h1>
    <div class="menu">${lv}<button class="btn" data-go="watch">CPU vs CPU</button><button class="btn" data-go="train">Training</button><button class="btn" data-go="controls">Controls</button></div>
    <h2 class="label">Your athlete</h2>${statBars()}
    <p class="hint">Train to fill the bars. Only your best grade in each drill counts, so there is nothing to grind.</p>`);
}
function watchMenu() {
  mode = 'menu';
  const lv = LEVELS.map((l) => `<button class="btn" data-go="watchgo" data-arg="${l.id}">${l.name}</button>`).join('');
  show(`<p class="label">CPU vs CPU</p><h1 class="title">Watch</h1>
    <div class="menu">${lv}<button class="btn" data-go="menu">Back</button></div>
    <p class="hint">Eight seeded dummies, Dummy A to Dummy H, race on their own. Each one is rolled from a new seed every race. Options / P pauses.</p>`);
}
function trainMenu() {
  mode = 'menu';
  const b = DRILLS.map((d) => `<button class="btn" data-go="drill" data-arg="${d.id}">${d.name} <small>best ${letter(data.best[d.id])}${data.best[d.id] ? ' · ' + Math.round(data.best[d.id] * 100) : ''}</small></button>`).join('');
  show(`<p class="label">Training</p><h1 class="title">Drills</h1>
    <div class="menu">${b}<button class="btn" data-go="menu">Back</button></div>
    <ul class="blurbs">${DRILLS.map((d) => `<li><b>${d.name}:</b> ${d.blurb}</li>`).join('')}</ul>`);
}
function controls() {
  mode = 'menu';
  show(`<p class="label">Controls</p><h1 class="title">How to run</h1>
    <table class="keys"><thead><tr><th></th><th>Controller</th><th>Keyboard</th></tr></thead><tbody>
    <tr><td>Stride</td><td>L2 and R2, one after the other</td><td>F and J, one after the other</td></tr>
    <tr><td>Lean</td><td>Left stick up to lean forward</td><td>W forward, S back</td></tr>
    <tr><td>Dip at the line</td><td>Cross / A</td><td>Space</td></tr>
    <tr><td>Pause</td><td>Options / Start</td><td>P or Esc</td></tr></tbody></table>
    <ul class="blurbs">
      <li>Strides have a rhythm. It starts long out of the blocks and gets quicker as you speed up. Mashing is off rhythm and gets you nowhere.</li>
      <li>Pull the triggers all the way. Half pulls are half strides.</li>
      <li>Lean forward hard out of the blocks and come up gradually. By about 40 m you should be tall.</li>
      <li>Two strides on the same trigger is a stumble.</li>
      <li>Stride before the gun and it's a false start.</li>
      <li>Dip just before the line. Dip early and you lose speed.</li>
    </ul>
    <p class="hint">Stick drifting? Raise the deadzone in the games settings on the <a href="../">games page</a>.</p>
    <div class="menu"><button class="btn" data-go="menu">Back</button></div>`);
}

/* ---------------- race state ---------------- */
let mode = 'menu';          // menu | race | paused | results
let race = null;
let watchT = 0;             // time on the CPU vs CPU results screen before the next race
const canvas = $('#c'), ctx = canvas.getContext('2d');

function newRace(kind, arg) {
  const watch = kind === 'watch';
  const me = watch ? null : new Runner(athlete(stats()));
  const drill = kind === 'drill' ? DRILLS.find((d) => d.id === arg) : null;
  const level = kind === 'race' || watch ? LEVELS.find((l) => l.id === arg) : null;
  const times = level ? level.field.slice() : [];
  if (watch) times.push((times[0] + times[times.length - 1]) / 2);   // eight lanes of dummies
  shuffle(times);
  const myLane = watch ? null : 4;
  const lanes = [1, 2, 3, 4, 5, 6, 7, 8].filter((l) => l !== myLane);
  // every computer runner is a fresh seeded dummy; the level only sets its target time
  const cpus = times.map((t, i) => {
    const d = rollDummy();
    return { c: new CpuRunner(d, t + d.rand(-0.06, 0.06)), d, lane: lanes[i], name: watch ? `Dummy ${'ABCDEFGH'[i]}` : `Lane ${lanes[i]}` };
  });
  race = {
    kind, watch, drill, level, me, myLane, rep: 0, reps: drill ? drill.reps : 1, repResults: [], cpus,
    phase: 'marks', phaseT: 0, gunAt: 0, t: -10, falseStarts: 0, reaction: null, msg: 'On your marks',
    trig: { L: arm(), R: arm() }, lean: 0.5, lastGrade: null, ticks: []
  };
  startRep();
  mode = 'race'; hide();
}
function startRep() {
  const r = race; r.ticks = []; r.phase = 'marks'; r.phaseT = 0; r.reaction = null;
  if (r.me) r.me.reset();
  r.setFor = 1.2 + rand(0.6, 1.8); r.msg = 'On your marks'; r.t = -10; r.lean = 0.85;
  r.cpus.forEach(({ c }) => c.prepStart());
}
const arm = () => ({ armed: true, pressing: false, start: 0, max: 0 });

function go(what, arg) {
  audio();
  if (what === 'menu') mainMenu();
  else if (what === 'train') trainMenu();
  else if (what === 'controls') controls();
  else if (what === 'race') newRace('race', arg);
  else if (what === 'drill') newRace('drill', arg);
  else if (what === 'watch') watchMenu();
  else if (what === 'watchgo') newRace('watch', arg);
  else if (what === 'again') newRace(race.kind, race.drill ? race.drill.id : race.level.id);
  else if (what === 'resume') { mode = 'race'; hide(); }
}

/* trigger handling: a stride fires on a full pull, or 70 ms into a partial one */
function readTrigger(tr, value, now) {
  if (tr.armed && value >= 0.35) { tr.armed = false; tr.pressing = true; tr.start = now; tr.max = value; }
  if (tr.pressing) {
    tr.max = Math.max(tr.max, value);
    if (value >= 0.95 || now - tr.start >= 0.07) { tr.pressing = false; return tr.max; }
  }
  if (!tr.armed && !tr.pressing && value < 0.15) tr.armed = true;
  return null;
}

function update(dt) {
  input.poll();
  // CPU vs CPU: show the result for a few seconds, then the next race with new seeds
  if (mode === 'results' && race && race.watch && (watchT += dt) > 5) return newRace('watch', race.level.id);
  if (mode === 'menu' || mode === 'results' || mode === 'paused') return menuInput();
  if (mode !== 'race') return;
  const r = race, me = r.me;
  if (input.pressed('START') || input.pressed('B')) { pause(); return; }
  r.phaseT += dt;

  // lean: controller sets it directly, keyboard nudges it and it stays (ignored when watching)
  const s = input.state;
  if (me) {
    if (input.lastDevice === 'controller') r.lean += ((0.5 - s.ly * 0.5) - r.lean) * Math.min(1, dt * 14);
    else if (s.ly) r.lean = Math.max(0, Math.min(1, r.lean - s.ly * dt * 1.4));
    me.lean = r.lean;
  }

  if (r.phase === 'marks' && r.phaseT > 1.2) { r.phase = 'set'; r.phaseT = 0; r.msg = 'Set'; beep(440, 0.06, 'sine', 0.15); }
  if (r.phase === 'set' && r.phaseT > r.setFor) { r.phase = 'run'; r.phaseT = 0; r.t = 0; r.msg = ''; gun(); }
  const now = r.phase === 'run' ? r.t : -1;

  const L = me ? readTrigger(r.trig.L, s.lt, performance.now() / 1000) : null;
  const R = me ? readTrigger(r.trig.R, s.rt, performance.now() / 1000) : null;
  for (const [side, depth] of [[-1, L], [1, R]]) {
    if (depth == null) continue;
    if (r.phase === 'marks' || r.phase === 'set') { if (r.phase === 'set') return falseStart(); continue; }
    if (r.phase !== 'run' || me.finish != null) continue;
    if (r.reaction == null) {
      r.reaction = now;
      if (now < 0.1) return falseStart();   // under 0.1 s is a guess, same as the real rule
    }
    const g = me.stride(side, depth, now);
    if (g) { r.ticks.push(g.stumble ? -1 : g.total); if (r.ticks.length > 10) r.ticks.shift(); beep(g.stumble ? 120 : 180 + 140 * (g.total || 0), 0.03, 'triangle', 0.12); }
  }
  if (me && r.phase === 'run' && input.pressed('A')) me.dip(now);

  if (r.phase === 'run') {
    r.t += dt;
    if (me) me.step(dt, r.t);
    r.cpus.forEach(({ c }) => c.step(dt, r.t));
    // a dummy that guessed the gun is caught by the blocks 0.1 s after it: recall the field
    if (r.t >= 0.1) { const fs = r.cpus.find(({ c }) => c.falseStart); if (fs) return cpuFalseStart(fs); }
    const goal = r.drill ? r.drill.dist : DIST;
    const done = r.drill ? me.x >= goal : (!me || me.finish != null) && r.cpus.every(({ c }) => c.finish != null);
    if (r.drill && me.x >= goal && me.finish == null) me.finish = r.t;
    if (done && r.phase === 'run') { r.phase = 'after'; r.phaseT = 0; }
  }
  if (r.phase === 'after') {
    if (me) me.step(dt, r.t + r.phaseT);
    r.cpus.forEach(({ c }) => c.step(dt, r.t + r.phaseT));
    if (r.phaseT > 1.1) finishRep();
  }
}
function falseStart() {
  const r = race; r.falseStarts++; beep(140, 0.25, 'sawtooth', 0.2);
  if (r.drill) { r.repResults.push({ reaction: null, score: 0, note: 'False start' }); r.rep++; return r.rep >= r.reps ? drillDone() : (r.flash = 'False start', startRep()); }
  if (r.falseStarts >= 2) { mode = 'results'; return show(`<p class="label">Disqualified</p><h1 class="title">False start</h1><p class="hint">Two false starts and you're out. Wait for the gun.</p><div class="menu"><button class="btn btn--solid" data-go="again">Run it again</button><button class="btn" data-go="menu">Menu</button></div>`); }
  r.flash = 'False start. One more and you are out.'; startRep();
}
function cpuFalseStart(fs) {
  const r = race; fs.c.warned = true; beep(140, 0.25, 'sawtooth', 0.2);
  r.flash = `False start, ${r.watch ? fs.name : `lane ${fs.lane}`}. Recall.`;
  startRep();
}
function finishRep() {
  const r = race;
  if (!r.drill) return raceDone();
  const me = r.me, gs = me.grades;
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  let score = 0, note = '';
  if (r.drill.id === 'blocks') {
    const react = Math.max(0, Math.min(1, (0.35 - r.reaction) / 0.23));
    score = 0.6 * react + 0.4 * mean(gs.slice(0, 4).map((g) => g.total || 0));
    note = `Reaction ${r.reaction.toFixed(3)} s`;
  } else if (r.drill.id === 'cadence') {
    score = mean(gs.slice(4).map((g) => (g.rhythm || 0) * (0.6 + 0.4 * (g.depth || 0))));
    note = `${gs.length} strides`;
  } else {
    score = mean(gs.map((g) => g.lean || 0));
    note = `${gs.length} strides`;
  }
  r.repResults.push({ reaction: r.reaction, score, note });
  r.rep++;
  if (r.rep < r.reps) { r.flash = `Rep ${r.rep}: ${Math.round(score * 100)}. ${note}`; return startRep(); }
  drillDone();
}
function drillDone() {
  const r = race, id = r.drill.id;
  const score = r.repResults.reduce((a, b) => a + b.score, 0) / r.repResults.length;
  const before = data.best[id], better = score > before;
  if (better) { data.best[id] = score; persist(); }
  mode = 'results';
  const reps = r.reps > 1 ? `<ol class="reps">${r.repResults.map((x) => `<li>${Math.round(x.score * 100)} <small>${x.note}</small></li>`).join('')}</ol>` : '';
  show(`<p class="label">Drill / ${r.drill.name}</p><h1 class="title">${letter(score)} <small>${Math.round(score * 100)}</small></h1>
    ${reps}<p class="hint">${better ? (before ? `New best, up from ${Math.round(before * 100)}.` : 'First grade on the board.') : `Your best is still ${Math.round(before * 100)}.`} ${tip(id, r)}</p>
    ${statBars()}
    <div class="menu"><button class="btn btn--solid" data-go="again">Again</button><button class="btn" data-go="train">Drills</button><button class="btn" data-go="menu">Menu</button></div>`);
}
function tip(id, r) {
  const gs = r.me.grades; if (!gs.length) return '';
  const avg = (k) => gs.reduce((a, g) => a + (g[k] || 0), 0) / gs.length;
  if (id === 'lean') return avg('lean') < 0.7 ? 'Push the stick further forward at the start and ease it back by 40 m.' : '';
  if (avg('depth') < 0.8) return 'Pull the triggers all the way down.';
  if (avg('rhythm') < 0.75) return 'Find the beat. Slower out of the blocks, quicker once you are moving.';
  return '';
}
function watchDone() {
  const r = race; mode = 'results'; watchT = 0;
  const res = r.cpus.slice().sort((a, b) => a.c.finish - b.c.finish);
  const rows = res.map((x, i) => `<tr><td>${i + 1}</td><td>${x.name} <small>lane ${x.lane} · ${x.d.style} · ${x.d.tag}</small></td><td>${x.c.finish.toFixed(2)}</td></tr>`).join('');
  show(`<p class="label">CPU vs CPU / ${r.level.name}</p><h1 class="title">${res[0].name} <small>${res[0].c.finish.toFixed(2)}</small></h1>
    <p class="hint">Next race in a few seconds, with new seeds.</p>
    <table class="board"><tbody>${rows}</tbody></table>
    <div class="menu"><button class="btn btn--solid" data-go="again">Next race</button><button class="btn" data-go="menu">Quit to menu</button></div>`);
}
function raceDone() {
  const r = race, me = r.me;
  if (r.watch) return watchDone();
  const results = [{ who: 'You', lane: r.myLane, time: me.finish, me: true }, ...r.cpus.map(({ c, d, lane }) => ({ who: `Lane ${lane} <small>${d.style} · ${d.tag}</small>`, lane, time: c.finish }))]
    .sort((a, b) => a.time - b.time);
  const place = results.findIndex((x) => x.me) + 1;
  const id = r.level.id, pb = data.pb[id], newPb = !pb || me.finish < pb;
  if (newPb) { data.pb[id] = me.finish; persist(); }
  mode = 'results';
  const rows = results.map((x, i) => `<tr${x.me ? ' class="me"' : ''}><td>${i + 1}</td><td>${x.who}</td><td>${x.time.toFixed(2)}</td></tr>`).join('');
  show(`<p class="label">${r.level.name} / 100 m final</p><h1 class="title">${ordinal(place)} <small>${me.finish.toFixed(2)}</small></h1>
    <p class="hint">Reaction ${r.reaction.toFixed(3)} s · top speed ${me.topV.toFixed(1)} m/s${newPb ? ' · new personal best' : ` · PB ${pb.toFixed(2)}`}</p>
    <table class="board"><tbody>${rows}</tbody></table>
    <div class="menu"><button class="btn btn--solid" data-go="again">Run it again</button><button class="btn" data-go="train">Training</button><button class="btn" data-go="menu">Menu</button></div>`);
}
function pause() {
  mode = 'paused';
  const r = race;
  const field = r.cpus.length ? `<ul class="blurbs">${r.cpus.slice().sort((a, b) => a.lane - b.lane).map((x) => `<li>${dummyLabel(x.name.toLowerCase(), x.d)}</li>`).join('')}</ul>` : '';
  show(`<p class="label">${r.watch ? 'Paused / CPU vs CPU' : 'Paused'}</p><div class="menu"><button class="btn btn--solid" data-go="resume">Resume</button><button class="btn" data-go="again">${r.watch ? 'New seeds' : 'Restart'}</button><button class="btn" data-go="menu">Quit to menu</button></div>${field}`);
}
function menuInput() {
  if (!menuItems.length) return;
  const n = input.nav();
  if (n.y || n.x) { menuIndex = (menuIndex + (n.y || n.x) + menuItems.length) % menuItems.length; menuItems[menuIndex].focus(); }
  // the input layer swallows Space/Enter, so A (or those keys) clicks the focused button here
  if (input.pressed('A')) { const b = menuItems[menuIndex]; b && b.click(); }
  if (input.pressed('B') && mode === 'paused') go('resume');
}

/* ---------------- drawing ---------------- */
let W = 0, H = 0, dpr = 1;
function resize() { ({ W, H, dpr } = look.fit(canvas)); }
look.watch(canvas, resize); resize();

const FG = '#ececec', BG = '#060606', MUTED = 'rgba(236,236,236,.55)', LINE = look.FLOOR.inner, EDGE = look.INK.strong;
const mono = look.mono;
const HUD = look.hud();
let seenRace = null, seenFlash = '', seenFinish = null, seenGun = false;
const flashKey = (r) => (r.flash ? `${r.flash}|${r.rep}|${r.falseStarts}` : '');

/* the track's geometry on this stage: crowd above, eight lanes, the stride panel below */
function layout() {
  const ph = Math.max(60, Math.min(84, H * 0.13)), y0 = H - ph - 10;
  const top = Math.max(54, H * 0.22), bottom = y0 - 16;
  return { top, bottom, laneH: (bottom - top) / 8, y0, ph };
}

function draw(dt) {
  HUD.tick(dt, input);
  const L = layout();
  look.arena(ctx, W, H, { horizon: L.top - 6, dt });
  if (!race || mode === 'menu') { drawIdle(L); board(null); menuBar(); return; }
  const r = race, me = r.me;
  const { top, bottom, laneH } = L;
  let ppm = Math.max(26, Math.min(64, W / 26));                 // pixels per metre
  let camX, lead = null;
  if (me) camX = me.x - (W * 0.3) / ppm;
  else {
    // watching: keep the whole field on screen, zooming out as it spreads
    lead = r.cpus.reduce((a, b) => (b.c.x > a.c.x ? b : a));
    const xs = r.cpus.map(({ c }) => c.x), hi = Math.max(...xs), lo = Math.min(...xs);
    ppm = Math.max(8, Math.min(ppm, (W * 0.7) / (hi - lo + 4)));
    camX = (hi + lo) / 2 - (W * 0.5) / ppm;
  }
  const sx = (x) => (x - camX) * ppm;
  const goal = r.drill ? r.drill.dist : DIST;

  surface(L, sx(me ? me.x : lead.c.x), top + ((me ? r.myLane : lead.lane) - 0.5) * laneH);
  // distance marks every 10 m, start and finish lines
  ctx.font = mono(11, 400); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (let m = 0; m <= goal; m += 10) {
    const x = sx(m); if (x < -40 || x > W + 40) continue;
    const isEnd = m === 0 || m === goal;
    // the finish line brightens, slowly, as you close on it
    const near = m === goal && (me ? me.finish == null && goal - me.x < 15 : lead.c.finish == null && goal - lead.c.x < 15);
    ctx.globalAlpha = near ? look.pulse(r.t) : 1;
    ctx.strokeStyle = near ? look.FLOOR.hot : isEnd ? look.FLOOR.line : LINE; ctx.lineWidth = isEnd ? 3 : 1;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    ctx.globalAlpha = 1;
    if (isEnd) look.tag(ctx, x, top - 14, m === goal && !r.drill ? 'finish' : `${m} m`, { size: 10, pad: 4 });
    else { ctx.fillStyle = look.FLOOR.mark; ctx.fillText(`${m} m`, x, top - 8); }
  }
  // lane numbers on the left
  ctx.textAlign = 'left'; ctx.font = mono(12, 400);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i + 1 === r.myLane ? FG : look.FLOOR.mark; ctx.fillText(String(i + 1), 10, top + i * laneH + laneH * 0.6); }

  // runners: the field dark with a light rim, you light. In CPU vs CPU every dummy runs light, lettered
  const clock = r.phase === 'after' ? r.t + r.phaseT : r.t;
  for (const { c, lane, name } of r.cpus) {
    const x = sx(c.x), y = top + (lane - 0.15) * laneH;
    figure(x, y, laneH, c.ph, c.lean, r.watch ? 0 : 1, false, c.dipping(clock), false, c.x <= 0.01);
    if (r.watch) look.tag(ctx, x - 22, top + (lane - 0.55) * laneH, name.slice(-1), { size: 10, pad: 4, align: 'right' });
  }
  if (me) {
    const myX = sx(me.x), myY = top + (r.myLane - 0.15) * laneH;
    figure(myX, myY, laneH, me.x * 1.35, r.lean, 0, true, me.dipAt != null && r.t - me.dipAt < 0.45, me.stumble > 0, me.x <= 0.01);
    look.tag(ctx, myX - 22, top + (r.myLane - 0.55) * laneH, 'you', { size: 10, pad: 4, align: 'right' });
  }

  if (me) hud(r, me, L); else watchHud(r, L);
  if (mode !== 'race') menuBar();
}
/* the track: a dark run-off, the lanes on it, and a pool of light where you are */
function surface({ top, bottom, laneH }, x, y) {
  ctx.fillStyle = look.FLOOR.edge; ctx.fillRect(0, top - 6, W, bottom - top + 12);
  ctx.fillStyle = look.FLOOR.base; ctx.fillRect(0, top, W, bottom - top);
  look.spot(ctx, x, y, Math.max(160, W * 0.32), Math.max(40, laneH * 2.6));
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const yy = Math.round(top + i * laneH) + 0.5;
    ctx.strokeStyle = i === 0 || i === 8 ? look.FLOOR.line : LINE;
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
  }
}
/* a runner side-on: chunky limbs in the side's tones, a shaded torso and head, bands at the ankles */
function figure(x, footY, laneH, phase, lean, side, isMe, dipping = false, stumble = false, still = false) {
  if (x < -60 || x > W + 60) return;
  const T = look.team(side);
  const h = Math.min(laneH * 0.82, 70);
  const swing = Math.sin(phase) * 0.9;
  const tilt = (dipping ? 0.9 : lean * 0.55) + (stumble ? 0.4 : 0);
  ctx.save(); ctx.translate(x, footY);
  if (isMe) look.ring(ctx, 0, 0, h * 0.42, Math.max(3, h * 0.09));
  const hipY = -h * 0.48, leg = h * 0.48;
  const end = (a, len, ox, oy) => [ox + Math.sin(a) * len, oy + Math.cos(a) * len];
  const line = (a, b) => () => { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); };
  const hip = [0, hipY];
  const footA = end(still ? 0.2 : swing, leg, 0, hipY), footB = end(still ? -0.2 : -swing, leg, 0, hipY);
  const torsoLen = h * 0.36, nx = Math.sin(tilt) * torsoLen, ny = hipY - Math.cos(tilt) * torsoLen;
  const sh = [nx * 0.85, ny + h * 0.04];
  const handA = end(still ? 0.3 : -swing * 1.1, h * 0.3, sh[0], sh[1]), handB = end(still ? -0.3 : swing * 1.1, h * 0.3, sh[0], sh[1]);
  const legW = Math.max(3, h * 0.12), armW = Math.max(2.5, h * 0.085), bandR = Math.max(1.8, h * 0.05);
  // far arm and leg first, a touch darker, then the torso, then the near side
  look.strokeLimb(ctx, line(sh, handB), armW, T, [T.skin[1], T.skin[2], T.skin[2]]);
  look.strokeLimb(ctx, line(hip, footB), legW, T, [T.suit[1], T.suit[2], T.suit[2]]);
  look.band(ctx, footB[0], footB[1], bandR, T);
  // torso: a shaded block from hip to neck
  const tw = Math.max(2.5, h * 0.085), px = Math.cos(tilt) * tw, py = Math.sin(tilt) * tw;
  const torso = () => { ctx.moveTo(-px, hipY - py); ctx.lineTo(px, hipY + py); ctx.lineTo(nx + px, ny + py); ctx.lineTo(nx - px, ny - py); ctx.closePath(); };
  look.fillBody(ctx, torso, T, T.suit, [nx - tw, ny, tw, hipY]);
  look.strokeLimb(ctx, line(hip, footA), legW, T, T.suit);
  look.band(ctx, footA[0], footA[1], bandR, T);
  look.strokeLimb(ctx, line(sh, handA), armW, T, T.skin);
  look.ball(ctx, nx + Math.sin(tilt) * h * 0.09, ny - Math.cos(tilt) * h * 0.09, Math.max(3, h * 0.09), T, T.skin);
  ctx.restore();
}
function place(r) {
  const me = r.me;
  if (me.finish != null) return 1 + r.cpus.filter(({ c }) => c.finish != null && c.finish < me.finish).length;
  return 1 + r.cpus.filter(({ c }) => c.x > me.x).length;
}

/* on your marks / set stay up as the status stamp; a false start or a rep grade is stamped once */
function stamps(r) {
  if (seenRace !== r || (r.phase === 'marks' && r.phaseT < 0.05)) { seenRace = r; seenFinish = null; seenGun = false; }
  HUD.msg(r.phase === 'marks' || r.phase === 'set' ? r.msg : '');
  if (r.flash && flashKey(r) !== seenFlash && (r.phase === 'marks' || r.phase === 'set')) HUD.call(r.flash.startsWith('False') ? 'False start' : r.flash.split('.')[0], r.flash.startsWith('False') ? r.flash.replace(/^False start\.?\s*/, '') : r.flash.split('. ').slice(1).join('. '));
  seenFlash = flashKey(r);
  if (r.flash && r.phase !== 'marks' && r.phase !== 'set') r.flash = '';
  if (r.phase === 'run' && !seenGun) { seenGun = true; look.cheer(0.4); }
}
/* CPU vs CPU: the winner stamped once, and one tag per dummy with its style and seed */
function watchHud(r, L) {
  board(r);
  stamps(r);
  const fin = r.cpus.filter(({ c }) => c.finish != null);
  if (fin.length && seenFinish == null) {
    const w = fin.reduce((a, b) => (b.c.finish < a.c.finish ? b : a));
    seenFinish = w.c.finish; HUD.call(`${w.name} wins`, `${w.c.finish.toFixed(2)} s`, true); look.cheer(0.8);
  }
  const list = r.cpus.slice().sort((a, b) => a.lane - b.lane);
  const cols = Math.max(1, Math.min(4, Math.floor((W - 24) / 270))), rows = Math.ceil(list.length / cols), lh = Math.min(20, L.ph / rows);
  list.forEach((x, i) => look.tag(ctx, 16 + Math.floor(i / rows) * 270, L.y0 + lh * 0.5 + (i % rows) * lh, dummyLabel(x.name.toLowerCase(), x.d), { size: 9, pad: 4, align: 'left' }));
  const pad = input.lastDevice === 'controller';
  HUD.bar('watching', [{ k: pad ? 'options' : 'P / esc', t: 'pause', open: true }], `cpu vs cpu · ${r.level.name}. the next race starts by itself`);
}
/* ---------------- HUD: the scoreboard, calls and button bar live on the page, around the stage ---------------- */
function board(r) {
  if (!r) { HUD.board({ a: { name: 'you', sub: look.bandWord(0), score: '0.0' }, b: { name: 'field', sub: look.bandWord(1), score: '0.0' }, clock: '0.00' }); return; }
  const live = r.phase !== 'marks' && r.phase !== 'set';
  if (!r.me) {
    // CPU vs CPU: the leader against the runner-up, speed in the boxes
    const [a, b] = r.cpus.slice().sort((p, q) => q.c.x - p.c.x);
    const done = r.cpus.map(({ c }) => c.finish).filter((f) => f != null);
    const t = r.phase === 'run' || r.phase === 'after' ? (done.length ? Math.min(...done) : r.t) : 0;
    HUD.board({
      a: { name: a.name.toLowerCase(), sub: `lane ${a.lane} · m/s`, score: a.c.v.toFixed(1), has: live },
      b: { name: b.name.toLowerCase(), sub: `lane ${b.lane} · m/s`, score: b.c.v.toFixed(1) },
      clock: t.toFixed(2)
    });
    return;
  }
  const me = r.me, t = r.phase === 'run' || r.phase === 'after' ? (me.finish ?? r.t) : 0;
  const togo = Math.max(0, (r.drill ? r.drill.dist : DIST) - me.x).toFixed(0);
  if (r.drill || !r.cpus.length) {
    HUD.board({
      a: { name: 'you', sub: `${look.bandWord(0)} · m/s`, score: me.v.toFixed(1) },
      b: { name: r.drill ? `${r.drill.name} drill` : 'to go', sub: r.drill && r.reps > 1 ? `rep ${Math.min(r.rep + 1, r.reps)}/${r.reps} · m to go` : 'm to go', score: togo },
      clock: t.toFixed(2)
    });
    return;
  }
  // you against whoever leads the field, speed in the boxes, a dot on whoever is in front
  const lead = r.cpus.reduce((a, b) => (b.c.x > a.c.x ? b : a));
  const ahead = me.x >= lead.c.x;
  HUD.board({
    a: { name: 'you', sub: `${look.bandWord(0)} · m/s`, score: me.v.toFixed(1), has: live && ahead },
    b: { name: `lane ${lead.lane}`, sub: `${look.bandWord(1)} · m/s`, score: lead.c.v.toFixed(1), has: live && !ahead },
    clock: t.toFixed(2)
  });
}
function menuBar() {
  const pad = input.lastDevice === 'controller';
  HUD.bar(mode === 'paused' ? 'paused' : mode === 'results' ? 'results' : 'menu', pad ? [{ k: '↕', t: 'pick' }, { k: '✕', t: 'choose', open: true }, { k: '○', t: 'back' }] : [{ k: '↕', t: 'pick' }, { k: 'enter', t: 'choose', open: true }, { k: 'esc', t: 'back' }]);
}
function hud(r, me, L) {
  board(r);
  stamps(r);
  if (!r.drill && me.finish != null && seenFinish !== me.finish) {
    seenFinish = me.finish; const pl = place(r);
    HUD.call(ordinal(pl), `${me.finish.toFixed(2)} s`, true); look.cheer(pl === 1 ? 0.9 : 0.6);
  }

  // on the canvas: trigger pads, lean gauge, last strides
  const s = input.state, pad = input.lastDevice === 'controller';
  const { y0, ph } = L, pw = Math.min(110, Math.max(64, W * 0.11));
  const nextL = me.lastSide === 1 || me.lastSide === 0, nextR = me.lastSide === -1 || me.lastSide === 0;
  trigPad(16, y0, pw, ph, pad ? 'L2' : 'F', s.lt, nextL);
  trigPad(24 + pw, y0, pw, ph, pad ? 'R2' : 'J', s.rt, nextR);
  const gx = 40 + pw * 2, gw = Math.min(160, Math.max(110, W * 0.15));
  leanGauge(gx, y0, gw, ph, r.lean, idealLean(me.x));
  strides(gx + gw + 16, y0, ph, r.ticks);

  // what the buttons do right now
  const c = (k, t, open) => ({ k, t, open });
  const running = r.phase === 'run' && me.finish == null, goal = r.drill ? r.drill.dist : DIST;
  const nearLine = running && !r.drill && goal - me.x < 8 && me.dipAt == null;
  const chips = pad
    ? [c('L2', 'stride', running && nextL), c('R2', 'stride', running && nextR), c('L↕', 'lean'), c('✕', 'dip', nearLine)]
    : [c('F', 'stride', running && nextL), c('J', 'stride', running && nextR), c('W S', 'lean'), c('space', 'dip', nearLine)];
  const togo = Math.max(0, goal - me.x).toFixed(0);
  let label, note;
  if (r.phase === 'marks' || r.phase === 'set') { label = r.phase === 'set' ? 'set' : 'on your marks'; note = 'wait for the gun. set your lean low and forward'; }
  else if (running) { label = r.drill ? `${r.drill.name} drill` : r.level.name; note = r.drill ? `${togo} m to go` : `${ordinal(place(r))} · ${togo} m to go${goal - me.x < 8 ? ' · dip just before the line' : ''}`; }
  else { label = 'finished'; note = me.finish != null ? `${me.finish.toFixed(2)} s` : ''; }
  HUD.bar(label, chips, note);
}
/* a black panel with its name in a tag, the on-canvas meter style */
function panel(x, y, w, h, name) {
  ctx.fillStyle = BG; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = EDGE; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (name) look.tag(ctx, x + 6, y, name, { size: 9, pad: 4, align: 'left' });
}
function trigPad(x, y, w, h, name, v, next) {
  panel(x, y, w, h);
  ctx.fillStyle = 'rgba(236,236,236,.16)'; ctx.fillRect(x + 1, y + h - 1 - (h - 2) * v, w - 2, (h - 2) * v);
  // the trigger that strides next gets the bright frame
  if (next) { ctx.strokeStyle = FG; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); }
  ctx.fillStyle = next ? FG : MUTED; ctx.font = mono(16, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name, x + w / 2, y + h / 2 + 2); ctx.textBaseline = 'alphabetic';
}
function leanGauge(x, y, w, h, lean, ideal) {
  panel(x, y, w, h, 'lean');
  const bx = x + 14, bw = w - 28, by = y + h * 0.52;
  ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
  // ideal: a hollow box, you: a filled block, so it reads without colour
  ctx.strokeStyle = FG; ctx.lineWidth = 1.5; ctx.strokeRect(bx + ideal * bw - 7, by - 11, 14, 22);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + lean * bw - 3, by - 15, 6, 30);
  ctx.font = mono(10, 400); ctx.fillStyle = MUTED; ctx.textAlign = 'left'; ctx.fillText('tall', bx, y + h - 7);
  ctx.textAlign = 'right'; ctx.fillText('low', bx + bw, y + h - 7);
}
function strides(x, y, h, ticks) {
  const w = 200; if (x + w > W - 12) return;
  panel(x, y, w, h, 'last strides');
  const base = y + h - 10, tall = h - 30;
  ticks.forEach((q, i) => {
    const cx = x + 18 + i * 18, bh = q < 0 ? 6 : 6 + tall * q;
    if (q < 0) { ctx.fillStyle = FG; ctx.font = mono(14, 600); ctx.textAlign = 'center'; ctx.fillText('×', cx, base); return; }
    ctx.fillStyle = q > 0.85 ? FG : '#8f8f8f'; ctx.fillRect(cx - 5, base - bh, 10, bh);
  });
}
function drawIdle(L) {
  // a quiet, empty track behind the menus
  surface(L, W * 0.5, L.top + 4.5 * L.laneH);
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

function rand(a, b) { return a + Math.random() * (b - a); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function ordinal(n) { return n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th'); }
