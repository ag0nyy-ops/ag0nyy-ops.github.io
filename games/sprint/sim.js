/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Sprint's race physics, kept apart from drawing so it can be tested on its own.

   You run by alternating the triggers. Each stride is graded on three things:
     rhythm  how close the gap since your last stride is to the ideal for your speed
     depth   how far you pulled the trigger (a keyboard key counts as a full pull)
     lean    how close your body lean (left stick up/down) is to the ideal for where you are
   Good strides push you toward your top speed; sloppy ones barely do. Two strides on the same
   trigger is a stumble. Mashing is a stride with bad rhythm, so it gets you nowhere. */

import { makeDummy, newSeed } from '../shared/seed.js';

export const DIST = 100;

// ideal gap between strides: longer out of the blocks, quicker at top speed
export const idealGap = (x) => 0.26 - 0.06 * Math.min(1, x / 40);
// ideal lean (0 = upright, 1 = deep forward): low drive out of the blocks, upright by ~40 m
export const idealLean = (x) => (x < 40 ? 0.85 - 0.6 * (x / 40) : 0.25);

/* athlete: built from training grades (0..1 each). Untrained is a fine runner, trained is fast. */
export function athlete(grades = {}) {
  const g = (k) => Math.max(0, Math.min(1, grades[k] || 0));
  return {
    vmax: 11.2 + 0.6 * g('cadence'),        // m/s top speed
    accel: 0.15 * (1 + 0.15 * g('lean')),   // share of the gap to top speed one perfect stride closes
    blocks: 1 + 0.25 * g('blocks')          // extra push on the first 4 strides
  };
}

export function gradeStride({ gap, depth, lean, x }) {
  const ideal = idealGap(x);
  const rhythm = Math.max(0.12, 1 - Math.abs(gap - ideal) / 0.12);
  const d = Math.min(1, Math.max(0, (depth - 0.55) / 0.4));
  const leanErr = Math.abs(lean - idealLean(x));
  const leanQ = Math.max(0, 1 - leanErr * 1.6);
  return { rhythm, depth: d, lean: leanQ, total: rhythm * (0.7 + 0.3 * d) * (0.55 + 0.45 * leanQ) };
}

export class Runner {
  constructor(ath) { this.a = ath; this.reset(); }
  reset() {
    this.x = 0; this.v = 0; this.t = 0; this.started = false; this.lastStride = -1; this.lastSide = 0;
    this.strides = 0; this.finish = null; this.dipAt = null; this.stumble = 0; this.topV = 0;
    this.grades = []; this.lean = 0.5;
  }
  stride(side, depth, now) {
    if (this.finish != null) return null;
    if (side === this.lastSide) { this.v *= 0.82; this.stumble = 0.35; this.lastSide = side; return { stumble: true }; }
    const gap = this.lastStride < 0 ? idealGap(0) : now - this.lastStride;
    const g = gradeStride({ gap, depth, lean: this.lean, x: this.x });
    let push = this.a.accel * g.total;
    if (this.strides < 4) push *= this.a.blocks * 1.6;
    this.v += (this.a.vmax - this.v) * push;
    this.lastStride = now; this.lastSide = side; this.strides++;
    this.grades.push(g);
    return g;
  }
  dip(now) { if (this.dipAt == null && this.finish == null) this.dipAt = now; }
  step(dt, now) {
    if (this.finish != null) { this.v *= Math.exp(-1.2 * dt); this.x += this.v * dt; return; }
    // you slow down between strides, faster the longer you wait
    const idle = this.lastStride < 0 ? 0 : now - this.lastStride;
    const drag = 0.06 + (idle > idealGap(this.x) * 1.5 ? 1.4 : 0);
    this.v *= Math.exp(-drag * dt);
    if (this.stumble > 0) this.stumble -= dt;
    // a dip held too long costs speed
    if (this.dipAt != null && now - this.dipAt > 0.45) this.v *= Math.exp(-0.9 * dt);
    const x0 = this.x;
    this.x += this.v * dt;
    this.topV = Math.max(this.topV, this.v);
    // the torso crosses first: an active dip finishes you up to 0.5 m early
    const dipping = this.dipAt != null && now - this.dipAt < 0.45;
    const line = DIST - (dipping ? 0.5 : 0);
    if (this.x >= line) {
      const frac = (line - x0) / Math.max(1e-6, this.x - x0);
      this.finish = now - dt + frac * dt;
    }
  }
}

/* computer runners ("dummies"). Each one is rolled from a seed (../shared/seed.js), so no two run
   alike. The level sets how fast the field is (its target times); the seed only changes HOW a dummy
   runs: reaction, how hard it guesses the gun, drive phase, top-end fade, a mid-race surge, stride
   turnover, lean, and how well it times the dip. Its top speed is solved from its target time and
   its own race shape, so an explosive starter that fades and a slow starter that closes both land
   near the same time. That keeps the seed a trade-off, never a raw speed boost.
   Speed follows a lag toward a goal speed: dv/dt = (goal(x) - v) / drive. */
export const CPU_RANGES = {
  react: [0.125, 0.2],    // s, reaction to the gun on a clean start
  risk: [0, 1],           // how hard it guesses the gun: quicker starts, but false starts
  nerve: [0, 1],          // low = sometimes sleepy out of the blocks
  drive: [0.95, 1.5],     // s, acceleration lag: low = explosive start
  fade: [0, 0.05],        // share of top speed lost over the last 40 m
  surge: [0, 1],          // extra push between 40 and 70 m
  cadence: [4.2, 5.0],    // strides per second at top speed (quick turnover vs long strides)
  low: [0.6, 0.95],       // lean out of the blocks
  rise: [25, 50],         // m until it runs tall
  dipLead: [0.08, 0.42],  // s before the line it plans to dip
  dipSkill: [0.3, 1],     // how close it gets to that plan
  steady: [0.3, 1]        // race-to-race consistency
};
export const CPU_STYLES = [
  ['gun hunter', (p) => p.risk > 0.8],
  ['drive phase', (p) => p.drive < 1.1],
  ['closer', (p) => p.fade < 0.012],
  ['long strider', (p) => p.cadence < 4.4]
];
export const rollDummy = (seed = newSeed()) => makeDummy(seed, CPU_RANGES, CPU_STYLES, 'all rounder');

function goalSpeed(p, vmax, x) {
  let k = 1;
  if (x > 60) k -= p.fade * Math.min(1, (x - 60) / 40);
  if (x > 40 && x < 70) k += 0.018 * p.surge * Math.sin((Math.PI * (x - 40)) / 30);
  return vmax * k;
}
// seconds from first movement to the line, for a given top speed
function runTime(p, vmax, dt = 1 / 240) {
  let x = 0, v = 0, t = 0;
  const lag = 1 - Math.exp(-dt / p.drive);
  while (t < 40) {
    v += (goalSpeed(p, vmax, x) - v) * lag;
    const x0 = x; x += v * dt; t += dt;
    if (x >= DIST) return t - dt + ((DIST - x0) / Math.max(1e-9, x - x0)) * dt;
  }
  return t;
}

export class CpuRunner {
  constructor(dummy, target) {
    this.d = dummy; this.p = dummy.p; this.target = target; this.warned = false;
    const T = target - this.p.react + 0.04;   // a clean dip gives back about 0.04 s
    let lo = 4, hi = 20;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (runTime(this.p, mid) > T) lo = mid; else hi = mid; }
    this.vmax = (lo + hi) / 2;
    this.reset();
  }
  reset() {
    this.x = 0; this.v = 0; this.ph = 0; this.finish = null; this.dipAt = null; this.topV = 0;
    this.react = this.p.react; this.falseStart = false; this.form = 1; this.dipPlan = this.p.dipLead;
    this.lean = this.p.low;
  }
  /* roll this start with the dummy's own generator: reaction, a gun guess, race-day form, dip plan */
  prepStart() {
    const { p, R, rand } = this.d;
    this.reset();
    let r = p.react + (R() - 0.5) * 0.02;
    if (R() < (1 - p.nerve) * 0.15) r += rand(0.04, 0.1);          // sleepy start
    if (!this.warned) {
      r -= 0.02 * p.risk;                                            // leaning on the gun
      if (R() < p.risk * p.risk * 0.05) r = rand(-0.08, 0.09);       // guessed it: false start
    } else r += 0.02;                                                // after a recall it waits
    this.react = r; this.falseStart = r < 0.1;
    const g = (R() + R() + R() - 1.5) * 2;                           // about one standard deviation
    const off = g * (0.01 + 0.05 * (1 - p.steady));                  // seconds off its target today
    this.form = (this.target - p.react) / Math.max(1, this.target - p.react + off);
    this.dipPlan = Math.max(0.02, p.dipLead + (R() - 0.5) * 0.4 * (1 - p.dipSkill));
  }
  dipping(t) { return this.dipAt != null && t - this.dipAt < 0.45; }
  step(dt, t) {
    const p = this.p, vmax = this.vmax * this.form;
    if (this.finish != null) { this.v *= Math.exp(-1.2 * dt); this.x += this.v * dt; this.ph += dt * Math.PI * p.cadence * (this.v / vmax); return; }
    if (t < this.react) return;
    this.v += (goalSpeed(p, vmax, this.x) - this.v) * (1 - Math.exp(-dt / p.drive));
    if (this.dipAt == null && this.v > 1 && (DIST - this.x) / this.v <= this.dipPlan) this.dipAt = t;
    if (this.dipAt != null && t - this.dipAt > 0.45) this.v *= Math.exp(-0.9 * dt);
    const x0 = this.x;
    this.x += this.v * dt;
    this.topV = Math.max(this.topV, this.v);
    this.ph += dt * Math.PI * p.cadence * (this.v / vmax);
    this.lean = this.x < p.rise ? p.low - (p.low - 0.25) * (this.x / p.rise) : 0.25;
    const line = DIST - (this.dipping(t) ? 0.5 : 0);
    if (this.x >= line) this.finish = t - dt + ((line - x0) / Math.max(1e-6, this.x - x0)) * dt;
  }
}

export const LEVELS = [
  { id: 'club', name: 'Club meet', field: [12.9, 12.6, 12.3, 12.1, 11.9, 11.7, 11.5] },
  { id: 'state', name: 'State final', field: [11.6, 11.4, 11.25, 11.1, 10.95, 10.85, 10.75] },
  { id: 'nationals', name: 'Nationals', field: [10.75, 10.62, 10.52, 10.44, 10.36, 10.28, 10.2] }
];
