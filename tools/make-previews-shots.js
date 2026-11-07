// node tools/make-previews-shots.js [baseUrl]
// Real screenshots of the site (no mockups) + the link-preview card built from them.
//   assets/previews/desktop-*.jpg   1440x900 viewport @2x: hero, projects, cases, services, contact
//   assets/previews/phone-*.jpg     iPhone 13 viewport @3x: hero, projects, services
//   assets/og-image.jpg             1200x630 card shown when the link is shared (og:image)
// Serve the repo first: python3 -m http.server 8123
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const R = path.resolve(__dirname, '..') + '/';
const BASE = process.argv[2] || 'http://localhost:8123/';
const OUT = R + 'assets/previews/';
fs.mkdirSync(OUT, { recursive: true });
const b64 = (f) => fs.readFileSync(f).toString('base64');

async function shoot(browser, ctxOpts, name, sections) {
  const ctx = await browser.newContext({ ...ctxOpts, reducedMotion: 'no-preference' });
  // skip the eyelid intro, and pin the full effects tier so every shot looks the same
  await ctx.addInitScript(() => { try { sessionStorage.setItem('seen', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  await page.goto(BASE + '?fx=full', { waitUntil: 'networkidle' });
  // the custom cursor ring is a pointer, not part of the page: leave it out of the pictures
  // …and show the cards at rest: the mouse parked for the flashlight would otherwise hover one and dim the rest
  await page.addStyleTag({ content: '.reticle { opacity: 0 !important; } .cases .case::after { opacity: 0 !important; }' });
  await page.evaluate(() => document.fonts.ready);
  const vp = page.viewportSize();
  await page.mouse.move(vp.width * 0.62, vp.height * 0.42);   // put the flashlight somewhere nice
  for (const [label, sel, at = 0.12] of sections) {
    if (sel) {
      // put the element `at` of the way down the screen; redaction bars only finish
      // peeling once text is ~40% through the viewport, so text-heavy shots sit higher
      await page.evaluate(([s, f]) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * f); }, [sel, at]);
      await page.waitForTimeout(900);
      await page.mouse.wheel(0, 1); await page.waitForTimeout(500);
    } else {
      await page.waitForTimeout(1600);
    }
    // eyes blink on their own timers: wait for a moment when every lid is open
    await page.waitForFunction(() => [...document.querySelectorAll('.eye__lid, .eye__lashes')]
      .every((l) => getComputedStyle(l).transform === 'none'), null, { timeout: 10000, polling: 50 }).catch(() => {});
    await page.screenshot({ path: `${OUT}${name}-${label}.jpg`, type: 'jpeg', quality: 90 });
    console.log(`${name}-${label}`);
  }
  await ctx.close();
}

function ogCard() {
  const desk = b64(OUT + 'desktop-hero.jpg');
  const proj = b64(OUT + 'desktop-projects.jpg');
  const phone = b64(OUT + 'phone-hero.jpg');
  const font = b64(R + 'assets/fonts/unifrakturmaguntia-400-latin.woff2');
  const mono = b64(R + 'assets/fonts/ibm-plex-mono-600-latin.woff2');
  const grain = b64(R + 'assets/img/grain.png');
  return `<!doctype html><html><head><style>
  @font-face{font-family:G;src:url(data:font/woff2;base64,${font})}
  @font-face{font-family:M;font-weight:600;src:url(data:font/woff2;base64,${mono})}
  html,body{margin:0}
  .card{position:relative;width:1200px;height:630px;overflow:hidden;background:#060606;color:#ececec}
  .card::after{content:"";position:absolute;inset:0;pointer-events:none;
    background:url(data:image/png;base64,${grain}) 0 0/160px, radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(0,0,0,.75))}
  .txt{position:absolute;left:64px;top:150px;z-index:2}
  .lab{font:600 15px/1 M;letter-spacing:.3em;color:#a8a8a8}
  .jay{font:400 150px/1 G;margin:18px 0 6px;color:transparent;-webkit-text-stroke:3px #ececec}
  .tag{font:600 26px/1 M;letter-spacing:.24em}
  .url{margin-top:30px;font:600 20px/1 M;color:#a8a8a8}
  .shot{position:absolute;border:1px solid #3a3a3a;border-radius:10px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.8)}
  .shot img{display:block;width:100%}
  .d1{width:640px;right:-70px;top:56px;transform:rotate(-3deg)}
  .d2{width:520px;right:120px;top:330px;transform:rotate(2deg);opacity:.95}
  .ph{width:170px;right:40px;top:250px;border-radius:24px;border:2px solid #4a4a4a;transform:rotate(4deg)}
  </style></head><body><div class="card">
    <div class="shot d2"><img src="data:image/jpeg;base64,${proj}"></div>
    <div class="shot d1"><img src="data:image/jpeg;base64,${desk}"></div>
    <div class="shot ph"><img src="data:image/jpeg;base64,${phone}"></div>
    <div class="txt"><div class="lab">FILE NO. J-018 · STATUS: ACTIVE</div><div class="jay">Jay</div>
      <div class="tag">SHIPS REAL THINGS</div><div class="url">ag0nyy-ops.github.io</div></div>
  </div></body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  await shoot(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, 'desktop',
    [['hero', null], ['projects', '.case--feature', 0.1], ['cases', '.case--feature + .case', 0.12], ['services', '.prices', 0.14], ['contact', '.contact__body', 0.22]]);
  await shoot(browser, { ...devices['iPhone 13'] }, 'phone', [['hero', null], ['projects', '.case--feature', 0.1], ['services', '.prices', 0.12]]);
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(ogCard());
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: R + 'assets/og-image.jpg', type: 'jpeg', quality: 88 });
  console.log('og-image');
  await browser.close();
})();
