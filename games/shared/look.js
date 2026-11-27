/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   The Folkstyle look for the canvas and the page HUD, shared by every game on /games.

   Colour: everything is grey except the two team bands. Side A (you, home) is light bodies with a
   green band, side B (CPU, away) is dark bodies with a light rim and a red band, so light vs dark
   always tells the teams apart even with the colour off. The bands follow the colour-vision
   setting on the hub. Nothing flashes; motion stops under reduced motion.

   import * as look from '../shared/look.js';
   look.fit(canvas) -> { W, H, dpr }            size the canvas to its stage
   look.arena(ctx, W, H, { horizon, t, dt })     background, crowd and lights; draw your floor after
   look.team(i), look.bands()                    body tones and band colours for side 0 / 1
   look.tag(ctx, x, y, 'TEXT')                   a black label box, the on-canvas text style
   const hud = look.hud(); hud.board({...}); hud.call('Bucket', 'three'); hud.msg('check'); hud.bar(...) */

import { loadSettings, palette, reducedMotion } from './settings.js';

export const INK = Object.freeze({
  bg: '#060606', fg: '#ececec', muted: 'rgba(236,236,236,.74)', dim: 'rgba(236,236,236,.42)',
  line: 'rgba(236,236,236,.2)', strong: '#4d4d4d'
});
export const BAND = Object.freeze(['#1fb85a', '#e0242f']);
export const RIM = '#dcdcdc';
/* [lit side, body, shadow side] */
export const TONE = Object.freeze({
  skin0: ['#e6e6e6', '#b6b6b6', '#575757'], suit0: ['#ffffff', '#e4e4e4', '#848484'],
  skin1: ['#adadad', '#7b7b7b', '#303030'], suit1: ['#555555', '#2a2a2a', '#0c0c0c'],
  shoe: ['#626262', '#2b2b2b', '#0a0a0a'], hair: ['#4a4a4a', '#222222', '#070707'],
  shirt: ['#ffffff', '#ececec', '#8c8c8c'], refskin: ['#c6c6c6', '#929292', '#454545'], pants: ['#4c4c4c', '#282828', '#0e0e0e'],
  white: ['#ffffff', '#f2f2f2', '#c8c8c8'], black: ['#1a1a1a', '#0c0c0c', '#050505']
});
export const FLOOR = Object.freeze({ base: '#0d0d0d', edge: '#333333', lit: ['#303030', '#202020', '#131313'], line: '#cfcfcf', hot: '#ffffff', inner: '#565656', mark: '#8f8f8f' });

export const mono = (px, w = 600) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`;
export const calm = () => reducedMotion(loadSettings());

/* band colours for side 0 and 1: green and red, or the pair the colour-vision setting picks */
export function bands(s = loadSettings()) {
  const p = palette(s);
  return [p.bandA || BAND[0], p.bandB || BAND[1]];
}

/* everything a side needs to draw a body: suit and skin tones, its band, and the rim for the dark side */
export function team(i, s = loadSettings()) {
  const b = bands(s)[i ? 1 : 0];
  return i ? { suit: TONE.suit1, skin: TONE.skin1, band: b, rim: RIM, light: false, word: bandWord(1, s) }
           : { suit: TONE.suit0, skin: TONE.skin0, band: b, rim: null, light: true, word: bandWord(0, s) };
}
/* what to call the band in words, so colour is never the only cue */
const WORDS = { standard: ['green', 'red'], deuteranopia: ['yellow', 'blue'], protanopia: ['yellow', 'blue'], tritanopia: ['teal', 'red'], mono: ['light', 'dark'] };
export function bandWord(i, s = loadSettings()) { return (WORDS[s.palette] || WORDS.standard)[i ? 1 : 0]; }

/* a limb or stroke in a side's tones: dark side gets the light rim behind it */
export function strokeLimb(ctx, draw, width, t, tone = t.suit) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (t.rim) { ctx.strokeStyle = t.rim; ctx.lineWidth = width + 2.5; ctx.beginPath(); draw(); ctx.stroke(); }
  ctx.strokeStyle = tone[1]; ctx.lineWidth = width; ctx.beginPath(); draw(); ctx.stroke();
}
/* a filled shape in a side's tones, lit from the top left */
export function fillBody(ctx, draw, t, tone = t.suit, box) {
  if (t.rim) { ctx.strokeStyle = t.rim; ctx.lineWidth = 2.5; ctx.beginPath(); draw(); ctx.stroke(); }
  if (box) {
    const g = ctx.createLinearGradient(box[0], box[1], box[2], box[3]);
    g.addColorStop(0, tone[0]); g.addColorStop(.55, tone[1]); g.addColorStop(1, tone[2]);
    ctx.fillStyle = g;
  } else ctx.fillStyle = tone[1];
  ctx.beginPath(); draw(); ctx.fill();
}
/* a ball, head or joint: a shaded circle */
export function ball(ctx, x, y, r, t, tone = t.skin) {
  if (t && t.rim) { ctx.fillStyle = t.rim; ctx.beginPath(); ctx.arc(x, y, r + 1.25, 0, Math.PI * 2); ctx.fill(); }
  const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
  g.addColorStop(0, tone[0]); g.addColorStop(.6, tone[1]); g.addColorStop(1, tone[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
/* the band: a short thick mark in the side's colour, at an ankle, wrist or glove */
export function band(ctx, x, y, r, t) {
  ctx.fillStyle = '#060606'; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = t.band; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
/* the ring under your own player */
export function ring(ctx, x, y, rx, ry = rx * .35) {
  ctx.strokeStyle = 'rgba(236,236,236,.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
}

/* on-canvas label: black box, light hairline, uppercase mono */
export function tag(ctx, x, y, text, { size = 11, align = 'center', pad = 5 } = {}) {
  text = String(text).toUpperCase();
  ctx.save();
  ctx.font = mono(size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2, h = Math.round(size * 1.6);
  const x0 = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x), y0 = Math.round(y - h / 2);
  ctx.fillStyle = '#060606'; ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = '#ececec'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + .75, y0 + .75, w - 1.5, h - 1.5);
  ctx.fillStyle = '#ececec'; ctx.fillText(text, x0 + pad, y0 + h / 2 + 1);
  ctx.restore();
  return [x0, y0, w, h];
}

/* size a canvas to the box it sits in (the stage), sharp on high-density screens */
export function fit(canvas) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  return { W, H, dpr };
}
/* call fn whenever the stage changes size (window resize, rotation, the page layout settling) */
export function watch(canvas, fn) {
  if ('ResizeObserver' in window) new ResizeObserver(() => fn()).observe(canvas.parentElement || canvas);
  addEventListener('resize', fn);
}

/* ---------------- the arena: dark room, lit floor, a crowd that leans in when it gets loud ---------------- */
let excite = 0, crowdT = 0;
export function cheer(v = .5) { excite = Math.min(1, excite + v); }
const ROWS = [[.42, '#1d1d1d', '#303030', 1], [.27, '#161616', '#242424', .8], [.14, '#101010', '#191919', .64]];
function rand(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export function arena(ctx, W, H, { horizon = H * .45, dt = 1 / 60, crowd = true } = {}) {
  const still = calm();
  excite = Math.max(0, excite - .45 * dt); crowdT += dt;
  const g = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, Math.max(W, H));
  g.addColorStop(0, '#121212'); g.addColorStop(1, '#030303');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (!crowd || horizon <= 20) return;
  // three rows of silhouettes, back row first
  for (let r = ROWS.length - 1; r >= 0; r--) {
    const [fy, body, rim, k] = ROWS[r];
    const size = Math.max(9, Math.min(26, W / 46)) * k, gap = size * 2.1, y = horizon * (1 - fy * .9);
    for (let i = 0, x = -gap * rand(r + 9); x < W + gap; i++, x += gap * (.8 + rand(i * 3 + r) * .5)) {
      const bob = still ? 0 : Math.sin(crowdT * (3 + rand(i + r * 50) * 3) + i) * excite * size * .35;
      const yy = y - bob - rand(i * 7 + r) * size * .4, s = size * (.85 + rand(i * 5 + r) * .3);
      ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(x, yy - s * 1.25, s * .5 + 1, 0, Math.PI * 2);
      ctx.roundRect ? ctx.roundRect(x - s * .95 - 1, yy - s * .75 - 1, s * 1.9 + 2, s * 2.2, s * .6) : ctx.rect(x - s * .95, yy - s * .75, s * 1.9, s * 2.2);
      ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, yy - s * 1.25, s * .5, 0, Math.PI * 2);
      ctx.roundRect ? ctx.roundRect(x - s * .95, yy - s * .75, s * 1.9, s * 2.2, s * .6) : ctx.rect(x - s * .95, yy - s * .75, s * 1.9, s * 2.2);
      ctx.fill();
    }
  }
  // the stands fade into the dark at the floor line
  const f = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 10);
  f.addColorStop(0, 'rgba(3,3,3,0)'); f.addColorStop(1, 'rgba(3,3,3,.9)');
  ctx.fillStyle = f; ctx.fillRect(0, horizon - 40, W, H - horizon + 40);
}
/* a lit disc on the floor, centre of the action: draw it after the floor fill */
export function spot(ctx, x, y, rx, ry) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(48,48,48,.85)'); g.addColorStop(.55, 'rgba(32,32,32,.6)'); g.addColorStop(1, 'rgba(19,19,19,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
/* the slow warning pulse for a line someone is close to: small, never a flash */
export function pulse(t) { return calm() ? 1 : .75 + .25 * Math.sin(t * 12); }

/* ---------------- the page HUD around the stage ---------------- */
export function hud(doc = document) {
  const $ = (id) => doc.getElementById(id);
  const el = { nm0: $('nm0'), sb0: $('sb0'), sc0: $('sc0'), clock: $('clock'), sc1: $('sc1'), nm1: $('nm1'), sb1: $('sb1'),
    msg: $('msg'), call: $('call'), moves: $('moves'), pad: $('pad'), tanks: doc.querySelector('.tanks') };
  const last = {};
  const set = (k, v) => { v = v == null ? '' : String(v); if (el[k] && last[k] !== v) { el[k].textContent = v; last[k] = v; } };
  let callT = 0, barKey = '', padKey = '';
  return {
    /* { a: { name, sub, score, has }, b: {...}, clock, low } */
    board(o) {
      for (const [i, s] of [[0, o.a], [1, o.b]]) {
        if (!s) continue;
        set('nm' + i, s.name); set('sb' + i, s.sub); set('sc' + i, s.score);
        if (el['sc' + i]) el['sc' + i].classList.toggle('has', !!s.has);
      }
      set('clock', o.clock);
      if (el.clock) el.clock.classList.toggle('low', !!o.low);
    },
    /* the big stamped call, top left of the stage, for about 1.5s */
    call(text, sub = '', title = false) {
      if (!el.call) return;
      el.call.hidden = false; el.call.classList.toggle('title', !!title);
      el.call.innerHTML = '<b></b><span></span>';
      el.call.firstChild.textContent = text; el.call.lastChild.textContent = sub;
      el.call.style.animation = 'none'; void el.call.offsetWidth; el.call.style.animation = '';
      callT = 1.5;
    },
    /* the status stamp at the top of the stage; '' hides it */
    msg(text) { set('msg', text || ''); },
    /* what the buttons do right now: label, chips [{ k: '□', t: 'shoot', open }], note */
    bar(label, chips = [], note = '') {
      if (!el.moves) return;
      const key = label + '|' + chips.map((c) => (c.open ? '*' : '') + (c.k || '') + c.t).join('|') + '|' + note;
      if (key === barKey) return; barKey = key;
      el.moves.innerHTML = '';
      const em = doc.createElement('em'); em.textContent = label; el.moves.append(em);
      if (note) { const sm = doc.createElement('small'); sm.textContent = note; el.moves.append(sm); }
      for (const c of chips) {
        const sp = doc.createElement('span'); if (c.open) sp.className = 'open';
        if (c.k) { const b = doc.createElement('b'); b.textContent = c.k; sp.append(b, ' ' + c.t); } else sp.textContent = c.t;
        el.moves.append(sp);
      }
    },
    /* two gauges, [{ label, v 0..1, lost 0..1 }, {...}] */
    meters(list) {
      if (!el.tanks) return;
      [...el.tanks.children].forEach((t, i) => {
        const m = list[i]; if (!m) return;
        const k = 'tank' + i, v = Math.round(m.v * 100), lost = Math.round((m.lost || 0) * 100);
        if (last[k] === `${m.label}${v}/${lost}`) return; last[k] = `${m.label}${v}/${lost}`;
        t.querySelector('span').firstChild.textContent = m.label + ' ';
        t.querySelector('b').textContent = String(v);
        t.querySelector('i').style.width = v + '%'; t.querySelector('u').style.width = lost + '%';
      });
    },
    /* controller status line under the bar; call once a frame with the game's Input */
    tick(dt, input) {
      if (callT > 0 && (callT -= dt) <= 0 && el.call) el.call.hidden = true;
      if (!el.pad || !input) return;
      const p = input.pad, k = p ? p.id : '';
      if (k === padKey) return; padKey = k;
      el.pad.textContent = p ? `controller: ${p.id.replace(/\(.*?\)/g, '').trim().toLowerCase() || 'connected'}` : 'no controller seen. press a button, or use the keyboard';
    }
  };
}
