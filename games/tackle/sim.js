/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Tackle: the football itself, kept apart from drawing and input so it can be tested on its own.
   Field units are yards. x runs from your goal line (0) to theirs (100), end zones go to -10 and 110.
   y runs across the field from 0 to 53.3. Every player on both teams has the same speed for their
   position; the difficulty only changes how quickly the defense reads the play.
   The CPU side is a seeded dummy (../shared/seed.js): the seed changes how it plays, never how good it is. */

import { makeDummy, rng as seeded } from '../shared/seed.js';

export const FW = 160 / 3;            // field width, 53.3 yd
export const MID = FW / 2;
export const HASH = [23.58, 29.75];
const R_CATCH = 1.35, R_TACKLE = 0.95;

export const DIFFS = Object.freeze({
  rookie: { id: 'rookie', name: 'Rookie', team: 'Fargo Frost', abbr: 'FRO', rush: 3.7, runShed: 1.6, react: 0.36, cover: 0.95,
    intP: 0.3, breakP: 0.6, oppTD: 0.2, oppFG: 0.15, otTD: 0.35, swap: false },
  pro: { id: 'pro', name: 'Pro', team: 'Duluth Iron', abbr: 'DUL', rush: 3.0, runShed: 1.25, react: 0.24, cover: 0.98,
    intP: 0.45, breakP: 0.45, oppTD: 0.3, oppFG: 0.2, otTD: 0.45, swap: false },
  allpro: { id: 'allpro', name: 'All-Pro', team: 'Rochester Kings', abbr: 'ROC', rush: 2.55, runShed: 1.0, react: 0.15, cover: 1.0,
    intP: 0.6, breakP: 0.35, oppTD: 0.4, oppFG: 0.22, otTD: 0.55, swap: true }
});

/* Routes are waypoints [downfield from the line, toward the middle of the field, stop?].
   A route without a stop keeps going the way its last leg points. */
export const PLAYS = Object.freeze([
  { id: 'slants', name: 'Slants', kind: 'pass', blurb: 'Quick breaks inside',
    routes: { X: [[1, 0], [9, 7]], Y: [[1, 0], [7, 7]], Z: [[4, 0], [5, -8]], RB: [[-3, 0], [0, -9]] } },
  { id: 'curls', name: 'Curls', kind: 'pass', blurb: 'Sit down at 10',
    routes: { X: [[12, 0], [10, 1, 1]], Y: [[7, 0], [6, 3, 1]], Z: [[12, 0], [10, -1, 1]], RB: [[0, 0], [2, -7]] } },
  { id: 'cross', name: 'Crossers', kind: 'pass', blurb: 'Dig, drag and a corner',
    routes: { X: [[10, 0], [11, 16]], Y: [[2, 0], [4, 18]], Z: [[10, 0], [20, -7]], RB: [[-2, 0], [1, -9]] } },
  { id: 'verts', name: 'Verticals', kind: 'pass', blurb: 'Take a shot deep',
    routes: { X: [[30, 0]], Y: [[6, 0], [30, 2]], Z: [[10, 0], [30, 7]], RB: [[0, 2], [5, 6, 1]] } },
  { id: 'dive', name: 'Dive', kind: 'run', blurb: 'Handoff up the middle', handoff: 0.35,
    routes: { X: [[3, 0]], Y: [[3, 0]], Z: [[3, 0]], RB: [[1, 2], [6, 2]] } },
  { id: 'sweep', name: 'Sweep', kind: 'run', blurb: 'Pitch it to the edge', handoff: 0.2,
    routes: { X: [[3, 0]], Y: [[3, 0]], Z: [[3, 0]], RB: [[-3, -6], [0, -12]] } }
]);

/* ---------- seeded dummies: every CPU team is rolled from its own seed ---------- */
/* drawn in this order, so the same seed is always the same team */
export const RANGES = Object.freeze({
  tempo: [0.6, 1.8],     // seconds it spends at the line before the snap
  runCall: [0.25, 0.6],  // chance to call a run on an ordinary down
  deep: [0.1, 0.6],      // love of the deep shot: Verticals and far targets
  patience: [0.9, 2.3],  // seconds the QB holds before he takes the best he has
  open: [1.6, 3.6],      // yards of room the QB wants before he lets it go
  gamble: [0.04, 0.28],  // chance to force a throw into coverage, or to try a long kick
  vision: [0.3, 1.0],    // how hard the runner cuts away from tacklers (low = straight ahead)
  juke: [0.2, 0.7],      // chance to juke a tackler who is about to arrive
  burst: [0.2, 0.7],     // meter it keeps in the tank before it bursts or stiff-arms
  goFor: [0.5, 3.5],     // goes for it on 4th down with this many yards to go or fewer
  lean: [-1, 1],         // defense: -1 reads the pass fast and the run late, +1 the other way round
  cushion: [0.8, 2.2],   // defense: yards the corners play off their man (deep help vs. underneath)
  blitz: [0, 0.35],      // defense: chance a linebacker leaves the back to rush the QB
  pursuit: [0.5, 1.0],   // defense: how far ahead of the carrier tacklers aim
  safe: [0.35, 0.75]     // defense: how far the safety leans toward the deepest receiver
});
export const STYLES = Object.freeze([
  ['gunslinger', (p) => p.deep > 0.5],
  ['ground and pound', (p) => p.runCall > 0.5],
  ['blitz happy', (p) => p.blitz > 0.26],
  ['ball hawk', (p) => p.lean < -0.5],
  ['run stopper', (p) => p.lean > 0.6]
]);
export const NEUTRAL = Object.freeze(Object.fromEntries(Object.entries(RANGES).map(([k, [a, b]]) => [k, (a + b) / 2])));
export function makeTeam(seed) { return makeDummy(seed, RANGES, STYLES, 'balanced'); }

export const SPEED = { QB: 6.5, RB: 8.4, WR: 8.6, OL: 5.6, DL: 6.6, LB: 7.6, DB: 8.6 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function mk(team, role, pos, x, y, speed) {
  return { team, role, pos, x, y, sx: x, sy: y, vx: 0, vy: 0, speed, stun: 0, hist: [], route: null, ri: 0, eng: null, chase: null };
}

/* Set up one play. x0 is the line of scrimmage, yb where the ball is spotted.
   dp is the defending dummy's numbers, dR its own random source for its pre-snap call. */
export function newPlay(x0, yb, playId, diff, rng = Math.random, dp = NEUTRAL, dR = rng) {
  const play = PLAYS.find((p) => p.id === playId) || PLAYS[0];
  const c = clamp(yb, HASH[0], HASH[1]);
  const wy = (y) => clamp(y, 3, FW - 3);
  const off = {
    QB: mk('off', 'QB', 'QB', x0 - 4.5, c, SPEED.QB),
    RB: mk('off', 'RB', 'RB', x0 - 5.5, c + 2, SPEED.RB),
    O1: mk('off', 'OL', 'OL', x0 - 0.8, c - 1.4, SPEED.OL),
    O2: mk('off', 'OL', 'OL', x0 - 0.8, c + 1.4, SPEED.OL),
    X: mk('off', 'X', 'WR', x0 - 0.6, wy(c - 17), SPEED.WR),
    Y: mk('off', 'Y', 'WR', x0 - 1.2, wy(c - 9), SPEED.WR),
    Z: mk('off', 'Z', 'WR', x0 - 0.6, wy(c + 16), SPEED.WR)
  };
  const def = {
    D1: mk('def', 'DL', 'DL', x0 + 0.8, c - 1.4, SPEED.DL * diff.cover),
    D2: mk('def', 'DL', 'DL', x0 + 0.8, c + 1.4, SPEED.DL * diff.cover),
    L1: mk('def', 'LB', 'LB', x0 + 5, c - 4.5, SPEED.LB * diff.cover),
    L2: mk('def', 'LB', 'LB', x0 + 5, c + 4.5, SPEED.LB * diff.cover),
    C1: mk('def', 'CB', 'DB', x0 + 6, off.X.y, SPEED.DB * diff.cover),
    C2: mk('def', 'CB', 'DB', x0 + 6, off.Z.y, SPEED.DB * diff.cover),
    S: mk('def', 'S', 'DB', x0 + 12, c, SPEED.DB * diff.cover)
  };
  // corners take the outside receivers, a linebacker takes the slot, the safety stays deep
  def.C1.man = off.X; def.C2.man = off.Z; def.L1.man = off.Y; def.L2.man = off.RB;
  def.S.deep = true;
  // the dummy calls its defense before it knows the play: sometimes the second backer leaves the back and blitzes
  if (dR() < dp.blitz) { def.L2.man = null; def.L2.blitz = true; }
  // on runs, who each receiver goes to block
  off.X.blockOn = def.C1; off.Z.blockOn = def.C2; off.Y.blockOn = def.L1;
  for (const k of ['X', 'Y', 'Z', 'RB']) {
    const p = off[k], side = p.y < c ? 1 : -1;
    p.route = play.routes[k].map(([dx, din, stop]) => ({ x: x0 + dx, y: wy(p.y + side * din), stop: !!stop }));
  }
  const p = {
    play, diff, dp, x0, c, t: 0, rng, off, def,
    all: [...Object.values(off), ...Object.values(def)],
    phase: 'live', ball: { at: off.QB, air: null }, carrier: null, carrierAt: 0,
    qb: { holding: false, holdT: 0, zip: 0, depth: 0, dropTo: x0 - 9.5 },
    aim: { x: x0 + 8, y: c }, meter: 1, trigArmed: false, juke: { t: 0, cd: 0 },
    result: null, events: [], firstDown: x0 + 10
  };
  // engaged at the snap: linemen on linemen
  engage(off.O1, def.D1, play.kind === 'pass' ? diff.rush + rng() * 0.6 : diff.runShed + rng() * 0.4);
  engage(off.O2, def.D2, play.kind === 'pass' ? diff.rush + 0.3 + rng() * 0.6 : diff.runShed + 0.2 + rng() * 0.4);
  return p;
}

function engage(blocker, defender, dur) {
  blocker.eng = defender; defender.eng = { by: blocker, until: dur };
}
function release(d) { if (d.eng) { d.eng.by.eng = null; d.eng = null; } }

function move(p, tx, ty, speed, dt, accel = 12) {
  const dx = tx - p.x, dy = ty - p.y, m = Math.hypot(dx, dy);
  let wx = 0, wy = 0;
  if (m > 0.05) { const s = Math.min(speed, m * 6) / m; wx = dx * s; wy = dy * s; }
  const k = Math.min(1, accel * dt);
  p.vx += (wx - p.vx) * k; p.vy += (wy - p.vy) * k;
  p.x += p.vx * dt; p.y += p.vy * dt;
}
function past(p, t) {
  const h = p.hist; if (!h.length) return p;
  for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= t) return h[i];
  return h[0];
}

/* ctl: { sx, sy, trig, trigDown (pressed this frame), jukeDir } read from the live hand only. */
export function step(p, dt, ctl) {
  if (p.result) return p.result;
  p.t += dt; p.events.length = 0;
  const { off, def, diff } = p, t = p.t;
  for (const q of p.all) { q.hist.push({ t, x: q.x, y: q.y }); if (q.hist.length > 90) q.hist.shift(); if (q.stun > 0) q.stun -= dt; }

  // handoff on run plays
  if (p.play.kind === 'run' && !p.carrier && t >= p.play.handoff) giveBall(p, off.RB);

  // ---------- quarterback ----------
  if (p.play.kind === 'pass' && !p.carrier && !p.ball.air) {
    const qb = off.QB, held = ctl.trig > 0.08;
    p.aim.x = clamp(p.aim.x + ctl.sx * 24 * dt, qb.x + 1, 112);
    p.aim.y = clamp(p.aim.y + ctl.sy * 24 * dt, -1, FW + 1);
    if (held) {
      p.qb.holding = true; p.qb.holdT += dt;
      p.qb.depth = Math.max(p.qb.depth, ctl.trig);
      p.qb.zip = Math.min(1, p.qb.holdT / 0.9) * p.qb.depth;
      move(qb, Math.max(p.qb.dropTo, qb.x - 0.1), qb.y, qb.x > p.qb.dropTo + 0.2 ? 3.6 : 0, dt);
    } else {
      if (p.qb.holding && p.qb.holdT >= 0.3) throwBall(p);
      p.qb.holding = false; p.qb.holdT = 0; p.qb.depth = 0; p.qb.zip = 0;
      move(qb, qb.x, qb.y, 0, dt);
    }
  } else if (!p.carrier || p.carrier !== off.QB) {
    move(off.QB, off.QB.x, off.QB.y, 0, dt);
  }

  // ---------- ball in the air ----------
  if (p.ball.air) {
    const a = p.ball.air; a.t += dt;
    if (a.t >= a.T) return resolveCatch(p);
  }

  // ---------- receivers and backs ----------
  for (const k of ['X', 'Y', 'Z', 'RB']) {
    const r = off[k];
    if (r === p.carrier) continue;
    if (p.play.kind === 'run' && k !== 'RB') { runBlock(p, r, dt); continue; }
    if (r.chase) { move(r, r.chase.x, r.chase.y, r.speed, dt, 16); continue; }
    if (p.play.kind === 'run' && k === 'RB' && !p.carrier) { followRoute(r, dt, 0.8); continue; }
    if (p.carrier && p.carrier !== r) { leadBlock(p, r, dt); continue; }
    followRoute(r, dt, 1);
  }
  for (const o of [off.O1, off.O2]) {
    if (o.eng) { o.x = o.eng.x - 1.05; o.y = o.eng.y; continue; }
    if (p.carrier) leadBlock(p, o, dt); else move(o, o.x, o.y, 0, dt);
  }

  // ---------- carrier ----------
  if (p.carrier) {
    const r = runCarrier(p, dt, ctl);
    if (r) return r;
  }

  // ---------- defense ----------
  for (const d of Object.values(def)) {
    if (d.eng) {
      d.eng.until -= dt;
      if (d.eng.until <= 0) { release(d); }
      else { const tgt = p.carrier || off.QB; move(d, d.x + Math.sign(tgt.x - d.x) * 0.5, d.y + Math.sign(tgt.y - d.y) * 0.5, 1.1, dt); continue; }
    }
    if (d.stun > 0) { move(d, d.x, d.y, 0, dt, 4); continue; }
    defend(p, d, dt);
  }

  // ---------- sack ----------
  if (p.play.kind === 'pass' && !p.carrier && !p.ball.air) {
    for (const d of Object.values(def)) {
      if (!d.eng && d.stun <= 0 && dist(d, off.QB) < R_TACKLE) {
        const x = off.QB.x;
        return end(p, x <= 0 ? 'safety' : 'sack', x, x <= 0 ? 'Sacked in the end zone. Safety.' : 'Sacked.', 'run');
      }
    }
  }
  if (t > 25) return end(p, 'inc', p.x0, 'Play blown dead.', 'stop');
  return null;
}

function followRoute(r, dt, pace) {
  const wp = r.route[r.ri];
  if (!wp) return move(r, r.x, r.y, 0, dt);
  if (Math.hypot(wp.x - r.x, wp.y - r.y) < 0.7) {
    if (r.ri < r.route.length - 1) r.ri++;
    else if (!wp.stop) {
      const prev = r.route[r.ri - 1] || { x: r.sx, y: r.sy };
      const dx = wp.x - prev.x, dy = wp.y - prev.y, m = Math.hypot(dx, dy) || 1;
      r.route.push({ x: clamp(wp.x + dx / m * 30, -5, 115), y: clamp(wp.y + dy / m * 30, 0.8, FW - 0.8), stop: false });
      r.ri++;
    } else return move(r, wp.x, wp.y, 0, dt);
  }
  const cur = r.route[r.ri];
  move(r, cur.x, cur.y, r.speed * pace, dt);
}

function runBlock(p, r, dt) {
  // receivers on a run go block the man covering them
  if (r.eng) { r.x = r.eng.x - 1.05; r.y = r.eng.y; return; }
  const mine = r.blockOn && !r.blockOn.eng ? r.blockOn : null;
  if (!mine || p.t < 0.15) return followRoute(r, dt, 0.6);
  move(r, mine.x - 0.9, mine.y, r.speed * 0.8, dt);
  if (dist(r, mine) < 1.2) engage(r, mine, 1.1 + p.rng() * 1.2);
}
function leadBlock(p, r, dt) {
  // once someone has the ball, the others look for a defender between him and the end zone
  // one block each, and only near the ball
  if (r.eng) { r.x = r.eng.x - 1.05; r.y = r.eng.y; return; }
  const c = p.carrier;
  if (r.blocks >= 1 || dist(r, c) > 9) return move(r, r.x + 0.3, r.y, r.speed * 0.3, dt);
  let best = null, bd = 6;
  for (const d of Object.values(p.def)) {
    if (d.eng || d.stun > 0 || d.x < c.x - 1) continue;
    const dd = dist(r, d), dc = dist(c, d);
    if (dc < 7 && dd < bd) { bd = dd; best = d; }
  }
  if (!best) return move(r, r.x + 0.3, r.y, r.speed * 0.4, dt);
  move(r, best.x - 0.8, best.y, r.speed * 0.85, dt);
  if (dist(r, best) < 1.1) { engage(r, best, 0.45 + p.rng() * 0.45); r.blocks = (r.blocks || 0) + 1; }
}

function defend(p, d, dt) {
  const { diff, off, dp } = p, t = p.t;
  // the seed trades one read for the other: quicker on the pass means later on the run, and back
  const passR = diff.react * (1 + 0.2 * dp.lean), runR = diff.react * (1 - 0.2 * dp.lean);
  // a carrier: everyone pursues, after they have read it
  if (p.carrier && (p.play.kind === 'run' ? t >= runR + 0.45 : t - p.carrierAt >= passR)) return pursue(p, d, dt);
  // ball in the air: break on the spot once they read the throw
  if (p.ball.air && t - p.ball.air.at >= passR && d.pos !== 'DL') {
    const a = p.ball.air, rem = Math.max(0.05, a.T - a.t);
    const reach = d.speed * rem;
    if (Math.hypot(a.to.x - d.x, a.to.y - d.y) < reach + 6) return move(d, a.to.x, a.to.y, d.speed, dt, 16);
  }
  if (d.pos === 'DL' || d.blitz) return move(d, off.QB.x, off.QB.y, d.speed, dt);
  if (p.play.kind === 'run' && t >= runR + 0.45) return pursue(p, d, dt, off.RB);
  if (d.deep) {
    // stays deeper than the deepest receiver, leaning toward his side of the field
    let deepest = null;
    for (const k of ['X', 'Y', 'Z']) { const r = past(off[k], t - diff.react); if (!deepest || r.x > deepest.x) deepest = r; }
    return move(d, Math.max(p.x0 + 12, deepest.x + 5), MID + (deepest.y - MID) * dp.safe, d.speed, dt);
  }
  if (d.man) {
    const m = past(d.man, t - diff.react);
    const deep = d.pos === 'DB' ? dp.cushion : 0.6;
    return move(d, m.x + deep, m.y, d.speed, dt);
  }
  if (d.zone) {
    let best = null, bd = 8;
    for (const k of ['X', 'Y', 'Z']) { const r = past(off[k], t - diff.react); const dd = Math.hypot(r.x - d.zone.x, r.y - d.zone.y); if (dd < bd) { bd = dd; best = r; } }
    return best ? move(d, best.x + 1, best.y, d.speed * 0.9, dt) : move(d, d.zone.x, d.zone.y, d.speed * 0.6, dt);
  }
  return move(d, d.x, d.y, 0, dt);
}
function pursue(p, d, dt, who = p.carrier) {
  const c = who, dd = dist(d, c);
  const lead = clamp(dd / d.speed, 0, 1.2) * p.dp.pursuit;
  // closing speed: a tackler gets a last lunge when he is almost there
  move(d, c.x + c.vx * lead, c.y + c.vy * lead, d.speed * (dd < 3 ? 1.12 : 1), dt, 14);
}

function giveBall(p, r) {
  p.carrier = r; p.carrierAt = p.t; p.ball.at = r; p.ball.air = null; r.chase = null;
  p.trigArmed = false; p.meter = Math.max(p.meter, 0);
  p.events.push({ type: 'ball', who: r.role });
}

function throwBall(p) {
  const qb = p.off.QB, to = { x: p.aim.x, y: p.aim.y };
  const d = Math.hypot(to.x - qb.x, to.y - qb.y);
  const zip = p.qb.zip, v = 12 + 22 * zip, T = d / v + 0.1;
  p.ball.air = { from: { x: qb.x, y: qb.y }, to, t: 0, T, at: p.t, zip, d };
  p.ball.at = null;
  // the receiver closest to the spot goes and gets it
  let best = null, bd = 10;
  for (const k of ['X', 'Y', 'Z', 'RB']) { const r = p.off[k]; const dd = dist(r, to); if (dd < bd) { bd = dd; best = r; } }
  if (best) best.chase = to;
  p.events.push({ type: 'throw', zip });
}

function resolveCatch(p) {
  const a = p.ball.air, land = a.to;
  if (land.y < 0 || land.y > FW || land.x > 110) return end(p, 'inc', p.x0, 'Incomplete. Out of bounds.', 'stop');
  const near = (list) => { let b = null, bd = Infinity; for (const q of list) { if (q.stun > 0) continue; const dd = dist(q, land); if (dd < bd) { bd = dd; b = q; } } return [b, bd]; };
  const [rec, dr] = near(['X', 'Y', 'Z', 'RB'].map((k) => p.off[k]));
  const [, dd] = near(Object.values(p.def).filter((d) => !d.eng));
  const r = p.rng();
  if (dr <= R_CATCH) {
    if (dd <= R_CATCH && dd < dr) return r < p.diff.intP ? pick(p, land) : end(p, 'inc', p.x0, 'Incomplete. Broken up.', 'stop');
    if (dd <= R_CATCH && r > 0.65) return end(p, 'inc', p.x0, 'Incomplete. Knocked away.', 'stop');
    if (a.zip > 0.85 && a.d < 9 && p.rng() < 0.3) return end(p, 'inc', p.x0, 'Dropped. Too much zip that close.', 'stop');
    // securing the catch costs a step
    rec.x = land.x; rec.y = land.y; rec.vx *= 0.35; rec.vy *= 0.35;
    giveBall(p, rec);
    p.events.push({ type: 'catch', who: rec.role });
    if (rec.x >= 100) return end(p, 'td', rec.x, 'Touchdown.', 'stop');
    return null;
  }
  if (dd <= 1.0 && r < p.diff.intP * 0.8) return pick(p, land);
  return end(p, 'inc', p.x0, 'Incomplete.', 'stop');
}
function pick(p, land) {
  return end(p, 'int', land.x, 'Intercepted.', 'stop');
}

function runCarrier(p, dt, ctl) {
  const c = p.carrier, J = p.juke;
  if (ctl.trig < 0.1) p.trigArmed = true;
  const burst = p.trigArmed && ctl.trig > 0.3 && p.meter > 0.02;
  if (burst) p.meter = Math.max(0, p.meter - 0.55 * dt); else p.meter = Math.min(1, p.meter + 0.22 * dt);
  J.cd -= dt; J.t -= dt;
  if (ctl.jukeDir && J.cd <= 0) { J.t = 0.2; J.cd = 1.0; J.dir = ctl.jukeDir; c.vy = ctl.jukeDir * 12; p.events.push({ type: 'juke' }); }
  const sp = c.speed * 0.96 * (burst ? 1.3 : 1);
  if (J.t > -0.15) { c.vx += (ctl.sx * sp * 0.55 - c.vx) * Math.min(1, 6 * dt); c.vy += ((J.t > 0 ? J.dir * 11 : ctl.sy * sp) - c.vy) * Math.min(1, 20 * dt); }
  else {
    const k = Math.min(1, 9 * dt);
    c.vx += (ctl.sx * sp - c.vx) * k; c.vy += (ctl.sy * sp - c.vy) * k;
  }
  c.x += c.vx * dt; c.y += c.vy * dt;
  p.bursting = burst;
  if (c.x >= 100) return end(p, 'td', c.x, 'Touchdown.', 'stop');
  if (c.y < 0.2 || c.y > FW - 0.2) return c.x <= 0 ? end(p, 'safety', c.x, 'Out in your end zone. Safety.', 'stop') : end(p, 'oob', c.x, 'Out of bounds.', 'stop');
  if (c.x < -9.5) return end(p, 'safety', c.x, 'Safety.', 'run');
  for (const d of Object.values(p.def)) {
    if (d.eng || d.stun > 0 || dist(d, c) > R_TACKLE) continue;
    // a juke beats one tackler coming from in front or the side, and only if you cut away from him
    if (J.t > 0 && d.x > c.x - 0.6 && Math.sign(d.y - c.y) !== J.dir) { d.stun = 0.7; J.t = 0; p.events.push({ type: 'missed', how: 'juke' }); continue; }
    if (burst && p.meter >= 0.15) {
      if (p.rng() < p.diff.breakP) {
        p.meter = Math.max(0, p.meter - 0.45); d.stun = 1.0;
        const m = dist(d, c) || 1; d.x += (d.x - c.x) / m * 1.4; d.y += (d.y - c.y) / m * 1.4;
        p.events.push({ type: 'missed', how: 'stiff' }); continue;
      }
    }
    const x = c.x + 0.5;
    if (x <= 0) return end(p, 'safety', x, 'Tackled in your end zone. Safety.', 'run');
    return end(p, 'tackle', Math.min(x, 99.6), 'Tackled.', 'run');
  }
  return null;
}

function end(p, type, x, text, clock) {
  const who = p.carrier || p.off.QB;
  p.result = { type, x, y: type === 'inc' || type === 'int' ? p.c : who.y, text, clock, carrier: p.carrier ? p.carrier.role : null };
  p.phase = 'dead';
  return p.result;
}

/* ---------- the other team's drives, simulated ---------- */
/* dp: the dummy's numbers. A deep-ball team scores touchdowns a bit more and field goals a bit less,
   a gambler turns it over a bit more, a running team eats more clock. Roughly the same points either way. */
export function simDrive(dist0, diff, rng = Math.random, dp = NEUTRAL) {
  const f = clamp(1.35 - dist0 / 110, 0.45, 1.35);
  const lean = (dp.deep - NEUTRAL.deep) / 0.25;   // -1 .. 1
  const pTD = diff.oppTD * f * (1 + 0.12 * lean), pFG = diff.oppFG * (dist0 < 85 ? 1 : 0.6) * (1 - 0.22 * lean);
  const pTO = 0.13 + 0.25 * (dp.gamble - NEUTRAL.gamble);
  const r = rng();
  let kind = r < pTD ? 'td' : r < pTD + pFG ? 'fg' : r < pTD + pFG + pTO ? (rng() < 0.5 ? 'int' : 'downs') : 'punt';
  let yds;
  if (kind === 'td') yds = dist0;
  else if (kind === 'fg') yds = clamp(dist0 - (8 + rng() * 24), 0, dist0 - 3);
  else if (kind === 'punt') yds = rng() * Math.min(30, dist0 - 30);
  else yds = rng() * dist0 * 0.6;
  yds = Math.max(0, Math.round(yds));
  if (kind === 'fg' && rng() < 0.15) kind = 'fgmiss';
  const plays = Math.max(3, Math.round(yds / 6 + rng() * 3));
  const time = Math.round((25 + plays * (12 + rng() * 5)) * (1 + 0.5 * (dp.runCall - NEUTRAL.runCall)));
  return { kind, yds, plays, time, endDist: dist0 - yds, pts: kind === 'td' ? 7 : kind === 'fg' ? 3 : 0 };
}
export function simOT(diff, rng = Math.random) {
  const r = rng();
  return r < diff.otTD ? 7 : r < diff.otTD + 0.3 ? 3 : 0;
}

/* ---------- field goal needle, shared by the player's kick and the dummy's ---------- */
export function kickSpec(kd) {
  return { w: 2.1 + (kd - 20) * 0.06, win: Math.max(0.07, 0.3 - (kd - 20) * 0.006) };
}

/* ---------- the dummy's offense: it plays through the same stick and trigger a player does ---------- */
export function newBrain() { return { look: 0, target: null, away: false, commit: false, miss: null, jukeFor: new Map(), trig: 0 }; }

const RECV = ['X', 'Y', 'Z', 'RB'];
function leadSpot(p, r, zip) {
  const qb = p.off.QB, v = 12 + 22 * zip;
  let T = Math.hypot(r.x - qb.x, r.y - qb.y) / v + 0.1;
  T = Math.hypot(r.x + r.vx * T - qb.x, r.y + r.vy * T - qb.y) / v + 0.1;
  return { x: clamp(r.x + r.vx * T, qb.x + 1, 108), y: clamp(r.y + r.vy * T, 1.5, FW - 1.5), T };
}
function room(p, spot) {
  // how much room the catch spot has once the defenders break on the ball
  let m = Infinity;
  for (const d of Object.values(p.def)) {
    if (d.eng || d.stun > 0) continue;
    m = Math.min(m, Math.hypot(d.x - spot.x, d.y - spot.y) - d.speed * Math.max(0, spot.T - 0.25) * 0.2);
  }
  return m;
}

/* team: the offense's dummy ({ p, R }). Returns the same ctl a hand gives: { sx, sy, trig, jukeDir }. */
export function cpuControl(p, b, team, dt) {
  const P = team.p, R = team.R, ctl = { sx: 0, sy: 0, trig: 0, jukeDir: 0 };
  if (p.result) return ctl;
  if (p.carrier) return cpuRun(p, b, P, R, ctl);
  if (p.play.kind !== 'pass' || p.ball.air) return ctl;

  const qb = p.off.QB, held = p.qb.holdT;
  // read the field: the best target right now, rated by room and by how far downfield it is
  let best = null;
  for (const k of RECV) {
    const r = p.off[k];
    const s = leadSpot(p, r, Math.max(0.5, b.trig * Math.min(1, (held + 0.4) / 0.9)));
    const sep = room(p, s), gain = s.x - p.x0;
    const score = sep + gain * (0.03 + 0.12 * P.deep);
    if (!best || score > best.score) best = { k, s, sep, gain, score };
  }
  if (!b.commit) b.target = best;
  const tgt = b.target;
  // pressure: the nearest free defender
  let rush = Infinity;
  for (const d of Object.values(p.def)) if (!d.eng && d.stun <= 0) rush = Math.min(rush, Math.hypot(d.x - qb.x, d.y - qb.y));

  b.look -= dt;
  if (!b.commit && held >= 0.3 && b.look <= 0) {
    b.look = 0.15;
    // it reads the coverage, but not perfectly: some windows look bigger than they are
    const sep = tgt.sep + (R() - 0.5) * 5;
    if (sep >= P.open) b.commit = true;
    else if (held >= P.patience && sep >= P.open * 0.5) b.commit = true;
    else if (rush < 2.4 || held >= P.patience + 1.2) {
      if (sep >= 0.8 || R() < P.gamble) b.commit = true;
      else { b.commit = true; b.away = true; }
    } else if (held >= P.patience && R() < P.gamble * 0.5) b.commit = true;
  }
  // nobody puts it on the spot every time: once it decides, it misses by a little, more on long or hurried throws
  if (b.commit && !b.miss) {
    const len = Math.hypot(tgt.s.x - qb.x, tgt.s.y - qb.y), r = (0.4 + 0.07 * len + (rush < 2.4 ? 1 : 0)) * Math.sqrt(R()), a = R() * Math.PI * 2;
    b.miss = { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }
  // where the stick drives the aim: the target's lead spot, or out of bounds to throw it away
  const aim = b.away ? { x: qb.x + 6, y: qb.y < MID ? -1 : FW + 1 } : b.miss ? { x: tgt.s.x + b.miss.x, y: tgt.s.y + b.miss.y } : tgt.s;
  ctl.sx = clamp((aim.x - p.aim.x) / 1.2, -1, 1);
  ctl.sy = clamp((aim.y - p.aim.y) / 1.2, -1, 1);
  // more zip for long throws; short ones stay soft so they can be caught
  b.trig = Math.max(b.trig, tgt.gain > 12 || tgt.s.T > 0.9 ? 0.95 : 0.62);
  ctl.trig = b.trig;
  if (b.commit && held >= 0.3 && Math.hypot(aim.x - p.aim.x, aim.y - p.aim.y) < (b.away ? 2 : 1.1)) ctl.trig = 0;
  return ctl;
}

function cpuRun(p, b, P, R, ctl) {
  const c = p.carrier;
  let sx = 1, sy = 0, near = null, nd = Infinity;
  for (const d of Object.values(p.def)) {
    if (d.eng || d.stun > 0) continue;
    const dd = Math.hypot(d.x - c.x, d.y - c.y);
    if (dd < nd) { nd = dd; near = d; }
    if (dd > 9 || d.x < c.x - 1.5) continue;
    const w = (9 - dd) / 9, side = Math.sign(d.y - c.y) || (c.y < MID ? -1 : 1);
    sy -= side * w * P.vision * (d.x > c.x ? 1 : 0.5);
    sx -= w * 0.25;
  }
  if (c.y < 5) sy += (5 - c.y) / 5 * 1.6;
  if (c.y > FW - 5) sy -= (c.y - (FW - 5)) / 5 * 1.6;
  sx = Math.max(0.35, sx);
  const m = Math.hypot(sx, sy) || 1;
  ctl.sx = sx / m; ctl.sy = sy / m;
  // a tackler about to arrive: one roll each for whether it jukes him and when. Too early and the juke is wasted.
  if (near && nd < 2.6 && !b.jukeFor.has(near)) b.jukeFor.set(near, R() < P.juke ? 0.85 + R() * 1.4 : -1);
  const at = near ? b.jukeFor.get(near) : -1;
  if (at > 0 && nd < at && near.x > c.x - 0.6 && p.juke.cd <= 0) { b.jukeFor.set(near, -1); ctl.jukeDir = -(Math.sign(near.y - c.y) || 1); }
  // burst and stiff-arm only into a tackler in front of it, and only with enough meter left
  if (near && nd < 2.2 && near.x > c.x && p.meter > P.burst) ctl.trig = 1;
  return ctl;
}

/* ---------- CPU vs CPU: a whole game, both sides played by seeded dummies ---------- */
/* No drawing or input in here, so a node test can play a full game. The page only draws m. */
export function newMatch({ secs = 180, diff = DIFFS.pro, seeds }) {
  const teams = seeds.map((s, i) => ({ name: i ? 'Dummy B' : 'Dummy A', abbr: i ? 'B' : 'A', d: makeTeam(s), score: 0, stats: { pass: 0, comp: 0, yds: 0, td: 0 } }));
  const m = { watch: true, teams, diff, qLen: secs, q: 1, clock: secs, pos: 0, x: 25, y: MID, down: 1, firstX: 35,
    hand: 'R', play: null, preview: null, brain: null, phase: 'pre', preT: 0, deadT: 0, deadLen: 1.6, next: null,
    banner: '', sub: '', call: null, kick: null, ot: null, plays: 0, finalT: 0, winner: null, cues: [],
    // the game's own luck (catches, blocks, punts) comes from both seeds, the dummies' choices from their own
    rng: seeded((teams[0].d.seed ^ Math.imul(teams[1].d.seed, 0x9e3779b1)) >>> 0) };
  startDown(m);
  return m;
}
export const offTeam = (m) => m.teams[m.pos];
export const defTeam = (m) => m.teams[1 - m.pos];

function cpuCall(m) {
  const o = offTeam(m).d, P = o.p, R = o.R;
  const togo = m.firstX - m.x, kd = Math.round(100 - m.x + 17);
  const behind = defTeam(m).score - offTeam(m).score, late = m.q === 4 && m.clock < 150;
  if (m.down === 4) {
    if (m.q >= 5) return behind <= 3 && kd <= 52 ? 'fg' : pickPlay(m, togo);
    if (late && behind > 3) return pickPlay(m, togo);
    if (togo <= P.goFor && m.x > 35) return pickPlay(m, togo);
    if (kd <= 48 || (kd <= 56 && R() < P.gamble * 2.5)) return 'fg';
    return 'punt';
  }
  return pickPlay(m, togo);
}
function pickPlay(m, togo) {
  const { p: P, R } = offTeam(m).d;
  let run = P.runCall;
  if (togo > 7 && m.down >= 2) run *= 0.45;
  if (togo <= 2) run = Math.min(0.9, run + 0.3);
  if (R() < run) return R() < 0.5 ? 'dive' : 'sweep';
  if (R() < P.deep * (togo > 8 || m.x < 70 ? 1 : 0.4)) return 'verts';
  const short = ['slants', 'curls', 'cross'];
  return togo <= 4 && R() < 0.5 ? 'slants' : short[Math.floor(R() * short.length)];
}

function startDown(m) {
  m.play = null; m.brain = null; m.kick = null;
  m.preview = newPlay(m.x, m.y, 'slants', m.diff, () => 0.5);
  if (m.plays > 600) return toFinal(m);
  const call = cpuCall(m);
  m.call = call;
  if (call === 'punt') return dead(m, 'Punt', `${offTeam(m).name} punts from ${spotText(m, m.x)}.`, () => punt(m), 1.4);
  if (call === 'fg') {
    const kd = Math.round(100 - m.x + 17);
    m.kick = { kd, t: 0, ...kickSpec(kd), done: false, pressAt: null, doneT: 0 };
    m.phase = 'kick'; return;
  }
  const def = defTeam(m).d;
  m.hand = offTeam(m).d.R() < 0.5 ? 'L' : 'R';
  m.play = newPlay(m.x, m.y, call, m.diff, m.rng, def.p, def.R);
  m.brain = newBrain();
  m.preT = 0; m.phase = 'pre';
}
function dead(m, banner, sub, next, len = 1.6) {
  m.banner = banner; m.sub = sub; m.next = next; m.deadT = 0; m.deadLen = len; m.phase = 'dead';
}
function spotText(m, x) { const r = Math.round(x); return r === 50 ? 'midfield' : r < 50 ? `its own ${r}` : `the ${defTeam(m).abbr} ${100 - r}`; }

export function matchTick(m, dt) {
  m.cues.length = 0;
  if (m.phase === 'final') { m.finalT += dt; return m; }
  if (m.phase === 'pre') {
    m.preT += dt;
    if (m.preT >= offTeam(m).d.p.tempo) { m.phase = 'live'; m.cues.push('snap'); }
    return m;
  }
  if (m.phase === 'live') {
    const p = m.play, ctl = cpuControl(p, m.brain, offTeam(m).d, dt);
    const res = step(p, dt, ctl);
    const st = offTeam(m).stats;
    for (const e of p.events) { if (e.type === 'throw') st.pass++; if (e.type === 'catch') st.comp++; }
    if (res) playOver(m, res);
    return m;
  }
  if (m.phase === 'kick') {
    const k = m.kick; k.t += dt;
    if (!k.done) {
      // the dummy waits for the needle to come into the box, then reacts a moment late
      if (k.pressAt == null && k.t > 0.3 && Math.abs(Math.sin(k.t * k.w)) < k.win) k.pressAt = k.t + offTeam(m).d.R() * 0.09;
      if (k.pressAt != null && k.t >= k.pressAt) { k.done = true; k.at = Math.sin(k.t * k.w); k.good = Math.abs(k.at) < k.win; m.cues.push('kick'); }
    } else if ((k.doneT += dt) > 1.3) kickOver(m);
    return m;
  }
  if (m.phase === 'dead') {
    m.deadT += dt;
    if (m.deadT > m.deadLen) { const n = m.next; m.next = null; n(); }
  }
  return m;
}

function playClock(m, t) {
  if (m.q >= 5) return null;
  m.clock -= t;
  if (m.clock > 0) return null;
  if (m.q === 1 || m.q === 3) { m.q++; m.clock += m.qLen; return 'quarter'; }
  m.clock = 0; return m.q === 2 ? 'half' : 'game';
}
function playOver(m, res) {
  m.plays++;
  const r = m.rng, o = offTeam(m), before = m.x;
  const t = res.clock === 'run' ? 24 + 12 * r() : 5 + 4 * r();
  const parts = res.text.split('. ');
  let banner = parts.shift(), sub = parts.length ? parts.join('. ') + ' ' : '', next = null;
  m.cues.push(res.type === 'td' ? 'td' : res.type === 'tackle' || res.type === 'sack' ? 'tackle' : 'whistle');
  const gain = Math.round((res.type === 'inc' || res.type === 'int' ? before : res.x) - before);
  if (res.type !== 'inc' && res.type !== 'int' && res.type !== 'sack') o.stats.yds += Math.max(0, res.x - before);
  if (res.type === 'td') {
    o.score += 7; o.stats.td++; banner = 'Touchdown'; sub = `${o.name}. Extra point is good.`;
    next = () => turnover(m, 25);
  } else if (res.type === 'int') {
    banner = 'Intercepted'; sub = `${defTeam(m).name} picks it off.`;
    next = () => turnover(m, res.x >= 100 ? 20 : 100 - clamp(res.x, 1, 99));
  } else if (res.type === 'safety') {
    defTeam(m).score += 2; banner = 'Safety'; sub = `2 points to ${defTeam(m).name}.`;
    next = () => turnover(m, 35);
  } else {
    const nx = res.type === 'inc' ? before : res.x;
    sub += res.type === 'inc' ? '' : gain > 0 ? `Gain of ${gain}.` : gain < 0 ? `Loss of ${-gain}.` : 'No gain.';
    m.x = clamp(nx, 1, 99); m.y = res.y;
    if (m.x >= m.firstX) { m.down = 1; m.firstX = Math.min(100, m.x + 10); sub += ' First down.'; }
    else if (m.down >= 4) { banner = 'Turnover on downs'; const at = m.x; next = () => turnover(m, 100 - at); }
    else m.down++;
    if (!next) next = () => startDown(m);
  }
  const clock = playClock(m, t);
  if (clock === 'half') next = () => halftime(m);
  if (clock === 'game') next = () => endRegulation(m);
  if (clock === 'quarter') sub += ` End of Q${m.q - 1}.`;
  dead(m, banner, sub.trim(), next);
}
function punt(m) {
  const land = m.x + 40 + (m.rng() * 14 - 6);
  const clock = playClock(m, 8);
  if (clock === 'half') return halftime(m);
  if (clock === 'game') return endRegulation(m);
  turnover(m, land >= 100 ? 20 : 100 - land);
}
function kickOver(m) {
  const k = m.kick, o = offTeam(m);
  if (k.good) o.score += 3;
  const clock = playClock(m, 5);
  m.cues.push(k.good ? 'td' : 'whistle');
  const at = m.x;
  let next = () => turnover(m, k.good ? 25 : Math.max(20, 107 - at));
  if (clock === 'half') next = () => halftime(m);
  if (clock === 'game') next = () => endRegulation(m);
  dead(m, k.good ? 'Field goal' : 'No good', `${o.name} from ${k.kd} yards.`, next);
}
function turnover(m, x) {
  if (m.q >= 5) return otNext(m);
  m.pos = 1 - m.pos; m.x = clamp(Math.round(x), 1, 99); m.y = MID; m.down = 1; m.firstX = Math.min(100, m.x + 10);
  startDown(m);
}
function halftime(m) {
  m.q = 3; m.clock = m.qLen; m.pos = 1; m.x = 25; m.y = MID; m.down = 1; m.firstX = 35;
  dead(m, 'Halftime', `${m.teams[0].name} ${m.teams[0].score}, ${m.teams[1].name} ${m.teams[1].score}. ${m.teams[1].name} gets the ball.`, () => startDown(m), 2.4);
}
function endRegulation(m) {
  const [a, b] = m.teams;
  if (a.score !== b.score) return toFinal(m);
  m.q = 5; m.ot = { round: 1, turn: 0 }; m.pos = 0;
  m.x = 75; m.y = MID; m.down = 1; m.firstX = 85;
  dead(m, 'Overtime', `Tied ${a.score} all. Each side gets a drive from the 25.`, () => startDown(m), 2.4);
}
function otNext(m) {
  const [a, b] = m.teams;
  if (m.ot.turn === 0) m.ot.turn = 1;
  else if (a.score !== b.score || m.ot.round >= 3) return toFinal(m);
  else { m.ot.round++; m.ot.turn = 0; }
  m.pos = m.ot.turn; m.x = 75; m.y = MID; m.down = 1; m.firstX = 85;
  startDown(m);
}
function toFinal(m) {
  const [a, b] = m.teams;
  m.winner = a.score > b.score ? 0 : b.score > a.score ? 1 : -1;
  m.phase = 'final'; m.finalT = 0; m.play = null; m.kick = null;
  m.banner = m.winner < 0 ? 'Tie game' : `${m.teams[m.winner].name} wins`;
  m.sub = `${a.name} ${a.score}, ${b.name} ${b.score}`;
}
