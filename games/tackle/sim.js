/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Tackle: the football itself, kept apart from drawing and input so it can be tested on its own.
   Field units are yards. x runs from your goal line (0) to theirs (100), end zones go to -10 and 110.
   y runs across the field from 0 to 53.3. Every player on both teams has the same speed for their
   position; the difficulty only changes how quickly the defense reads the play. */

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

export const SPEED = { QB: 6.5, RB: 8.4, WR: 8.6, OL: 5.6, DL: 6.6, LB: 7.6, DB: 8.6 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function mk(team, role, pos, x, y, speed) {
  return { team, role, pos, x, y, sx: x, sy: y, vx: 0, vy: 0, speed, stun: 0, hist: [], route: null, ri: 0, eng: null, chase: null };
}

/* Set up one play. x0 is the line of scrimmage, yb where the ball is spotted. */
export function newPlay(x0, yb, playId, diff, rng = Math.random) {
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
  // on runs, who each receiver goes to block
  off.X.blockOn = def.C1; off.Z.blockOn = def.C2; off.Y.blockOn = def.L1;
  for (const k of ['X', 'Y', 'Z', 'RB']) {
    const p = off[k], side = p.y < c ? 1 : -1;
    p.route = play.routes[k].map(([dx, din, stop]) => ({ x: x0 + dx, y: wy(p.y + side * din), stop: !!stop }));
  }
  const p = {
    play, diff, x0, c, t: 0, rng, off, def,
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
  const { diff, off } = p, t = p.t;
  // a carrier: everyone pursues, after they have read it
  if (p.carrier && (p.play.kind === 'run' ? t >= diff.react + 0.45 : t - p.carrierAt >= diff.react) ) return pursue(p, d, dt);
  // ball in the air: break on the spot once they read the throw
  if (p.ball.air && t - p.ball.air.at >= diff.react && d.pos !== 'DL') {
    const a = p.ball.air, rem = Math.max(0.05, a.T - a.t);
    const reach = d.speed * rem;
    if (Math.hypot(a.to.x - d.x, a.to.y - d.y) < reach + 6) return move(d, a.to.x, a.to.y, d.speed, dt, 16);
  }
  if (d.pos === 'DL') return move(d, off.QB.x, off.QB.y, d.speed, dt);
  if (p.play.kind === 'run' && t >= diff.react + 0.45) return pursue(p, d, dt, off.RB);
  if (d.deep) {
    // stays deeper than the deepest receiver, leaning toward his side of the field
    let deepest = null;
    for (const k of ['X', 'Y', 'Z']) { const r = past(off[k], t - diff.react); if (!deepest || r.x > deepest.x) deepest = r; }
    return move(d, Math.max(p.x0 + 12, deepest.x + 5), MID + (deepest.y - MID) * 0.55, d.speed, dt);
  }
  if (d.man) {
    const m = past(d.man, t - diff.react);
    const deep = d.pos === 'DB' ? 1.4 : 0.6;
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
  const lead = clamp(dd / d.speed, 0, 1.2) * 0.75;
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
export function simDrive(dist0, diff, rng = Math.random) {
  const f = clamp(1.35 - dist0 / 110, 0.45, 1.35);
  const pTD = diff.oppTD * f, pFG = diff.oppFG * (dist0 < 85 ? 1 : 0.6), pTO = 0.13;
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
  const time = Math.round(25 + plays * (12 + rng() * 5));
  return { kind, yds, plays, time, endDist: dist0 - yds, pts: kind === 'td' ? 7 : kind === 'fg' ? 3 : 0 };
}
export function simOT(diff, rng = Math.random) {
  const r = rng();
  return r < diff.otTD ? 7 : r < diff.otTD + 0.3 ? 3 : 0;
}
