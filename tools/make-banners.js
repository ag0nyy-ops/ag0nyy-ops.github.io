// node tools/make-banners.js — rebuilds assets/banners/*.svg + *.png (needs playwright)
// builds each banner as a self-contained SVG (fonts + grain embedded), measures text in Chromium, exports PNG
const { chromium } = require('playwright');
const fs = require('fs');
const R = require('path').resolve(__dirname, '..') + '/';
const OUT = R + 'assets/banners/';
fs.mkdirSync(OUT, { recursive: true });
const b64 = (f) => fs.readFileSync(R + f).toString('base64');
const FONTS = `
@font-face{font-family:'UnifrakturMaguntia';src:url(data:font/woff2;base64,${b64('assets/fonts/unifrakturmaguntia-400-latin.woff2')}) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-weight:400;src:url(data:font/woff2;base64,${b64('assets/fonts/ibm-plex-mono-400-latin.woff2')}) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-weight:600;src:url(data:font/woff2;base64,${b64('assets/fonts/ibm-plex-mono-600-latin.woff2')}) format('woff2')}`;
const GRAIN = b64('assets/img/grain.png');

const FG = '#ececec', MUTED = '#b4b4b4', LINE = '#3a3a3a', BG = '#060606';

// the site's eye, drawn around (0,0) with ring radius 500 (so the sigil is 1000 wide)
function sigil(id, { ring = true, ticks = true, tri = true, eye = true, ringText = true } = {}) {
  let s = `<g class="sigil">` + (eye ? `<circle r="500" fill="${BG}"/>` : '');
  if (tri) s += `<g fill="none" stroke="${LINE}" stroke-width="3" opacity=".8"><path d="M0 -440 L381 220 L-381 220Z"/><path d="M0 440 L381 -220 L-381 -220Z"/></g>`;
  if (ring) {
    s += `<circle r="495" fill="none" stroke="${LINE}" stroke-width="3"/>`;
    s += `<path id="${id}-ring" d="M0 0 m-430 0 a430 430 0 1 1 860 0 a430 430 0 1 1 -860 0" fill="none"/>`;
    if (ringText) s += `<text font-family="IBM Plex Mono" font-weight="600" font-size="46" fill="${MUTED}"><textPath href="#${id}-ring" textLength="2650" lengthAdjust="spacing">SEES EVERYTHING · SHIPS REAL THINGS · SEES EVERYTHING · SHIPS REAL THINGS ·</textPath></text>`;
  }
  if (ticks) { s += `<g stroke="${LINE}" stroke-width="3">`; for (let i = 0; i < 72; i++) { const a = i * 5 * Math.PI / 180, r1 = i % 6 ? 360 : 345, r2 = 380; s += `<line x1="${(Math.cos(a)*r1).toFixed(1)}" y1="${(Math.sin(a)*r1).toFixed(1)}" x2="${(Math.cos(a)*r2).toFixed(1)}" y2="${(Math.sin(a)*r2).toFixed(1)}"/>`; } s += `</g>`; }
  if (!eye) return s + `</g>`;
  // lens + dark fill so the ticks don't show through
  s += `<defs><linearGradient id="${id}-lid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${FG}"/><stop offset="1" stop-color="#7a7a7a"/></linearGradient></defs>`;
  s += `<path d="M-300 0 Q0 -290 300 0 Q0 290 -300 0Z" fill="${BG}" stroke="url(#${id}-lid)" stroke-width="12" stroke-linejoin="round"/>`;
  // lashes
  s += `<g stroke="${FG}" stroke-width="7" stroke-linecap="round">`;
  for (const k of [-3, -2, -1, 0, 1, 2, 3]) { const a = (-90 + k * 13) * Math.PI / 180, r1 = 205, r2 = k === 0 ? 265 : 255 - Math.abs(k) * 6; s += `<line x1="${(Math.cos(a)*r1).toFixed(1)}" y1="${(Math.sin(a)*r1+60).toFixed(1)}" x2="${(Math.cos(a)*r2).toFixed(1)}" y2="${(Math.sin(a)*r2+60).toFixed(1)}"/>`; }
  s += `</g>`;
  // iris: outer ring, fibres, inner ring, pupil with a catchlight
  s += `<circle r="104" fill="${BG}" stroke="${FG}" stroke-width="8"/>`;
  s += `<g stroke="${FG}" stroke-width="2.4" opacity=".75">`; for (let i = 0; i < 96; i++) { const a = i * 3.75 * Math.PI / 180; s += `<line x1="${(Math.cos(a)*76).toFixed(1)}" y1="${(Math.sin(a)*76).toFixed(1)}" x2="${(Math.cos(a)*97).toFixed(1)}" y2="${(Math.sin(a)*97).toFixed(1)}"/>`; } s += `</g>`;
  s += `<circle r="72" fill="${BG}" stroke="${FG}" stroke-width="5"/>`;
  s += `<circle r="52" fill="${FG}"/><circle cx="-17" cy="-15" r="10" fill="${BG}"/>`;
  return s + `</g>`;
}

function text() {
  // laid out at a reference scale; the whole lockup is scaled afterwards
  return `<g class="txt" font-family="IBM Plex Mono">
    <text class="lab" x="0" y="0" font-size="32" letter-spacing="5" fill="${MUTED}">FILE NO. J-018 · CLASS: PUBLIC · STATUS: <tspan fill="${FG}" font-weight="600">ACTIVE</tspan></text>
    <text class="jay" x="-8" y="0" font-family="UnifrakturMaguntia" font-size="330" fill="${FG}">Jay</text>
    <text class="tag" x="0" y="0" font-size="60" font-weight="600" letter-spacing="15" fill="${FG}">SHIPS REAL THINGS</text>
    <text class="sub" x="0" y="0" font-size="46" fill="${MUTED}">discord bots · web apps · ios · builds</text>
    <text class="url" x="0" y="0" font-size="46" font-weight="600" fill="${FG}">ag0nyy-ops.github.io</text>
  </g>`;
}

function shell(W, H, body, { grain = 128, vig = .75 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<!-- Jay · https://ag0nyy-ops.github.io/ · © 2026 Jay, all rights reserved -->
<style>${FONTS}</style>
<defs>
  <pattern id="grain" width="${grain}" height="${grain}" patternUnits="userSpaceOnUse"><image href="data:image/png;base64,${GRAIN}" width="${grain}" height="${grain}"/></pattern>
  <radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${vig}"/></radialGradient>
  <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="${BG}"/>
${body}
<rect width="${W}" height="${H}" fill="url(#grain)"/>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>`;
}

// a cat's head, front-on, with the site's lens eyes and slit pupils; centred on (0,0), ~520 wide
function cat(id) {
  const eye = (x, tilt) => `<g transform="translate(${x} -40) rotate(${tilt})">
      <clipPath id="${id}-lens${x}"><path d="M-82 0 Q0 -72 82 0 Q0 72 -82 0Z"/></clipPath>
      <circle r="70" fill="url(#${id}-iris)" clip-path="url(#${id}-lens${x})"/>
      <ellipse rx="10" ry="44" fill="${BG}" clip-path="url(#${id}-lens${x})"/>
      <circle cx="-16" cy="-14" r="7" fill="${FG}"/>
      <path d="M-82 0 Q0 -72 82 0 Q0 72 -82 0Z" fill="none" stroke="${FG}" stroke-width="8" stroke-linejoin="round"/>
    </g>`;
  let s = `<g class="cat"><defs>
      <radialGradient id="${id}-iris"><stop offset="0" stop-color="${FG}"/><stop offset=".75" stop-color="#9a9a9a"/><stop offset="1" stop-color="#4a4a4a"/></radialGradient>
      <radialGradient id="${id}-shine"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>`;
  s += `<ellipse cx="0" cy="-40" rx="330" ry="170" fill="url(#${id}-shine)"/>`;
  // head + ears in one outline
  s += `<path d="M-250 60 C-262 -70 -215 -160 -160 -200 L-215 -395 L-62 -258 C-22 -266 22 -266 62 -258 L215 -395 L160 -200 C215 -160 262 -70 250 60 C232 200 112 272 0 276 C-112 272 -232 200 -250 60Z" fill="${BG}" stroke="${FG}" stroke-width="9" stroke-linejoin="round"/>`;
  // inner ears
  s += `<g fill="none" stroke="#6a6a6a" stroke-width="5" stroke-linejoin="round"><path d="M-188 -330 L-100 -255 L-165 -215"/><path d="M188 -330 L100 -255 L165 -215"/></g>`;
  s += eye(-108, 8) + eye(108, -8);
  // the third eye, same lens as the site's
  s += `<g transform="translate(0 -172) scale(.62)"><path d="M-82 0 Q0 -62 82 0 Q0 62 -82 0Z" fill="${BG}" stroke="${FG}" stroke-width="8" stroke-linejoin="round"/>
      <circle r="30" fill="none" stroke="${FG}" stroke-width="6"/><circle r="15" fill="${FG}"/><circle cx="-5" cy="-5" r="4" fill="${BG}"/></g>`;
  // nose, mouth, whiskers
  s += `<path d="M-24 92 L24 92 L0 118Z" fill="${FG}"/>`;
  s += `<path d="M0 118 q-8 32 -42 28 M0 118 q8 32 42 28" fill="none" stroke="${FG}" stroke-width="6" stroke-linecap="round"/>`;
  s += `<g stroke="#8a8a8a" stroke-width="4" stroke-linecap="round">`;
  for (const side of [-1, 1]) for (const [y1, y2] of [[118, 82], [134, 134], [150, 188]]) s += `<line x1="${side * 70}" y1="${y1}" x2="${side * 360}" y2="${y2}"/>`;
  return s + `</g></g>`;
}

// a bot avatar: ring + ticks + one blackletter initial
function botIcon(letter) {
  return `<rect width="512" height="512" fill="url(#glow)"/><g transform="translate(256 256) scale(.47)">${sigil('b' + letter, { tri: false, eye: false, ringText: false })}</g>
    <text x="256" y="256" dy=".34em" text-anchor="middle" font-family="UnifrakturMaguntia" font-size="250" fill="${FG}">${letter}</text>`;
}

const FORMATS = [
  // box = where every piece of text and the eye must sit (x, y, w, h)
  // discord: shown tiny (~340px wide in the profile popout). The avatar covers the left and
  // bottom-left, the avatar decoration the top, the custom status the bottom-right. So: only
  // "Jay" + tagline, big, in the right half's middle band. Everything else is in the bio anyway.
  { name: 'discord-banner', W: 1200, H: 480, box: [560, 88, 590, 262], textOnly: true, keep: ['jay', 'tag'],
    decor: (sig) => `<g transform="translate(230 240) scale(.5)" opacity=".4">${sig('bg', { eye: false, ringText: false })}</g>` },
  { name: 'github-social-preview', W: 1280, H: 640, box: [256, 128, 768, 384] },
  { name: 'x-header', W: 1500, H: 500, box: [300, 90, 900, 320] },
  { name: 'youtube-banner', W: 2560, H: 1440, box: [557, 518, 1446, 404], bgSigil: true, wide: true },
  { name: 'avatar', W: 1024, H: 1024, avatar: true },
  // discord profile "board" widget art. Discord writes the title + description over the bottom-left,
  // so that corner stays dark; the watching cat sits on the right.
  { name: 'discord-widget', W: 1320, H: 490, custom: () => `
      <defs><linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="${BG}"/><stop offset=".45" stop-color="${BG}" stop-opacity=".85"/><stop offset=".7" stop-color="${BG}" stop-opacity="0"/></linearGradient></defs>
      <g transform="translate(1010 250) scale(.58)" opacity=".5">${sigil('w', { eye: false, ringText: false })}</g>
      <g transform="translate(1010 275) scale(.6)">${cat('c')}</g>
      <rect width="1320" height="490" fill="url(#fade)"/>
      <text x="56" y="70" font-family="IBM Plex Mono" font-size="24" letter-spacing="5" fill="${MUTED}">CASE FILE · BOTS · STATUS: <tspan fill="${FG}" font-weight="600">ONLINE</tspan></text>` },
  { name: 'bot-jinzo', W: 512, H: 512, custom: () => botIcon('J') },
  { name: 'bot-cosmou', W: 512, H: 512, custom: () => botIcon('C') },
  { name: 'icon-site', W: 512, H: 512, custom: () => `<rect width="512" height="512" fill="url(#glow)"/><g transform="translate(256 256) scale(.49)">${sigil('s', { tri: false, ringText: false })}</g>` },
  { name: 'icon-commissions', W: 512, H: 512, custom: () => botIcon('$') },
];

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage();
  for (const f of FORMATS) {
    let body;
    if (f.custom) {
      body = f.custom();
    } else if (f.avatar) {
      body = `<rect width="1024" height="1024" fill="url(#glow)"/><g transform="translate(512 512) scale(.96)">${sigil('a')}</g>`;
    } else {
      body = (f.decor ? f.decor(sigil) : '') + (f.bgSigil ? `<g transform="translate(${f.W/2} ${f.H/2}) scale(1.3)" opacity=".2">${sigil('bg', { tri: true, eye: false })}</g>` : '')
        + `<g class="lockup">${f.textOnly ? '' : sigil('e', { tri: false, ticks: true })}${text()}</g>`;
    }
    const svg = shell(f.W, f.H, body, { grain: f.W > 2000 ? 256 : 160 });
    await page.setViewportSize({ width: f.W, height: f.H });
    await page.setContent(`<html><body style="margin:0;background:#000">${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    let info = {};
    if (!f.avatar && !f.custom) {
      info = await page.evaluate(([box, wide, keep]) => {
        const q = (s) => document.querySelector(s), bb = (s) => q(s).getBBox();
        const s = q('.lockup .sigil'), txt = q('.txt');
        const stack = (keys, gap) => { let y = 0; for (const k of keys) { const el = q('.' + k); el.setAttribute('y', 0); el.setAttribute('x', 0); const b = el.getBBox(); y += gap[k] || 0; el.setAttribute('y', (y - b.y).toFixed(1)); y += b.height; } return y; };
        if (!wide) {
          // eye | stacked column: labels, Jay, tagline, sub line, url
          const keys = keep || ['lab', 'jay', 'tag', 'sub', 'url'];
          for (const k of ['lab', 'jay', 'tag', 'sub', 'url']) if (!keys.includes(k)) q('.' + k).remove();
          if (keep) { q('.jay').setAttribute('font-size', 250); q('.tag').setAttribute('letter-spacing', 7); }
          stack(keys, { jay: 40, tag: 30, sub: 34, url: 18 });
        } else {
          // eye | Jay | stacked column — a long, low lockup for very wide safe areas
          const colH = stack(['lab', 'tag', 'sub', 'url'], { tag: 34, sub: 30, url: 16 });
          const jay = q('.jay'); jay.setAttribute('y', 0); const jb = jay.getBBox();
          const jayScale = (colH * 1.25) / jb.height;
          jay.setAttribute('font-size', (330 * jayScale).toFixed(1));
          const jb2 = jay.getBBox();
          jay.setAttribute('y', (-(jb2.y) + (colH - jb2.height) / 2).toFixed(1));
          jay.setAttribute('x', (-jb2.width - 70 - jb2.x).toFixed(1));
        }
        const t = bb('.txt'), D = s ? t.height * (wide ? 1.35 : 1.04) : 0, between = s ? 80 : 0;
        if (s) s.setAttribute('transform', `translate(${D/2} ${D/2}) scale(${(D/1000).toFixed(4)})`);
        txt.setAttribute('transform', `translate(${D + between - t.x} ${(D - t.height)/2 - t.y})`);
        const L = bb('.lockup');
        const sc = Math.min(box[2] / L.width, box[3] / L.height);
        const tx = box[0] + (box[2] - L.width * sc) / 2 - L.x * sc, ty = box[1] + (box[3] - L.height * sc) / 2 - L.y * sc;
        q('.lockup').setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${sc.toFixed(4)})`);
        const r = q('.lockup').getBoundingClientRect();
        return { scale: +sc.toFixed(3), tagPx: +(60 * sc), smallTextPx: +(46 * sc).toFixed(1), labelPx: +(32 * sc).toFixed(1), lockup: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
      }, [f.box, !!f.wide, f.keep || null]);
    }
    const final = await page.evaluate(() => document.querySelector('svg').outerHTML);
    fs.writeFileSync(OUT + f.name + '.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + final);
    await page.screenshot({ path: OUT + f.name + '.png', clip: { x: 0, y: 0, width: f.W, height: f.H } });
    console.log(f.name, f.W + 'x' + f.H, JSON.stringify(info));
  }
  await br.close();
})();
