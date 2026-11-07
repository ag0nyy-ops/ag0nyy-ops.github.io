// node tools/make-skyscrob-readme.js <out-dir>
// The skyscrob README diagram, drawn in the skyscrob dashboard's own design (public/style.css:
// light stone palette, white 12px cards, Inter / system-ui, Last.fm red accent, green "ok"),
// so it sits next to docs/demo.gif without clashing. The portfolio uses the dark version from
// make-previews.js instead. Writes skyscrob-diagram.svg + skyscrob-diagram.png (2x).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = (process.argv[2] || '.').replace(/\/?$/, '/');

const C = { bg: '#fafaf9', fg: '#1c1917', muted: '#78716c', card: '#ffffff', border: '#e7e5e4', accent: '#d51007', ok: '#16a34a' };
const W = 720, H = 420;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const card = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${C.card}" stroke="${C.border}"/>`;
const text = (x, y, t, { size = 14, weight = 400, fill = C.fg, anchor = 'start', mono = false } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${mono ? ' font-family="ui-monospace, SFMono-Regular, Menlo, monospace"' : ''}>${esc(t)}</text>`;
const dot = (x, y, fill) => `<circle cx="${x}" cy="${y}" r="4" fill="${fill}"/>`;
const arrow = (x1, x2, y) => `<path d="M${x1} ${y} H${x2 - 2}" stroke="${C.muted}" stroke-width="1.5"/><path d="M${x2 - 7} ${y - 4} L${x2} ${y} L${x2 - 7} ${y + 4}" fill="none" stroke="${C.muted}" stroke-width="1.5" stroke-linejoin="round"/>`;

function body() {
  let s = text(14, 38, 'How skyscrob works', { size: 26, weight: 700 });
  s += text(14, 66, 'Diagram, not a screenshot. Apple Music → Last.fm, from any device.', { size: 15, fill: C.muted });

  // four steps, same card look as the dashboard's Last.fm / Apple Music / Scrobbling row
  const y = 90, h = 150, w = 150, gap = 26;
  const steps = [
    ['Your devices', [['iPhone, HomePod,'], ['Watch, CarPlay,'], ['or Mac'], ['nothing to install', C.muted]]],
    ['Apple Music', [['"Recently played"'], ['list'], ['', null], ['connected', C.fg, C.ok]]],
    ['skyscrob', [['Cloudflare Worker'], ['polls every minute'], ['diffs the list', C.muted]]],
    ['Last.fm', [['now playing', C.fg, C.accent], ['scrobbled', C.ok]]],
  ];
  steps.forEach(([title, lines], i) => {
    const x = 14 + i * (w + gap);
    s += card(x, y, w, h);
    s += text(x + 16, y + 30, title, { size: 15, weight: 600 });
    lines.forEach(([t, fill = C.fg, dotFill], j) => {
      if (!t) return;
      const ly = y + 60 + j * 21;
      if (dotFill) { s += dot(x + 20, ly - 5, dotFill); s += text(x + 30, ly, t, { size: 14, fill }); }
      else s += text(x + 16, ly, t, { size: 14, fill });
    });
    if (i < steps.length - 1) s += arrow(x + w + 4, x + w + gap - 4, y + h / 2);
  });

  // the rule + the real log format, in a card like "Recent"
  const ry = 258;
  s += card(14, ry, 692, 148);
  s += text(30, ry + 30, 'When a play is scrobbled', { size: 15, weight: 600 });
  s += text(30, ry + 54, 'A new song on top is sent as now playing. It is scrobbled after half the song or 4 minutes,', { size: 13, fill: C.muted });
  s += text(30, ry + 72, 'and only if your Last.fm history doesn\'t already have it.', { size: 13, fill: C.muted });
  s += `<path d="M30 ${ry + 88} H690" stroke="${C.border}"/>`;
  s += text(30, ry + 110, '{"event":"poll","user":"…","result":"new","planned":1,"skipped":0}', { size: 12, mono: true });
  s += text(30, ry + 130, '{"event":"scrobbled","user":"…","sent":1,"ignored":0}', { size: 12, mono: true, fill: C.ok });
  s += text(690, ry + 30, 'log format: src/service.ts', { size: 12, fill: C.muted, anchor: 'end' });
  return s;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, system-ui, -apple-system, sans-serif">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${body()}
</svg>`;

(async () => {
  fs.writeFileSync(OUT + 'skyscrob-diagram.svg', svg + '\n');
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: OUT + 'skyscrob-diagram.png', clip: { x: 0, y: 0, width: W, height: H } });
  await br.close();
})();
