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
export const fmt = (v) => (Math.abs(Math.round(v * 100) % 10) ? v.toFixed(2) : v.toFixed(1));
