/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   One input layer for every game: the first connected controller (standard mapping) plus the keyboard.
   Call input.poll() once per frame, then read input.state. Sticks get a radial deadzone that is
   rescaled, so a drifting stick sits at exactly 0 and full tilt is still 1. */

import { loadSettings } from './settings.js';

// standard gamepad button numbers (PlayStation names in comments)
export const BTN = Object.freeze({ A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 });
// A = cross, B = circle, X = square, Y = triangle, LB/RB = L1/R1, LT/RT = L2/R2, START = options

export function applyDeadzone(x, y, dz) {
  const m = Math.hypot(x, y);
  if (m <= dz) return [0, 0];
  const s = Math.min(1, (m - dz) / (1 - dz)) / m;
  return [x * s, y * s];
}

const BUTTON_NAMES = Object.keys(BTN);

export class Input {
  /* keymap: { action: ['KeyF', ...] } for the game's own keyboard layout. Actions named like a
     button (A, B, LT, UP...) also light up that button, so menus work the same on both. */
  constructor(keymap = {}) {
    this.keymap = keymap;
    this.keys = new Set();
    this.settings = loadSettings();
    this.state = blank();
    this.prev = blank();
    this.pad = null;
    this.lastDevice = 'keyboard';
    addEventListener('keydown', (e) => {
      if (this.owns(e.code)) e.preventDefault();
      this.keys.add(e.code); this.lastDevice = 'keyboard';
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('focus', () => { this.settings = loadSettings(); });
  }
  owns(code) { return Object.values(this.keymap).some((list) => list.includes(code)); }
  key(action) { return (this.keymap[action] || []).some((c) => this.keys.has(c)); }

  poll() {
    this.prev = this.state;
    const s = blank();
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const pad = pads.find((p) => p.mapping === 'standard') || pads[0] || null;
    this.pad = pad;
    const dz = this.settings.deadzone, tdz = this.settings.triggerDeadzone;
    if (pad) {
      const ax = (i) => pad.axes[i] || 0;
      [s.lx, s.ly] = applyDeadzone(ax(0), ax(1), dz);
      [s.rx, s.ry] = applyDeadzone(ax(2), ax(3), dz);
      const val = (i) => (pad.buttons[i] ? pad.buttons[i].value || (pad.buttons[i].pressed ? 1 : 0) : 0);
      s.lt = trig(val(BTN.LT), tdz);
      s.rt = trig(val(BTN.RT), tdz);
      for (const n of BUTTON_NAMES) s.btn[n] = !!(pad.buttons[BTN[n]] && pad.buttons[BTN[n]].pressed);
      s.btn.LT = s.lt > 0.5; s.btn.RT = s.rt > 0.5;
      if (s.lx || s.ly || s.rx || s.ry || s.lt || s.rt || BUTTON_NAMES.some((n) => s.btn[n])) this.lastDevice = 'controller';
    }
    // keyboard on top: digital values
    const kx = (this.key('RIGHT') ? 1 : 0) - (this.key('LEFT') ? 1 : 0);
    const ky = (this.key('DOWN') ? 1 : 0) - (this.key('UP') ? 1 : 0);
    if (kx || ky) { const m = Math.hypot(kx, ky); s.lx = kx / m; s.ly = ky / m; }
    for (const n of BUTTON_NAMES) if (this.key(n)) s.btn[n] = true;
    if (this.key('LT')) s.lt = 1;
    if (this.key('RT')) s.rt = 1;
    for (const action of Object.keys(this.keymap)) if (!(action in s.btn) && this.key(action)) s.act[action] = true;
    this.state = s;
    return s;
  }
  down(name) { return !!(this.state.btn[name] || this.state.act[name]); }
  pressed(name) { return this.down(name) && !(this.prev.btn[name] || this.prev.act[name]); }
  /* menu navigation: stick, d-pad or arrows; one step per push */
  nav() {
    const s = this.state, p = this.prev;
    const y = s.btn.UP || s.ly < -0.6 ? -1 : s.btn.DOWN || s.ly > 0.6 ? 1 : 0;
    const py = p.btn.UP || p.ly < -0.6 ? -1 : p.btn.DOWN || p.ly > 0.6 ? 1 : 0;
    const x = s.btn.LEFT || s.lx < -0.6 ? -1 : s.btn.RIGHT || s.lx > 0.6 ? 1 : 0;
    const px = p.btn.LEFT || p.lx < -0.6 ? -1 : p.btn.RIGHT || p.lx > 0.6 ? 1 : 0;
    return { y: y !== py ? y : 0, x: x !== px ? x : 0 };
  }
}

function trig(v, dz) { return v <= dz ? 0 : Math.min(1, (v - dz) / (1 - dz)); }
function blank() { return { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, btn: {}, act: {} }; }

/* Raw stick readings for the calibration screen: no deadzone applied. */
export function rawSticks() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const pad = pads.find((p) => p.mapping === 'standard') || pads[0];
  if (!pad) return null;
  return { id: pad.id, l: [pad.axes[0] || 0, pad.axes[1] || 0], r: [pad.axes[2] || 0, pad.axes[3] || 0] };
}
