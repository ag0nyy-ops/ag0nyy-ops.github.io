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

// "Jay" as outlines (tools/jay-outline.json, pulled from UnifrakturMaguntia with fontTools), so it
// never depends on a font being loaded. Hollow like the site footer: faint fill, near-white stroke.
// The stroke is non-scaling, so `sw` is in output pixels whatever the lockup's scale.
const JAY = JSON.parse(fs.readFileSync(__dirname + '/jay-outline.json', 'utf8'));
const jayPath = (sw) => `<g class="jay" data-size="330"><path d="${JAY.d}" transform="scale(${(330 / JAY.upm).toFixed(5)})"
    fill="#ffffff" fill-opacity=".08" stroke="${FG}" stroke-width="${sw}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></g>`;

function text(sw) {
  // laid out at a reference scale; the whole lockup is scaled afterwards
  return `<g class="txt" font-family="IBM Plex Mono">
    <text class="lab" x="0" y="0" font-size="32" letter-spacing="5" fill="${MUTED}">FILE NO. J-018 · CLASS: PUBLIC · STATUS: <tspan fill="${FG}" font-weight="600">ACTIVE</tspan></text>
    ${jayPath(sw)}
    <text class="tag" x="0" y="0" font-size="60" font-weight="600" letter-spacing="15" fill="${FG}">SHIPS REAL THINGS</text>
    <text class="sub" x="0" y="0" font-size="46" fill="${MUTED}">discord bots · web apps · ios · builds</text>
    <text class="url" x="0" y="0" font-size="46" font-weight="600" fill="${FG}">ag0nyy-ops.github.io</text>
  </g>`;
}

function shell(W, H, body, { grain = 128, vig = .75 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<!-- Jay · https://ag0nyy-ops.github.io/ · © 2026 Jay, all rights reserved -->
<style>${FONTS.split('\n').filter((l) => !l.includes('UnifrakturMaguntia') || body.includes('UnifrakturMaguntia')).join('\n')}</style>
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

// developer card: an editor window with a small, original bot snippet + a terminal strip
function devCard() {
  const X = 664, Y = 50, W = 606, H = 390, lh = 30;
  const code = [
    [['k', 'const'], ['t', ' bot = '], ['k', 'new'], ['t', ' Client({ intents })']],
    [],
    [['t', 'bot.'], ['f', 'on'], ['t', '('], ['s', "'ready'"], ['t', ', () => {']],
    [['t', '  console.'], ['f', 'log'], ['t', '('], ['s', "'watching.'"], ['t', ');']],
    [['t', '});']],
    [],
    [['k', 'await'], ['t', ' bot.'], ['f', 'login'], ['t', '(process.env.TOKEN);']],
  ];
  const col = { k: [FG, 600], t: ['#9c9c9c', 400], f: [FG, 400], s: ['#c8c8c8', 400] };
  let rows = '';
  code.forEach((line, i) => {
    const y = Y + 86 + i * lh;
    rows += `<text x="${X + 34}" y="${y}" fill="#4a4a4a" text-anchor="end">${i + 1}</text>`;
    rows += `<text x="${X + 58}" y="${y}">` + line.map(([c, t]) => `<tspan fill="${col[c][0]}" font-weight="${col[c][1]}">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/^ +/, (m) => '\u00a0'.repeat(m.length))}</tspan>`).join('') + `</text>`;
  });
  const ty = Y + H - 60;
  return `
    <defs><linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="${BG}"/><stop offset=".42" stop-color="${BG}" stop-opacity=".9"/><stop offset=".55" stop-color="${BG}" stop-opacity="0"/></linearGradient></defs>
    <g transform="translate(960 245) scale(.62)" opacity=".35">${sigil('w', { eye: false, ringText: false })}</g>
    <rect width="1320" height="490" fill="url(#fade)"/>
    <g font-family="IBM Plex Mono" font-size="21" style="white-space: pre">
      <rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="14" fill="#0b0b0b" stroke="${LINE}" stroke-width="2"/>
      <path d="M${X} ${Y + 48} h${W}" stroke="${LINE}" stroke-width="2"/>
      <g fill="none" stroke="#6a6a6a" stroke-width="2"><circle cx="${X + 26}" cy="${Y + 24}" r="7"/><circle cx="${X + 50}" cy="${Y + 24}" r="7"/><circle cx="${X + 74}" cy="${Y + 24}" r="7"/></g>
      <text x="${X + 104}" y="${Y + 31}" fill="${MUTED}" font-size="19">bots/index.js</text>
      <g transform="translate(${X + W - 36} ${Y + 24}) scale(.2)"><path d="M-82 0 Q0 -62 82 0 Q0 62 -82 0Z" fill="none" stroke="${FG}" stroke-width="9"/><circle r="26" fill="${FG}"/></g>
      ${rows}
      <path d="M${X} ${ty - 30} h${W}" stroke="${LINE}" stroke-width="2"/>
      <text x="${X + 24}" y="${ty}" fill="${MUTED}">$ <tspan fill="${FG}">npm start</tspan></text>
      <text x="${X + 24}" y="${ty + lh}" fill="${FG}">› watching.<tspan fill="${FG}" font-weight="600"> █</tspan></text>
    </g>
    <text x="56" y="70" font-family="IBM Plex Mono" font-size="22" letter-spacing="4" fill="${MUTED}">CASE FILE · DEV · STATUS: <tspan fill="${FG}" font-weight="600">ACTIVE</tspan></text>`;
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
  { name: 'discord-banner', W: 1200, H: 480, box: [565, 92, 550, 232], textOnly: true, keep: ['jay', 'tag'], jayStroke: 6,
    decor: (sig) => `<g transform="translate(230 240) scale(.5)" opacity=".4">${sig('bg', { eye: false, ringText: false })}</g>` },
  { name: 'github-social-preview', W: 1280, H: 640, box: [256, 128, 768, 384], jayStroke: 3.5 },
  { name: 'x-header', W: 1500, H: 500, box: [300, 90, 900, 320], jayStroke: 4 },
  { name: 'youtube-banner', W: 2560, H: 1440, box: [557, 518, 1446, 404], bgSigil: true, wide: true, jayStroke: 6 },
  { name: 'avatar', W: 1024, H: 1024, avatar: true },
  // discord profile "board" widget art. Discord writes the title + description over the bottom-left,
  // so that corner stays dark; the watching cat sits on the right.
  // discord profile "board" widget art. Discord writes the title + description over the left,
  // so that side stays dark; a code window sits on the right.
  { name: 'discord-widget', W: 1320, H: 490, custom: () => devCard() },
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
        + `<g class="lockup">${f.textOnly ? '' : sigil('e', { tri: false, ticks: true })}${text(f.jayStroke || +(f.W / 240).toFixed(1))}</g>`;
    }
    const svg = shell(f.W, f.H, body, { grain: f.W > 2000 ? 256 : 160 });
    await page.setViewportSize({ width: f.W, height: f.H });
    await page.setContent(`<html><body style="margin:0;background:#000">${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    let info = {};
    if (!f.avatar && !f.custom) {
      info = await page.evaluate(([box, wide, keep, UPM]) => {
        const q = (s) => document.querySelector(s), bb = (s) => q(s).getBBox();
        // text elements move with x/y; the outlined "Jay" is a <g>, so it moves with a translate
        const setXY = (el, x, y) => { if (el.tagName === 'g') el.setAttribute('transform', `translate(${(+x).toFixed(1)} ${(+y).toFixed(1)})`); else { el.setAttribute('x', x); el.setAttribute('y', y); } };
        const setJaySize = (px) => { const j = q('.jay'), path = j.querySelector('path'); j.dataset.size = px; path.setAttribute('transform', `scale(${(px / UPM).toFixed(5)})`); };
        const s = q('.lockup .sigil'), txt = q('.txt');
        const stack = (keys, gap) => { let y = 0; for (const k of keys) { const el = q('.' + k); setXY(el, 0, 0); const b = el.getBBox(); y += gap[k] || 0; setXY(el, 0, (y - b.y).toFixed(1)); y += b.height; } return y; };
        if (!wide) {
          // eye | stacked column: labels, Jay, tagline, sub line, url
          const keys = keep || ['lab', 'jay', 'tag', 'sub', 'url'];
          for (const k of ['lab', 'jay', 'tag', 'sub', 'url']) if (!keys.includes(k)) q('.' + k).remove();
          if (keep) { setJaySize(250); q('.tag').setAttribute('letter-spacing', 4); }
          stack(keys, { jay: 40, tag: 30, sub: 34, url: 18 });
        } else {
          // eye | Jay | stacked column — a long, low lockup for very wide safe areas
          const colH = stack(['lab', 'tag', 'sub', 'url'], { tag: 34, sub: 30, url: 16 });
          const jay = q('.jay'); setXY(jay, 0, 0); const jb = jay.getBBox();
          setJaySize(330 * (colH * 1.25) / jb.height);
          const jb2 = jay.getBBox();
          setXY(jay, -jb2.width - 70 - jb2.x, -jb2.y + (colH - jb2.height) / 2);
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
      }, [f.box, !!f.wide, f.keep || null, JAY.upm]);
    }
    const final = await page.evaluate(() => document.querySelector('svg').outerHTML);
    fs.writeFileSync(OUT + f.name + '.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + final);
    await page.screenshot({ path: OUT + f.name + '.png', clip: { x: 0, y: 0, width: f.W, height: f.H } });
    console.log(f.name, f.W + 'x' + f.H, JSON.stringify(info));
  }
  await br.close();
})();
