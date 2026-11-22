# Jay's style sheet

How everything Jay makes should look and sound: websites, apps, bots, banners, images. It is the design of https://ag0nyy-ops.github.io/, written down so a new project can match it without copying the whole site.

**Files:** `style/tokens.css` (drop-in tokens and pieces), `style/demo.html` (every piece on one page), and the live site's `assets/css/style.css` (the full thing, with every effect commented).

---

## 1. Paste this to a future Claude

> Build it in Jay's style. It's a **classified-file / surveillance-dossier** look: pure black and white, a watching eye as the mascot, blackletter for names and big titles, small wide-spaced uppercase mono labels like a case file ("FILE 01 / CASE FILES"), hairline borders, rubber stamps (SHIPPED, LIVE, OPEN), film grain and a vignette. Fonts: UnifrakturMaguntia (titles and the name "Jay"), IBM Plex Mono (labels, UI, prices), IBM Plex Sans (reading text), all self-hosted. Colours: `#060606` background, `#ececec` text, and greys made with `color-mix` from those two. No other colours. Motion is CSS only, springy and quiet, and does nothing for `prefers-reduced-motion`. Plain HTML/CSS/JS, no framework, no trackers, no third-party requests. Copy is short, dry and honest: no invented testimonials, stats, clients or claims, and unfinished things are hidden, not shown as placeholders. Import `style/tokens.css` and follow `style/STYLE.md`.

---

## 2. The idea

A classified dossier that watches you back. Everything is a document in a file: sections are "files", projects are "cases", statuses are rubber stamps. The mascot is a single drawn eye. The eyes on the page follow the cursor, blink on their own timers and widen when you hover something clickable. It is dark, quiet and a little unsettling, never gory or loud, never strobing.

Keep it black and white. The only colour anywhere is a faint 1px red/cyan fringe on very large titles (`--fringe-r`, `--fringe-c`).

## 3. Colour

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#060606` | page background |
| `--fg` | `#ececec` | text, borders that matter, outlines |
| `--bg-2` | `fg` 4% over `bg` | cards and panels |
| `--muted` | `fg` 74% over `bg` | secondary text (about 9:1 contrast) |
| `--line` | `fg` 13% over `bg` | hairlines |
| `--line-strong` | `fg` 32% over `bg` | card borders, dividers, dashed rules |

Always build greys from `--fg` and `--bg` with `color-mix(in oklab, …)`. Never add a new colour. Text must stay readable: body text is `--fg`, secondary is `--muted`, and nothing the reader has to act on is dimmer than `--muted`.

## 4. Type

| Role | Font | How it's set |
| --- | --- | --- |
| Name and big titles | UnifrakturMaguntia (`--goth`) | `clamp(3.6rem, 12vw, 9.5rem)`, line-height `.85`, with the faint red/cyan fringe |
| Hollow name (footer, avatars, banners) | UnifrakturMaguntia | transparent fill, near-white outline: 1px on a big page element, **3px or more** on anything that gets shrunk (banners, avatars, social cards) |
| Labels, UI, prices, card titles | IBM Plex Mono (`--mono`) | labels: 400, `.75rem`, `letter-spacing: .22em`, uppercase, `--muted`, with a "■ " marker. Buttons: 600, `.76rem`, `.14em`, uppercase. Card titles: 600, `clamp(1.6rem, 3vw, 2.3rem)`, `letter-spacing: -.045em` |
| Reading text | IBM Plex Sans (`--sans`) | 400, `1.0625rem` on a `1.65` line height |

All three are SIL Open Font License 1.1: free for web and commercial use. Self-host them, with their licence texts, from `assets/fonts/`. Never load fonts from Google or any CDN.

## 5. Layout

- Content is `max-width: 1320px` (`--max`), centred, with `--gutter` (`clamp(16px, 4vw, 56px)`) on each side.
- A section is a **file**: a small label ("■ FILE 02 / COMMISSIONS / RATE SHEET"), a huge blackletter title, and a hairline under it that draws itself in on scroll. A giant outlined section number sits faintly behind the title.
- Sharp corners. No border radius on cards, buttons or stamps. No drop shadows on UI (only on tilted screenshots inside images).
- Cards are flat: `--bg-2` fill, 1px `--line-strong` border.
- Dotted leaders (`border-bottom: 2px dotted var(--line-strong)`) connect a name to its price in rate sheets.
- Design phone-first and test down to **320px wide**. No sideways scrolling. Every tap target is at least 44px tall on touch screens.

## 6. Pieces

All are in `tokens.css` and shown in `demo.html`.

- **Label** `.label`: small uppercase mono, "■" marker.
- **Button** `.btn` (outlined) and `.btn--solid` (filled): the fill wipes up from the bottom on hover and the button lifts 2px on a spring.
- **Stamp** `.stamp`: boxed uppercase mono, rotated about -4°. Dashed border (`.stamp--wip`) means in progress. `.stamp--big` for headline stamps like OPEN FOR COMMISSIONS.
- **Card** `.card`: a "case file", with a tab label like "CASE 001" and a stamp in the corner.
- **Redaction bars**: descriptions can sit under a solid `--fg` bar that peels away on scroll.
- **Callout**: a box with a 1px `--fg` border and small solid square corners on two opposite corners, a big blackletter link, and a big stamp.
- **Atmosphere**: one film-grain layer plus a vignette (`.atmosphere`). Grain is a pre-rendered 46 KB PNG tiled at 128px with its transparency baked in. Do not use a live SVG noise filter for it (slow).

## 7. Imagery

- **The eye** is a drawn lens shape, not a photo or an emoji. Spec: a lens outline (width about 600, a quadratic curve up and down) in a white-to-grey gradient stroke, a ring iris with about 96 fine fibres, an inner ring, a solid pupil with a small dark catchlight, and 7 lashes on the top lid. Reference code: `sigil()` in `tools/make-banners.js`, and the animated version in `tools/make-animated-pfp.js`.
- **Sigil**: the eye inside a thin ring with repeating ring text ("SEES EVERYTHING · SHIPS REAL THINGS") and two faint triangles. At emoji size use one triangle, not two (two read as a star).
- **Screenshots** in promo images are real, not mocked up: tilted a few degrees, in a thin `--line-strong` frame with a heavy shadow, on the black background with grain and vignette. Skyscrob-style diagrams are drawn in the same black and white.
- **Social sizes** (all built by scripts in `tools/`): Discord banner 1200×480 (shown at 600×240; the avatar covers the left and the status bubble covers the bottom right, so keep text in the right middle), GitHub social preview 1280×640, X header 1500×500, YouTube 2560×1440 with the text inside the central 1546×423, avatar 1024×1024, emoji 128×128 transparent, Discord commission sheet 1080×1350, square cards 1080×1080.
- Keep text on small images big and thick enough to survive being shrunk: test at the real display size, and after JPEG compression.

## 8. Motion and effects

- **CSS does the work.** JavaScript only feeds CSS things it can't know: cursor position, where each eye sits, idle state. It never animates anything.
- Prefer `transform`, `translate`, `scale` and `opacity`. Big moving layers must never repaint.
- Use scroll-driven animations (`animation-timeline: view()` and `scroll()`) and view transitions where supported; the page must still be fully readable without them.
- Easing: `--ease-liquid` for glides, `--ease-ink` for slow-fast-slow pours, `--ease-spring` for anything that should overshoot and settle. Animated avatars and loops use real damped springs, and the last move settles into the first frame so the loop is seamless.
- Scares are subtle and rare: a brief chromatic glitch, a blink. **Never strobe or flash.**
- `prefers-reduced-motion` turns off all motion and glitches. `prefers-contrast: more` removes the darkness overlays. Browsers without scroll-driven animation get a static, fully visible page.
- **Adaptive quality (3 tiers).** The live site picks `full`, `balanced` or `low` from cheap hints and measured frame rate, never goes back up in a visit, remembers it in `sessionStorage` only, and offers a "SIGHT: FULL / LIMITED / MIN" toggle plus `?fx=full|balanced|low`. Copy that pattern for anything effect-heavy.

## 9. Performance

Full-screen layers are what make a page slow. Merge overlays into one layer, keep the grain pre-rendered, avoid `backdrop-filter` on things that scroll under the cursor, and profile before optimising. Target 60fps scrolling. Lighthouse 90+.

## 10. Accessibility

Real focus rings (`outline: 2px solid var(--fg)`, never removed), keyboard-first, a skip link, proper headings, alt text that says what the image shows, `aria-label`s on icon buttons, and contrast checked. Hiding the scrollbar is done with `scrollbar-width: none`, never `overflow: hidden`, so keyboard scrolling keeps working.

## 11. Voice and content rules

- Short, dry, direct. Sentence case, with uppercase only for labels and stamps. The "classified" wording (files, cases, declassified, redacted) is the joke, so use it lightly.
- **Be honest.** No invented testimonials, stats, clients, reviews or "builds anything" claims. Describe only what actually exists: list a bot's commands from its code, not from imagination.
- **Hide what isn't finished.** An unfinished or not-for-sale project does not appear. A missing image or link is left out with a `TODO` HTML comment where it goes, never shown as "[screenshot here]" on the live page.
- Prices come from one data file (`assets/data/prices.js`) so the page, the images and the posts can't disagree. Say "from $X", and "quote on request" when there isn't a number.
- No emojis in UI copy. No attribution lines ("generated with…") anywhere.

## 12. Code conventions

- Plain HTML, CSS and a little JS. **No framework, no build step, no dependencies.**
- CSS in `@layer`s declared up front: `reset, tokens, base, layout, components, atmosphere, motion, scares, easter-egg, a11y`. Later layer wins, so no specificity fights.
- Custom properties on the eye system and the SVG filter ids are prefixed `jdx-` ("jay dossier"). Use that prefix for new unique names so the work is recognisable.
- Everything self-hosted: fonts, images, scripts. **No third-party requests and no trackers.** Verify with a network log.
- Every file starts with a small signature comment (name, year, URL, the licence line). The repo is source-viewable but not reusable by others (`LICENSE`), so keep that line.
- Test at 1440px, a tablet, a phone and 320px, with the browser console clear of errors.

## 13. Don'ts

- No colours, gradients or glow effects beyond the black-and-white system.
- No rounded corners, soft shadows or glassmorphism on UI.
- No stock photos or other people's art. Everything is drawn from the eye, the fonts and real screenshots.
- No fake content, no overclaiming, no bracketed placeholders on a live page.
- No heavy JavaScript effects, no autoplaying sound, nothing that flashes.
