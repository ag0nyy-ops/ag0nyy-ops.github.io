/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Sprint's race physics, kept apart from drawing so it can be tested on its own.

   You run by alternating the triggers. Each stride is graded on three things:
     rhythm  how close the gap since your last stride is to the ideal for your speed
     depth   how far you pulled the trigger (a keyboard key counts as a full pull)
     lean    how close your body lean (left stick up/down) is to the ideal for where you are
   Good strides push you toward your top speed; sloppy ones barely do. Two strides on the same
   trigger is a stumble. Mashing is a stride with bad rhythm, so it gets you nowhere. */

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

/* computer runners: a smooth curve that hits a target time. x(t) = v * (t - tau(1 - e^(-t/tau))) */
export class Pacer {
  constructor(target, react, tau = 1.25) {
    this.react = react; this.tau = tau; this.target = target;
    const T = target - react;
    this.vmax = DIST / (T - tau * (1 - Math.exp(-T / tau)));
    this.x = 0; this.v = 0; this.finish = null;
  }
  at(t) {
    const u = Math.max(0, t - this.react), tau = this.tau;
    this.x = this.vmax * (u - tau * (1 - Math.exp(-u / tau)));
    this.v = this.vmax * (1 - Math.exp(-u / tau));
    if (this.finish == null && this.x >= DIST) this.finish = this.target;
    return this.x;
  }
}

export const LEVELS = [
  { id: 'club', name: 'Club meet', field: [12.9, 12.6, 12.3, 12.1, 11.9, 11.7, 11.5] },
  { id: 'state', name: 'State final', field: [11.6, 11.4, 11.25, 11.1, 10.95, 10.85, 10.75] },
  { id: 'nationals', name: 'Nationals', field: [10.75, 10.62, 10.52, 10.44, 10.36, 10.28, 10.2] }
];
