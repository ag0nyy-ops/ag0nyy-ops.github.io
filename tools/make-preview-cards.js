// node tools/make-preview-cards.js — seven square (1:1, 1080x1080) cards to post in Discord
//   assets/previews/cards/01-intro.jpg ... 07-site.jpg
// Same look as the link preview card: hollow blackletter Jay, mono labels, tilted real screenshots,
// grain + vignette. Screenshots come from assets/previews (tools/make-previews-shots.js), the bot
// banners from assets/img, the price list from assets/data/prices.js. Every feature line on the
// bot cards is a command or behaviour that exists in the bots' code.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const R = path.resolve(__dirname, '..') + '/';
const OUT = R + 'assets/previews/cards/';
fs.mkdirSync(OUT, { recursive: true });

const uri = (f) => {
  const ext = path.extname(f).slice(1).replace('jpg', 'jpeg');
  return `data:${ext === 'woff2' ? 'font/woff2' : 'image/' + ext};base64,${fs.readFileSync(R + f).toString('base64')}`;
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// prices straight from the site's one price list
const ctx = { window: {}, document: { addEventListener() {}, querySelectorAll: () => [] } };
vm.runInNewContext(fs.readFileSync(R + 'assets/data/prices.js', 'utf8'), ctx);
const P = ctx.window.PRICES;
const price = (k) => { const i = P.items[k]; return i.amount == null ? P.onRequest : `${P.label} ${P.currency}${i.amount}`; };

const CSS = `
@font-face{font-family:G;src:url(${uri('assets/fonts/unifrakturmaguntia-400-latin.woff2')})}
@font-face{font-family:M;font-weight:400;src:url(${uri('assets/fonts/ibm-plex-mono-400-latin.woff2')})}
@font-face{font-family:M;font-weight:600;src:url(${uri('assets/fonts/ibm-plex-mono-600-latin.woff2')})}
*{box-sizing:border-box}
html,body{margin:0;background:#000}
.card{position:relative;width:1080px;height:1080px;overflow:hidden;background:#060606;color:#ececec;font-family:M,monospace}
.card::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:9;
  background:url(${uri('assets/img/grain.png')}) 0 0/160px, radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(0,0,0,.75))}
.abs{position:absolute}
.lab{position:absolute;left:72px;font:600 20px/1 M;letter-spacing:.3em;text-transform:uppercase;color:#a8a8a8}
.h{position:absolute;left:68px;font:600 104px/1 M;letter-spacing:-.045em;white-space:nowrap}
.sub{position:absolute;left:72px;width:900px;font:400 29px/1.45 M;color:#b4b4b4}
.jay{position:absolute;left:62px;font:400 230px/1 G;color:transparent;-webkit-text-stroke:4px #ececec}
.tag{position:absolute;left:72px;font:600 34px/1 M;letter-spacing:.22em}
.url{position:absolute;left:72px;font:600 24px/1 M;color:#a8a8a8}
.shot{position:absolute;border:1px solid #3a3a3a;border-radius:12px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.85);background:#0b0b0b}
.shot img{display:block;width:100%}
.phone{border-radius:38px;border:2px solid #4a4a4a}
.tags{position:absolute;left:72px;display:flex;gap:12px}
.tags span{padding:9px 14px;border:1px solid #3a3a3a;font:400 17px/1 M;letter-spacing:.08em;text-transform:uppercase;color:#d6d6d6}
.banner{position:absolute;left:0;top:0;width:1080px;height:330px;object-fit:cover;display:block}
.fade{position:absolute;left:0;top:170px;width:1080px;height:162px;background:linear-gradient(transparent,#060606)}
.row{position:absolute;left:72px;width:936px}
.row b{display:block;font:600 29px/1.2 M;letter-spacing:-.02em;color:#ececec}
.row span{display:block;margin-top:8px;font:400 23px/1.25 M;color:#a8a8a8}
`;

const bots = (banner, tint, name, role, rows) => `
  <img class="banner" src="${uri(banner)}"><div class="fade"></div>
  <div class="lab" style="top:362px">${esc(role)}</div>
  <div class="h" style="top:396px;color:${tint}">${esc(name)}</div>
  ${rows.map(([c, d], i) => `<div class="row" style="top:${548 + i * 80}px"><b>${esc(c)}</b><span>${esc(d)}</span></div>`).join('')}`;

const CARDS = [
  ['01-intro', `
    <div class="lab" style="top:84px">File no. J-018 · Status: active</div>
    <div class="jay" style="top:112px">Jay</div>
    <div class="tag" style="top:392px">SHIPS REAL THINGS</div>
    <div class="url" style="top:450px">ag0nyy-ops.github.io</div>
    <div class="shot" style="left:140px;top:560px;width:880px;transform:rotate(-3deg)"><img src="${uri('assets/previews/desktop-hero.jpg')}"></div>
    <div class="shot phone" style="left:790px;top:610px;width:250px;transform:rotate(4deg)"><img src="${uri('assets/previews/phone-hero.jpg')}"></div>`],

  ['02-skyscrob', `
    <div class="lab" style="top:84px">Case 001 · Shipped</div>
    <div class="h" style="top:124px">Skyscrob</div>
    <div class="sub" style="top:262px">Scrobbles your Apple Music listening to Last.fm, from any device.</div>
    <div class="shot" style="left:72px;top:408px;width:936px;transform:rotate(-1.5deg)"><img src="${uri('assets/img/skyscrob-diagram.png')}"></div>
    <div class="tags" style="top:1010px"><span>TypeScript</span><span>Cloudflare Workers</span><span>Apple Music</span><span>Last.fm API</span></div>`],

  ['03-jinzo', bots('assets/img/jinzo-banner.png', '#ececec', 'Jinzo', 'Case 002 · Live · moderation + chat', [
    ['/warn /timeout /kick /ban', 'every action saved as a case you can look up'],
    ['automod', 'spam, repeated messages, invite links, blocked terms'],
    ['/modlog /case /history', 'look up past moderation'],
    ['/art', "browse anyone's posts in the art channel"],
    ['@jinzo', 'replies in character when you ping it'],
    ['/tod /roll /coinflip', 'and the fun side'],
  ])],

  ['04-cosmou', bots('assets/img/cosmou-banner.jpg', '#e8d2bd', 'Cosmou', 'Case 002 · Live · helping + server management', [
    ['/role-form', 'role applications, reviewed by staff'],
    ['welcome', 'greets new members'],
    ['/rules', 'posts the server rules'],
    ['counting', 'a counting game that even accepts 2x+5=45'],
    ['/quiz', 'a short quiz'],
    ['@cosmou', 'replies in character when you ping it'],
  ])],

  ['05-commissions', `
    <div class="lab" style="top:84px">Commission sheet · open</div>
    <div class="h" style="top:122px">Commissions</div>
    ${[['Discord bots', 'discord-bots'], ['Websites', 'websites'], ['Web apps + tools', 'web-apps'], ['Automation', 'automation']].map(([n, k], i) =>
      `<div class="row" style="top:${300 + i * 118}px;width:430px"><span style="margin:0 0 8px;font-size:21px;letter-spacing:.14em;text-transform:uppercase">${n}</span><b style="font-size:44px;letter-spacing:-.04em">${esc(price(k))}</b></div>`).join('')}
    <div class="abs" style="left:72px;top:900px;font:600 34px/1.2 M">DM .jaypatty</div>
    <div class="abs" style="left:72px;top:950px;font:400 24px/1.3 M;color:#a8a8a8">pay after it works, up front,<br>or half and half, by job size</div>
    <div class="shot" style="left:535px;top:262px;width:470px;transform:rotate(4deg)"><img src="${uri('assets/commissions/sheet.png')}"></div>`],

  ['06-mobile', `
    <div class="lab" style="top:84px">Mobile · tested down to 320 px</div>
    <div class="h" style="top:122px">On your phone</div>
    <div class="sub" style="top:252px">Same eyes, same effects, no sideways scrolling.</div>
    <div class="shot phone" style="left:64px;top:372px;width:300px;transform:rotate(-7deg)"><img src="${uri('assets/previews/phone-hero.jpg')}"></div>
    <div class="shot phone" style="left:390px;top:330px;width:300px;z-index:3"><img src="${uri('assets/previews/phone-projects.jpg')}"></div>
    <div class="shot phone" style="left:716px;top:372px;width:300px;transform:rotate(7deg)"><img src="${uri('assets/previews/phone-services.jpg')}"></div>`],

  ['07-site', `
    <div class="lab" style="top:84px">How it's built</div>
    <div class="h" style="top:122px">No framework.</div>
    <div class="sub" style="top:252px">Plain HTML, CSS and a little JavaScript.<br>Fonts hosted on the site, no trackers.<br>The eyes follow your cursor, all in CSS.</div>
    <div class="shot" style="left:70px;top:500px;width:940px;transform:rotate(-2deg)"><img src="${uri('assets/previews/desktop-projects.jpg')}"></div>`],
];

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  for (const [name, html] of CARDS) {
    await page.setContent(`<html><head><style>${CSS}</style></head><body><div class="card">${html}</div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1080 } });
    console.log(name, (fs.statSync(`${OUT}${name}.jpg`).size / 1024).toFixed(0) + ' KB');
  }
  await br.close();
})();
