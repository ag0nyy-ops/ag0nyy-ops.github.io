/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Bucket: the game rules and the court, with no drawing, sound or DOM in here.
   Everything moves through step(match, dt, intents): each player gets an intent object per frame,
   from a controller (game.js), from the CPU (cpuIntent below) or, later, from another browser.
   Units are feet and seconds. x runs across the court (-25..25), y from the baseline (0) to half
   court (47), z is height. The hoop is at the baseline end. */

export const COURT = Object.freeze({
  W: 25, L: 47,
  RIM: Object.freeze({ x: 0, y: 5.25, z: 10 }), RIM_R: 0.75, BOARD_Y: 4,
  ARC: 23.75, CORNER: 22, CORNER_Y: 14,
  PAINT_W: 8, FT_Y: 19, CHECK: Object.freeze({ x: 0, y: 32 })
});
const { RIM } = COURT;
const G = 32;                  // gravity, ft/s²
const BODY = 1.15;             // player radius
const CLOCK = 14;              // shot clock

export const SIZES = [1, 2, 3];
export const CPU = Object.freeze({
  rookie: { name: 'Rookie', shoot: 0.8, lag: 0.22, speed: 0.9, gap: 3.8, steal: 0.12, iq: 0.55 },
  pro:    { name: 'Pro',    shoot: 1.0, lag: 0.13, speed: 0.97, gap: 3.3, steal: 0.22, iq: 0.8 },
  legend: { name: 'Legend', shoot: 1.12, lag: 0.07, speed: 1.02, gap: 2.9, steal: 0.32, iq: 1 }
});

/* shot kinds: how big the drop target is, how long you hang, how far off the hands start */
export const SHOTS = Object.freeze({
  dunk:   { name: 'Dunk',   target: 1.9, hang: 0.85, spread: 0.6 },
  layup:  { name: 'Layup',  target: 1.4, hang: 1.05, spread: 1.1 },
  jumper: { name: 'Jumper', target: 1.0, hang: 1.7, spread: 1.4 }
});

export const rimDist = (x, y) => Math.hypot(x - RIM.x, y - RIM.y);
export function isThree(x, y) {
  return y <= COURT.CORNER_Y ? Math.abs(x) >= COURT.CORNER : rimDist(x, y) >= COURT.ARC;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const len = (x, y) => Math.hypot(x, y);
function norm(x, y) { const m = Math.hypot(x, y) || 1; return [x / m, y / m]; }

/* small seeded random so a match can be replayed or synced later */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* where players stand on offense, by team size */
const SPOTS = {
  1: [[0, 30]],
  2: [[0, 30], [-17, 19], [17, 19]],
  3: [[0, 30], [-18, 12], [18, 12], [-12, 26], [12, 26]]
};

export function blankIntent() {
  return { mx: 0, my: 0, shoot: false, pass: false, passDir: null, call: false, flick: null,
    hands: 0, aimG: [0, 0], aimS: [0, 0], aimNudge: [0, 0] };
}

export function createMatch(cfg = {}) {
  const c = { size: 1, cpu: 'pro', to: 11, practice: false, seed: (Math.random() * 1e9) | 0, ...cfg };
  if (c.practice) c.size = 1;
  const m = {
    cfg: c, rand: rng(c.seed), t: 0, players: [], score: [0, 0], poss: 0, phase: 'check', phaseT: 0,
    clock: CLOCK, cleared: true, ball: { holder: null, x: 0, y: 30, z: 4, vx: 0, vy: 0, vz: 0, mode: 'held', pass: null, flight: null, lastTeam: 0, touched: false, deadT: 0 },
    shot: null, events: [], winner: null, timeScale: 1, practice: c.practice ? { att: 0, made: 0, zones: {} } : null, msg: '', msgT: 0
  };
  const teams = c.practice ? [0] : [0, 1];
  for (const team of teams) for (let i = 0; i < c.size; i++) {
    m.players.push({ id: m.players.length, team, slot: i, x: 0, y: 30, z: 0, vx: 0, vy: 0, vz: 0, face: -Math.PI / 2,
      hands: 0, stun: 0, lunge: 0, moveCd: 0, moveT: 0, moveDir: [0, 0], moveTimes: [], burst: 0, handT: 0,
      seenX: 0, seenY: 0, mark: null, spot: 0, cut: 0, screen: null, screenT: 0, wantT: 0, think: 0, plan: null, stride: 0, jumpCd: 0 });
  }
  for (const p of m.players) {
    const opp = m.players.filter((q) => q.team !== p.team);
    p.mark = opp.length ? opp[p.slot % opp.length].id : null;
  }
  setupCheck(m, 0);
  return m;
}

export const handler = (m) => (m.ball.holder != null ? m.players[m.ball.holder] : null);
const mates = (m, p) => m.players.filter((q) => q.team === p.team && q !== p);
const foes = (m, p) => m.players.filter((q) => q.team !== p.team);
function say(m, text, t = 1.4) { m.msg = text; m.msgT = t; }
function emit(m, type, data = {}) { m.events.push({ type, ...data }); }

function setupCheck(m, team) {
  m.poss = team; m.phase = 'check'; m.phaseT = m.practice ? 0.3 : 1.1; m.clock = CLOCK; m.cleared = true; m.shot = null;
  const spots = SPOTS[m.cfg.size];
  const off = m.players.filter((p) => p.team === team), def = m.players.filter((p) => p.team !== team);
  off.forEach((p, i) => { const s = i === 0 ? spots[0] : spots[i * 2 - 1 + (m.rand() < 0.5 ? 0 : 1)] || spots[i];
    place(p, s[0], s[1]); p.spot = spots.indexOf(s); });
  for (const p of def) { const man = m.players[p.mark]; const [ux, uy] = norm(RIM.x - man.x, RIM.y - man.y);
    place(p, man.x + ux * 4, man.y + uy * 4); }
  const b = m.ball; b.holder = off[0].id; b.mode = 'held'; b.flight = null; b.pass = null; b.touched = false; b.lastTeam = team;
  if (!m.practice) say(m, 'Check', 1.1);
}
function place(p, x, y) { p.x = x; p.y = y; p.z = 0; p.vx = p.vy = p.vz = 0; p.seenX = x; p.seenY = y; p.stun = 0; p.lunge = 0; p.burst = 0;
  p.screen = null; p.cut = 0; p.face = Math.atan2(RIM.y - y, RIM.x - x); }

/* ---------------------------------------------------------------- contest and odds */
/* How well the defense is covering this shooter right now, 0..1. Distance, being in front,
   hands up and being in the air all count. It is recomputed every frame of a shot. */
export function contestOn(m, s) {
  let best = 0;
  const [rx, ry] = norm(RIM.x - s.x, RIM.y - s.y);
  for (const d of foes(m, s)) {
    const dist = len(d.x - s.x, d.y - s.y);
    if (dist > 6.5 || d.stun > 0) continue;
    const near = clamp((6.5 - dist) / 4.5, 0, 1);
    const [ox, oy] = norm(d.x - s.x, d.y - s.y);
    const front = clamp(0.35 + 0.65 * (ox * rx + oy * ry), 0.15, 1);
    const hands = 0.45 + 0.55 * d.hands, air = d.z > 0.6 ? 1.3 : 1;
    best = Math.max(best, near * front * hands * air);
  }
  return clamp(best, 0, 1);
}
function shotKind(p, speedToRim) {
  const d = rimDist(p.x, p.y);
  if (d < 4.2 && speedToRim > 9) return 'dunk';
  if (d < 7) return 'layup';
  return 'jumper';
}
/* make chance for a CPU shot */
function cpuOdds(m, p, contest, kind) {
  const d = rimDist(p.x, p.y);
  let base = kind === 'dunk' ? 0.9 : kind === 'layup' ? 0.68 : d < 16 ? 0.5 : !isThree(p.x, p.y) ? 0.43 : d < 27 ? 0.37 : 0.2;
  const skill = p.team === 1 || m.cfg.practice ? CPU[m.cfg.cpu].shoot : 1;
  return clamp(base * skill * (1 - 0.62 * contest), 0.02, 0.97);
}

/* ---------------------------------------------------------------- the step */
export function step(m, dt, intents) {
  m.events = [];
  const aiming = m.shot && m.shot.human && m.shot.phase !== 'gone';
  m.timeScale = aiming ? 0.28 : 1;          // the world crawls while you line up a shot
  const wdt = dt * m.timeScale;
  m.t += wdt;
  if (m.msgT > 0) m.msgT -= dt;

  if (m.phase === 'over') return;
  if (m.phase === 'check') {
    m.phaseT -= wdt;
    for (const p of m.players) settle(p, wdt);
    holdBall(m);
    if (m.phaseT <= 0) { m.phase = 'live'; emit(m, 'live'); }
    return;
  }
  if (m.phase === 'dead') {
    m.phaseT -= wdt; ballPhysics(m, wdt); for (const p of m.players) settle(p, wdt);
    if (m.phaseT <= 0) afterDead(m);
    return;
  }

  for (const p of m.players) {
    const it = intents[p.id] || blankIntent();
    act(m, p, it, wdt, dt);
  }
  collide(m);
  if (m.shot) shotTick(m, intents[m.shot.id] || blankIntent(), dt, wdt);
  ballTick(m, wdt);

  // clearing, shot clock
  const h = handler(m);
  if (h && h.team === m.poss && !m.cleared && isThree(h.x, h.y)) { m.cleared = true; emit(m, 'cleared'); say(m, 'Cleared', 0.8); }
  if (!m.practice && (m.ball.mode === 'held' || m.ball.mode === 'pass') && !m.shot) {
    m.clock -= wdt;
    if (m.clock <= 0) { emit(m, 'violation'); say(m, 'Shot clock', 1.4); turnover(m, 1 - m.poss, 0.9); }
  }
}

function settle(p, dt) {
  p.vx *= Math.max(0, 1 - 10 * dt); p.vy *= Math.max(0, 1 - 10 * dt);
  p.x += p.vx * dt; p.y += p.vy * dt; air(p, dt); p.hands = Math.max(0, p.hands - 3 * dt);
}
function air(p, dt) {
  if (p.z > 0 || p.vz > 0) { p.vz -= G * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; p.vz = 0; p.jumpCd = 0.25; } }
  if (p.jumpCd > 0) p.jumpCd -= dt;
}
function jump(p, power = 14) { if (p.z === 0 && p.jumpCd <= 0 && p.stun <= 0) { p.vz = power; p.z = 0.001; return true; } return false; }

function act(m, p, it, dt, realDt) {
  const b = m.ball, hasBall = b.holder === p.id;
  for (const k of ['stun', 'lunge', 'moveCd', 'burst', 'screenT', 'cut', 'handT']) if (p[k] > 0) p[k] -= dt;
  p.stride += len(p.vx, p.vy) * dt;
  air(p, dt);
  const press = it.shoot && !p.shootHeld; p.shootHeld = it.shoot;
  if (m.shot && m.shot.id === p.id) { p.vx *= 0.9; p.vy *= 0.9; return; }   // the shooter belongs to the shot now
  const onGround = p.z === 0;

  // speed
  const cpu = CPU[m.cfg.cpu];
  let top = hasBall ? 13.2 : 14.6;
  if (p.team === 1 && !m.practice) top *= cpu.speed;
  if (p.hands > 0.5 && !hasBall) top *= 0.76;
  if (p.lunge > 0) top *= 0.4;
  if (p.stun > 0) top *= 0.12;
  if (p.screen && p.screenT > 0) top = 0;
  let [mx, my] = [it.mx, it.my];
  const mag = Math.min(1, len(mx, my));
  if (mag > 1e-3) { const k = mag / len(mx, my); mx *= k; my *= k; }
  let tx = mx * top, ty = my * top;
  if (p.burst > 0) { tx = p.moveDir[0] * 16; ty = p.moveDir[1] * 16; }
  if (onGround) {
    const acc = (p.burst > 0 ? 120 : 58) * dt;
    const dx = tx - p.vx, dy = ty - p.vy, dl = len(dx, dy);
    if (dl > acc) { p.vx += dx / dl * acc; p.vy += dy / dl * acc; } else { p.vx = tx; p.vy = ty; }
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = clamp(p.x, -COURT.W + 0.6, COURT.W - 0.6); p.y = clamp(p.y, 0.6, COURT.L + 2);
  if (len(p.vx, p.vy) > 1.5) p.face = Math.atan2(p.vy, p.vx);
  else if (!hasBall) { const h = handler(m); if (h && h.team !== p.team) p.face = Math.atan2(h.y - p.y, h.x - p.x); }
  const target = hasBall ? 0 : it.hands;
  p.hands += clamp(target - p.hands, -4 * dt, 6 * dt);
  // CPU defenders see the ball handler a beat late; that's what a crossover beats
  const lag = p.team === 1 ? cpu.lag : 0.1;
  const h = handler(m), follow = h || p;
  const a = 1 - Math.exp(-dt / Math.max(0.01, lag));
  p.seenX += (follow.x - p.seenX) * a; p.seenY += (follow.y - p.seenY) * a;

  if (m.phase !== 'live') return;
  if (hasBall) {
    if (it.flick && onGround) dribbleMove(m, p, it.flick);
    if (it.pass && m.cfg.size > 1) passBall(m, p, it.passDir);
    else if (it.call && m.cfg.size > 1) callScreen(m, p);
    if (press && onGround && p.stun <= 0 && b.holder === p.id) startShot(m, p, !!it.human);
  } else {
    if (press) jump(p, b.mode === 'loose' ? 15 : 14);
    if (it.pass && h && h.team !== p.team) swipe(m, p, h);
    if (it.pass && h && h.team === p.team && p.wantT <= 0) { p.wantT = 0.8; emit(m, 'want', { id: p.id }); }
  }
  if (p.wantT > 0) p.wantT -= dt;
}

/* right-stick moves: a quick burst to one side. A defender leaning the other way loses their feet. */
function dribbleMove(m, p, dir) {
  if (p.moveCd > 0 || p.stun > 0) return;
  const [rx, ry] = norm(RIM.x - p.x, RIM.y - p.y);
  let v; let name;
  if (dir === 'left') { v = [-1, 0.15]; name = 'Crossover'; }
  else if (dir === 'right') { v = [1, 0.15]; name = 'Crossover'; }
  else if (dir === 'down') { v = [-rx, -ry]; name = 'Step-back'; }
  else { v = [rx, ry]; name = 'Hesi'; }
  p.moveDir = norm(v[0], v[1]); p.burst = dir === 'up' ? 0.28 : 0.22; p.moveCd = 0.42; p.handT = 0.3;
  p.moveTimes = p.moveTimes.filter((t) => m.t - t < 1.8); p.moveTimes.push(m.t);
  emit(m, 'move', { id: p.id, name });
  for (const d of foes(m, p)) {
    const dist = len(d.x - p.x, d.y - p.y);
    if (dist > 4.6 || d.stun > 0 || d.z > 0) continue;
    // a defender drifting against the move, or one who lunged, goes down
    const against = -(d.vx * p.moveDir[0] + d.vy * p.moveDir[1]) / 13;
    const chance = clamp(0.03 + against * 0.6 + (d.lunge > 0 ? 0.5 : 0) + (dir === 'up' && len(d.vx, d.vy) > 6 ? 0.3 : 0), 0, 0.85);
    if (m.rand() < chance) { d.stun = 0.75; emit(m, 'ankles', { id: d.id }); say(m, 'Ankles', 1.1); }
  }
  // too many moves in a row with a defender on you and the handle gets loose
  const near = foes(m, p).some((d) => len(d.x - p.x, d.y - p.y) < 3 && d.stun <= 0);
  if (p.moveTimes.length >= 4 && near && m.rand() < 0.4) { looseBall(m, p, 'Lost the handle'); }
}

function swipe(m, d, h) {
  if (d.lunge > 0 || d.stun > 0) return;
  d.lunge = 0.45; emit(m, 'swipe', { id: d.id });
  const dist = len(d.x - h.x, d.y - h.y);
  if (dist > 3.4 || (m.shot && m.shot.id === h.id)) return;
  let ch = 0.1 + 0.3 * (1 - dist / 3.4);
  if (h.handT > 0) ch *= 0.35;
  if (len(h.vx, h.vy) < 2) ch *= 1.4;
  if (d.team === 1) ch *= 0.5 + CPU[m.cfg.cpu].steal * 2;
  if (m.rand() < ch) {
    if (m.rand() < 0.55) { take(m, d); emit(m, 'steal', { id: d.id }); say(m, 'Stolen', 1.1); }
    else looseBall(m, h, 'Poked loose', [d.x - h.x, d.y - h.y]);
  }
}

function looseBall(m, p, why, dir) {
  const b = m.ball; const [ux, uy] = dir ? norm(dir[0], dir[1]) : norm(m.rand() - 0.5, m.rand() - 0.5);
  b.holder = null; b.mode = 'loose'; b.x = p.x; b.y = p.y; b.z = 3; b.vx = ux * 9; b.vy = uy * 9; b.vz = 6; b.lastTeam = p.team;
  b.noGrab = p.id; b.noGrabT = 0.35;
  emit(m, 'loose', { why }); if (why) say(m, why, 1.1);
}

function callScreen(m, p) {
  const def = foes(m, p).find((d) => d.mark === p.id) || nearest(foes(m, p), p);
  const s = nearest(mates(m, p), p);
  if (!def || !s) return;
  // screener sets up on the defender's side, toward where the handler is heading
  const side = p.vx >= 0 ? 1 : -1;
  const [ux, uy] = norm(def.x - p.x, def.y - p.y);
  s.screen = { x: def.x + -uy * side * 1.6 + ux * 0.6, y: def.y + ux * side * 1.6 + uy * 0.6, set: false };
  s.screenT = 0; emit(m, 'screen', { id: s.id }); say(m, 'Screen', 0.9);
}

function passBall(m, p, dir) {
  const pool = mates(m, p); if (!pool.length) return;
  let to = null;
  if (dir && len(dir[0], dir[1]) > 0.3) {
    const [dx, dy] = norm(dir[0], dir[1]); let best = -2;
    for (const q of pool) { const [qx, qy] = norm(q.x - p.x, q.y - p.y); const s = qx * dx + qy * dy; if (s > best) { best = s; to = q; } }
  } else {
    to = pool.find((q) => q.wantT > 0) || nearest(pool, p);
  }
  const b = m.ball; b.holder = null; b.mode = 'pass'; b.x = p.x; b.y = p.y; b.z = 5;
  b.pass = { from: p.id, to: to.id, t: 0, speed: 42, checked: new Set() }; b.lastTeam = p.team;
  emit(m, 'pass', { from: p.id, to: to.id });
}

function nearest(list, p) { let best = null, bd = 1e9; for (const q of list) { const d = len(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } } return best; }

function take(m, p) {
  const b = m.ball, change = p.team !== m.poss;
  b.holder = p.id; b.mode = 'held'; b.pass = null; b.flight = null; b.noGrab = null;
  if (change) { m.poss = p.team; m.cleared = false; m.clock = CLOCK; emit(m, 'change', { team: p.team }); say(m, 'Take it back', 1.2); }
  else if (b.touched) { m.clock = CLOCK; }
  b.touched = false; b.lastTeam = p.team;
  emit(m, 'grab', { id: p.id, change });
  // a catch beyond the arc clears it
  if (!m.cleared && isThree(p.x, p.y)) { m.cleared = true; emit(m, 'cleared'); }
  if (m.practice) m.cleared = true;
}

function turnover(m, team, delay = 0.9) {
  m.shot = null; const b = m.ball; b.holder = null; b.mode = 'dead'; m.phase = 'dead'; m.phaseT = delay; m.next = { check: team };
}
function afterDead(m) {
  const n = m.next || { check: 1 - m.poss }; m.next = null;
  if (m.winner != null) { m.phase = 'over'; return; }
  if (m.practice) { const p = m.players[0]; m.phase = 'live'; giveBack(m, p); return; }
  setupCheck(m, n.check);
}
function giveBack(m, p) { const b = m.ball; b.holder = p.id; b.mode = 'held'; b.flight = null; b.pass = null; m.cleared = true; m.shot = null; emit(m, 'grab', { id: p.id }); }

/* ---------------------------------------------------------------- shooting */
/* Hands live in "target units": the drop zone on the rim is a circle of radius 1 (bigger for
   layups and dunks, smaller when contested). Each hand starts somewhere off it and drifts.
   You steer each one back with its own stick, then let go. No meter, no timing window. */
function startShot(m, p, human) {
  if (!m.cleared) { say(m, 'Take it back first', 1); emit(m, 'blocked-clear'); return; }
  const [rx, ry] = norm(RIM.x - p.x, RIM.y - p.y);
  const toRim = p.vx * rx + p.vy * ry, speed = len(p.vx, p.vy);
  const kind = shotKind(p, toRim), K = SHOTS[kind];
  const dist = rimDist(p.x, p.y), contest = contestOn(m, p);
  const moving = clamp((speed - 3) / 10, 0, 1) * (kind === 'jumper' ? 1 : 0.3);
  const spread = K.spread * (1 + 0.9 * moving + 0.9 * contest + (kind === 'jumper' ? clamp((dist - 12) / 30, 0, 0.6) : 0));
  const hand = () => { const a = m.rand() * Math.PI * 2, r = spread * (0.7 + 0.6 * m.rand()); return [Math.cos(a) * r, Math.sin(a) * r]; };
  const drift = () => { const a = m.rand() * Math.PI * 2, r = 0.35 + 0.5 * contest; return [Math.cos(a) * r, Math.sin(a) * r]; };
  m.shot = {
    id: p.id, team: p.team, human, kind, dist, three: isThree(p.x, p.y), phase: 'gather', t: 0, hang: K.hang,
    g: hand(), s: hand(), dg: drift(), ds: drift(), wob: [m.rand() * 9, m.rand() * 9, m.rand() * 9, m.rand() * 9],
    contest, targetR: K.target, x: p.x, y: p.y, cpuAt: 0.32 + m.rand() * 0.2, blockers: new Map()
  };
  if (kind !== 'jumper') { p.vx = rx * Math.max(6, toRim); p.vy = ry * Math.max(6, toRim); }
  emit(m, 'rise', { id: p.id, kind, human });
}

function shotTick(m, it, realDt, wdt) {
  const s = m.shot, p = m.players[s.id];
  // gather, then up
  s.t += s.human ? realDt : wdt;
  if (s.phase === 'gather' && s.t > 0.16) { s.phase = 'air'; jump(p, s.kind === 'dunk' ? 16 : s.kind === 'layup' ? 13 : 12); p.vz = Math.max(p.vz, 1); }
  // keep the shooter in the air for the whole hang (the world is slowed for a human)
  if (s.phase === 'air') { const u = clamp((s.t - 0.16) / s.hang, 0, 1); p.z = Math.max(0.01, Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.1)) * (s.kind === 'dunk' ? 3.6 : 2.6)); p.vz = 0; }
  if (s.kind !== 'jumper') { p.x += p.vx * wdt * 0.6; p.y += p.vy * wdt * 0.6; const d = rimDist(p.x, p.y); if (d < 1.4) { p.x -= p.vx * wdt * 0.6; p.y -= p.vy * wdt * 0.6; } }

  const c = contestOn(m, p);
  s.contest += (c - s.contest) * Math.min(1, realDt * 6);
  s.targetR = SHOTS[s.kind].target * (1 - 0.45 * s.contest);
  // defenders in the air close enough and in front become possible blockers
  for (const d of foes(m, p)) {
    const dist = len(d.x - p.x, d.y - p.y), [ox, oy] = norm(d.x - p.x, d.y - p.y), [rx, ry] = norm(RIM.x - p.x, RIM.y - p.y);
    if (d.z > 0.9 && dist < 3 && ox * rx + oy * ry > 0.15 && s.t < 0.16 + s.hang * 0.6) s.blockers.set(d.id, Math.max(s.blockers.get(d.id) || 0, 1 - dist / 3));
  }

  if (s.human) {
    if (s.phase === 'air') {
      const T = s.t;
      const grow = 1 + 0.5 * clamp((T - 0.16) / s.hang, 0, 1) + 0.6 * s.contest;
      const wob = (i) => Math.sin(T * (1.7 + i * 0.4) + s.wob[i]) * 0.55 + Math.sin(T * 3.1 + s.wob[i] * 2) * 0.22;
      s.g[0] += (s.dg[0] * grow + wob(0) + it.aimG[0]) * realDt;
      s.g[1] += (s.dg[1] * grow + wob(1) + it.aimG[1]) * realDt;
      s.s[0] += (s.ds[0] * grow + wob(2) + it.aimS[0]) * realDt + it.aimNudge[0];
      s.s[1] += (s.ds[1] * grow + wob(3) + it.aimS[1]) * realDt + it.aimNudge[1];
      for (const h of [s.g, s.s]) { const r = len(h[0], h[1]); if (r > 5) { h[0] *= 5 / r; h[1] *= 5 / r; } }
    }
    const out = s.phase === 'air' && s.t > 0.16 + s.hang;
    if ((!it.shoot && s.t > 0.2) || out) release(m, p, out);
  } else if (s.t > s.cpuAt + 0.16) release(m, p, false);
}

/* make chance for your own shot, from where the two hands sit */
export function handOdds(s) {
  const R = s.targetR, dg = len(s.g[0], s.g[1]) / R, ds = len(s.s[0], s.s[1]) / R;
  const deep = s.kind === 'jumper' ? clamp((s.dist - 24) * 0.035, 0, 0.35) : 0;
  const top = s.kind === 'dunk' ? 0.97 : s.kind === 'layup' ? 0.95 : 0.93 - 0.005 * Math.max(0, s.dist - 8);
  // even a perfect release is harder with a hand in your face
  if (dg <= 1 && ds <= 1) return { inside: true, p: clamp(top - 0.33 * (0.4 * dg * dg + 0.6 * ds * ds) - deep - 0.25 * s.contest, 0.05, 0.99), dg, ds };
  return { inside: false, p: 0.06 * clamp(2.2 - Math.max(dg, ds), 0, 1), dg, ds };
}

function release(m, p, late) {
  const s = m.shot; if (!s || s.phase === 'gone') return;
  s.phase = 'gone';
  const b = m.ball;
  // blocks first
  let blk = 0, by = null;
  for (const [id, v] of s.blockers) { const d = m.players[id]; const ch = 0.55 * v * (d.z > 1.2 ? 1 : 0.55) * (s.kind === 'dunk' ? 0.55 : 1); if (ch > blk) { blk = ch; by = d; } }
  let odds, miss;
  if (s.human) { const h = handOdds(s); odds = h.p; miss = [0.65 * s.s[0] + 0.35 * s.g[0], 0.65 * s.s[1] + 0.35 * s.g[1]]; }
  else { odds = cpuOdds(m, p, s.contest, s.kind); miss = [m.rand() - 0.5, m.rand() - 0.5]; }
  const make = m.rand() < odds;
  const pts = s.three ? 3 : 2;
  if (m.practice) { m.practice.att++; }
  b.holder = null; b.x = p.x; b.y = p.y; b.z = 8.4 + p.z; b.touched = false;
  if (by && m.rand() < blk) {
    const [ux, uy] = norm(p.x - RIM.x + (m.rand() - 0.5) * 6, p.y - RIM.y);
    b.mode = 'loose'; b.vx = ux * 14; b.vy = uy * 14; b.vz = 3; b.lastTeam = p.team; b.noGrab = by.id; b.noGrabT = 0.2;
    emit(m, 'block', { id: by.id, shooter: p.id }); say(m, 'Blocked', 1.1); m.shot = null; return;
  }
  // where the ball comes down relative to the rim: made shots go to the middle
  const [fx, fy] = norm(RIM.x - p.x, RIM.y - p.y);          // shooter → rim
  const side = [-fy, fx];
  let off = [0, 0];
  if (!make) {
    let [mx, my] = len(miss[0], miss[1]) > 0.05 ? norm(miss[0], miss[1]) : norm(m.rand() - 0.5, m.rand() - 0.5);
    const far = s.human ? len(miss[0], miss[1]) / s.targetR : 1;
    const r = far > 3.2 ? 2.4 + m.rand() : 0.85 + 0.35 * m.rand();       // way off is an air ball
    // screen x → side to side, screen y (down) → short
    off = [(side[0] * mx - fx * my) * r, (side[1] * mx - fy * my) * r];
  }
  const T = s.kind === 'dunk' ? 0.22 : 0.55 + s.dist * 0.022;
  b.mode = 'flight';
  b.flight = { x0: b.x, y0: b.y, z0: b.z, x1: RIM.x + off[0], y1: RIM.y + off[1], z1: RIM.z + (make ? 0.3 : 0.2), T, u: 0,
    arc: s.kind === 'dunk' ? 0.3 : 3 + s.dist * 0.2, make, pts, team: p.team, shooter: p.id, kind: s.kind, odds, late, three: s.three, dist: s.dist };
  emit(m, 'release', { id: p.id, odds, make, late, human: s.human });
  if (s.kind === 'dunk' && make) say(m, 'Dunk', 1);
  m.shot = null;
}

/* ---------------------------------------------------------------- the ball */
function holdBall(m) {
  const b = m.ball, h = handler(m); if (!h) return;
  const bounce = Math.abs(Math.sin(m.t * 6.5)) * 2.4;
  b.x = h.x + Math.cos(h.face + 0.6) * 1; b.y = h.y + Math.sin(h.face + 0.6) * 1;
  b.z = (len(h.vx, h.vy) > 1 || m.phase === 'live') && m.phase !== 'check' ? 0.4 + bounce : 3.6;
  if (m.shot && m.shot.id === h.id) { b.x = h.x + Math.cos(h.face) * 0.5; b.y = h.y + Math.sin(h.face) * 0.5; b.z = 7.6 + h.z; }
}

function ballTick(m, dt) {
  const b = m.ball;
  if (b.mode === 'held') return holdBall(m);
  if (b.mode === 'pass') {
    const P = b.pass, to = m.players[P.to];
    const dx = to.x - b.x, dy = to.y - b.y, d = len(dx, dy), stepLen = P.speed * dt;
    // anyone in the lane can pick it off
    for (const q of m.players) {
      if (q.team === b.lastTeam || P.checked.has(q.id)) continue;
      const qd = len(q.x - b.x, q.y - b.y);
      if (qd < 1.7) { P.checked.add(q.id); const ch = q.team === 1 ? 0.25 + CPU[m.cfg.cpu].steal : 0.5;
        if (q.stun <= 0 && m.rand() < ch) { take(m, q); emit(m, 'pick', { id: q.id }); say(m, 'Picked off', 1.1); return; } }
    }
    if (d <= stepLen + 0.8) { take(m, to); return; }
    b.x += dx / d * stepLen; b.y += dy / d * stepLen; b.z = 5;
    return;
  }
  if (b.mode === 'flight') {
    const F = b.flight; F.u += dt / F.T; const u = Math.min(1, F.u);
    b.x = F.x0 + (F.x1 - F.x0) * u; b.y = F.y0 + (F.y1 - F.y0) * u; b.z = F.z0 + (F.z1 - F.z0) * u + Math.sin(Math.PI * u) * F.arc;
    if (u >= 1) arrive(m);
    return;
  }
  ballPhysics(m, dt);
  if (b.mode === 'loose') grab(m);
}

function arrive(m) {
  const b = m.ball, F = b.flight;
  b.flight = null; b.touched = true;
  if (F.make) {
    emit(m, 'make', { ...F });
    b.mode = 'net'; b.x = RIM.x; b.y = RIM.y; b.z = RIM.z - 0.2; b.vx = 0; b.vy = 0; b.vz = -6;
    if (m.practice) { m.practice.made++; zone(m, F, true); m.phase = 'dead'; m.phaseT = 0.8; m.next = null; return; }
    m.score[F.team] += F.pts; say(m, F.pts === 3 ? 'Three' : F.kind === 'dunk' ? 'Dunk' : 'Bucket', 1.2);
    if (m.score[F.team] >= m.cfg.to) { m.winner = F.team; emit(m, 'final', { team: F.team }); say(m, 'Game', 3); }
    m.phase = 'dead'; m.phaseT = m.winner != null ? 1.6 : 1.1; m.next = { check: 1 - F.team };
    return;
  }
  if (m.practice) zone(m, F, false);
  const offRim = len(b.x - RIM.x, b.y - RIM.y);
  if (offRim < 1.6) {
    // off the iron
    const [ux, uy] = norm(b.x - RIM.x + (m.rand() - 0.5) * 0.8, b.y - RIM.y + (m.rand() - 0.5) * 0.8);
    const sp = 5 + m.rand() * 7;
    b.vx = ux * sp; b.vy = Math.abs(uy * sp) + 1.5; b.vz = 6 + m.rand() * 7; emit(m, 'rim');
    m.clock = CLOCK;
  } else {
    b.vx = (F.x1 - F.x0) / F.T * 0.5; b.vy = (F.y1 - F.y0) / F.T * 0.5; b.vz = -4; emit(m, 'airball'); say(m, 'Air ball', 1.1);
  }
  b.mode = 'loose'; b.lastTeam = F.team; b.noGrab = null;
  if (m.practice) { m.phase = 'dead'; m.phaseT = 1.1; }
}
function zone(m, F, made) {
  const z = F.kind !== 'jumper' ? 'Rim' : F.three ? 'Three' : F.dist < 15 ? 'Short' : 'Mid';
  const r = m.practice.zones[z] || (m.practice.zones[z] = { a: 0, m: 0 }); r.a++; if (made) r.m++;
}

function ballPhysics(m, dt) {
  const b = m.ball;
  if (b.mode === 'held' || b.mode === 'dead') { if (b.mode === 'held') holdBall(m); return; }
  if (b.mode === 'net') { b.z += b.vz * dt; b.vz -= G * dt * 0.5; if (b.z < 0.4) { b.z = 0.4; b.vz = 0; b.mode = 'loose'; b.vx = 0; b.vy = 2; } return; }
  b.vz -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if (b.z < 0.4) { b.z = 0.4; if (b.vz < -3) { b.vz = -b.vz * 0.6; emit(m, 'bounce'); } else b.vz = 0; b.vx *= 0.82; b.vy *= 0.82; }
  // backboard and the edges keep it in play (street rules, no out of bounds)
  if (b.y < COURT.BOARD_Y + 0.4 && b.z > 9 && b.z < 13.5 && Math.abs(b.x) < 3) { b.y = COURT.BOARD_Y + 0.4; b.vy = Math.abs(b.vy) * 0.6; }
  if (Math.abs(b.x) > COURT.W - 0.4) { b.x = Math.sign(b.x) * (COURT.W - 0.4); b.vx *= -0.5; }
  if (b.y < 0.4) { b.y = 0.4; b.vy = Math.abs(b.vy) * 0.5; }
  if (b.y > COURT.L + 1) { b.y = COURT.L + 1; b.vy = -Math.abs(b.vy) * 0.5; }
  if (b.noGrabT > 0) b.noGrabT -= dt; else b.noGrab = null;
}

function grab(m) {
  const b = m.ball; let best = null, bd = 1e9;
  for (const p of m.players) {
    if (p.id === b.noGrab || p.stun > 0) continue;
    const d = len(p.x - b.x, p.y - b.y), reach = 8.2 + p.z;
    if (d < 2.3 && b.z < reach && d < bd) { bd = d; best = p; }
  }
  if (best) take(m, best);
}

function collide(m) {
  const ps = m.players;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], b = ps[j]; const dx = b.x - a.x, dy = b.y - a.y, d = len(dx, dy), min = BODY * 2;
    if (d >= min || d < 1e-4) continue;
    const push = (min - d) / 2, ux = dx / d, uy = dy / d;
    const aw = a.screen && a.screenT > 0 ? 0 : 1, bw = b.screen && b.screenT > 0 ? 0 : 1;
    const tot = aw + bw || 1;
    a.x -= ux * push * 2 * aw / tot; a.y -= uy * push * 2 * aw / tot; b.x += ux * push * 2 * bw / tot; b.y += uy * push * 2 * bw / tot;
    // running into a set screen costs you a moment
    for (const [s, o] of [[a, b], [b, a]]) if (s.screen && s.screenT > 0 && o.team !== s.team && o.stun <= 0 && !s.screen.hit) {
      s.screen.hit = true; o.stun = 0.5; emit(m, 'screened', { id: o.id });
    }
  }
}

/* ---------------------------------------------------------------- the CPU */
/* Gives an intent for a CPU player. Your own teammates use this too. */
export function cpuIntent(m, p, dt) {
  const it = blankIntent();
  if (m.phase !== 'live') return it;
  const b = m.ball, h = handler(m), cpu = CPU[m.cfg.cpu], dumb = p.team === 0 ? 0.85 : cpu.iq;
  const goTo = (x, y, slow = 1, stopAt = 0.6) => { const dx = x - p.x, dy = y - p.y, d = len(dx, dy); if (d < stopAt) return; const k = Math.min(1, d / 3) * slow; it.mx = dx / d * k; it.my = dy / d * k; };
  p.think -= dt;

  if (b.mode === 'loose' || b.mode === 'net') {
    // chase where the ball will come down
    const land = landing(b);
    const mineD = len(land[0] - p.x, land[1] - p.y);
    const team = m.players.filter((q) => q.team === p.team);
    const chaser = team.reduce((a, q) => (len(land[0] - q.x, land[1] - q.y) < len(land[0] - a.x, land[1] - a.y) ? q : a), team[0]);
    if (chaser === p || mineD < 8) goTo(land[0], land[1], 1, 0.2);
    else { const man = m.players[p.mark]; if (man) goTo((man.x + RIM.x) / 2, (man.y + RIM.y) / 2 + 2); }
    if (len(b.x - p.x, b.y - p.y) < 3 && b.z > 6.5 && b.z < 11 && b.vz < 4) it.shoot = true;
    return it;
  }
  if (b.mode === 'flight') {
    const man = m.players[p.mark];
    if (man) { const [ux, uy] = norm(RIM.x - man.x, RIM.y - man.y); goTo(man.x + ux * 2.5, man.y + uy * 2.5); }
    return it;
  }

  const onOffense = m.poss === p.team;
  if (onOffense) {
    if (b.holder === p.id) return handlerBrain(m, p, it, dt, goTo, dumb);
    // off the ball: screens, spots, cuts
    if (p.screen) {
      const d = len(p.screen.x - p.x, p.screen.y - p.y);
      if (!p.screen.set) { goTo(p.screen.x, p.screen.y, 1, 0.3); if (d < 0.6) { p.screen.set = true; p.screenT = 1.7; } }
      else if (p.screenT <= 0) p.screen = null;
      return it;
    }
    const spots = SPOTS[m.cfg.size];
    if (p.think <= 0) {
      p.think = 0.8 + m.rand() * 1.2;
      const taken = new Set(m.players.filter((q) => q.team === p.team && q !== p).map((q) => nearestSpot(spots, q)));
      const free = spots.map((s, i) => i).filter((i) => i !== 0 && !taken.has(i));
      if (!free.includes(p.spot)) p.spot = free.length ? free[(m.rand() * free.length) | 0] : 1;
      const def = m.players.find((q) => q.mark === p.id);
      if (def && h && m.rand() < 0.25 * dumb && len(def.x - p.x, def.y - p.y) > 4 && m.cleared) p.cut = 1.4;
      if (h && h.team === p.team && m.rand() < 0.08 && m.cfg.size > 1 && len(h.x - p.x, h.y - p.y) < 22 && !h.human) callScreen(m, h);
    }
    if (p.cut > 0) goTo(p.x < 0 ? -3 : 3, 7, 1, 0.3);
    else { const s = spots[p.spot] || spots[1]; goTo(s[0], s[1], 0.85); }
    return it;
  }

  // defense
  const man = m.players[p.mark];
  if (!man) return it;
  const onBall = b.holder === man.id;
  const mx = onBall ? p.seenX : man.x, my = onBall ? p.seenY : man.y;
  const [ux, uy] = norm(RIM.x - mx, RIM.y - my);
  let gap = onBall ? cpu.gap : 6;
  if (p.team === 0) gap = onBall ? 3.3 : 6;
  let tx = mx + ux * gap, ty = my + uy * gap;
  if (!onBall && h) { tx = tx * 0.7 + (h.x + RIM.x) / 2 * 0.3; ty = ty * 0.7 + (h.y + RIM.y) / 2 * 0.3; }   // help side sags
  if (!m.cleared && onBall) { tx = mx + ux * (gap + 1.5); ty = my + uy * (gap + 1.5); }
  goTo(tx, ty, 1, 0.25);
  const dist = len(man.x - p.x, man.y - p.y);
  if (onBall && dist < 7) it.hands = 1;
  if (m.shot && m.shot.id === man.id) {
    it.hands = 1;
    if (dist < 4.5) { p.wantJump = (p.wantJump ?? (0.06 + (1 - dumb) * 0.25 + m.rand() * 0.12)) - dt; if (p.wantJump <= 0) { it.shoot = true; p.wantJump = null; } }
  } else p.wantJump = null;
  if (onBall && dist < 3 && p.lunge <= 0 && m.rand() < (p.team === 1 ? cpu.steal : 0.15) * dt * 1.6) it.pass = true;
  return it;
}

function nearestSpot(spots, q) { let bi = 0, bd = 1e9; spots.forEach((s, i) => { const d = len(s[0] - q.x, s[1] - q.y); if (d < bd) { bd = d; bi = i; } }); return bi; }

function landing(b) {
  // rough: where it'll be when it drops under 7 ft
  let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
  for (let i = 0; i < 60; i++) { vz -= G / 30; x += vx / 30; y += vy / 30; z += vz / 30; if (z < 7 && vz < 0) break; }
  return [clamp(x, -24, 24), clamp(y, 1, 46)];
}

function handlerBrain(m, p, it, dt, goTo, dumb) {
  const d = rimDist(p.x, p.y), contest = contestOn(m, p), def = nearest(foes(m, p), p);
  const ddist = def ? len(def.x - p.x, def.y - p.y) : 99;
  const [rx, ry] = norm(RIM.x - p.x, RIM.y - p.y);
  p.holdT = (p.holdT || 0) + dt;
  if (!m.cleared) {
    const [ox, oy] = norm(p.x - RIM.x, p.y - RIM.y + 0.01);
    goTo(RIM.x + ox * 26, RIM.y + oy * 26 + 1, 1, 0.2); return it;
  }
  if (!p.plan || p.think <= 0) {
    p.think = 0.35 + m.rand() * 0.4;
    const open = ddist > 6 || (def && def.stun > 0);
    const lane = !foes(m, p).some((q) => { const qx = q.x - p.x, qy = q.y - p.y, along = qx * rx + qy * ry, across = Math.abs(qx * -ry + qy * rx); return along > 0 && along < d && across < 3 && q.stun <= 0; });
    const ev = (isThree(p.x, p.y) ? 3 : 2) * cpuOdds(m, p, contest, shotKind(p, 0));
    const mateOpen = m.cfg.size > 1 && mates(m, p).find((q) => { const qd = nearest(foes(m, q), q); return !qd || len(qd.x - q.x, qd.y - q.y) > 7; });
    if (m.clock < 2.5) p.plan = 'shoot';
    else if (d < 6) p.plan = 'shoot';
    else if (ev > 1.05 - 0.15 * (1 - dumb) && (open || d < 16) && m.rand() < 0.7) p.plan = 'shoot';
    else if (lane && m.rand() < 0.65) p.plan = 'drive';
    else if (mateOpen && p.holdT > 1.2 && m.rand() < 0.5) p.plan = 'pass';
    else p.plan = m.rand() < 0.5 ? 'jab' : 'drive';
    p.planTarget = [clamp(p.x + (m.rand() - 0.5) * 16, -21, 21), clamp(p.y + (m.rand() - 0.6) * 10, 10, 31)];
  }
  const caller = mates(m, p).find((q) => q.wantT > 0);
  if (caller && m.rand() < dt * 6) { it.pass = true; it.passDir = [caller.x - p.x, caller.y - p.y]; p.plan = null; p.holdT = 0; return it; }
  if (p.plan === 'shoot') { if (d < 5 || len(p.vx, p.vy) < 6 || m.clock < 2.5) { it.shoot = true; p.plan = null; p.holdT = 0; } }
  else if (p.plan === 'drive') { goTo(RIM.x, RIM.y + 1.5, 1, 0.3); if (d < 4.8) p.plan = 'shoot'; }
  else if (p.plan === 'pass') { it.pass = true; it.passDir = null; p.plan = null; p.holdT = 0; }
  else { goTo(p.planTarget[0], p.planTarget[1], 0.8); }
  if (def && ddist < 4.2 && p.moveCd <= 0 && m.rand() < dt * 1.5 * dumb) {
    // shake them: crossover against the way they're leaning
    it.flick = def.vx > 0.5 ? 'left' : def.vx < -0.5 ? 'right' : m.rand() < 0.5 ? 'left' : 'right';
    if (m.rand() < 0.25) it.flick = 'down';
  }
  return it;
}
