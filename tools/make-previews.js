// node tools/make-previews.js — project preview images for the case files (1600x1000, 16:10 like .case__media)
//   assets/img/skyscrob-diagram.{svg,png}  how skyscrob turns a play into a scrobble (a diagram, not a screenshot)
//   assets/img/bots-terminal.{svg,png}     what Jinzo and Cosmou actually do (commands from ag0nyy-ops/ebots)
// Everything is drawn from real behaviour: the skyscrob flow and log events come from its README and
// src/service.ts, the bot commands from the setName() calls in ebots/{jinzo,cosmou}/commands.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const R = path.resolve(__dirname, '..') + '/';
const OUT = R + 'assets/img/';
const b64 = (f) => fs.readFileSync(R + f).toString('base64');
const FONTS = `@font-face{font-family:'IBM Plex Mono';font-weight:400;src:url(data:font/woff2;base64,${b64('assets/fonts/ibm-plex-mono-400-latin.woff2')}) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-weight:600;src:url(data:font/woff2;base64,${b64('assets/fonts/ibm-plex-mono-600-latin.woff2')}) format('woff2')}`;
const GRAIN = b64('assets/img/grain.png');
const FG = '#ececec', MUTED = '#a8a8a8', DIM = '#6a6a6a', LINE = '#3a3a3a', BG = '#060606', PANEL = '#0d0d0d';
const W = 1600, H = 1000;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const shell = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<!-- Jay · https://ag0nyy-ops.github.io/ · © 2026 Jay, all rights reserved -->
<style>${FONTS} text{font-family:'IBM Plex Mono',monospace;white-space:pre}</style>
<defs>
  <pattern id="grain" width="160" height="160" patternUnits="userSpaceOnUse"><image href="data:image/png;base64,${GRAIN}" width="160" height="160"/></pattern>
  <radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" fill="${FG}"/></marker>
</defs>
<rect width="${W}" height="${H}" fill="${BG}"/>
${body}
<rect width="${W}" height="${H}" fill="url(#grain)"/>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>`;

// a labelled box: title line + a few muted lines
function box(x, y, w, h, title, lines, { solid = false } = {}) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${solid ? FG : PANEL}" stroke="${solid ? FG : MUTED}" stroke-width="2.5"/>`;
  s += `<text x="${x + 28}" y="${y + 52}" font-size="30" font-weight="600" fill="${solid ? BG : FG}">${esc(title)}</text>`;
  lines.forEach((l, i) => { s += `<text x="${x + 28}" y="${y + 98 + i * 34}" font-size="22" fill="${solid ? '#333' : MUTED}">${esc(l)}</text>`; });
  return s;
}
const arrow = (x1, y1, x2, y2, label) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${FG}" stroke-width="3" marker-end="url(#arrow)"/>`
  + (label ? `<text x="${(x1 + x2) / 2}" y="${Math.min(y1, y2) - 14}" text-anchor="middle" font-size="19" fill="${MUTED}">${esc(label)}</text>` : '');
const tag = (x, y, t) => `<text x="${x}" y="${y}" font-size="20" letter-spacing="4" fill="${MUTED}">${esc(t)}</text>`;

function skyscrob() {
  let s = tag(70, 92, 'DIAGRAM · NOT A SCREENSHOT · SKYSCROB');
  s += `<text x="70" y="160" font-size="52" font-weight="600" fill="${FG}">a play becomes a scrobble</text>`;
  // row: devices -> apple -> worker -> last.fm
  const y = 250, h = 300;
  s += box(70, y, 300, h, 'your devices', ['iPhone', 'HomePod', 'Apple Watch', 'CarPlay · Mac']);
  s += box(450, y, 330, h, 'Apple Music', ['"recently played"', 'list', '', 'no app to keep open']);
  s += box(860, y, 340, h, 'skyscrob', ['Cloudflare Worker', 'polls every minute', '(backs off when idle)', 'diffs the list']);
  s += box(1280, y, 250, h, 'Last.fm', ['now playing', '   ↓', 'scrobbled'], {});
  s += arrow(370, y + h / 2, 446, y + h / 2, 'play');
  s += arrow(780, y + h / 2, 856, y + h / 2, 'fetch');
  s += arrow(1200, y + h / 2, 1276, y + h / 2, 'send');
  // rules strip
  const ry = 620;
  s += `<path d="M70 ${ry} H1530" stroke="${LINE}" stroke-width="2"/>`;
  s += tag(70, ry + 46, 'SCROBBLE RULE');
  s += `<text x="70" y="${ry + 90}" font-size="24" fill="${FG}">new song on top → now playing. scrobbled after half the song or 4 min.</text>`;
  s += `<text x="70" y="${ry + 126}" font-size="24" fill="${MUTED}">checks your Last.fm history first, so another scrobbler's plays aren't doubled.</text>`;
  // real log format
  const ly = 820;
  s += `<rect x="70" y="${ly}" width="1460" height="120" rx="10" fill="${PANEL}" stroke="${LINE}" stroke-width="2"/>`;
  s += `<text x="96" y="${ly + 48}" font-size="21" fill="${MUTED}">{"event":"poll","user":"…","result":"new","planned":1,"skipped":0}</text>`;
  s += `<text x="96" y="${ly + 88}" font-size="21" fill="${FG}">{"event":"scrobbled","user":"…","sent":1,"ignored":0}</text>`;
  s += `<text x="1504" y="${ly + 48}" text-anchor="end" font-size="16" letter-spacing="2" fill="${DIM}">LOG FORMAT FROM src/service.ts</text>`;
  return s;
}

function bots() {
  let s = tag(70, 92, 'PREVIEW · REAL COMMANDS FROM THE BOTS\' CODE');
  const col = (x, name, role, rows) => {
    const y = 130, w = 700, h = 800;
    let t = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${PANEL}" stroke="${LINE}" stroke-width="2.5"/>`;
    t += `<path d="M${x} ${y + 58} h${w}" stroke="${LINE}" stroke-width="2"/>`;
    t += `<g fill="none" stroke="${DIM}" stroke-width="2"><circle cx="${x + 30}" cy="${y + 29}" r="7"/><circle cx="${x + 54}" cy="${y + 29}" r="7"/><circle cx="${x + 78}" cy="${y + 29}" r="7"/></g>`;
    t += `<text x="${x + 108}" y="${y + 37}" font-size="21" fill="${MUTED}">${esc(name.toLowerCase())} — ${esc(role)}</text>`;
    t += `<text x="${x + 36}" y="${y + 130}" font-size="46" font-weight="600" fill="${FG}">${esc(name)}</text>`;
    rows.forEach(([cmd, what], i) => {
      const ry = y + 215 + i * 96;
      t += `<text x="${x + 36}" y="${ry}" font-size="31" font-weight="600" fill="${FG}">${esc(cmd)}</text>`;
      t += `<text x="${x + 36}" y="${ry + 38}" font-size="24" fill="${MUTED}">${esc(what)}</text>`;
    });
    return t;
  };
  s += col(70, 'Jinzo', 'moderation + chat', [
    ['/warn /timeout /kick /ban', 'every action logged as a case'],
    ['/purge /lock /modlog', 'clean up channels, look up past cases'],
    ['automod', 'spam, repeats, invites and blocked terms'],
    ['/art', 'browse anyone\'s art-channel posts'],
    ['@jinzo', 'replies in character when pinged'],
    ['/tod /roll /coinflip', 'and the fun side'],
  ]);
  s += col(830, 'Cosmou', 'helping + server management', [
    ['/role-form', 'role applications, reviewed by staff'],
    ['welcome', 'greets new members'],
    ['/rules', 'posts the server rules'],
    ['counting', 'counting game that accepts 2x+5=45'],
    ['/quiz', 'a short quiz'],
    ['@cosmou', 'replies in character when pinged'],
  ]);
  return s;
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: W, height: H } });
  for (const [name, body] of [['skyscrob-diagram', skyscrob()], ['bots-terminal', bots()]]) {
    const svg = shell(body);
    fs.writeFileSync(OUT + name + '.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + svg);
    await page.setContent(`<html><body style="margin:0;background:#000">${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: OUT + name + '.png', clip: { x: 0, y: 0, width: W, height: H } });
    console.log(name);
  }
  await br.close();
})();
