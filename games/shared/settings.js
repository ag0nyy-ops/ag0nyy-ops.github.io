/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Settings shared by every game on /games. Saved in this browser only (localStorage), never sent anywhere.
   Change them on the /games hub; each game reads them when it starts and when the tab regains focus. */

const KEY = 'jay.games.settings.v1';

export const DEFAULTS = Object.freeze({
  deadzone: 0.15,      // sticks: anything under this (0..1) counts as centred. Raise it for drift.
  triggerDeadzone: 0.06,
  palette: 'standard', // team / highlight colours, see PALETTES
  volume: 0.6,         // 0..1
  reduceMotion: 'auto' // 'auto' follows the system setting, 'on', 'off'
});

/* Two-team colour pairs plus a highlight, picked to stay apart for each kind of colour blindness.
   Every game also marks teams with shape or text, so colour is never the only cue. */
export const PALETTES = Object.freeze({
  standard:     { name: 'Standard',              home: '#ececec', away: '#e0a030', mark: '#ececec' },
  deuteranopia: { name: 'Deuteranopia (red-green)', home: '#ececec', away: '#3b8fe0', mark: '#f2c14e' },
  protanopia:   { name: 'Protanopia (red-green)',   home: '#ececec', away: '#3b8fe0', mark: '#f2c14e' },
  tritanopia:   { name: 'Tritanopia (blue-yellow)', home: '#ececec', away: '#e05a6a', mark: '#4fd1c5' },
  mono:         { name: 'Black and white only',     home: '#ececec', away: '#7a7a7a', mark: '#ececec' }
});

export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { /* private mode or bad data */ }
  const s = { ...DEFAULTS, ...saved };
  if (!PALETTES[s.palette]) s.palette = DEFAULTS.palette;
  s.deadzone = clamp(+s.deadzone || 0, 0, 0.6);
  s.triggerDeadzone = clamp(+s.triggerDeadzone || 0, 0, 0.5);
  s.volume = clamp(+s.volume, 0, 1);
  return s;
}

export function saveSettings(s) {
  const out = {};
  for (const k of Object.keys(DEFAULTS)) out[k] = s[k];
  try { localStorage.setItem(KEY, JSON.stringify(out)); } catch (e) {}
  return out;
}

export function reducedMotion(s = loadSettings()) {
  if (s.reduceMotion === 'on') return true;
  if (s.reduceMotion === 'off') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function palette(s = loadSettings()) { return PALETTES[s.palette]; }

function clamp(v, a, b) { return Math.min(b, Math.max(a, isNaN(v) ? a : v)); }
