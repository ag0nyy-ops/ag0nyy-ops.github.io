/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Moves: the body and the judging, kept apart from drawing so it can be checked on its own.

   A pass is run, hurdle, takeoff, flight, landing.
     takeoff  how fast you were running and how well you timed the punch set your height and
              your spin (angular momentum). Both are fixed once you leave the floor.
     flight   tucking and piking make your body smaller, so the same spin turns faster. Opening
              up slows it down. Twist works the same way with your arms: pull them in to twist faster.
     landing  whatever rotation you didn't finish (or overdid) becomes lean. Steady it, then show
              the landing with your arms up.
   Judges score what your body did: difficulty (D) for what you threw, execution (E) from 10
   minus deductions. Nothing here gets better with practice except you. */

export const FLOOR = 14;        // metres of floor, side-on
export const G = 9.81;
export const VMAX = 7.6;        // top run-up speed, m/s
export const HURDLE = 0.42;     // seconds from arms up to the punch
export const WINDOW = 0.14;     // punch timing window either side of the sweet spot
export const REBOUND = { at: 0.07, window: 0.1, open: 0.22 }; // flicking again just after touchdown
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const TUCK_I = 0.32, PIKE_I = 0.5;
/* how hard you are to spin: 1 laid out straight, smaller when you pull in */
export function inertia(tuck, pike) {
  return tuck >= pike ? 1 - (1 - TUCK_I) * tuck : 1 - (1 - PIKE_I) * pike;
}

/* What a flick of the legs stick asks for. fx is toward your direction of travel, fy is up. */
export function classifyFlick(fx, fy) {
  const a = Math.atan2(fy, fx) * 180 / Math.PI;           // -180..180, 0 = toward travel
  if (a > 67.5 && a < 112.5) return { kind: 'jump', dir: 'up', twist: false };
  if (a >= 22.5 && a <= 67.5) return { kind: 'salto', dir: 'front', twist: true };
  if (a > -75 && a < 22.5) return { kind: 'salto', dir: 'front', twist: false };
  if (a >= 112.5 && a <= 157.5) return { kind: 'salto', dir: 'back', twist: true };
  if (a > 157.5 || a < -105) return { kind: 'salto', dir: 'back', twist: false };
  return null;                                             // straight down: nothing
}

export const punchQuality = (err, win = WINDOW) => clamp(1 - Math.abs(err) / win, 0, 1);

export class Flight {
  constructor({ kind, dir, twist, speed, q, travel, x }) {
    Object.assign(this, { kind, dir, twist, speed, q, travel, x0: x, x });
    const s = clamp(speed / VMAX, 0, 1);
    if (kind === 'jump') {
      this.vz = 2.3 + 1.2 * q + 0.3 * s; this.L = 0; this.Lt = 0; this.vx = travel * 0.22 * speed;
    } else {
      const front = dir === 'front';
      this.vz = (3.0 + 2.8 * q * (0.35 + 0.65 * s)) * (front ? 0.96 : 1);
      this.L = (2.8 + 3.0 * q * (0.3 + 0.7 * s)) * (front ? 0.93 : 1);   // rad/s when laid out
      this.Lt = twist ? 0.8 : 0;                                          // turns/s with arms out
      this.vx = travel * (0.6 + 0.2 * speed);
    }
    this.T = 2 * this.vz / G;
    this.peak = this.vz * this.vz / (2 * G);
    this.t = 0; this.z = 0; this.theta = 0; this.tw = 0;
    this.tuck = 0; this.pike = 0; this.arms = 0; this.legs = 0; this.split = 0;
    this.st = { tuckT: 0, pikeT: 0, maxT: 0, maxP: 0, bend: 0, bendN: 0, apartT: 0, splitT: 0 };
  }
  get omega() { return this.L / inertia(this.tuck, this.pike); }
  get twistRate() { return this.Lt / (1 - 0.7 * this.arms); }
  /* where you'd end up if you opened right now: shown on the spin dial as a hollow ring */
  get predicted() { return this.theta + this.L * Math.max(0, this.T - this.t); }
  get predictedTwist() { return this.tw + this.Lt * Math.max(0, this.T - this.t); }
  /* input: tuck, pike, armsIn 0..1, legs = how far the legs stick is pushed 0..1, split -1..1 */
  step(dt, { tuck = 0, pike = 0, armsIn = 0, legs = 0, split = 0 }) {
    dt = Math.min(dt, this.T - this.t);
    if (dt <= 0) return true;
    const r = 14 * dt, ra = 12 * dt;
    this.tuck += clamp(tuck - this.tuck, -r, r);
    this.pike += clamp(pike - this.pike, -r, r);
    this.arms += clamp(armsIn - this.arms, -ra, ra);
    const early = this.t < 0.15;            // the flick itself doesn't count as legs apart
    this.legs = early ? 0 : legs; this.split = early ? 0 : split;
    this.theta += this.omega * dt;
    this.tw += this.twistRate * dt;
    this.t += dt;
    this.x += this.vx * dt;
    this.z = Math.max(0, this.vz * this.t - 0.5 * G * this.t * this.t);
    const st = this.st;
    if (this.tuck > 0.6) st.tuckT += dt;
    if (this.pike > 0.6) st.pikeT += dt;
    st.maxT = Math.max(st.maxT, this.tuck); st.maxP = Math.max(st.maxP, this.pike);
    if (this.t > this.T * 0.15 && this.t < this.T * 0.85) { st.bend += Math.max(this.tuck, this.pike) * dt; st.bendN += dt; }
    if (this.legs > 0.5) st.apartT += dt;
    if (Math.abs(this.split) > 0.8) st.splitT += dt;
    return this.t >= this.T - 1e-9;
  }
}

/* The moment the feet hit the floor. Lean is in the gymnast's own frame: + is toward the way they face. */
export function touchdown(f) {
  if (f.kind === 'jump') {
    const halves = Math.round(f.tw * 2);
    return { R: 0, e: 0, halves, twErr: Math.abs(f.tw - halves / 2), lean: 0, leanVel: 0.03 * f.speed,
      squat: Math.max(f.tuck, f.pike) > 0.5, crash: false, fall: false, omega: 0 };
  }
  const R = Math.round(f.theta / TAU), e = f.theta - R * TAU;       // e > 0: rotated too far
  const sign = f.dir === 'back' ? -1 : 1;                             // back saltos rotate backward
  const halves = Math.round(f.tw * 2), twErr = Math.abs(f.tw - halves / 2);
  const squat = Math.max(f.tuck, f.pike) > 0.5;
  const crash = R === 0 || Math.abs(e) > 1.7 || twErr > 0.32;         // not feet first
  const fall = crash || Math.abs(e) > 0.95 || twErr > 0.25 || (squat && Math.abs(e) > 0.6);
  return { R, e, halves, twErr, lean: sign * e, leanVel: sign * f.omega * 0.045 * (squat ? 2 : 1),
    squat, crash, fall, omega: f.omega };
}

/* Standing the landing up. lam is lean in screen space (+ = right), u is the arms stick (-1..1).
   It's an upside-down pendulum: leave it and it tips over, push the stick against the lean. */
export const STEP_AT = 0.42;
export class Balance {
  constructor(lam, vel) {
    this.lam = lam; this.vel = vel; this.t = 0; this.steps = 0; this.large = 0; this.fell = false;
    this.hold = 0; this.done = false; this.shown = false;
    if (Math.abs(lam) > STEP_AT) { this.large = 1; this.steps = 1; this.lam = Math.sign(lam) * 0.18; this.vel *= 0.3; }
  }
  get stable() { return Math.abs(this.lam) < 0.1 && Math.abs(this.vel) < 0.3; }
  /* returns 'step' or 'fall' when one happens */
  step(dt, u, armsUp, stepped = false) {
    if (this.done) return null;
    this.t += dt;
    // wobbly until you're still, then your feet are planted and small pushes don't tip you
    const k = this.stable ? -4 * this.lam - 6 * this.vel : 2.2 * this.lam - 1.6 * this.vel;
    this.vel += (k + 6 * u) * dt;
    this.lam += this.vel * dt;
    let ev = null;
    if (Math.abs(this.lam) > STEP_AT || stepped) {
      this.steps++; ev = 'step';
      this.lam *= Math.abs(this.lam) > STEP_AT ? 0.45 : 0.6; this.vel *= 0.25; this.hold = 0;
      if (this.steps >= 4) { this.fell = true; this.done = true; return 'fall'; }
    }
    if (armsUp && this.stable) this.hold += dt; else if (!armsUp) this.hold = 0;
    if (this.hold >= 0.35) { this.done = true; this.shown = true; }
    else if (this.t > 3.2) this.done = true;
    return ev;
  }
}

/* ---------------- judging ---------------- */

const BASE = { 1: { tuck: 0.1, pike: 0.2, layout: 0.3 }, 2: { tuck: 0.4, pike: 0.5, layout: 0.7 },
  3: { tuck: 0.9, pike: 1.1, layout: 1.3 }, 4: { tuck: 1.6, pike: 1.8, layout: 2.0 } };
const TWIST_NAMES = ['', 'half twist', 'full twist', '1½ twists', 'double twist', '2½ twists', 'triple twist', '3½ twists', 'quad twist'];
const MULT = ['', '', 'Double ', 'Triple ', 'Quad '];
export const VALUES = BASE;

export function shapeOf(f) {
  const tf = f.st.tuckT / f.T, pf = f.st.pikeT / f.T;
  if (f.kind === 'jump') {
    if (tf > 0.25 && tf >= pf) return 'tuck';
    if (pf > 0.25) return 'pike';
    if (f.st.splitT > 0.15) return 'split';
    return 'straight';
  }
  if (tf >= pf && tf > 0.3) return 'tuck';
  if (pf > 0.3) return 'pike';
  return 'layout';
}

export function skillValue({ kind, dir, R, shape, halves }) {
  if (kind === 'jump') return { tuck: 0.05, pike: 0.1, split: 0.1, straight: 0 }[shape] + 0.05 * halves;
  if (!R) return 0;
  const b = BASE[Math.min(4, R)][shape] ?? 0;
  return round1(b + (dir === 'front' ? 0.1 : 0) + halves * (R >= 2 ? 0.2 : 0.1));
}

export function skillName({ kind, dir, R, shape, halves }) {
  if (kind === 'jump') {
    const n = { tuck: 'Tuck jump', pike: 'Pike jump', split: 'Split jump', straight: 'Straight jump' }[shape];
    return halves ? `${n}, ${TWIST_NAMES[Math.min(8, halves)]}` : n;
  }
  if (!R) return dir === 'back' ? 'Back salto, not finished' : 'Front salto, not finished';
  const s = `${MULT[Math.min(4, R)]}${dir} ${shape}${halves ? ', ' + TWIST_NAMES[Math.min(8, halves)] : ''}`;
  return s[0].toUpperCase() + s.slice(1);
}

/* Deductions for what happened in the air. */
export function airDeductions(f) {
  const d = [], st = f.st;
  if (f.kind === 'salto' && f.peak < 0.65) d.push(['Low', 0.1]);
  const shape = shapeOf(f);
  if (shape === 'tuck' && st.maxT < 0.85) d.push(['Loose tuck', 0.1]);
  if (shape === 'pike' && st.maxP < 0.85) d.push(['Loose pike', 0.1]);
  if (f.kind === 'salto' && shape === 'layout' && st.bendN > 0) {
    const bend = st.bend / st.bendN;
    if (bend > 0.3) d.push(['Body piked down', 0.3]); else if (bend > 0.15) d.push(['Bent body', 0.1]);
  }
  if (!(f.kind === 'jump' && shape === 'split')) {
    if (st.apartT > 0.4) d.push(['Legs apart', 0.3]); else if (st.apartT > 0.12) d.push(['Legs apart', 0.1]);
  }
  return d;
}

/* Deductions for the landing, capped at 1.0 like a fall. */
export function landingDeductions(td, bal, outOfBounds) {
  const d = [];
  if (td.fall || (bal && bal.fell)) d.push(['Fall', 1.0]);
  else {
    if (td.squat) d.push(['Squat landing', 0.3]);
    if (td.twErr > 0.12) d.push(['Landed off line', 0.3]);
    else if (td.twErr > 0.06) d.push(['Twist not finished', 0.1]);
    if (bal) {
      if (bal.large) d.push(['Large step', 0.3]);
      const small = bal.steps - bal.large;
      if (small > 0) d.push([small === 1 ? 'Step' : `${small} steps`, round1(0.1 * small)]);
      if (!bal.shown) d.push(['No finish', 0.1]);
    }
  }
  if (outOfBounds) d.push(['Out of bounds', 0.1]);
  const out = []; let left = 1;
  for (const [why, v] of d) { if (left <= 0) break; const take = Math.min(v, left); out.push([why, round1(take)]); left = round1(left - take); }
  return out;
}

/* A whole skill, judged: name, D, deductions. */
export function judgeSkill(f, td) {
  const shape = shapeOf(f);
  const info = { kind: f.kind, dir: f.dir, R: td.R, shape, halves: td.twErr <= 0.25 ? td.halves : Math.floor(f.tw * 2) };
  const recognized = !td.crash;
  return {
    ...info, recognized, name: skillName(info),
    d: recognized ? skillValue(info) : 0,
    air: airDeductions(f)
  };
}

/* Routine requirements: each one met adds 0.5 to D. */
export const REQUIREMENTS = [
  { id: 'front', name: 'A front salto', test: (s) => s.kind === 'salto' && s.dir === 'front' && s.recognized && s.R >= 1 },
  { id: 'back', name: 'A back salto', test: (s) => s.kind === 'salto' && s.dir === 'back' && s.recognized && s.R >= 1 },
  { id: 'double', name: 'A double salto', test: (s) => s.kind === 'salto' && s.recognized && s.R >= 2 }
];

export function scoreRoutine(passes, { requirements = true } = {}) {
  const skills = passes.flatMap((p) => p.skills);
  let D = skills.reduce((a, s) => a + s.d, 0) + passes.reduce((a, p) => a + p.connections * 0.1, 0);
  const met = REQUIREMENTS.map((r) => ({ ...r, met: skills.some(r.test) }));
  if (requirements) D += met.filter((r) => r.met).length * 0.5;
  const ded = skills.reduce((a, s) => a + s.ded.reduce((b, [, v]) => b + v, 0), 0);
  const E = Math.max(0, 10 - ded);
  return { D: round1(D), E: round1(E), total: round1(D + E), met };
}

export const round1 = (v) => Math.round(v * 1000) / 1000;

/* ---------------- one gymnast on the floor ----------------
   The pass by pass state machine: ready, run, hurdle, air, land, settle, walk. It reads a plain
   control frame each step, so a person (game.js reads the pad) and a CPU (CpuGymnast below) drive
   it the same way:
     { legs: { x, y }  the legs stick, -1..1, y down
       lx, ly          the arms stick, ly < -0.6 is arms up
       lt, rt }        tuck and pike, 0..1
   opts: passes (routine length, null for free floor), skipWalk (reduce motion), maxTries (how many
   times a pass can run out before it counts as empty; null never gives up). */
export const NO_INPUT = Object.freeze({ legs: { x: 0, y: 0 }, lx: 0, ly: 0, lt: 0, rt: 0 });

export class Performer {
  constructor({ passes = null, skipWalk = false, maxTries = null, x = 0.6 } = {}) {
    Object.assign(this, { limit: passes, skipWalk, maxTries });
    this.g = { x, face: x < FLOOR / 2 ? 1 : -1, travel: x < FLOOR / 2 ? 1 : -1, v: 0, runPhase: 0 };
    this.passes = []; this.pass = null; this.phase = 'ready'; this.t = 0; this.done = false;
    this.flight = null; this.td = null; this.bal = null; this.q = 0;
    this.hurdleT = 0; this.armsWasUp = true; this.legsWasOut = true; this.callout = null; this.msg = '';
    this.rebound = null; this.stepCool = 0; this.stepShift = 0; this.landT = 0; this.landX = x;
    this.walkTo = null; this.settleT = 0; this.tries = 0; this.linkNext = false; this.legsHeldMsg = null;
    this.ctl = NO_INPUT; this.flick = { armed: true, at: null, best: null };
    this.on = () => {};                 // sound hook: on('punch', q), on('hurdle'), on('thud', hard), on('finish')
    this.newPass();
  }
  get passNo() { return this.passes.length + 1; }
  newPass() { this.linkNext = false; this.pass = { skills: [], connections: 0 }; this.phase = 'ready'; this.g.v = 0; this.resetFlick(); }

  /* A flick: the stick goes from near the middle to well out. The direction is read over the next
     50 ms so two arrow keys pressed a hair apart still make a diagonal. */
  readFlick(now) {
    const l = this.ctl.legs, m = Math.hypot(l.x, l.y), fl = this.flick;
    if (m < 0.35) { fl.armed = true; if (fl.at == null) return null; }
    if (fl.at == null && fl.armed && m > 0.7) { fl.at = now; fl.best = { x: l.x, y: l.y, m }; fl.armed = false; }
    if (fl.at != null) {
      if (m >= fl.best.m - 0.01) fl.best = { x: l.x, y: l.y, m };
      if (now - fl.at >= 0.05) { const out = { at: fl.at, x: fl.best.x, y: fl.best.y }; fl.at = null; return out; }
    }
    return null;
  }
  resetFlick() { const l = this.ctl.legs; this.flick.armed = Math.hypot(l.x, l.y) < 0.35; this.flick.at = null; }

  step(dt, ctl = NO_INPUT) {
    this.ctl = ctl;
    if (this.done) return;
    const g = this.g, legs = ctl.legs;
    this.t += dt;
    const armsUp = ctl.ly < -0.6, armsUpEdge = armsUp && !this.armsWasUp;
    this.armsWasUp = armsUp;
    const toward = legs.x * g.travel;                      // how hard the legs push toward the far side
    this.stepCool = Math.max(0, this.stepCool - dt);

    if (this.phase === 'ready' || this.phase === 'run') {
      if (toward > 0.3 && this.phase === 'ready') { this.phase = 'run'; this.callout = this.callout && { ...this.callout, old: true }; }
      if (this.phase === 'run') {
        if (toward > 0.3) g.v += 8.5 * (1 - g.v / VMAX) * Math.min(1, toward) * dt;
        else g.v = Math.max(0, g.v - 3 * dt);
        g.x += g.travel * g.v * dt; g.runPhase += g.v * dt * 1.9;
        const far = g.travel > 0 ? g.x > FLOOR - 0.5 : g.x < 0.5;
        if (far) return this.ranOut('Ran out of floor. Hurdle before the far corner.');
      }
      if (armsUpEdge) { this.phase = 'hurdle'; this.hurdleT = 0; this.resetFlick(); this.on('hurdle'); }
      return;
    }
    if (this.phase === 'hurdle') {
      this.hurdleT += dt;
      g.x += g.travel * g.v * 0.6 * dt;
      const f = this.readFlick(this.hurdleT);
      if (f) {
        const c = classifyFlick(f.x * g.travel, -f.y);
        if (!c) return this.ranOut('That flick was straight down. Flick back, forward or up.');
        return this.takeoff(c, g.v, punchQuality(f.at - HURDLE));
      }
      if (this.hurdleT > HURDLE + WINDOW + 0.12) return this.ranOut(this.legsHeldMsg || 'No takeoff. Let the legs stick go, then flick it as the rings meet.');
      if (this.hurdleT < 0.05 && Math.hypot(legs.x, legs.y) > 0.35) this.legsHeldMsg = 'No takeoff. Let go of the legs stick during the hurdle, then flick it.';
      return;
    }
    if (this.phase === 'air') {
      const f = this.flight;
      const done = f.step(dt, { tuck: ctl.lt, pike: ctl.rt, armsIn: Math.max(0, ctl.ly), legs: Math.hypot(legs.x, legs.y), split: legs.x });
      g.x = f.x;
      if (done) this.land();
      return;
    }
    if (this.phase === 'land') {
      this.landT += dt;
      // connection: flick again right after a salto lands
      if (this.rebound && this.landT < REBOUND.open) {
        const fl = this.readFlick(this.landT);
        if (fl) {
          const c = classifyFlick(fl.x * g.travel, -fl.y);
          const same = c && (c.kind === 'jump' || c.dir === this.flight.dir);
          if (same) {
            const q = punchQuality(fl.at - REBOUND.at, REBOUND.window);
            const carry = clamp(this.flight.speed * 0.55 + 3.4 * (1 - Math.min(1, Math.abs(this.td.e) / 0.35)), 0, VMAX);
            this.finishSkill(true);
            this.linkNext = true;
            return this.takeoff(c, carry, q, true);
          }
        }
      } else if (this.rebound) { this.rebound = null; }
      const legsOut = Math.hypot(legs.x, legs.y) > 0.5;
      const stepped = !this.rebound && legsOut && !this.legsWasOut && this.stepCool <= 0;
      this.legsWasOut = legsOut;
      if (stepped) this.stepCool = 0.4;
      const ev = this.bal.step(dt, ctl.lx, armsUp, stepped);
      if (ev === 'step') { const s = Math.sign(this.bal.lam || g.face) * 0.25; this.stepShift += s; g.x += s; this.on('thud', 0.2); }
      if (ev === 'fall') this.on('thud', 1);
      if (this.bal.done) { this.finishSkill(false); this.endPass(); }
      return;
    }
    if (this.phase === 'settle') {
      this.settleT += dt;
      if (this.settleT >= (this.skipWalk ? 0.3 : 0.7)) this.walkTo_(g.x > FLOOR / 2 ? FLOOR - 0.6 : 0.6);
      return;
    }
    if (this.phase === 'walk') {
      const dir = Math.sign(this.walkTo - g.x);
      g.face = dir || g.face; g.v = 2.6;
      g.x += dir * 2.6 * dt; g.runPhase += 2.6 * dt * 1.9;
      if (Math.sign(this.walkTo - g.x) !== dir || this.skipWalk) this.arrive();
    }
  }

  ranOut(msg) {
    this.msg = msg; this.legsHeldMsg = null; this.tries++;
    if (this.maxTries != null && this.tries >= this.maxTries) { this.passes.push(this.pass); this.tries = 0; }  // counts as an empty pass
    this.walkTo_(this.g.travel > 0 ? 0.6 : FLOOR - 0.6);
  }
  walkTo_(x) { this.phase = 'walk'; this.walkTo = x; this.g.v = 0; }
  arrive() {
    const g = this.g;
    g.x = this.walkTo; g.travel = g.x < FLOOR / 2 ? 1 : -1; g.face = g.travel; g.v = 0;
    if (this.limit != null && this.passes.length >= this.limit) { this.done = true; this.phase = 'done'; return; }
    this.newPass();
  }

  takeoff(c, speed, q, rebound = false) {
    const g = this.g;
    this.flight = new Flight({ kind: c.kind, dir: c.dir, twist: c.twist, speed, q, travel: g.travel, x: g.x });
    g.face = c.dir === 'back' ? -g.travel : g.travel;     // a round-off turns you around for back skills
    this.phase = 'air'; this.q = q; this.msg = ''; this.legsHeldMsg = null; this.rebound = null;
    this.on('punch', q);
    if (!rebound) this.callout = null;
  }

  land() {
    const f = this.flight, g = this.g;
    const td = touchdown(f);
    this.td = td; this.phase = 'land'; this.landT = 0; this.legsWasOut = true; this.stepShift = 0; this.landX = g.x;
    const lamScreen = td.lean * g.face, velScreen = td.leanVel * g.face;
    this.bal = new Balance(td.fall ? Math.sign(lamScreen || 1) * 0.9 : lamScreen, velScreen);
    if (td.fall) { this.bal.done = true; this.bal.fell = true; }
    this.rebound = f.kind === 'salto' && !td.fall && !td.squat && Math.abs(td.e) < 0.35 ? { open: true } : null;
    this.resetFlick();
    this.on('thud', clamp(Math.abs(td.e), 0, 1));
  }

  finishSkill(connected) {
    const f = this.flight, td = this.td;
    const sk = judgeSkill(f, td);
    const out = this.landX < -0.05 || this.landX > FLOOR + 0.05;
    const landDed = connected ? landingDeductions({ ...td, squat: false }, null, out).filter(([w]) => w !== 'No finish')
      : landingDeductions(td, this.bal, out);
    sk.ded = [...sk.air, ...landDed];
    sk.connected = connected; sk.q = this.q;
    sk.linked = !!this.linkNext; this.linkNext = false;          // rebounded into from the skill before
    if (sk.linked && sk.recognized) this.pass.connections++;      // a connection only counts if the second skill does
    this.pass.skills.push(sk);
    this.callout = { skills: this.pass.skills.slice(), connections: this.pass.connections };
  }

  endPass() {
    this.passes.push(this.pass); this.tries = 0;
    if (this.bal && this.bal.shown) this.on('finish');
    this.phase = 'settle'; this.settleT = 0;
  }
}

/* ---------------- CPU gymnasts ("dummies") ----------------
   Each one is rolled from a seed with makeDummy (../shared/seed.js), the way Folkstyle rolls its
   wrestlers. The seed changes how it tumbles, not how strong it is: every dummy has the same body
   and the same physics as you, and the numbers below are trade-offs. */
export const DUMMY_RANGES = {
  ambition: [0, 1],        // how much difficulty it goes for: doubles, triples (more D, more risk)
  runup: [0.42, 0.62],     // share of the floor it runs before the hurdle: faster takeoff, less room to land
  focus: [0, 1],           // where its timing is sharp: high = clean punch, worse read of the spin; low = the other way
  open: [-0.16, 0.14],     // habit of opening early (-, short landings) or late (+, over-rotated)
  shape: [0, 1],           // < .4 tucks, .4-.72 pikes, above that lays out when the spin allows
  twist: [0, 1],           // love of twisting saltos (flashy, harder to land on line)
  front: [0, 1],           // front vs back saltos when nothing forces it
  link: [0, 1],            // how often it rebounds into a second skill
  reflex: [0, 1],          // landing: high = reacts fast but pushes softly, low = slow but firm
  tidy: [0, 1],            // form: how tight its shapes are and how well it keeps the legs together
  room: [0.4, 1.3],        // metres of floor it wants spare in front before it hurdles
  think: [0.35, 1.2],      // pause in the corner before each pass, seconds
  nerve: [0, 1]            // how readily it throws the big skill again after a fall
};
export const DUMMY_STYLES = [
  ['twister', (p) => p.twist > 0.72],
  ['power tumbler', (p) => p.ambition > 0.72],
  ['connector', (p) => p.link > 0.7],
  ['clean lines', (p) => p.tidy > 0.72],
  ['spot lander', (p) => p.focus < 0.25 && p.reflex < 0.4]
];
export const DUMMY_FALLBACK = 'all rounder';

export class CpuGymnast {
  constructor(d, passes = 4) {
    this.d = d; this.p = d.p; this.passes = passes;
    this.plan = null; this.air = null; this.flightSeen = null; this.wait = 0; this.hist = [];
    this.stillT = 0; this.flickT = -1; this.passSeen = -1; this.fellLast = false;
    // derived trade-offs
    const p = this.p;
    this.punchSd = 0.026 + 0.03 * (1 - p.focus);    // seconds
    this.spinSd = 0.07 + 0.13 * p.focus;            // radians when it opens
    this.react = 0.05 + 0.1 * (1 - p.reflex);       // seconds of delay on the landing
    this.gain = 1.05 + 0.6 * (1 - p.reflex);        // how hard it pushes against the lean
  }
  /* about-normal noise from the dummy's own generator */
  noise() { const R = this.d.R; return (R() + R() + R() - 1.5) * 1.4; }

  /* what this pass is going to be, decided in the corner */
  planPass(perf) {
    const p = this.p, R = this.d.R;
    const skills = perf.passes.flatMap((ps) => ps.skills);
    const have = (id) => skills.some(REQUIREMENTS.find((r) => r.id === id).test);
    const left = this.passes - perf.passes.length;          // passes still to throw, this one included
    const need = ['front', 'back', 'double'].filter((id) => !have(id));
    let R1 = 1 + (R() < 0.15 + 0.75 * p.ambition ? 1 : 0);
    if (R1 === 2 && p.ambition > 0.8 && R() < 0.35) R1 = 3;
    if (this.fellLast && R() > 0.3 + 0.6 * p.nerve) R1 = Math.max(1, R1 - 1);    // shaken: plays it safer
    if (need.includes('double') && (left <= need.length || R() < 0.4 + 0.4 * p.ambition)) R1 = Math.max(2, R1);
    let dir = R() < 0.25 + 0.5 * p.front ? 'front' : 'back';
    if (need.includes('front') && (left <= need.length || dir === 'front' || R() < 0.5)) dir = 'front';
    else if (need.includes('back') && (left <= need.length || R() < 0.5)) dir = 'back';
    const twist = R() < 0.1 + 0.75 * p.twist;
    const connect = R() < 0.1 + 0.7 * p.link;
    this.plan = { R: R1, dir, twist, connect, second: { dir, R: 1, twist: R() < 0.2 + 0.6 * p.twist } };
    this.wait = p.think * (0.7 + 0.6 * R());
    this.startX = perf.g.x; this.flickT = -1;
  }

  /* the flick vector for a skill, in stick space (x along the floor, y down) */
  flickVec(perf, s) {
    const t = perf.g.travel, fx = s.dir === 'front' ? 1 : -1;
    return s.twist ? { x: fx * t * 0.7, y: -0.72 } : { x: fx * t, y: 0 };
  }

  /* how the flight goes, decided the moment it leaves the floor */
  planAir(f, s) {
    const p = this.p, R = this.d.R;
    const lay = f.L * f.T, maxTuck = lay / 0.32 * 0.8, maxPike = lay / 0.5 * 0.82;
    let turns = Math.max(1, Math.min(s.R, Math.floor(maxTuck / TAU)));
    let shape = 'tuck';
    if (p.shape > 0.72 && lay >= turns * TAU - 0.35) shape = 'layout';
    else if (p.shape > 0.4 && maxPike >= turns * TAU) shape = 'pike';
    const depth = clamp(0.8 + 0.2 * p.tidy + 0.05 * this.noise(), 0.6, 1);
    let halves = 0;
    if (f.twist) {
      const out = f.Lt * f.T, most = f.Lt / 0.3 * f.T * 0.75;
      halves = Math.max(Math.ceil(out * 2 + 0.15), 2 + (R() < p.twist ? 1 : 0) + (p.twist > 0.8 && R() < 0.5 ? 1 : 0));
      halves = Math.min(halves, Math.max(Math.ceil(out * 2 + 0.15), Math.floor(most * 2)));
    }
    const sloppy = R() < (1 - p.tidy) * 0.35 ? { at: 0.2 + 0.3 * R(), len: 0.1 + 0.25 * R() } : null;
    this.air = { turns, shape, depth, halves, sloppy,
      target: turns * TAU + p.open + this.noise() * this.spinSd,
      twTarget: halves / 2 + this.noise() * (0.02 + 0.017 * halves) };
  }

  controls(perf, dt) {
    const p = this.p, R = this.d.R, g = perf.g;
    const out = { legs: { x: 0, y: 0 }, lx: 0, ly: 0, lt: 0, rt: 0 };
    if (perf.done) return out;
    const ph = perf.phase;
    if (ph === 'ready') {
      if (this.passSeen !== perf.passes.length || !this.plan) {
        const prev = perf.passes[perf.passes.length - 1];
        this.fellLast = !!(prev && prev.skills.some((s) => s.ded.some(([w]) => w === 'Fall')));
        this.passSeen = perf.passes.length; this.planPass(perf);
      }
      this.wait -= dt;
      if (this.wait <= 0) { out.legs.x = g.travel; this.startX = g.x; }
      return out;
    }
    if (ph === 'run') {
      out.legs.x = g.travel;
      const ran = Math.abs(g.x - this.startX), left = g.travel > 0 ? FLOOR - g.x : g.x;
      const flight = (0.6 + 0.2 * g.v) * 1.1 * (this.plan.connect ? 1.9 : 1);
      if (ran >= p.runup * FLOOR || left <= 0.6 * g.v * HURDLE + flight + p.room) { out.ly = -1; this.punchAt = HURDLE + this.noise() * this.punchSd; }
      return out;
    }
    if (ph === 'hurdle') {
      out.ly = -1;
      if (perf.hurdleT >= this.punchAt - 0.004 && perf.hurdleT < this.punchAt + 0.09) out.legs = this.flickVec(perf, this.plan);
      return out;
    }
    if (ph === 'air') {
      const f = perf.flight;
      if (this.flightSeen !== f) { this.flightSeen = f; this.planAir(f, perf.linkNext ? this.plan.second : this.plan); this.flickT = -1; }
      const a = this.air;
      if (f.kind === 'salto') {
        const lag = (f.omega - f.L) * Math.max(f.tuck, f.pike) / 14 * 0.5;
        const short = f.predicted + lag < a.target;
        if (a.shape === 'layout') { if (f.predicted < a.target - 0.12) out.rt = 0.5; }
        else if (short) { if (a.shape === 'pike') out.rt = a.depth; else out.lt = a.depth; }
      }
      if (f.twist && f.predictedTwist + (f.twistRate - f.Lt) * f.arms / 12 * 0.5 < a.twTarget) out.ly = 1;
      if (a.sloppy && f.t > a.sloppy.at && f.t < a.sloppy.at + a.sloppy.len) out.legs = { x: 0, y: 0.6 };
      return out;
    }
    if (ph === 'land') {
      const b = perf.bal;
      if (perf.landT < dt * 1.5) { this.hist = []; this.stillT = 0; this.linkDecided = null; }
      // connection: flick the same way again just after the feet land
      if (perf.rebound && !perf.linkNext && this.plan.connect) {
        if (this.linkDecided == null) {
          const left = g.travel > 0 ? FLOOR - g.x : g.x;
          this.linkDecided = left > 2.2 + 0.4 * p.room ? REBOUND.at + this.noise() * this.punchSd * 0.8 : false;
        }
        if (this.linkDecided !== false && perf.landT >= this.linkDecided - 0.004 && perf.landT < this.linkDecided + 0.09) {
          out.legs = this.flickVec(perf, this.plan.second);
          return out;
        }
      }
      if (!b) return out;
      this.hist.push([perf.landT, b.lam, b.vel]);
      let seen = this.hist[0];
      for (const h of this.hist) { if (h[0] <= perf.landT - this.react) seen = h; else break; }
      while (this.hist.length > 2 && this.hist[1][0] <= perf.landT - this.react) this.hist.shift();
      this.wob = (this.wob || 0) * 0.92 + (R() * 2 - 1) * 0.16;        // a little unsteadiness of its own
      out.lx = clamp(-(this.gain * 1.6 * seen[1] + this.gain * 0.55 * seen[2]) + this.wob * (0.5 + 0.5 * (1 - p.tidy)), -1, 1);
      if (b.stable) this.stillT += dt; else this.stillT = 0;
      if (this.stillT > this.react) { out.ly = -1; out.lx *= 0.3; }
      return out;
    }
    return out;
  }
}
export const fmt = (v) => (Math.abs(Math.round(v * 100) % 10) ? v.toFixed(2) : v.toFixed(1));
