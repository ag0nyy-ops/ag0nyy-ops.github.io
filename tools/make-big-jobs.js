// node tools/make-big-jobs.js — "the big jobs" image: the most ambitious things I'll take on
//   assets/commissions/big-jobs.png   1080x1650, exported at 2x
//   assets/commissions/big-jobs.svg   self-contained source (fonts + grain embedded, no external requests)
// Prices are starting estimates read from assets/data/prices.js; the final price is quoted after a feasibility check.
// Every line describes something that exists in my own projects or is scoped honestly (iOS and
// hardware are "yes or no first"), so nothing here promises more than I can deliver.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const R = path.resolve(__dirname, '..') + '/';
const OUT = R + 'assets/commissions/';
fs.mkdirSync(OUT, { recursive: true });
const b64 = (f) => fs.readFileSync(R + f).toString('base64');
const JAY = JSON.parse(fs.readFileSync(R + 'tools/jay-outline.json', 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const vm = require('vm');
const pc = { window: {}, document: { addEventListener() {}, querySelectorAll: () => [] } };
vm.runInNewContext(fs.readFileSync(R + 'assets/data/prices.js', 'utf8'), pc);
const P = pc.window.PRICES;
const price = (k) => { const i = P.items[k]; return i.amount == null ? P.onRequest : `${P.label} ${P.currency}${i.amount}${i.per || ''}`; };

const FG = '#ececec', MUTED = '#b4b4b4', DIM = '#8a8a8a', LINE = '#3a3a3a', BG = '#060606';
const W = 1080, H = 1650, X0 = 72, X1 = W - 72;

const JOBS = [
  ['Embedded + hardware projects', 'Microcontroller and device work. We scope it together and I say yes or no before anything is paid.', 'embedded', true],
  ['Full web apps', 'Logins, a database, hosting, deployed and running. The same kind of build as skyscrob.', 'web-app-full', false],
  ['Custom iOS apps', 'Built and tested with you. Shipping to the App Store needs your own Apple developer account.', 'ios-app', true],
  ['Data systems', 'Pipelines, reports and dashboards that update themselves instead of living in a spreadsheet.', 'data-dashboard', false],
  ['AI assistants for your tools', 'Like my Discord bots: looks things up for real, asks a human before it acts.', 'ai-assistant', false],
  ['A whole Discord server system', 'Bots, moderation, role applications and AI chat, set up end to end.', 'discord-system', false],
];

function body() {
  let s = `<text x="${X0}" y="96" font-size="26" letter-spacing="7" fill="${MUTED}">FILE NO. J-018 · THE BIG JOBS</text>`;
  s += `<g transform="translate(${X0 - 4} 236) scale(.082)"><path d="${JAY.d}" fill="#fff" fill-opacity=".08" stroke="${FG}" stroke-width="3.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></g>`;
  s += `<g transform="translate(${X1 - 6} 218) rotate(-4)"><rect x="-300" y="-44" width="300" height="80" fill="none" stroke="${FG}" stroke-width="4"/><text x="-150" y="12" text-anchor="middle" font-size="34" font-weight="600" letter-spacing="6" fill="${FG}">ESTIMATES</text></g>`;
  s += `<path d="M${X0} 312 H${X1}" stroke="${LINE}" stroke-width="3"/>`;
  s += `<text x="${X0}" y="372" font-size="27" fill="${MUTED}">The most ambitious things I'll take on.</text>`;
  s += `<text x="${X0}" y="410" font-size="27" fill="${MUTED}">Starting estimates. If we can pull it off, we do it.</text>`;

  JOBS.forEach(([name, desc, key, check], i) => {
    const y = 484 + i * 122;
    s += `<text x="${X0}" y="${y}" font-size="32" font-weight="600" fill="${FG}">${esc(name)}</text>`;
    s += `<text x="${X1}" y="${y}" font-size="30" font-weight="600" text-anchor="end" fill="${FG}">${esc(price(key))}</text>`;
    if (check) s += `<text x="${X1}" y="${y + 34}" font-size="20" text-anchor="end" fill="${MUTED}">yes or no first</text>`;
    // wrap the description to about 68 characters a line
    const words = desc.split(' '); const lines = []; let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > 56) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
    lines.push(cur);
    lines.forEach((l, j) => { s += `<text x="${X0}" y="${y + 36 + j * 30}" font-size="22" fill="${DIM}">${esc(l)}</text>`; });
    s += `<path d="M${X0} ${y + 36 + (lines.length - 1) * 30 + 22} H${X1}" stroke="${LINE}" stroke-width="2" stroke-dasharray="2 8"/>`;
  });

  const hy = 484 + JOBS.length * 122 + 34;
  s += `<text x="${X0}" y="${hy}" font-size="26" letter-spacing="7" fill="${MUTED}">HOW A BIG JOB GOES</text>`;
  [['1', 'We talk. I check it can actually be done.'], ['2', 'You get a final price and a plan, or an honest no.'], ['3', 'Half to start, half when it is delivered.']].forEach(([n, t], i) => {
    s += `<text x="${X0}" y="${hy + 50 + i * 44}" font-size="28" font-weight="600" fill="${FG}">${n}</text><text x="${X0 + 44}" y="${hy + 50 + i * 44}" font-size="27" fill="${MUTED}">${esc(t)}</text>`;
  });
  const by = H - 176;
  s += `<path d="M${X0} ${by - 52} H${X1}" stroke="${LINE}" stroke-width="3"/>`;
  s += `<text x="${X0}" y="${by + 6}" font-size="34" font-weight="600" fill="${FG}">DM me to talk it through</text>`;
  s += `<text x="${X0}" y="${by + 50}" font-size="27" fill="${MUTED}">discord.gg/nGysyw7MgS</text>`;
  s += `<text x="${X0}" y="${by + 90}" font-size="27" fill="${MUTED}">ag0nyy-ops.github.io/commissions.html</text>`;
  return s;
}

function svg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="IBM Plex Mono, monospace">
<!-- Jay · https://ag0nyy-ops.github.io/ · © 2026 Jay, all rights reserved -->
<style>@font-face{font-family:'IBM Plex Mono';font-weight:400;src:url(data:font/woff2;base64,${b64('assets/fonts/ibm-plex-mono-400-latin.woff2')}) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-weight:600;src:url(data:font/woff2;base64,${b64('assets/fonts/ibm-plex-mono-600-latin.woff2')}) format('woff2')}</style>
<defs>
  <pattern id="grain" width="160" height="160" patternUnits="userSpaceOnUse"><image href="data:image/png;base64,${b64('assets/img/grain.png')}" width="160" height="160"/></pattern>
  <radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="${BG}"/>
${body()}
<rect width="${W}" height="${H}" fill="url(#grain)"/>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>`;
}

(async () => {
  const s = svg();
  fs.writeFileSync(OUT + 'big-jobs.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + s + '\n');
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.setContent(`<html><body style="margin:0;background:#000">${s}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT + 'big-jobs.png', clip: { x: 0, y: 0, width: W, height: H } });
  await br.close();
  console.log('big-jobs.png', (fs.statSync(OUT + 'big-jobs.png').size / 1024).toFixed(0) + ' KB');
})();
