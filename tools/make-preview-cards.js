// node tools/make-preview-cards.js — five square (1:1, 1080x1080) cards to post in Discord
//   assets/previews/cards/01-intro.jpg ... 05-commissions.jpg
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
const price = (k) => { const i = P.items[k]; return i.amount == null ? P.onRequest : `${P.label} ${P.currency}${i.amount}${i.per && !i.or ? i.per : ''}`; };

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
.c b{display:block;font:600 27px/1.2 M;color:#ececec}.c span{display:block;margin-top:6px;font:400 20px/1.3 M;color:#a8a8a8}
.fade{position:absolute;left:0;top:170px;width:1080px;height:162px;background:linear-gradient(transparent,#060606)}
.row{position:absolute;left:72px;width:936px}
.row b{display:block;font:600 29px/1.2 M;letter-spacing:-.02em;color:#ececec}
.row span{display:block;margin-top:8px;font:400 23px/1.25 M;color:#a8a8a8}
`;

const svc = (top, name, desc, key) => `
  <div class="abs" style="left:72px;top:${top}px;width:936px;height:150px;border-top:1px solid #3a3a3a"></div>
  <div class="abs" style="left:72px;top:${top + 28}px;width:640px;font:600 40px/1.15 M;letter-spacing:-.03em">${esc(name)}</div>
  <div class="abs" style="left:72px;top:${top + 82}px;width:640px;font:400 23px/1.35 M;color:#a8a8a8">${esc(desc)}</div>
  <div class="abs" style="right:72px;top:${top + 36}px;font:600 34px/1.1 M;text-align:right;color:#ececec">${esc(price(key))}</div>`;

const col = (x, banner, name, role, rows) => `
  <img class="abs" src="${uri(banner)}" style="left:${x}px;top:112px;width:448px;height:150px;object-fit:cover;border:1px solid #3a3a3a">
  <div class="abs" style="left:${x}px;top:284px;font:600 62px/1 M;letter-spacing:-.045em">${esc(name)}</div>
  <div class="abs" style="left:${x}px;top:362px;font:600 16px/1 M;letter-spacing:.24em;text-transform:uppercase;color:#a8a8a8">${esc(role)}</div>
  ${rows.map(([c, d], i) => `<div class="c abs" style="left:${x}px;top:${440 + i * 112}px;width:448px"><b>${esc(c)}</b><span>${esc(d)}</span></div>`).join('')}`;

const CARDS = [
  ['01-intro', `
    <div class="lab" style="top:84px">File no. J-018 · Status: active</div>
    <div class="jay" style="top:112px">Jay</div>
    <div class="tag" style="top:392px">SHIPS REAL THINGS</div>
    <div class="abs" style="left:72px;top:446px;font:400 25px/1.3 M;color:#b4b4b4">data · it support · security · bots · sites</div>
    <div class="url" style="top:496px">ag0nyy-ops.github.io</div>
    <div class="shot" style="left:140px;top:600px;width:880px;transform:rotate(-3deg)"><img src="${uri('assets/previews/desktop-hero.jpg')}"></div>
    <div class="shot phone" style="left:790px;top:640px;width:250px;transform:rotate(4deg)"><img src="${uri('assets/previews/phone-hero.jpg')}"></div>`],

  ['02-services', `
    <div class="lab" style="top:84px">Commissions · open</div>
    <div class="h" style="top:122px">What I do</div>
    ${svc(272, 'Data analysis', 'messy spreadsheets into clean data, charts and reports you can reuse', 'data')}
    ${svc(432, 'IT support', 'accounts, email, backups, 2FA, and the stuff that won\'t work', 'it-support')}
    ${svc(592, 'Security basics', 'OAuth2 logins, safe tokens and basic protection for apps and sites', 'security')}
    <div class="abs" style="left:72px;top:772px;width:936px;border-top:1px solid #3a3a3a"></div>
    <div class="abs" style="left:72px;top:800px;font:400 21px/1 M;letter-spacing:.16em;text-transform:uppercase;color:#a8a8a8">Also</div>
    <div class="tags" style="top:844px"><span>Discord bots</span><span>Websites</span><span>Web apps</span><span>APIs + hosting</span></div>
    <div class="tags" style="top:900px"><span>AI chatbots</span><span>Automation</span><span>Fixes + care plan</span></div>
    <div class="abs" style="left:72px;top:990px;font:600 28px/1 M">DM me to commission</div>`],

  ['03-security', `
    <div class="lab" style="top:84px">Security basics · shown, not claimed</div>
    <div class="h" style="top:122px">Real security</div>
    <div class="sub" style="top:252px;font-size:26px">Basic protection I've actually built, in my own project skyscrob, which stores other people's tokens.</div>
    ${[['Tokens encrypted at rest', 'AES-256-GCM, tied to where they\'re stored'], ['Login cookies locked down', 'HttpOnly, Secure, SameSite'], ['CSRF protection', 'a token plus a same-origin check on every change'], ['Strict security headers', 'CSP, no framing, no sniffing'], ['Secret scanner', 'fails the build if a key ever lands in git history']].map(([c, d], i) =>
      `<div class="c abs" style="left:72px;top:${396 + i * 84}px;width:936px"><b>■ ${esc(c)}</b><span style="margin-left:36px">${esc(d)}</span></div>`).join('')}
    <div class="shot" style="left:500px;top:880px;width:520px;transform:rotate(-2deg)"><img src="${uri('assets/img/skyscrob-diagram.png')}"></div>
    <div class="abs" style="left:72px;top:1010px;width:380px;font:400 22px/1.35 M;color:#a8a8a8">basic protection, not an audit or a pen test.</div>`],

  ['04-bots', `
    <div class="lab" style="top:60px">Case 002 · Live · my own Discord bots</div>
    ${col(72, 'assets/img/jinzo-banner.png', 'Jinzo', 'moderation + chat', [
      ['/warn /timeout /kick /ban', 'every action saved as a case'], ['automod', 'spam, invites, blocked terms'], ['/modlog /case /history', 'look up past moderation'],
      ['/art', "browse posts in the art channel"], ['@jinzo', 'replies in character when pinged']])}
    ${col(560, 'assets/img/cosmou-banner.jpg', 'Cosmou', 'helping + management', [
      ['/role-form', 'role applications, staff review'], ['welcome + /rules', 'greets members, posts the rules'], ['counting', 'a game that even accepts 2x+5=45'],
      ['/quiz', 'a short quiz'], ['@cosmou', 'replies in character when pinged']])}`],

  ['05-commissions', `
    <div class="lab" style="top:84px">Commission sheet · open</div>
    <div class="h" style="top:122px">Commissions</div>
    ${[['Data analysis', 'data'], ['IT support', 'it-support'], ['Security basics', 'security'], ['Discord bots', 'discord-bots']].map(([n, k], i) =>
      `<div class="row" style="top:${300 + i * 118}px;width:430px"><span style="margin:0 0 8px;font-size:21px;letter-spacing:.14em;text-transform:uppercase">${n}</span><b style="font-size:40px;letter-spacing:-.04em">${esc(price(k))}</b></div>`).join('')}
    <div class="abs" style="left:72px;top:900px;font:600 34px/1.2 M">DM me</div>
    <div class="abs" style="left:72px;top:950px;font:400 24px/1.3 M;color:#a8a8a8">pay after it works, up front,<br>or half and half, by job size</div>
    <div class="shot" style="left:535px;top:262px;width:470px;transform:rotate(4deg)"><img src="${uri('assets/commissions/sheet.png')}"></div>`],
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
