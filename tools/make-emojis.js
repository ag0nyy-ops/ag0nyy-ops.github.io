// node tools/make-emojis.js — builds assets/emojis/*.png (128x128, transparent) + *.svg
// Line art in the site's style: off-white strokes with a thin near-black outline,
// so they read on Discord's dark AND light themes.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const R = path.resolve(__dirname, '..') + '/';
const OUT = R + 'assets/emojis/';
fs.mkdirSync(OUT, { recursive: true });
const b64 = (f) => fs.readFileSync(R + f).toString('base64');
const FONTS = `@font-face{font-family:'UnifrakturMaguntia';src:url(data:font/woff2;base64,${b64('assets/fonts/unifrakturmaguntia-400-latin.woff2')}) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-weight:600;src:url(data:font/woff2;base64,${b64('assets/fonts/ibm-plex-mono-600-latin.woff2')}) format('woff2')}`;

const FG = '#ececec', BG = '#060606';
const lens = (w, h) => `M${-w} 0 Q0 ${-h} ${w} 0 Q0 ${h} ${-w} 0Z`;

// every drawing is in a 128x128 box centred on (64, 64)
const EMOJIS = {
  // the site's eye
  eye: `<path d="${lens(56, 52)}" transform="translate(64 64)" fill="${BG}" stroke="${FG}" stroke-width="7" stroke-linejoin="round"/>
        <circle cx="64" cy="64" r="20" fill="${BG}" stroke="${FG}" stroke-width="5"/>
        <circle cx="64" cy="64" r="11" fill="${FG}"/><circle cx="60" cy="60" r="3.2" fill="${BG}"/>
        <g stroke="${FG}" stroke-width="5" stroke-linecap="round"><path d="M64 26v-14M46 30l-6-11M82 30l6-11"/></g>`,
  // mid-blink
  blink: `<path d="M8 66 Q64 30 120 66" fill="none" stroke="${FG}" stroke-width="7" stroke-linecap="round"/>
          <path d="M8 66 Q64 96 120 66" fill="none" stroke="${FG}" stroke-width="7" stroke-linecap="round"/>
          <g stroke="${FG}" stroke-width="5" stroke-linecap="round"><path d="M64 88v14M44 84l-7 12M84 84l7 12"/></g>`,
  // bot head with one lens eye
  bot: `<path d="M64 14v12" stroke="${FG}" stroke-width="6" stroke-linecap="round"/><circle cx="64" cy="12" r="6" fill="${FG}"/>
        <rect x="18" y="30" width="92" height="72" rx="18" fill="${BG}" stroke="${FG}" stroke-width="7"/>
        <path d="M10 58v16M118 58v16" stroke="${FG}" stroke-width="7" stroke-linecap="round"/>
        <path d="${lens(30, 30)}" transform="translate(64 64)" fill="none" stroke="${FG}" stroke-width="5"/>
        <circle cx="64" cy="64" r="9" fill="${FG}"/>
        <path d="M46 88h36" stroke="${FG}" stroke-width="5" stroke-linecap="round"/>`,
  // </>
  code: `<g fill="none" stroke="${FG}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
           <path d="M40 34 L12 64 L40 94"/><path d="M88 34 L116 64 L88 94"/><path d="M74 22 L54 106"/></g>`,
  // terminal window with a prompt
  terminal: `<rect x="10" y="20" width="108" height="88" rx="14" fill="${BG}" stroke="${FG}" stroke-width="7"/>
             <path d="M10 40h108" stroke="${FG}" stroke-width="5"/>
             <g fill="${FG}"><circle cx="24" cy="30" r="3.5"/><circle cx="36" cy="30" r="3.5"/><circle cx="48" cy="30" r="3.5"/></g>
             <path d="M28 60 L44 72 L28 84" fill="none" stroke="${FG}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
             <rect x="54" y="80" width="30" height="7" rx="3" fill="${FG}"/>`,
  // an isometric block (builds)
  block: `<g stroke="${FG}" stroke-width="7" stroke-linejoin="round">
            <path d="M64 12 L112 38 L64 64 L16 38Z" fill="${FG}"/>
            <path d="M16 38 L64 64 L64 116 L16 90Z" fill="${BG}"/>
            <path d="M112 38 L64 64 L64 116 L112 90Z" fill="#3a3a3a"/></g>`,
  // phone (ios)
  phone: `<rect x="34" y="8" width="60" height="112" rx="16" fill="${BG}" stroke="${FG}" stroke-width="7"/>
          <rect x="54" y="16" width="20" height="6" rx="3" fill="${FG}"/>
          <path d="${lens(18, 18)}" transform="translate(64 64)" fill="none" stroke="${FG}" stroke-width="4"/>
          <circle cx="64" cy="64" r="5.5" fill="${FG}"/>
          <path d="M54 106h20" stroke="${FG}" stroke-width="5" stroke-linecap="round"/>`,
  // globe (web)
  web: `<g fill="none" stroke="${FG}" stroke-width="6"><circle cx="64" cy="64" r="50"/>
          <ellipse cx="64" cy="64" rx="22" ry="50"/><path d="M14 64h100"/></g>`,
  // blackletter monogram
  jay: `<circle cx="64" cy="64" r="56" fill="${BG}" stroke="${FG}" stroke-width="5"/>
        <text x="64" y="58" dy=".3em" text-anchor="middle" font-family="UnifrakturMaguntia" font-size="88" fill="${FG}">J</text>`,
  // ring + triangle + eye (one triangle: two would read as a hexagram at emoji size)
  sigil: `<circle cx="64" cy="64" r="56" fill="none" stroke="${FG}" stroke-width="5"/>
          <g fill="none" stroke="${FG}" stroke-width="4.5" stroke-linejoin="round" transform="translate(64 64)">
            <path d="M0 -46 L42 30 L-42 30Z" stroke-width="6"/></g>
          <path d="${lens(17, 16)}" transform="translate(64 74)" fill="${BG}" stroke="${FG}" stroke-width="4.5"/>
          <circle cx="64" cy="74" r="6" fill="${FG}"/>`,
  // a shipped check in a seal
  shipped: `<circle cx="64" cy="64" r="54" fill="${BG}" stroke="${FG}" stroke-width="7"/>
            <circle cx="64" cy="64" r="43" fill="none" stroke="${FG}" stroke-width="2.5" stroke-dasharray="4 5"/>
            <path d="M40 66 L57 82 L90 46" fill="none" stroke="${FG}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
  // commissions: $ in a seal
  commission: `<circle cx="64" cy="64" r="54" fill="${BG}" stroke="${FG}" stroke-width="7"/>
               <circle cx="64" cy="64" r="43" fill="none" stroke="${FG}" stroke-width="2.5" stroke-dasharray="4 5"/>
               <text x="64" y="64" dy=".36em" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="62" fill="${FG}">$</text>`,
};

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<!-- Jay · https://ag0nyy-ops.github.io/ · © 2026 Jay, all rights reserved -->
<style>${FONTS}</style>
<defs><filter id="outline" x="-10%" y="-10%" width="120%" height="120%">
  <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="fat"/>
  <feFlood flood-color="${BG}"/><feComposite in2="fat" operator="in" result="ring"/>
  <feMerge><feMergeNode in="ring"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter></defs>
<g filter="url(#outline)" transform="translate(64 64) scale(.92) translate(-64 -64)">${body}</g>
</svg>`;

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 128, height: 128 } });
  for (const [name, body] of Object.entries(EMOJIS)) {
    const svg = wrap(body);
    fs.writeFileSync(OUT + name + '.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + svg);
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: OUT + name + '.png', omitBackground: true, clip: { x: 0, y: 0, width: 128, height: 128 } });
    console.log(name);
  }
  await br.close();
})();
