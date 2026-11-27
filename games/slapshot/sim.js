/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Slapshot simulation: rink, skaters, puck, goalies and the computer players. No DOM in here, so a
   whole game can run without a page. Units are rink units (about a quarter foot); time is seconds.
   Home (team 0) defends the left net and attacks right. */

import { makeDummy, newSeed } from '../shared/seed.js';

export const RINK = Object.freeze({ HX: 400, HY: 170, CR: 72, GX: 352, GW: 26, GD: 18, BLUE: 100, CREASE: 34 });
const { HX, HY, CR, GX, GW, GD, BLUE } = RINK;

export const SK = Object.freeze({ r: 8, reach: 18, max: 172, maxPuck: 158, acc: 400, glide: 0.5, brake: 6 });
export const PUCK_R = 3.2;

/* Computer skill per level. speed scales top speed, think is seconds between decisions, poke is the
   chance a poke check works on a carrier who isn't stickhandling, check is how often they throw a
   hit, aim is shot spread in degrees. Goalies: react is how late they read a shot, speed how fast
   they slide. Your teammates always play at Pro. */
export const LEVELS = [
  { id: 'rookie', name: 'Rookie', ai: { speed: 0.86, think: 0.34, poke: 0.34, check: 0.05, aim: 9, pass: 0.45 }, goalie: { react: 0.24, speed: 120, slide: 75, size: 9.5 } },
  { id: 'pro', name: 'Pro', ai: { speed: 0.95, think: 0.24, poke: 0.48, check: 0.1, aim: 6, pass: 0.6 }, goalie: { react: 0.17, speed: 150, slide: 95, size: 10.5 } },
  { id: 'allstar', name: 'All-Star', ai: { speed: 1.02, think: 0.16, poke: 0.6, check: 0.16, aim: 4, pass: 0.75 }, goalie: { react: 0.12, speed: 180, slide: 115, size: 11.5 } }
];
const TEAMMATE_AI = LEVELS[1].ai;

/* Seeded dummies: each computer team is rolled from a seed (shared/seed.js), so no two teams play
   alike. The level stays the skill; the seed only changes how the team plays, and every number is a
   trade-off (shoot more but from worse ice, hit more but stumble on misses), never raw strength.
   Drawn in this order, so a seed always makes the same team. */
export const RANGES = {
  think: [0.8, 1.25],     // decision delay, times the level's think time
  shoot: [0.4, 0.8],      // chance to shoot on a look from good ice
  range: [190, 275],      // farthest it shoots from
  slap: [0.2, 0.7],       // love of the big slapshot over a quick wrister
  snipe: [0, 1],          // aims tight to the post: harder to save, misses more
  pass: [0.7, 1.3],       // pass first under pressure, times the level's pass rate
  drive: [0.75, 1.2],     // where the carrier sets up: low drives deep, high stays at the point
  dangle: [0.5, 1.5],     // stickhandles through pressure (high) or skates around it (low)
  width: [0.75, 1.3],     // spacing: how wide the support players spread
  poke: [0.35, 0.8],      // how often the pressuring defender pokes
  hit: [0.4, 1.6],        // how often it throws body checks, times the level's rate
  forecheck: [0, 1],      // how high the third man sits: high pressures, low guards the slot
  chase: [80, 150],       // how close a second skater has to be to join a loose-puck chase
  depth: [0.8, 1.2]       // how far its goalie plays out of the net
};
export const STYLES = [
  ['enforcer', (p) => p.hit > 1.32],
  ['cannon', (p) => p.slap > 0.58],
  ['playmaker', (p) => p.pass > 1.15],
  ['dangler', (p) => p.dangle > 1.25]
];
export const FALLBACK_STYLE = 'two way';
export const rollTeam = (seed = newSeed()) => makeDummy(seed, RANGES, STYLES, FALLBACK_STYLE);
const HUMAN_POKE = 0.72;
export const WRIST_MAX = 0.4;   // a wind-up shorter than this is a wrist shot, longer is a slapshot
export const SLAP_FULL = 1.0;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const len = (x, y) => Math.hypot(x, y);
const norm = (x, y) => { const m = Math.hypot(x, y) || 1; return [x / m, y / m]; };
const rot = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

export function shotSpeed(power) {
  return power < WRIST_MAX ? 520 + 130 * clamp(power / WRIST_MAX, 0, 1)
    : 700 + 260 * clamp((power - WRIST_MAX) / (SLAP_FULL - WRIST_MAX), 0, 1);
}
export const shotKind = (power) => (power < WRIST_MAX ? 'wrist' : 'slap');

/* rounded-rectangle boards: push a circle back inside, return the wall normal or null */
function boards(o, r) {
  const ix = HX - CR, iy = HY - CR;
  if (Math.abs(o.x) > ix && Math.abs(o.y) > iy) {
    const cx = Math.sign(o.x) * ix, cy = Math.sign(o.y) * iy;
    const dx = o.x - cx, dy = o.y - cy, d = len(dx, dy), lim = CR - r;
    if (d > lim) { const nx = dx / d, ny = dy / d; o.x = cx + nx * lim; o.y = cy + ny * lim; return [-nx, -ny]; }
    return null;
  }
  if (o.x > HX - r) { o.x = HX - r; return [-1, 0]; }
  if (o.x < -HX + r) { o.x = -HX + r; return [1, 0]; }
  if (o.y > HY - r) { o.y = HY - r; return [0, -1]; }
  if (o.y < -HY + r) { o.y = -HY + r; return [0, 1]; }
  return null;
}
function bounce(o, n, e) {
  const d = o.vx * n[0] + o.vy * n[1];
  if (d < 0) { o.vx -= (1 + e) * d * n[0]; o.vy -= (1 + e) * d * n[1]; }
  return -d;
}
/* a net is a box behind the goal line; the front is open */
function netBox(side) { // side -1 = left net, +1 = right net
  const x0 = side < 0 ? -GX - GD : GX, x1 = side < 0 ? -GX : GX + GD;
  return { x0, x1, y0: -GW, y1: GW };
}
function pushOutOfBox(o, r, b) {
  if (o.x < b.x0 - r || o.x > b.x1 + r || o.y < b.y0 - r || o.y > b.y1 + r) return null;
  const opts = [[o.x - (b.x0 - r), [-1, 0]], [(b.x1 + r) - o.x, [1, 0]], [o.y - (b.y0 - r), [0, -1]], [(b.y1 + r) - o.y, [0, 1]]];
  opts.sort((a, c) => a[0] - c[0]);
  const [depth, n] = opts[0];
  o.x += n[0] * depth; o.y += n[1] * depth;
  return n;
}

export class Skater {
  constructor(team, idx, num) {
    this.team = team; this.idx = idx; this.num = num;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.fx = team === 0 ? 1 : -1; this.fy = 0;
    this.bx = this.fx * SK.reach * 0.75; this.by = 0; this.handle = 0;
    this.stun = 0; this.recover = 0; this.lunge = 0; this.checkCd = 0; this.hitDone = false;
    this.pokeT = 0; this.pokeCd = 0; this.pokeDx = 0; this.pokeDy = 0; this.poked = false;
    this.pickCd = 0; this.windup = 0; this.wdx = 0; this.wdy = 0;
    this.human = false; this.ai = { next: Math.random() * 0.2, tx: 0, ty: 0, phase: Math.random() * 6, wind: 0, power: 0, sdx: 0, sdy: 0, chase: false };
    this.cmd = blankCmd();
  }
  get blade() { return [this.x + this.bx, this.y + this.by]; }
}
export function blankCmd() { return { mx: 0, my: 0, stop: 0, sx: 0, sy: 0, windup: 0, wdx: 0, wdy: 0, shoot: null, poke: null, pass: null, check: false }; }

class Goalie {
  constructor(team, lv, depth = 1) {
    this.team = team; this.side = team === 0 ? -1 : 1; this.gx = this.side * GX; this.depth = depth;
    this.out = -this.side; // direction out of the net
    this.x = this.gx + this.out * 10; this.y = 0; this.vy = 0; this.vx = 0;
    this.react = lv.react; this.speed = lv.speed; this.slide = lv.slide; this.size = lv.size; this.hold = 0;
  }
}

export class Game {
  /* opts: level id, periodLen (s), periods, practice (bool), humanIdx (-1 = computer plays both),
     watch (bool: CPU vs CPU, both teams at the level), seeds ([a, b], fresh ones if left out) */
  constructor(opts = {}) {
    this.level = LEVELS.find((l) => l.id === opts.level) || LEVELS[1];
    this.practice = !!opts.practice;
    this.watch = !!opts.watch && !this.practice;
    const seeds = opts.seeds || [newSeed(), newSeed()];
    this.dummies = [rollTeam(seeds[0]), rollTeam(seeds[1])];
    // in CPU vs CPU both teams play at the chosen level; otherwise your teammates play at Pro
    this.ais = [this.watch ? this.level.ai : TEAMMATE_AI, this.level.ai];
    this.periodLen = opts.periodLen || 120; this.periods = opts.periods || 3;
    this.period = 1; this.clock = this.periodLen; this.ot = false;
    this.score = [0, 0]; this.sog = [0, 0]; this.hits = [0, 0];
    this.events = []; this.t = 0; this.msg = ''; this.over = false;
    const nums = [[19, 8, 44], [91, 27, 4]];
    this.skaters = [];
    for (let team = 0; team < 2; team++) {
      const n = this.practice ? (team === 0 ? 1 : 0) : 3;
      for (let i = 0; i < n; i++) this.skaters.push(new Skater(team, i, nums[team][i]));
    }
    for (const s of this.skaters) { const d = this.dummies[s.team]; s.ai.next = d.rand(0, 0.2); s.ai.phase = d.rand(0, 6); }
    const D = this.dummies;
    this.goalies = [this.practice ? null : new Goalie(0, (this.watch ? this.level : LEVELS[1]).goalie, D[0].p.depth), new Goalie(1, this.level.goalie, D[1].p.depth)];
    this.humanIdx = this.watch ? -1 : opts.humanIdx === undefined ? 0 : opts.humanIdx;
    if (this.humanIdx >= 0) this.skaters[this.humanIdx].human = true;
    this.puck = { x: 0, y: 0, vx: 0, vy: 0, z: 0, air: 0, airT: 0, owner: null, shot: null, passTo: null, lastTeam: -1, hist: [], ghost: null };
    this.faceoff();
  }
  get human() { return this.humanIdx >= 0 ? this.skaters[this.humanIdx] : null; }
  team(t) { return this.skaters.filter((s) => s.team === t); }
  emit(type, data = {}) { this.events.push({ type, ...data }); }

  /* switch the player you control to the teammate nearest the puck */
  switchPlayer() {
    const h = this.human; if (!h || this.puck.owner === h) return false;
    const mates = this.team(h.team).filter((s) => s !== h);
    if (!mates.length) return false;
    mates.sort((a, b) => len(a.x - this.puck.x, a.y - this.puck.y) - len(b.x - this.puck.x, b.y - this.puck.y));
    this.setHuman(mates[0]); return true;
  }
  setHuman(s) {
    const h = this.human; if (h) { h.human = false; h.cmd = blankCmd(); }
    s.human = true; this.humanIdx = this.skaters.indexOf(s);
  }

  faceoff() {
    const P = this.puck;
    Object.assign(P, { x: 0, y: 0, vx: 0, vy: 0, z: 0, air: 0, owner: null, shot: null, passTo: null, ghost: null });
    P.hist.length = 0;
    const spots = this.practice ? [[-60, 0]] : [[-16, 0], [-50, -72], [-95, 45]];
    for (const s of this.skaters) {
      const [sx, sy] = spots[s.idx] || [-40, 0];
      s.x = s.team === 0 ? sx : -sx; s.y = s.team === 0 ? sy : -sy;
      s.vx = s.vy = 0; s.fx = s.team === 0 ? 1 : -1; s.fy = 0; s.bx = s.fx * SK.reach * 0.75; s.by = 0;
      s.stun = s.recover = s.lunge = s.pokeT = s.windup = 0; s.pickCd = 0;
    }
    for (const g of this.goalies) if (g) { g.x = g.gx + g.out * 10; g.y = 0; g.vx = g.vy = 0; g.hold = 0; }
    if (this.practice) { P.x = -30; P.y = 0; this.phase = 'play'; this.phaseT = 0; return; }
    this.phase = 'faceoff'; this.phaseT = 0;
  }

  step(dt) {
    this.events.length = 0;
    if (this.over) return;
    this.t += dt; this.phaseT += dt;
    const P = this.puck;
    if (this.phase === 'faceoff') {
      if (this.phaseT > 1.0) { this.phase = 'play'; this.phaseT = 0; P.vx = rnd(-25, 25); P.vy = rnd(-25, 25); this.emit('drop'); }
      else { for (const s of this.skaters) { this.blade(s, s.cmd, dt); } return; }
    }
    if (this.phase === 'goal' || this.phase === 'break') {
      // players coast, puck sits in the net
      for (const s of this.skaters) { s.vx *= Math.exp(-2 * dt); s.vy *= Math.exp(-2 * dt); s.x += s.vx * dt; s.y += s.vy * dt; boards(s, SK.r); }
      const wait = this.phase === 'goal' ? 2.4 : 2.6;
      if (this.phaseT > wait) this.afterStoppage();
      return;
    }
    // play
    if (!this.practice) {
      this.clock -= dt;
      if (this.clock <= 0) { this.clock = 0; return this.endPeriod(); }
    }
    for (const s of this.skaters) if (!s.human) s.cmd = this.think(s, dt);
    for (const s of this.skaters) this.skate(s, s.cmd, dt);
    this.collide();
    for (const g of this.goalies) if (g) this.goalie(g, dt);
    this.movePuck(dt);
    for (const s of this.skaters) { s.cmd.shoot = s.cmd.poke = s.cmd.pass = null; s.cmd.check = false; }
  }

  endPeriod() {
    if (this.ot) { this.over = true; this.emit('end'); return; }
    if (this.period >= this.periods) {
      if (this.score[0] !== this.score[1]) { this.over = true; this.emit('end'); return; }
      this.ot = true; this.period++; this.clock = Math.min(120, this.periodLen);
      this.phase = 'break'; this.phaseT = 0; this.msg = 'Tied. Sudden death overtime'; this.emit('whistle'); return;
    }
    this.period++; this.clock = this.periodLen;
    this.phase = 'break'; this.phaseT = 0; this.msg = `End of period ${this.period - 1}`; this.emit('whistle');
  }
  afterStoppage() { this.msg = ''; if (this.practice) { this.respawnPractice(); return; } this.faceoff(); }
  respawnPractice() {
    const P = this.puck, h = this.skaters[0];
    Object.assign(P, { x: h.x + h.fx * 30, y: h.y + h.fy * 30, vx: 0, vy: 0, z: 0, air: 0, owner: null, shot: null, passTo: null, ghost: null });
    boards(P, PUCK_R); this.phase = 'play'; this.phaseT = 0;
    const g = this.goalies[1]; g.hold = 0;
  }

  /* ---------------- skating ---------------- */
  skate(s, c, dt) {
    const hasPuck = this.puck.owner === s;
    s.stun = Math.max(0, s.stun - dt); s.recover = Math.max(0, s.recover - dt);
    s.checkCd = Math.max(0, s.checkCd - dt); s.pokeCd = Math.max(0, s.pokeCd - dt); s.pickCd = Math.max(0, s.pickCd - dt);
    s.windup = s.stun ? 0 : c.windup || 0; s.wdx = c.wdx; s.wdy = c.wdy;
    const aiSpeed = s.human ? 1 : this.ais[s.team].speed;
    let mx = c.mx, my = c.my; const mm = len(mx, my); if (mm > 1) { mx /= mm; my /= mm; }
    if (s.stun) { mx = my = 0; }
    const ctrl = s.stun ? 0 : s.recover ? 0.35 : 1;
    let max = (hasPuck ? SK.maxPuck : SK.max) * aiSpeed;
    // a slapshot wind-up (stick drawn back behind you) slows you down: easy to read.
    // Holding the puck out to the side to shield it does not.
    if (s.windup > WRIST_MAX && c.wdx * s.fx + c.wdy * s.fy < -0.3) max *= 0.55;
    // accelerate along the input; the part of the velocity sideways to the input bleeds off (edges)
    if (mm > 0.05) {
      s.vx += mx * SK.acc * ctrl * dt; s.vy += my * SK.acc * ctrl * dt;
      const [ux, uy] = norm(mx, my), along = s.vx * ux + s.vy * uy;
      const px = s.vx - along * ux, py = s.vy - along * uy, k = Math.exp(-2.4 * ctrl * dt);
      s.vx = along * ux + px * k; s.vy = along * uy + py * k;
    }
    const glide = Math.exp(-(SK.glide + (mm > 0.05 ? 0 : 0.4)) * dt);
    s.vx *= glide; s.vy *= glide;
    if (c.stop > 0.05 && !s.stun) { const k = Math.exp(-SK.brake * c.stop * dt); s.vx *= k; s.vy *= k; if (len(s.vx, s.vy) > 60) s.spray = 0.15; }
    const sp = len(s.vx, s.vy);
    if (sp > max && !s.lunge) { const k = Math.max(max, sp - 500 * dt) / sp; s.vx *= k; s.vy *= k; }
    // facing turns toward where you push, or where you're going
    let tx = 0, ty = 0;
    if (mm > 0.2) { tx = mx; ty = my; } else if (sp > 30) { tx = s.vx; ty = s.vy; }
    if ((tx || ty) && !s.stun) {
      const want = Math.atan2(ty, tx), cur = Math.atan2(s.fy, s.fx);
      let d = want - cur; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const a = cur + clamp(d, -9 * dt, 9 * dt); s.fx = Math.cos(a); s.fy = Math.sin(a);
    }
    // body check: a short lunge; land it and they go down, miss and you stumble
    if (c.check && !hasPuck && s.checkCd <= 0 && !s.stun && !s.recover) {
      s.lunge = 0.22; s.hitDone = false; s.checkCd = 1.3;
      s.vx += s.fx * 210; s.vy += s.fy * 210;
      const v = len(s.vx, s.vy), cap = SK.max * 1.35; if (v > cap) { s.vx *= cap / v; s.vy *= cap / v; }
      this.emit('lunge', { s });
    }
    if (s.lunge > 0) { s.lunge -= dt; if (s.lunge <= 0) { s.lunge = 0; if (!s.hitDone) s.recover = 0.4; } }
    s.x += s.vx * dt; s.y += s.vy * dt;
    const n = boards(s, SK.r); if (n) bounce(s, n, 0.2);
    for (const side of [-1, 1]) { const nn = pushOutOfBox(s, SK.r, netBox(side)); if (nn) bounce(s, nn, 0.2); }
    // stay out of the goalie
    for (const g of this.goalies) if (g) {
      const dx = s.x - g.x, dy = s.y - g.y, d = len(dx, dy), m = SK.r + g.size;
      if (d < m && d > 0) { s.x = g.x + dx / d * m; s.y = g.y + dy / d * m; }
    }
    this.blade(s, c, dt);
    // actions
    if (c.poke && !hasPuck && s.pokeCd <= 0 && !s.stun) {
      const [dx, dy] = norm(c.poke.dx, c.poke.dy);
      s.pokeT = 0.2; s.pokeDx = dx; s.pokeDy = dy; s.pokeCd = 0.55; s.poked = false; this.emit('poke', { s });
    }
    if (hasPuck && c.shoot) this.shoot(s, c.shoot);
    else if (hasPuck && c.pass) this.pass(s, c.pass);
  }

  /* the blade follows the stick; its speed is how hard you are to poke */
  blade(s, c, dt) {
    let tx, ty;
    s.pokeT = Math.max(0, s.pokeT - dt);
    const m = len(c.sx, c.sy);
    if (s.pokeT > 0) { tx = s.pokeDx * SK.reach * 1.6; ty = s.pokeDy * SK.reach * 1.6; }
    else if (s.windup > 0) { tx = s.wdx * SK.reach; ty = s.wdy * SK.reach; }
    else if (m > 0.15) { const k = Math.min(1, m); const [ux, uy] = norm(c.sx, c.sy); tx = ux * SK.reach * (0.45 + 0.55 * k); ty = uy * SK.reach * (0.45 + 0.55 * k); }
    else { tx = s.fx * SK.reach * 0.75; ty = s.fy * SK.reach * 0.75; }
    const dx = tx - s.bx, dy = ty - s.by, d = len(dx, dy), maxStep = (s.pokeT > 0 ? 1400 : 800) * dt;
    const k = d > maxStep ? maxStep / d : 1;
    s.bx += dx * k; s.by += dy * k;
    const moved = d * k / Math.max(dt, 1e-3);
    s.handle += (moved - s.handle) * Math.min(1, dt * 6);
  }

  shoot(s, sh) {
    const P = this.puck, power = clamp(sh.power || 0, 0, SLAP_FULL);
    const kind = shotKind(power);
    const spread = (kind === 'wrist' ? 1.4 : 2 + 3 * (power - WRIST_MAX) / (SLAP_FULL - WRIST_MAX)) + (sh.spread || 0);
    let [dx, dy] = norm(sh.dx, sh.dy); [dx, dy] = rot(dx, dy, gauss() * spread * Math.PI / 180);
    const v = shotSpeed(power);
    P.owner = null; P.vx = dx * v + s.vx * 0.3; P.vy = dy * v + s.vy * 0.3; P.z = 0; P.air = 0;
    P.shot = { by: s, team: s.team, kind, read: power >= WRIST_MAX * 0.9, t: 0, counted: false, luck: rnd(0.6, 1.9) };
    P.passTo = null; P.ghost = null; s.pickCd = 0.35; P.lastTeam = s.team;
    this.emit('shot', { s, kind, power });
  }

  pass(s, ps) {
    const P = this.puck, mates = this.team(s.team).filter((m) => m !== s && !m.stun);
    if (!mates.length) { // practice: just send the puck
      const [dx, dy] = norm(ps.dx || s.fx, ps.dy || s.fy);
      P.owner = null; P.vx = dx * 360; P.vy = dy * 360; s.pickCd = 0.3; this.emit('pass', { s }); return;
    }
    let [ax, ay] = len(ps.dx, ps.dy) > 0.3 ? norm(ps.dx, ps.dy) : [s.fx, s.fy];
    let best = null, bestScore = -1e9;
    for (const m of mates) {
      const [ux, uy] = norm(m.x - s.x, m.y - s.y), d = len(m.x - s.x, m.y - s.y);
      const sc = (ux * ax + uy * ay) * 1.5 - d / 900;
      if (sc > bestScore) { bestScore = sc; best = m; }
    }
    this.passTo(s, best, !!ps.saucer);
  }
  passTo(s, m, saucer) {
    const P = this.puck;
    const d0 = len(m.x - s.x, m.y - s.y);
    const speed = saucer ? clamp(220 + d0 * 0.45, 240, 380) : clamp(300 + d0 * 0.5, 320, 470);
    const t = d0 / speed, lx = m.x + m.vx * t * 0.9 + m.fx * 6, ly = m.y + m.vy * t * 0.9 + m.fy * 6;
    const [dx, dy] = norm(lx - s.x, ly - s.y), d = len(lx - s.x, ly - s.y);
    P.owner = null; P.vx = dx * speed; P.vy = dy * speed; P.shot = null; P.passTo = m; P.ghost = null;
    P.air = saucer ? Math.max(0.25, (d / speed) * 0.8) : 0; P.airT = 0;
    s.pickCd = 0.3; P.lastTeam = s.team;
    this.emit(saucer ? 'saucer' : 'pass', { s, to: m });
  }

  collide() {
    const S = this.skaters, P = this.puck;
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const a = S[i], b = S[j], dx = b.x - a.x, dy = b.y - a.y, d = len(dx, dy), m = SK.r * 2;
      if (d >= m + 1.5 || d === 0) continue;
      const nx = dx / d, ny = dy / d;
      // a lunging checker hitting an opponent knocks them down
      for (const [hit, tgt, sgn] of [[a, b, 1], [b, a, -1]]) {
        if (hit.lunge > 0 && !hit.hitDone && hit.team !== tgt.team && !tgt.stun) {
          hit.hitDone = true; hit.lunge = 0;
          const pv = len(hit.vx, hit.vy);
          tgt.stun = 0.85; tgt.vx = nx * sgn * pv * 0.8; tgt.vy = ny * sgn * pv * 0.8; tgt.windup = 0;
          hit.vx *= 0.4; hit.vy *= 0.4;
          if (P.owner === tgt) { P.owner = null; P.vx = tgt.vx + rnd(-70, 70); P.vy = tgt.vy + rnd(-70, 70); tgt.pickCd = 0.6; }
          this.hits[hit.team]++; this.emit('hit', { by: hit, on: tgt });
        }
      }
      if (d < m) {
        const o = (m - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) { const imp = -rv * 0.6; a.vx -= nx * imp; a.vy -= ny * imp; b.vx += nx * imp; b.vy += ny * imp; }
      }
    }
  }

  /* ---------------- goalies ---------------- */
  goalie(g, dt) {
    const P = this.puck;
    if (g.hold > 0) {
      g.hold -= dt; P.x = g.x + g.out * (g.size + PUCK_R + 1); P.y = g.y; P.vx = P.vy = 0;
      if (g.hold <= 0) this.goalieClear(g);
      return;
    }
    // where the goalie thinks the puck is: a moment ago (react), unless they read a slapshot
    const sh = P.shot, lag = sh && sh.team !== g.team ? (sh.read ? 0.06 : g.react) * sh.luck : g.react;
    const seen = this.seenPuck(lag);
    let tx, ty, spd = g.speed;
    const behind = (seen.x - g.gx) * g.out < 2;
    if (behind) { tx = g.gx + g.out * 5; ty = Math.sign(seen.y || 1) * (GW - 7); }
    else {
      const dx = seen.x - g.gx, dy = seen.y, d = len(dx, dy) || 1;
      const out = clamp(4 + (d - 60) * 0.04, 4, 12) * g.depth;
      tx = g.gx + dx / d * out; ty = clamp(dy / d * out, -(GW + 2), GW + 2);
      // once they have read a shot, they slide to where it crosses their line
      const toward = (P.vx * -g.out) > 60;
      if (sh && sh.team !== g.team && toward && sh.t > lag) {
        const t = (g.x - P.x) / (P.vx || 1e-6);
        if (t > 0 && t < 0.8) { ty = clamp(P.y + P.vy * t, -(GW + 4), GW + 4); spd = g.slide / Math.sqrt(sh.luck); }
      }
    }
    const dx = tx - g.x, dy = ty - g.y, d = len(dx, dy), step = spd * dt;
    const k = d > step ? step / d : 1;
    g.vx = dx * k / dt; g.vy = dy * k / dt;
    g.x += dx * k; g.y += dy * k;
  }
  seenPuck(lag) {
    const h = this.puck.hist, want = this.t - lag;
    for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= want) return h[i];
    return h[0] || this.puck;
  }
  goalieClear(g) {
    const P = this.puck, mates = this.team(g.team).filter((m) => !m.stun);
    if (!mates.length) { // practice: flip it into the corner
      P.owner = null; P.x = g.x + g.out * (g.size + PUCK_R + 4); P.vx = g.out * 220; P.vy = rnd(-1, 1) > 0 ? 200 : -200; P.shot = null; return;
    }
    mates.sort((a, b) => len(a.x - g.x, a.y - g.y) - len(b.x - g.x, b.y - g.y));
    const m = mates[0];
    P.owner = null; P.x = g.x + g.out * (g.size + PUCK_R + 4); P.y = g.y;
    this.passTo({ x: P.x, y: P.y, vx: 0, vy: 0, pickCd: 0, team: g.team }, m, false);
  }

  /* ---------------- the puck ---------------- */
  movePuck(dt) {
    const P = this.puck;
    P.hist.push({ t: this.t, x: P.x, y: P.y }); while (P.hist.length && P.hist[0].t < this.t - 0.5) P.hist.shift();
    if (P.shot) P.shot.t += dt;
    if (P.owner) {
      const s = P.owner;
      if (s.stun) { P.owner = null; }
      else {
        const [bx, by] = s.blade, k = Math.min(1, dt * 28);
        P.x += (bx - P.x) * k; P.y += (by - P.y) * k; P.vx = s.vx; P.vy = s.vy; P.z = 0;
        if (len(bx - P.x, by - P.y) > 16) { P.owner = null; s.pickCd = 0.3; }
        boards(P, PUCK_R);
        for (const side of [-1, 1]) if ((P.x - side * GX) * side >= 0) pushOutOfBox(P, PUCK_R, netBox(side));
        this.pokes(); return;
      }
    }
    // free puck
    if (P.air > 0) { P.airT += dt; P.z = Math.max(0, Math.sin(Math.PI * Math.min(1, P.airT / P.air))); if (P.airT >= P.air) { P.air = 0; P.z = 0; this.emit('land'); } }
    const fr = Math.exp(-0.45 * dt); P.vx *= fr; P.vy *= fr;
    const steps = Math.ceil(len(P.vx, P.vy) * dt / 3) || 1, h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const px = P.x, py = P.y;
      P.x += P.vx * h; P.y += P.vy * h;
      if (this.goalCheck(px, py)) return;
      const n = boards(P, PUCK_R); if (n) { const hit = bounce(P, n, 0.72); if (hit > 160) this.emit('boards', { v: hit }); if (P.shot) P.shot.dead = true; }
      for (const side of [-1, 1]) {
        // the front of the net is open: only push the puck out once it is past the goal line
        const nn = (P.x - side * GX) * side >= 0 ? pushOutOfBox(P, PUCK_R, netBox(side)) : null;
        if (nn) { bounce(P, nn, 0.4); if (P.shot) P.shot.dead = true; }
        for (const py2 of [-GW, GW]) { // posts
          const cx = side * GX, dx = P.x - cx, dy = P.y - py2, d = len(dx, dy), m = 2.6 + PUCK_R;
          if (d < m && d > 0) { const nx = dx / d, ny = dy / d; P.x = cx + nx * m; P.y = py2 + ny * m; const v = bounce(P, [nx, ny], 0.6); if (v > 120) this.emit('post', { v }); }
        }
      }
      if (this.goalieContact()) return;
      if (P.z < 0.25) this.bodyBlocks();
    }
    if (P.air <= 0 || P.z < 0.2) this.pickup();
    this.pokes();
    if (len(P.vx, P.vy) < 140) P.shot = null;
  }
  goalCheck(px, py) {
    const P = this.puck;
    for (const side of [-1, 1]) {
      const gx = side * GX;
      if ((px - gx) * side < 0 && (P.x - gx) * side >= 0) {
        const t = (gx - px) / ((P.x - px) || 1e-6), y = py + (P.y - py) * t;
        if (Math.abs(y) < GW - PUCK_R * 0.5) {
          const scorer = side > 0 ? 0 : 1;
          P.x = gx + side * 8; P.y = y; P.vx = P.vy = 0; P.owner = null; P.air = 0; P.z = 0;
          if (P.shot && !P.shot.counted) { this.sog[scorer]++; P.shot.counted = true; }
          const by = P.shot ? P.shot.by : null;
          this.score[scorer]++; this.phase = 'goal'; this.phaseT = 0; P.shot = null;
          this.msg = 'Goal'; this.lastGoal = { team: scorer, by };
          this.emit('goal', { team: scorer, by });
          if (this.ot && !this.practice) { this.over = true; this.emit('end'); }
          return true;
        }
      }
    }
    return false;
  }
  goalieContact() {
    const P = this.puck;
    for (const g of this.goalies) {
      if (!g || g.hold > 0 || P.ghost === g) continue;
      const nx = (P.x - g.x) / (g.size + PUCK_R), ny = (P.y - g.y) / ((g.size + PUCK_R) * 1.1);
      if (nx * nx + ny * ny >= 1 || P.z > 0.6) continue;
      const v = len(P.vx, P.vy), sh = P.shot;
      const towardNet = (P.vx * g.out) < 0;
      // a hard shot while the goalie is still sliding can squeeze through
      if (sh && sh.team !== g.team && v > 560 && Math.abs(g.vy) > g.slide * 0.7 && Math.random() < 0.25) { P.ghost = g; continue; }
      if (sh && sh.team !== g.team && towardNet && !sh.counted) { this.sog[sh.team]++; sh.counted = true; }
      if (v > 230 && sh) {
        const [rx, ry] = norm(g.out, rnd(-0.9, 0.9));
        P.vx = rx * v * 0.28; P.vy = ry * v * 0.28; P.x = g.x + rx * (g.size + PUCK_R + 1); P.y = g.y + ry * (g.size + PUCK_R + 1);
        P.shot = null; this.emit('save', { g, rebound: true });
      } else if (v > 40 && v <= 230 && Math.random() < 0.5) {
        const [rx, ry] = norm(g.out, rnd(-1, 1));
        P.vx = rx * 120; P.vy = ry * 120; P.x = g.x + rx * (g.size + PUCK_R + 1); P.y = g.y + ry * (g.size + PUCK_R + 1); P.shot = null;
      } else {
        g.hold = 0.75; P.owner = null; P.vx = P.vy = 0; P.shot = null; P.passTo = null;
        this.emit('save', { g, rebound: false });
      }
      return true;
    }
    return false;
  }
  bodyBlocks() {
    const P = this.puck; if (!P.shot) return;
    for (const s of this.skaters) {
      if (s === P.shot.by && P.shot.t < 0.15) continue;
      if (s.team === P.shot.team) continue;
      const dx = P.x - s.x, dy = P.y - s.y, d = len(dx, dy), m = SK.r + PUCK_R;
      if (d < m && d > 0) {
        const nx = dx / d, ny = dy / d; P.x = s.x + nx * m; P.y = s.y + ny * m; bounce(P, [nx, ny], 0.25);
        P.vx += rnd(-40, 40); P.vy += rnd(-40, 40); P.shot = null; this.emit('block', { s }); return;
      }
    }
  }
  pickup() {
    const P = this.puck; if (P.owner) return;
    const v = len(P.vx, P.vy);
    let best = null, bestD = 1e9;
    for (const s of this.skaters) {
      if (s.stun || s.pickCd > 0) continue;
      if (P.shot && P.shot.team === s.team && P.shot.t < 0.6) continue;
      const [bx, by] = s.blade, d = len(bx - P.x, by - P.y);
      const r = 9 + (P.passTo === s ? 5 : 0) + (s.windup > 0 ? 3 : 0);
      if (d < r && d < bestD) { best = s; bestD = d; }
    }
    if (!best) return;
    const s = best, intended = P.passTo === s;
    const sameTeamPass = P.passTo && P.passTo.team === s.team;
    let take = intended || v < 240 || (sameTeamPass && v < 420);
    if (!take) {
      // a fast puck past a stick: sometimes picked off, sometimes knocked down, often it gets by
      const r = Math.random();
      if (r < 0.22) take = true;
      else if (r < 0.5) { P.vx *= 0.3; P.vy *= 0.3; P.vx += rnd(-50, 50); P.vy += rnd(-50, 50); P.shot = null; s.pickCd = 0.12; this.emit('tip', { s }); return; }
      else { s.pickCd = 0.2; return; }
    }
    P.owner = s; P.shot = null; P.passTo = null; P.lastTeam = s.team; P.ghost = null;
    this.emit('pickup', { s, intended });
  }
  pokes() {
    const P = this.puck;
    for (const s of this.skaters) {
      if (s.pokeT <= 0 || s.poked) continue;
      const [bx, by] = s.blade;
      if (len(bx - P.x, by - P.y) > 8 + PUCK_R) continue;
      if (P.owner === s) continue;
      if (P.owner && P.owner.team === s.team) continue;
      s.poked = true;
      if (P.owner) {
        const o = P.owner, skill = s.human ? HUMAN_POKE : this.ais[s.team].poke;
        const p = skill * (1 - Math.min(0.6, o.handle / 450));
        if (Math.random() < p) {
          P.owner = null; P.vx = s.pokeDx * 170 + o.vx * 0.5 + rnd(-30, 30); P.vy = s.pokeDy * 170 + o.vy * 0.5 + rnd(-30, 30);
          o.pickCd = 0.45; this.emit('steal', { s, from: o });
        } else { s.recover = 0.25; s.pokeCd = 0.8; this.emit('whiff', { s }); }
      } else {
        P.vx = P.vx * 0.3 + s.pokeDx * 160; P.vy = P.vy * 0.3 + s.pokeDy * 160; P.shot = null; P.passTo = null; P.air = 0; P.z = 0;
      }
    }
  }

  /* ---------------- computer players ---------------- */
  think(s, dt) {
    const c = blankCmd(), P = this.puck, A = this.ais[s.team];
    // the team's seeded personality, and its own random for every choice it makes
    const D = this.dummies[s.team], p = D.p, R = D.R, rand = D.rand;
    const dir = s.team === 0 ? 1 : -1, attackX = dir * GX, ownX = -attackX;
    const ai = s.ai; ai.phase += dt * 9;
    const mates = this.team(s.team), opps = this.team(1 - s.team);
    const owner = P.owner, gHold = this.goalies.find((g) => g && g.hold > 0);
    const ownerTeam = owner ? owner.team : gHold ? gHold.team : -1;
    let tx = s.x, ty = s.y, stickX = s.fx * 0.6, stickY = s.fy * 0.6;
    ai.next -= dt;
    const decide = ai.next <= 0; if (decide) ai.next = A.think * p.think * rand(0.7, 1.3);

    // charging a slapshot
    if (ai.wind > 0) {
      ai.wind -= dt; ai.power += dt;
      c.windup = ai.power; c.wdx = -ai.sdx; c.wdy = -ai.sdy; c.stop = 0.25;
      if (owner !== s) { ai.wind = 0; ai.power = 0; }
      else if (ai.wind <= 0) {
        const [dx, dy] = this.aimAt(s, attackX);
        c.shoot = { dx, dy, power: ai.power, spread: A.aim * 0.8 * (0.8 + 0.4 * p.snipe) }; ai.power = 0;
      }
      s.cmd = c; return c;
    }

    if (owner === s) {
      // carry it up ice, shoot from good ice, pass under pressure
      const near = this.nearest(opps, s.x, s.y), nd = near ? len(near.x - s.x, near.y - s.y) : 999;
      const dGoal = len(attackX - s.x, -s.y), deep = (attackX - s.x) * dir;
      tx = attackX - dir * 85 * p.drive; ty = clamp(s.y * 0.6 * p.width, -70, 70);
      if (deep < 110 * p.drive) { tx = attackX - dir * 55 * p.drive; ty = (s.y > 0 ? 35 : -35) * p.width; }
      if (near && nd < 75) { // sidestep whoever is in front; a dangler sidesteps less and handles through it
        const [ux, uy] = norm(tx - s.x, ty - s.y), ox = near.x - s.x, oy = near.y - s.y, step = 70 * (1.5 - 0.5 * p.dangle);
        if (ox * ux + oy * uy > 0) { const side = (ox * uy - oy * ux) > 0 ? 1 : -1; tx += -uy * side * step; ty += ux * side * step; }
      }
      const pressured = nd < 48 * (0.75 + 0.35 * p.dangle);
      if (pressured) { const sw = Math.sin(ai.phase) * Math.min(1.3, 0.95 * p.dangle); [stickX, stickY] = rot(s.fx, s.fy, sw); }
      if (decide) {
        const angleOk = Math.abs(s.y) < 115 && deep > 18;
        if (angleOk && dGoal < p.range && R() < p.shoot) {
          const [dx, dy] = this.aimAt(s, attackX);
          if (dGoal > 150 && nd > 70 && R() < p.slap) { ai.wind = rand(0.45, 0.8); ai.power = 0; ai.sdx = dx; ai.sdy = dy; }
          else c.shoot = { dx, dy, power: rand(0.1, 0.35), spread: A.aim * (0.8 + 0.4 * p.snipe) };
        } else if (pressured && R() < clamp(A.pass * p.pass, 0.1, 0.95)) this.aiPass(s, c, opps);
        else if (deep < 40 && R() < 0.5 * p.pass) this.aiPass(s, c, opps);
      }
    } else if (ownerTeam === s.team) {
      // support the carrier: one goes wide and ahead, one trails
      const car = owner || gHold, others = mates.filter((m) => m !== owner && !m.human);
      const k = others.indexOf(s), side = Math.sign(car.y) || 1, inZone = car.x * dir > BLUE;
      const w = p.width;
      if (inZone) { if (k === 0) { tx = attackX - dir * 70; ty = -side * 40 * w; } else { tx = dir * (BLUE + 35); ty = side * 60 * w; } }
      else if (k === 0) { tx = car.x + dir * 100; ty = -side * 70 * w; } else { tx = car.x - dir * 60; ty = side * 25 * w; }
      ty = clamp(ty, -HY + 25, HY - 25);
      tx = clamp(tx, -HX + 40, HX - 40); if ((attackX - tx) * dir < 45) tx = attackX - dir * 45;
      [stickX, stickY] = norm(car.x - s.x, car.y - s.y);
    } else if (gHold) {
      // their goalie has it: back off to the middle and pick men up
      tx = ownX * 0.3 + (P.x - ownX) * 0.2; ty = (s.idx - 1) * 70 * p.width;
    } else if (owner) {
      // defend: closest one pressures goal-side, the next covers the most dangerous man, the last holds the slot
      const order = mates.slice().sort((a, b) => len(a.x - owner.x, a.y - owner.y) - len(b.x - owner.x, b.y - owner.y));
      const role = order.indexOf(s);
      const [gx, gy] = norm(ownX - owner.x, -owner.y);
      if (role === 0) {
        const gap = 11 + 8 * (1 - p.forecheck); // a forechecking team plays tighter
        tx = owner.x + gx * gap; ty = owner.y + gy * gap;
        const d = len(owner.x - s.x, owner.y - s.y);
        [stickX, stickY] = norm(P.x - s.x, P.y - s.y);
        if (decide && d < SK.reach * 1.6 + SK.r && R() < p.poke) c.poke = { dx: P.x - s.x, dy: P.y - s.y };
        else if (decide && d < 34 && R() < clamp(A.check * p.hit, 0, 0.4)) { c.check = true; s.fx = (owner.x - s.x) / d; s.fy = (owner.y - s.y) / d; }
      } else if (owner.windup > 0.2) { // step into the shooting lane
        tx = owner.x + (ownX - owner.x) * 0.4; ty = owner.y * 0.6; [stickX, stickY] = norm(owner.x - s.x, owner.y - s.y);
      } else if (role === 1) {
        const mark = opps.filter((o) => o !== owner).sort((a, b) => len(a.x - ownX, a.y) - len(b.x - ownX, b.y))[0];
        if (mark) { tx = mark.x + (ownX - mark.x) * 0.3; ty = mark.y * 0.8; [stickX, stickY] = norm(owner.x - s.x, owner.y - s.y); }
      } else { tx = ownX + dir * (35 + 90 * p.forecheck); ty = owner.y * 0.3; [stickX, stickY] = norm(owner.x - s.x, owner.y - s.y); }
    } else {
      // loose puck: the closest computer player goes for it unless you're closer
      const pt = 0.25, px = P.x + P.vx * pt, py = P.y + P.vy * pt;
      const team = mates.slice().sort((a, b) => len(a.x - px, a.y - py) - len(b.x - px, b.y - py));
      const second = team[1] === s && len(s.x - px, s.y - py) < p.chase * (team[0].human ? 1 : 0.5);
      if (team[0] === s || second) { tx = px; ty = py; [stickX, stickY] = norm(P.x - s.x, P.y - s.y); ai.chase = true; }
      else {
        const attacking = P.lastTeam === s.team;
        tx = attacking ? P.x * 0.6 + dir * 60 : (ownX + P.x) / 2; ty = (s.idx - 1) * 60 * p.width;
        ai.chase = false;
      }
      if (decide && len(P.x - s.x, P.y - s.y) < SK.reach * 1.5 && len(P.vx, P.vy) > 240 && R() < 0.3) c.poke = { dx: P.x - s.x, dy: P.y - s.y };
    }
    // steer: full speed far away, ease in when close
    const dx = tx - s.x, dy = ty - s.y, d = len(dx, dy);
    if (d > 3) { const k = clamp(d / 40, 0, 1); c.mx = dx / d * k; c.my = dy / d * k; if (d < 25 && len(s.vx, s.vy) > 90) c.stop = 0.4; }
    c.sx = stickX; c.sy = stickY;
    s.cmd = c; return c;
  }
  nearest(list, x, y) { let b = null, bd = 1e9; for (const o of list) { const d = len(o.x - x, o.y - y); if (d < bd) { bd = d; b = o; } } return b; }
  aimAt(s, attackX) {
    const g = this.goalies[s.team === 0 ? 1 : 0];
    const d = this.dummies[s.team];
    const gy = g ? g.y : 0, aimY = (gy > 0 ? -1 : 1) * (GW - 9 + 6 * d.p.snipe) + d.rand(-4, 4);
    return norm(attackX - s.x, aimY - s.y);
  }
  aiPass(s, c, opps) {
    const mates = this.team(s.team).filter((m) => m !== s && !m.stun);
    let best = null, bestSc = -1e9, blocked = false;
    for (const m of mates) {
      const lane = laneClear(s, m, opps), ahead = (m.x - s.x) * (s.team === 0 ? 1 : -1);
      const sc = (lane ? 1 : 0.3) + ahead / 300 - len(m.x - s.x, m.y - s.y) / 900;
      if (sc > bestSc) { bestSc = sc; best = m; blocked = !lane; }
    }
    if (best) c.pass = { dx: best.x - s.x, dy: best.y - s.y, saucer: blocked };
  }
}
function laneClear(a, b, opps) {
  const dx = b.x - a.x, dy = b.y - a.y, L = len(dx, dy) || 1;
  for (const o of opps) {
    const t = clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / (L * L), 0, 1);
    if (len(a.x + dx * t - o.x, a.y + dy * t - o.y) < 18) return false;
  }
  return true;
}
