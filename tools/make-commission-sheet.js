// node tools/make-commission-sheet.js — the price sheet to post and pin in Discord
//   assets/commissions/sheet.png   1080x1350 (4:5), exported at 2x
//   assets/commissions/sheet.svg   self-contained source (fonts + grain embedded, no external requests)
// Prices are read from assets/data/prices.js, so the sheet and the site can't disagree.
// Payment rules and wording mirror commissions.html. Change them in both places.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const R = path.resolve(__dirname, '..') + '/';
const OUT = R + 'assets/commissions/';
fs.mkdirSync(OUT, { recursive: true });
const b64 = (f) => fs.readFileSync(R + f).toString('base64');

// the one price list (same file the site uses)
const ctx = { window: {}, document: { addEventListener() {}, querySelectorAll: () => [] } };
vm.runInNewContext(fs.readFileSync(R + 'assets/data/prices.js', 'utf8'), ctx);
const P = ctx.window.PRICES;
const money = (p) => P.currency + p.amount + (p.per || '');
const price = (key) => { const i = P.items[key]; return i.amount == null ? P.onRequest : `${P.label} ${money(i)}${i.or ? ', or ' + money(i.or) : ''}`; };

const FG = '#ececec', MUTED = '#b4b4b4', LINE = '#3a3a3a', BG = '#060606';
const W = 1080, H = 1350, X0 = 72, X1 = W - 72;
const JAY = JSON.parse(fs.readFileSync(R + 'tools/jay-outline.json', 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const rows = [
  ['Discord bots + server setup', price('discord-bots')],
  ['Websites + landing pages', price('websites')],
  ['AI chatbots + integrations', price('ai')],
  ['Custom web apps + tools', price('web-apps')],
  ['Automation + scripts', price('automation')],
  ['Fixes + care plan', price('maintenance').replace(', or ', ' / ').replace(' per fix', '/fix').replace('/mo care plan', '/mo')],
  ['iOS / mobile prototypes', price('mobile')],
  ['Custom showpiece site', price('custom-showpiece')],
  ['Something unusual? ask', 'straight yes or no'],
];

function body() {
  let s = '';
  // header: label, hollow Jay, OPEN stamp
  s += `<text x="${X0}" y="96" font-size="26" letter-spacing="7" fill="${MUTED}">FILE NO. J-018 · COMMISSION SHEET</text>`;
  s += `<g transform="translate(${X0 - 4} 236) scale(.082)"><path d="${JAY.d}" fill="#fff" fill-opacity=".08" stroke="${FG}" stroke-width="3.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></g>`;
  s += `<g transform="translate(${X1 - 6} 218) rotate(-4)"><rect x="-228" y="-44" width="228" height="80" fill="none" stroke="${FG}" stroke-width="4"/><text x="-114" y="12" text-anchor="middle" font-size="38" font-weight="600" letter-spacing="8" fill="${FG}">OPEN</text></g>`;
  s += `<path d="M${X0} 312 H${X1}" stroke="${LINE}" stroke-width="3"/>`;

  // price rows with dotted leaders, like the site's rate sheet
  rows.forEach(([name, amt], i) => {
    const y = 380 + i * 55;
    s += `<text x="${X0}" y="${y}" font-size="31" font-weight="600" fill="${FG}">${esc(name)}</text>`;
    s += `<text x="${X1}" y="${y}" font-size="29" text-anchor="end" fill="${MUTED}">${esc(amt)}</text>`;
    s += `<path d="M${X0} ${y + 20} H${X1}" stroke="${LINE}" stroke-width="2" stroke-dasharray="2 8"/>`;
  });

  // paying
  const py = 380 + rows.length * 55 + 34;
  s += `<text x="${X0}" y="${py}" font-size="26" letter-spacing="7" fill="${MUTED}">HOW PAYING WORKS</text>`;
  const pay = [['UNDER $40', 'after it works'], ['$40 – $149', 'everything up front'], ['$150 AND UP', 'half to start, half on delivery']];
  pay.forEach(([a, b], i) => {
    const y = py + 50 + i * 44;
    s += `<text x="${X0}" y="${y}" font-size="29" font-weight="600" fill="${FG}">${esc(a)}</text>`;
    s += `<text x="${X0 + 270}" y="${y}" font-size="29" fill="${MUTED}">${esc(b)}</text>`;
  });
  const ay = py + 50 + 3 * 44;
  s += `<text x="${X0}" y="${ay}" font-size="26" letter-spacing="7" fill="${MUTED}">ACCEPTED</text>`;
  s += `<text x="${X0 + 270}" y="${ay}" font-size="29" font-weight="600" fill="${FG}">Cash App · Venmo · Zelle</text>`;

  // how to book
  const by = H - 168;
  s += `<path d="M${X0} ${by - 52} H${X1}" stroke="${LINE}" stroke-width="3"/>`;
  s += `<text x="${X0}" y="${by + 6}" font-size="34" font-weight="600" fill="${FG}">DM me to commission</text>`;
  s += `<text x="${X0}" y="${by + 50}" font-size="27" fill="${MUTED}">discord.gg/nGysyw7MgS</text>`;
  s += `<text x="${X0}" y="${by + 90}" font-size="27" fill="${MUTED}">ag0nyy-ops.github.io/commissions.html</text>`;
  s += `<text x="${X0}" y="${by + 138}" font-size="23" fill="${DIM()}">Prices start low while I build my portfolio. They'll go up.</text>`;
  return s;
}
function DIM() { return '#8a8a8a'; }

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
  fs.writeFileSync(OUT + 'sheet.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + s + '\n');
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.setContent(`<html><body style="margin:0;background:#000">${s}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT + 'sheet.png', clip: { x: 0, y: 0, width: W, height: H } });
  await br.close();
  console.log('sheet.png', (fs.statSync(OUT + 'sheet.png').size / 1024).toFixed(0) + ' KB');
})();
