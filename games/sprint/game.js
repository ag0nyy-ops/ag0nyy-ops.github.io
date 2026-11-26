/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Sprint: 100 m in the browser. Alternate the triggers to stride, set your lean with the left
   stick, dip at the line. Training drills grade your starts, rhythm and lean, and your best grade
   in each builds your athlete, so getting better means training well, not training a lot. */

import { Input } from '../shared/input.js';
import { loadSettings, palette, reducedMotion } from '../shared/settings.js';
import { Runner, Pacer, athlete, idealGap, idealLean, LEVELS, DIST } from './sim.js';

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
  overlay.innerHTML = html; overlay.hidden = false; if (backLink) backLink.hidden = false;
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
    <div class="menu">${lv}<button class="btn" data-go="train">Training</button><button class="btn" data-go="controls">Controls</button></div>
    <h2 class="label">Your athlete</h2>${statBars()}
    <p class="hint">Train to fill the bars. Only your best grade in each drill counts, so there is nothing to grind.</p>`);
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
const canvas = $('#c'), ctx = canvas.getContext('2d');

function newRace(kind, arg) {
  const me = new Runner(athlete(stats()));
  const drill = kind === 'drill' ? DRILLS.find((d) => d.id === arg) : null;
  const level = kind === 'race' ? LEVELS.find((l) => l.id === arg) : null;
  const field = level ? shuffle(level.field.slice()).map((t) => new Pacer(t + rand(-0.06, 0.06), rand(0.13, 0.2))) : [];
  const lanes = [1, 2, 3, 4, 5, 6, 7, 8];
  const myLane = level ? 4 : 4;
  const others = lanes.filter((l) => l !== myLane);
  race = {
    kind, drill, level, me, myLane, rep: 0, reps: drill ? drill.reps : 1, repResults: [],
    pacers: field.map((p, i) => ({ p, lane: others[i] })),
    phase: 'marks', phaseT: 0, gunAt: 0, t: -10, falseStarts: 0, reaction: null, msg: 'On your marks',
    trig: { L: arm(), R: arm() }, lean: 0.5, lastGrade: null, ticks: []
  };
  startRep();
  mode = 'race'; hide();
}
function startRep() {
  const r = race; r.me.reset(); r.phase = 'marks'; r.phaseT = 0; r.reaction = null; r.ticks = [];
  r.setFor = 1.2 + rand(0.6, 1.8); r.msg = 'On your marks'; r.t = -10; r.lean = 0.85;
  r.pacers.forEach(({ p }) => { p.x = 0; p.v = 0; p.finish = null; });
}
const arm = () => ({ armed: true, pressing: false, start: 0, max: 0 });

function go(what, arg) {
  audio();
  if (what === 'menu') mainMenu();
  else if (what === 'train') trainMenu();
  else if (what === 'controls') controls();
  else if (what === 'race') newRace('race', arg);
  else if (what === 'drill') newRace('drill', arg);
  else if (what === 'again') newRace(race.kind, race.kind === 'race' ? race.level.id : race.drill.id);
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
  if (mode === 'menu' || mode === 'results' || mode === 'paused') return menuInput();
  if (mode !== 'race') return;
  const r = race, me = r.me;
  if (input.pressed('START') || input.pressed('B')) { pause(); return; }
  r.phaseT += dt;

  // lean: controller sets it directly, keyboard nudges it and it stays
  const s = input.state;
  if (input.lastDevice === 'controller') r.lean += ((0.5 - s.ly * 0.5) - r.lean) * Math.min(1, dt * 14);
  else if (s.ly) r.lean = Math.max(0, Math.min(1, r.lean - s.ly * dt * 1.4));
  me.lean = r.lean;

  if (r.phase === 'marks' && r.phaseT > 1.2) { r.phase = 'set'; r.phaseT = 0; r.msg = 'Set'; beep(440, 0.06, 'sine', 0.15); }
  if (r.phase === 'set' && r.phaseT > r.setFor) { r.phase = 'run'; r.phaseT = 0; r.t = 0; r.msg = ''; gun(); }
  const now = r.phase === 'run' ? r.t : -1;

  const L = readTrigger(r.trig.L, s.lt, performance.now() / 1000);
  const R = readTrigger(r.trig.R, s.rt, performance.now() / 1000);
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
  if (r.phase === 'run' && input.pressed('A')) me.dip(now);

  if (r.phase === 'run') {
    r.t += dt;
    me.step(dt, r.t);
    r.pacers.forEach(({ p }) => p.at(r.t));
    const goal = r.drill ? r.drill.dist : DIST;
    const done = r.drill ? me.x >= goal : me.finish != null && r.pacers.every(({ p }) => p.finish != null || p.x > DIST);
    if (r.drill && me.x >= goal && me.finish == null) me.finish = r.t;
    if (done && r.phase === 'run') { r.phase = 'after'; r.phaseT = 0; }
  }
  if (r.phase === 'after') {
    me.step(dt, r.t + r.phaseT); r.pacers.forEach(({ p }) => p.at(r.t + r.phaseT));
    if (r.phaseT > 1.1) finishRep();
  }
}
function falseStart() {
  const r = race; r.falseStarts++; beep(140, 0.25, 'sawtooth', 0.2);
  if (r.drill) { r.repResults.push({ reaction: null, score: 0, note: 'False start' }); r.rep++; return r.rep >= r.reps ? drillDone() : (r.flash = 'False start', startRep()); }
  if (r.falseStarts >= 2) { mode = 'results'; return show(`<p class="label">Disqualified</p><h1 class="title">False start</h1><p class="hint">Two false starts and you're out. Wait for the gun.</p><div class="menu"><button class="btn btn--solid" data-go="again">Run it again</button><button class="btn" data-go="menu">Menu</button></div>`); }
  r.flash = 'False start. One more and you are out.'; startRep();
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
function raceDone() {
  const r = race, me = r.me;
  const results = [{ who: 'You', lane: r.myLane, time: me.finish, me: true }, ...r.pacers.map(({ p, lane }) => ({ who: `Lane ${lane}`, lane, time: p.target }))]
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
  show(`<p class="label">Paused</p><div class="menu"><button class="btn btn--solid" data-go="resume">Resume</button><button class="btn" data-go="again">Restart</button><button class="btn" data-go="menu">Quit to menu</button></div>`);
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
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize); resize();

const FG = '#ececec', BG = '#060606', MUTED = 'rgba(236,236,236,.55)', LINE = 'rgba(236,236,236,.16)';
const mono = (px, w = 400) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`;

function draw() {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  if (!race || mode === 'menu') return drawIdle();
  const r = race, me = r.me, pal = palette();
  const top = 92, bottom = H - 150, laneH = (bottom - top) / 8;
  const ppm = Math.max(26, Math.min(64, W / 26));               // pixels per metre
  const camX = me.x - (W * 0.3) / ppm;
  const sx = (x) => (x - camX) * ppm;

  // lanes
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) { const y = top + i * laneH; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // distance marks every 10 m, start and finish lines
  ctx.font = mono(11); ctx.fillStyle = MUTED; ctx.textAlign = 'center';
  const goal = r.drill ? r.drill.dist : DIST;
  for (let m = 0; m <= goal; m += 10) {
    const x = sx(m); if (x < -40 || x > W + 40) continue;
    const isEnd = m === 0 || m === goal;
    ctx.strokeStyle = isEnd ? FG : LINE; ctx.lineWidth = isEnd ? 3 : 1;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    ctx.fillText(m === goal && !r.drill ? 'FINISH' : `${m} m`, x, top - 10);
  }
  // lane numbers on the left
  ctx.textAlign = 'left'; ctx.font = mono(12);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i + 1 === r.myLane ? FG : MUTED; ctx.fillText(String(i + 1), 10, top + i * laneH + laneH * 0.6); }

  // runners
  for (const { p, lane } of r.pacers) figure(sx(p.x), top + (lane - 0.15) * laneH, laneH, p.x, 0.25 + Math.max(0, 0.5 - p.x / 60), MUTED, false);
  figure(sx(me.x), top + (r.myLane - 0.15) * laneH, laneH, me.x, r.lean, pal.mark, true, me.dipAt != null && r.t - me.dipAt < 0.45, me.stumble > 0);
  ctx.fillStyle = pal.mark; ctx.font = mono(11, 600); ctx.textAlign = 'center';
  ctx.fillText('YOU', sx(me.x), top + (r.myLane - 1) * laneH + 12);

  hud(r, me, pal);
}
function figure(x, footY, laneH, dist, lean, color, isMe, dipping = false, stumble = false) {
  if (x < -60 || x > W + 60) return;
  const h = Math.min(laneH * 0.82, 70), phase = dist * 1.35;
  const swing = Math.sin(phase) * 0.9, still = dist <= 0.01;
  const tilt = (dipping ? 0.9 : lean * 0.55) + (stumble ? 0.4 : 0);
  ctx.save(); ctx.translate(x, footY); ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = isMe ? 3 : 2; ctx.lineCap = 'round';
  const hipY = -h * 0.48, leg = h * 0.48;
  const limb = (a, len, ox, oy) => { ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.sin(a) * len, oy + Math.cos(a) * len); ctx.stroke(); };
  limb(still ? 0.2 : swing, leg, 0, hipY); limb(still ? -0.2 : -swing, leg, 0, hipY);
  const torsoLen = h * 0.36, nx = Math.sin(tilt) * torsoLen, ny = hipY - Math.cos(tilt) * torsoLen;
  ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(nx, ny); ctx.stroke();
  limb(Math.PI + (still ? 0.3 : -swing * 1.1), h * 0.3, nx * 0.85, ny + h * 0.04);
  limb(Math.PI + (still ? -0.3 : swing * 1.1), h * 0.3, nx * 0.85, ny + h * 0.04);
  ctx.beginPath(); ctx.arc(nx + Math.sin(tilt) * h * 0.08, ny - Math.cos(tilt) * h * 0.08, h * 0.08, 0, Math.PI * 2);
  isMe ? ctx.fill() : ctx.stroke();
  ctx.restore();
}
function hud(r, me, pal) {
  const t = r.phase === 'run' || r.phase === 'after' ? (me.finish ?? r.t) : 0;
  ctx.textAlign = 'left'; ctx.fillStyle = FG; ctx.font = mono(34, 600);
  ctx.fillText(t.toFixed(2), 20, 50);
  ctx.font = mono(12); ctx.fillStyle = MUTED;
  const label = r.drill ? `${r.drill.name.toUpperCase()} DRILL${r.reps > 1 ? ` · REP ${r.rep + 1}/${r.reps}` : ''}` : r.level.name.toUpperCase();
  ctx.fillText(label, 20, 72);
  ctx.textAlign = 'right'; ctx.font = mono(22, 600); ctx.fillStyle = FG;
  ctx.fillText(`${me.v.toFixed(1)} m/s`, W - 20, 46);
  ctx.font = mono(12); ctx.fillStyle = MUTED;
  ctx.fillText(`${Math.max(0, (r.drill ? r.drill.dist : DIST) - me.x).toFixed(0)} m to go`, W - 20, 68);

  // big call in the middle: on your marks / set / false start
  const msg = r.msg || (r.flash && r.phase !== 'run' ? r.flash : '');
  if (msg) { ctx.textAlign = 'center'; ctx.font = mono(Math.min(56, W / 14), 600); ctx.fillStyle = FG; ctx.fillText(msg, W / 2, H * 0.45); }
  if (r.flash && r.phase !== 'marks' && r.phase !== 'set') r.flash = '';
  if ((r.phase === 'marks' || r.phase === 'set') && r.flash) { ctx.font = mono(14); ctx.fillStyle = MUTED; ctx.textAlign = 'center'; ctx.fillText(r.flash, W / 2, H * 0.45 + 34); }

  // bottom panel: trigger pads, lean gauge, last strides
  const y0 = H - 128;
  const s = input.state;
  pad(20, y0, 'L2', s.lt, me.lastSide === 1 || me.lastSide === 0, pal);
  pad(150, y0, 'R2', s.rt, me.lastSide === -1 || me.lastSide === 0, pal);
  leanGauge(300, y0, r.lean, idealLean(me.x), pal);
  strides(470, y0, r.ticks);
  ctx.textAlign = 'right'; ctx.font = mono(11); ctx.fillStyle = MUTED;
  if (W > 760) ctx.fillText(input.lastDevice === 'controller' ? 'L2 R2 stride · left stick lean · cross dip' : 'F J stride · W S lean · space dip', W - 20, H - 18);
}
function pad(x, y, name, v, next, pal) {
  ctx.strokeStyle = next ? pal.mark : LINE; ctx.lineWidth = next ? 2 : 1; ctx.strokeRect(x, y, 110, 96);
  ctx.fillStyle = 'rgba(236,236,236,.14)'; ctx.fillRect(x + 1, y + 95 - 94 * v, 108, 94 * v);
  ctx.fillStyle = next ? FG : MUTED; ctx.font = mono(16, 600); ctx.textAlign = 'center'; ctx.fillText(name, x + 55, y + 54);
}
function leanGauge(x, y, lean, ideal, pal) {
  ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.strokeRect(x, y, 140, 96);
  ctx.font = mono(10); ctx.fillStyle = MUTED; ctx.textAlign = 'left'; ctx.fillText('LEAN', x + 8, y + 16);
  const bx = x + 14, bw = 112, by = y + 54;
  ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
  // ideal: a hollow box, you: a filled block, so it reads without colour
  ctx.strokeStyle = FG; ctx.strokeRect(bx + ideal * bw - 7, by - 12, 14, 24);
  ctx.fillStyle = pal.mark; ctx.fillRect(bx + lean * bw - 3, by - 16, 6, 32);
  ctx.fillStyle = MUTED; ctx.fillText('tall', bx, y + 88); ctx.textAlign = 'right'; ctx.fillText('low', bx + bw, y + 88);
}
function strides(x, y, ticks) {
  if (W < 640) return;
  ctx.strokeStyle = LINE; ctx.strokeRect(x, y, 200, 96);
  ctx.font = mono(10); ctx.fillStyle = MUTED; ctx.textAlign = 'left'; ctx.fillText('LAST STRIDES', x + 8, y + 16);
  ticks.forEach((q, i) => {
    const cx = x + 18 + i * 18, h = q < 0 ? 6 : 6 + 50 * q;
    if (q < 0) { ctx.fillStyle = FG; ctx.font = mono(14, 600); ctx.fillText('×', cx - 5, y + 84); return; }
    ctx.fillStyle = q > 0.85 ? FG : MUTED; ctx.fillRect(cx - 5, y + 84 - h, 10, h);
  });
}
function drawIdle() {
  // a quiet track behind the menus
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) { const y = H * 0.55 + i * 22; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
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

function rand(a, b) { return a + Math.random() * (b - a); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function ordinal(n) { return n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th'); }
