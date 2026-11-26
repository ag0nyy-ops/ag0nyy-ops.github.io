/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Southpaw's fight engine: two fighters on one line, punches with windup / impact / recovery,
   guards, slips, stamina and knockdowns. No drawing and no input here, so the computer fighters
   and you run on exactly the same rules. */

export const RING = 2.9;      // ropes sit this many metres either side of the centre
export const MIN_GAP = 0.5;   // chest to chest, fighters can't get closer than this
export const COUNT_STEP = 0.7; // seconds per number of the referee's count

/* role-kind: timings in seconds, reach in metres (chest to target), damage out of 100 health */
export const PUNCHES = {
  'lead-straight': { name: 'Jab',      startup: 0.11, active: 0.06, recover: 0.15, reach: 0.98, dmg: 4,  stam: 3, stun: 0.10 },
  'rear-straight': { name: 'Cross',    startup: 0.19, active: 0.07, recover: 0.22, reach: 1.02, dmg: 10, stam: 6, stun: 0.18 },
  'lead-hook':     { name: 'Lead hook', startup: 0.20, active: 0.07, recover: 0.24, reach: 0.74, dmg: 9,  stam: 6, stun: 0.20 },
  'rear-hook':     { name: 'Rear hook', startup: 0.26, active: 0.08, recover: 0.28, reach: 0.74, dmg: 13, stam: 8, stun: 0.26 },
  'lead-upper':    { name: 'Lead uppercut', startup: 0.22, active: 0.07, recover: 0.27, reach: 0.60, dmg: 10, stam: 7, stun: 0.22 },
  'rear-upper':    { name: 'Rear uppercut', startup: 0.28, active: 0.08, recover: 0.32, reach: 0.60, dmg: 15, stam: 9, stun: 0.30 }
};
export const SLIP = { dur: 0.32, window: 0.27, cost: 4, counter: 0.7 };
const GET_UP_HP = [100, 60, 44, 30];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class Fighter {
  constructor(x, face, stance = 'orthodox') {
    this.home = x; this.face = face; this.stance = stance;
    this.stats = { thrown: 0, landed: 0, power: 0, blocked: 0, slips: 0, counters: 0, kds: 0 };
    this.kd = 0;
    this.resetRound();
    this.hp = 100;
  }
  resetRound() {
    this.x = this.home; this.vx = 0; this.stam = 100; this.guard = 'none'; this.act = null;
    this.counterT = 0; this.sinceThrow = 9; this.bodyT = 0; this.move = 0; this.roundDmg = 0; this.roundKd = 0;
  }
  lead() { return this.stance === 'orthodox' ? 'L' : 'R'; }
  role(hand) { return hand === this.lead() ? 'lead' : 'rear'; }
  is(type) { return !!this.act && this.act.type === type; }
  free() { return !this.act; }
  down() { return this.is('down'); }

  startPunch(hand, kind, body, p) {
    if (this.act) return false;
    const role = this.role(hand), key = `${role}-${kind}`, P = PUNCHES[key];
    if (kind === 'upper') body = false;
    if (this.stam < 15) p = Math.min(p, 0.6);
    p = clamp(p, 0, 1);
    const slow = 1 + 0.6 * Math.pow(1 - this.stam / 100, 2);   // tired arms are slow arms
    this.act = {
      type: 'punch', hand, role, kind, body, key, p, t: 0, phase: 'startup', extra: 0, missed: false, landed: false,
      s: (P.startup + 0.07 * p) * slow, a: P.active, r: (P.recover + 0.2 * p) * slow
    };
    this.stam = Math.max(0, this.stam - P.stam * (0.6 + 0.8 * p));
    this.sinceThrow = 0; this.guard = 'none'; this.stats.thrown++; this.lastThrow = this.act;
    if (p > 0.7) this.stats.power++;
    return true;
  }
  slip() {
    if (this.act || this.stam < 3) return false;
    this.act = { type: 'slip', t: 0, dur: SLIP.dur }; this.stam -= SLIP.cost; this.guard = 'none';
    return true;
  }
  switchStance() {
    if (this.act) return false;
    this.stance = this.stance === 'orthodox' ? 'southpaw' : 'orthodox';
    this.act = { type: 'switch', t: 0, dur: 0.22 };
    return true;
  }
}

/* One fight. bout.step(dt, myIntent) runs the world; the computer fighter's intent comes from its Brain.
   An intent is { move: -1..1 toward the other fighter, guard: none|high|low|shell, punch: {hand, kind, body, p}|null,
   slip: bool, stance: bool }. Things worth drawing or hearing come out in bout.fx and bout.events. */
export class Bout {
  constructor(style, opts = {}) {
    this.style = style;
    this.me = new Fighter(-1.1, 1, 'orthodox');
    this.foe = new Fighter(1.1, -1, style.stance || 'orthodox');
    this.foe.speed = style.speed || 1; this.foe.heavy = style.iron ? 0.4 : 1;
    this.brain = new Brain(style);
    this.practice = !!opts.practice;
    this.fx = []; this.events = []; this.freeze = 0; this.clock = 0;
    this.downed = null; // the fighter on the canvas, while the count runs
    this.over = null;   // { winner: 'me'|'foe', how: 'KO'|'TKO' }
  }
  other(f) { return f === this.me ? this.foe : this.me; }
  gap() { return this.foe.x - this.me.x; }

  /* acting = false freezes intents (intro, bell): fighters stand and recover */
  step(dt, myIntent, acting = true) {
    this.clock += dt;
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life);
    if (this.freeze > 0) { this.freeze -= dt; return; }
    const me = this.me, foe = this.foe;
    if (this.downed) return this.stepCount(dt);
    const foeIntent = acting ? this.brain.think(dt, foe, me, this) : idle();
    this.apply(me, acting ? myIntent : idle(), dt);
    this.apply(foe, foeIntent, dt);
    const hits = [];
    for (const f of [me, foe]) this.advance(f, dt, hits);
    for (const [att, a] of hits) if (!this.downed) this.resolve(att, this.other(att), a);   // both at once, so a trade is a trade
    // feet
    for (const f of [me, foe]) {
      let sp = 1.9 * (f.speed || 1);
      if (f.guard === 'shell') sp *= 0.45; else if (f.guard !== 'none') sp *= 0.75;
      if (f.is('punch')) sp *= 0.3;
      if (f.is('slip') || f.is('stun') || f.is('switch')) sp = 0;
      f.x += (f.move * sp + f.vx) * f.face * dt;
      f.vx *= Math.pow(0.0005, dt);
      f.x = clamp(f.x, -RING, RING);
    }
    if (foe.x - me.x < MIN_GAP) {
      const mid = (foe.x + me.x) / 2;
      me.x = mid - MIN_GAP / 2; foe.x = mid + MIN_GAP / 2;
      if (me.x < -RING) { me.x = -RING; foe.x = -RING + MIN_GAP; }
      if (foe.x > RING) { foe.x = RING; me.x = RING - MIN_GAP; }
    }
  }

  apply(f, it, dt) {
    f.move = 0;
    if (f.is('down') || f.is('stun')) { f.guard = 'none'; return; }
    if (it.stance && f.switchStance()) this.events.push({ type: 'stance', who: f });
    if (it.slip && f.slip()) this.events.push({ type: 'slip', who: f });
    if (it.punch && f.free() && f.startPunch(it.punch.hand, it.punch.kind, it.punch.body, it.punch.p)) {
      this.events.push({ type: 'windup', who: f });
      it.punch.taken = true;
    }
    f.guard = f.is('punch') || f.is('slip') ? 'none' : it.guard || 'none';
    f.move = clamp(it.move || 0, -1, 1);
  }

  advance(f, dt, hits) {
    f.counterT = Math.max(0, f.counterT - dt); f.sinceThrow += dt; f.bodyT = Math.max(0, f.bodyT - dt);
    const a = f.act;
    if (a) {
      a.t += dt;
      if (a.type === 'punch') {
        if (a.phase === 'startup' && a.t >= a.s) { a.phase = 'active'; hits.push([f, a]); }
        if (f.act === a && a.phase === 'active' && a.t >= a.s + a.a) a.phase = 'recover';
        if (f.act === a && a.phase === 'recover' && a.t >= a.s + a.a + a.r + a.extra) f.act = null;
      } else if (a.t >= a.dur) f.act = null;
    }
    if (!f.is('punch') && !f.is('down') && !f.is('stun') && f.sinceThrow > 0.5) {
      const rate = 14 * (f.guard === 'shell' ? 0.5 : 1) * (f.bodyT > 0 ? 0.5 : 1);
      f.stam = Math.min(100, f.stam + rate * dt);
    }
  }

  resolve(att, def, a) {
    const P = PUNCHES[a.key];
    const d = def.x - att.x;
    const reach = P.reach + (a.kind === 'straight' ? 0.1 * a.p : 0.03);
    const head = !a.body;
    const at = { x: def.x - def.face * 0.18, y: head ? 1.6 : 1.2 };
    const fx = (text, tone, x = at.x, y = at.y) => this.fx.push({ text, tone, x, y, t: 0, life: 0.75, who: att === this.me ? 'me' : 'foe' });
    if (Math.abs(d) > reach) {
      a.missed = true; a.extra = 0.16; att.stam = Math.max(0, att.stam - 2);
      fx('MISS', 'quiet', att.x + att.face * reach * 0.85, at.y);
      this.events.push({ type: 'miss', who: att });
      return;
    }
    const slipping = def.is('slip') && def.act.t < SLIP.window;
    if (slipping && head && a.kind !== 'upper') {
      a.missed = true; a.extra = 0.12; def.counterT = SLIP.counter; def.stats.slips++;
      fx('SLIPPED', 'mark');
      this.events.push({ type: 'slipped', who: def });
      return;
    }
    // counters: after a slip, into a missed or finished punch, or a power shot beating their windup
    const da = def.is('punch') ? def.act : null;
    const counter = att.counterT > 0 || (da && da.phase === 'recover') || (da && da.phase === 'startup' && a.key !== 'lead-straight');
    let mult = 1, blocked = false, label = '';
    const g = def.guard;
    if (a.body) blocked = g === 'low' || g === 'shell';
    else if (a.kind === 'upper') {
      if (g === 'shell') { mult = 0.45; label = 'SPLIT GUARD'; } else if (g === 'high') { mult = 0.85; label = 'UNDER GUARD'; }
      if (slipping) { mult *= 1.25; label = 'CAUGHT SLIPPING'; }
    } else blocked = g === 'high' || g === 'shell';

    // in close, straights get smothered and short punches come into their own
    if (Math.abs(d) < 0.64) mult *= a.kind === 'straight' ? 0.7 : 1.2;
    const opposite = att.stance !== def.stance;
    if (a.kind === 'straight') mult *= opposite ? (a.role === 'rear' ? 1.15 : 0.95) : (a.role === 'lead' ? 1.1 : 1);
    const base = 0.45 * P.dmg * (0.55 + 0.6 * a.p) * (0.4 + 0.6 * Math.min(1, att.stam / 60));

    if (blocked) {
      def.hp -= base * 0.1; def.stam = Math.max(0, def.stam - base * 0.5); def.vx = -(0.25 + 0.6 * a.p) * (def.heavy || 1);
      def.stats.blocked++;
      fx('BLOCKED', 'quiet');
      this.events.push({ type: 'block', who: def, p: a.p });
      if (def.hp <= 0) this.knockdown(def, att);
      return;
    }
    let dmg = base * mult * (counter ? 1.35 : 1);
    a.landed = true; att.stats.landed++;
    if (counter) { att.counterT = 0; att.stats.counters++; label = 'COUNTER'; }
    if (a.body) {
      def.hp -= dmg * 0.6; def.stam = Math.max(0, def.stam - dmg * 1.3); def.bodyT = 2.5;
      if (!label) label = 'BODY';
    } else def.hp -= dmg;
    att.roundDmg += dmg;
    const stun = P.stun * (0.6 + 0.8 * a.p) * Math.min(1, mult) * (counter ? 1.25 : 1);
    // a real shot stuns and stuffs whatever they were winding up; a light touch doesn't stop a committed punch
    const iron = def === this.foe ? this.style.iron || 0 : 0;   // some fighters walk through light shots
    if ((dmg >= 2.2 || !def.is('punch')) && dmg >= iron) { def.act = { type: 'stun', t: 0, dur: stun }; def.guard = 'none'; }
    def.vx = -(0.3 + 0.9 * a.p) * (def.heavy || 1);
    this.freeze = 0.03 + 0.04 * a.p;
    fx(label || P.name.toUpperCase(), counter ? 'mark' : 'hit');
    this.events.push({ type: 'hit', who: def, p: a.p, counter, body: a.body, dmg });
    if (def.hp <= 0) this.knockdown(def, att);
  }

  knockdown(def, att) {
    def.hp = 0; def.kd++; def.roundKd++; att.stats.kds++;
    def.act = { type: 'down', t: 0 };
    def.guard = 'none';
    const getUp = this.practice ? 3 : Math.min(9, 3 + 2 * def.kd);
    this.downed = { who: def, by: att, t: 0, count: 0, getUp, out: !this.practice && def.kd >= 3 };
    this.events.push({ type: 'down', who: def });
  }

  stepCount(dt) {
    const c = this.downed, att = c.by;
    c.t += dt;
    // the standing fighter walks to a neutral spot
    const want = att === this.me ? -1.4 : 1.4;
    att.act = null; att.guard = 'none';
    att.x += clamp(want - att.x, -1.2 * dt, 1.2 * dt);
    att.stam = Math.min(100, att.stam + 10 * dt);
    const n = Math.floor(c.t / COUNT_STEP);
    if (n > c.count) { c.count = n; this.events.push({ type: 'count', n }); }
    if (c.out && c.count >= 10) {
      this.over = { winner: c.who === this.me ? 'foe' : 'me', how: 'TKO' };
      this.downed = null;
      return;
    }
    if (!c.out && c.count >= c.getUp) {
      c.who.act = null; c.who.hp = this.practice ? 100 : GET_UP_HP[Math.min(3, c.who.kd)];
      c.who.stam = Math.max(c.who.stam, 50); c.who.x = c.who === this.me ? -1.1 : 1.1;
      this.downed = null;
      this.events.push({ type: 'up', who: c.who });
    }
  }
}

const idle = () => ({ move: 0, guard: 'none', punch: null, slip: false, stance: false });

/* ---------------- computer fighters ----------------
   A brain only sees what you would see: your punch from the moment its windup starts, a reaction
   time later. It never reads your buttons. It plays by the same fighter rules as you. */
const J = (body = false) => ({ hand: 'lead', kind: 'straight', body });
const C = (body = false) => ({ hand: 'rear', kind: 'straight', body });
const LH = (body = false) => ({ hand: 'lead', kind: 'hook', body });
const RH = (body = false) => ({ hand: 'rear', kind: 'hook', body });
const LU = () => ({ hand: 'lead', kind: 'upper', body: false });
const RU = () => ({ hand: 'rear', kind: 'upper', body: false });

export const STYLES = [
  { id: 'rook', closeGuard: 0.4, anticipate: 0.25, name: 'Rook', tag: 'Stand-up', stance: 'orthodox',
    blurb: 'Stands tall, throws the one-two, keeps his gloves high. Start here.',
    tip: 'Rook guards high. Dip to the body, or go under with an uppercut.',
    reaction: 0.42, pGuard: 0.3, pSlip: 0, pStep: 0.1, punish: 0.15, tempo: 2.2, range: 0.9, idleGuard: 0.4,
    power: [0.25, 0.55], combos: [[J()], [J(), C()], [C()], [J(), J()]] },
  { id: 'bull', rangeSense: 0.2, closeGuard: 0.85, anticipate: 0.15, name: 'Bull', tag: 'Pressure', stance: 'orthodox',
    blurb: 'Walks you down through your jab and digs hooks to the body. Tires if you make him miss.',
    tip: 'Bull wants the ropes. Make him miss and he tires fast; he barely guards his head.',
    reaction: 0.27, pGuard: 0.3, pSlip: 0.04, pStep: 0, punish: 0.4, tempo: 0.75, iron: 3.5, tiredAt: 6, speed: 1.2, range: 0.62, idleGuard: 0.15, minStam: 8,
    power: [0.45, 0.9], combos: [[LH(true)], [RH()], [LH(), RH()], [J(), RH(true)], [LU(), RH()], [LH(true), LH()]] },
  { id: 'kestrel', closeGuard: 0.3, anticipate: 0.35, name: 'Kestrel', tag: 'Out-boxer', stance: 'southpaw',
    blurb: 'A southpaw who lives on the end of her jab and never stays still.',
    tip: 'Kestrel is southpaw. Your rear straight lines up better against her, and her jab comes from the other side.',
    reaction: 0.27, pGuard: 0.3, pSlip: 0.2, pStep: 0.3, punish: 0.4, tempo: 0.95, range: 1.0, idleGuard: 0.25, bounce: 0.14,
    power: [0.2, 0.7], combos: [[J()], [J(), J()], [J(), C()], [J(), J(), C()], [J(true), C()]] },
  { id: 'dutch', rangeSense: 0.8, closeGuard: 0.6, anticipate: 0.5, name: 'Dutch', tag: 'Counter-puncher', stance: 'orthodox',
    blurb: 'Waits for you to miss, then makes you pay. Patient and sharp.',
    tip: 'Dutch punishes misses. Throw light, stay in range, and make him lead.',
    reaction: 0.22, pGuard: 0.36, pSlip: 0.34, pStep: 0.15, punish: 0.85, tempo: 2.3, range: 0.86, idleGuard: 0.45,
    power: [0.4, 0.9], combos: [[C()], [LH()], [C(), LH()], [J(), RU()]] },
  { id: 'clerk', rangeSense: 0.95, closeGuard: 0.9, anticipate: 0.6, name: 'The Clerk', tag: 'All-rounder', stance: 'orthodox', adaptive: true, switches: true,
    blurb: 'Keeps a tally of what you throw and guards for it. Switches stance between rounds.',
    tip: 'The Clerk learns your favourite punch inside a round. Mix head, body and uppercuts.',
    reaction: 0.19, pGuard: 0.4, pSlip: 0.26, pStep: 0.15, punish: 0.7, tempo: 1.25, range: 0.9, idleGuard: 0.5,
    power: [0.3, 0.95], combos: [[J()], [J(), C()], [J(true), LH()], [C(), LH(), RU()], [LH(true), RH()], [J(), J(), RH(true)]] }
];
export const SPARRING = { id: 'sparring', name: 'Partner', tag: 'Practice', stance: 'orthodox', noPunch: true,
  blurb: 'Holds pads, guards now and then, never throws.', tip: '',
  reaction: 0.3, pGuard: 0.45, pSlip: 0.15, pStep: 0, punish: 0, tempo: 9, range: 0.85, idleGuard: 0.35, power: [0, 0], combos: [] };

export class Brain {
  constructor(style) {
    this.s = style; this.t = 0; this.seen = []; this.lastAct = null; this.plan = [];
    this.next = rand(0.6, 1.2) * style.tempo; this.hold = 0; this.holdGuard = 'none'; this.backT = 0;
    this.idleGuard = 'none'; this.idleT = 0; this.tally = { head: 0, body: 0, upper: 0 }; this.gapT = 0; this.recent = [];
  }
  newRound() { this.plan = []; this.tally = { head: 0, body: 0, upper: 0 }; this.next = rand(0.8, 1.4) * this.s.tempo; }

  think(dt, me, foe, bout) {
    const s = this.s; this.t += dt;
    const d = Math.abs(foe.x - me.x);
    const it = { move: 0, guard: 'none', punch: null, slip: false, stance: false };

    // perception: notice a new punch, and its outcome, only after a reaction time
    const fa = foe.act;
    if (fa !== this.lastAct) {
      this.lastAct = fa;
      if (fa && fa.type === 'punch') this.recent.push(this.t);
      if (fa && fa.type === 'punch') this.seen.push({ at: this.t + s.reaction * rand(0.85, 1.25), act: fa, kind: 'windup' });
    }
    if (fa && fa.type === 'punch' && fa.missed && !fa.seenMiss) {
      fa.seenMiss = true;
      this.seen.push({ at: this.t + s.reaction * rand(0.8, 1.1), act: fa, kind: 'miss' });
    }
    const due = this.seen.filter((e) => e.at <= this.t);
    this.seen = this.seen.filter((e) => e.at > this.t);
    for (const e of due) {
      if (e.kind === 'windup' && foe.act === e.act && e.act.phase === 'startup') this.defend(e.act, it, me);
      if (e.kind === 'miss' && !s.noPunch && Math.random() < s.punish && d < 1.0 && me.stam > 10) {
        this.plan = [pick([[C()], [LH()], [RH()], [J(), C()]])]; this.plan = this.plan[0].slice(); this.gapT = 0;
      }
    }

    // offense
    if (!s.noPunch && !bout.downed) {
      this.next -= dt;
      const want = this.plan.length ? reachOf(this.plan[0], me) - 0.08 : s.range;
      if (!this.plan.length && this.next <= 0 && d <= s.range + 0.12 && me.stam > (s.minStam || 22)) {
        let options = s.combos;
        if (Math.random() < (s.rangeSense ?? 0.6)) {   // pick something that reaches from here
          const fits = options.filter((c) => reachOf(c[0]) >= d - 0.04);
          if (fits.length) options = fits;
        }
        if (foe.guard === 'shell' || foe.guard === 'high') {
          const under = options.filter((c) => c.some((p) => p.body || p.kind === 'upper'));
          if (under.length && Math.random() < 0.6) options = under;
        }
        this.plan = pick(options).slice(); this.gapT = 0; this.closeG = Math.random() < (s.closeGuard || 0);
        this.next = s.tempo * rand(0.6, 1.4) * (1 + (1 - me.stam / 100) * 0.8);
      }
      if (this.plan.length && me.free()) {
        this.gapT -= dt;
        if (this.gapT <= 0 && d <= want + 0.06) {
          const n = this.plan.shift();
          const hand = n.hand === 'lead' ? me.lead() : (me.lead() === 'L' ? 'R' : 'L');
          it.punch = { hand, kind: n.kind, body: n.body, p: rand(s.power[0], s.power[1]) };
          this.gapT = rand(0.03, 0.1);
        }
      }
      if (this.plan.length && d > want + 0.6) this.plan = [];
    }

    // guard
    this.hold -= dt; this.idleT -= dt;
    this.recent = this.recent.filter((t) => this.t - t < 2.5);
    if (this.idleT <= 0) {
      // a busy opponent in range gets the gloves up more often
      const busy = this.recent.length >= 2 && d < 1.15 ? s.anticipate || 0 : 0;
      this.idleT = rand(0.5, 1.2); this.idleGuard = Math.random() < s.idleGuard + busy ? 'high' : 'none';
    }
    if (this.hold > 0) it.guard = this.holdGuard;
    else if (!this.plan.length || (this.recent.length >= 3 && d < 1.15)) it.guard = this.idleGuard;
    if (this.plan.length && this.closeG && d > reachOf(this.plan[0]) - 0.02) it.guard = 'high';   // walk in behind the gloves

    // feet
    let desired = this.plan.length ? reachOf(this.plan[0], me) - 0.1 : s.range;
    if (s.bounce) desired += Math.sin(this.t * 2.3) * s.bounce;
    if (me.stam < (s.tiredAt ?? 25)) desired += 0.45;
    if (s.noPunch) desired = s.range;
    this.backT -= dt;
    if (this.backT > 0) it.move = -1;
    else { const e = d - desired; it.move = Math.abs(e) < 0.06 ? 0 : clamp(e * 4, -1, 1); }
    if (bout.downed) it.move = 0;
    return it;
  }

  defend(act, it, me) {
    const s = this.s;
    let pG = s.pGuard, pS = s.pSlip;
    const cat = act.kind === 'upper' ? 'upper' : act.body ? 'body' : 'head';
    if (s.adaptive) {
      this.tally[cat]++;
      const total = this.tally.head + this.tally.body + this.tally.upper;
      if (total >= 4) pG = Math.min(0.8, pG + 0.4 * (this.tally[cat] / total - 0.33));
    }
    const r = Math.random();
    if (cat === 'body') {
      if (r < pG + 0.1) { this.holdGuard = 'low'; this.hold = rand(0.3, 0.5); } else if (r < pG + 0.1 + s.pStep) this.backT = 0.25;
    } else if (cat === 'upper') {
      if (r < s.pStep + pG * 0.5) this.backT = 0.3; else if (r < s.pStep + pG) { this.holdGuard = 'shell'; this.hold = 0.35; }
    } else {
      if (r < pS) it.slip = true;
      else if (r < pS + pG) { this.holdGuard = 'high'; this.hold = rand(0.3, 0.55); }
      else if (r < pS + pG + s.pStep * 0.5) this.backT = 0.25;
    }
    if (this.hold > 0) { this.plan = []; }
  }
}

function reachOf(n, f) { return PUNCHES[`${n.hand}-${n.kind}`].reach; }
