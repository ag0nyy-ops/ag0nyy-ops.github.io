# ag0nyy-ops.github.io

My portfolio and commissions page: Discord bots, iOS apps, Roblox/Minecraft and websites.

**Live:** [https://ag0nyy-ops.github.io](https://ag0nyy-ops.github.io/)

## Stack

Plain HTML, CSS and a little JavaScript. No framework, no build step, no dependencies.

- `assets/fonts/`: self-hosted IBM Plex Mono, IBM Plex Sans and UnifrakturMaguntia (OFL 1.1). No third-party requests.
- `index.html`: the page, plus two SVG filters (chromatic aberration and a liquid warp)
- `assets/css/style.css`: almost everything. It's organised in `@layer`s and commented so every effect can be explained.
- `assets/js/main.js`: about 100 lines. It never animates anything; it only tells CSS what CSS can't know (cursor position, where each eye sits, idle/away state), plus the copy button and view transitions.
- `uploader/` and `privacy.html`: homepage and privacy policy for my uploader app (keep these URLs stable)

### Effects and how they're built

| Effect | Technique |
| --- | --- |
| Flashlight | huge radial-gradient overlay moved with `translate` (composited); touch devices get a CSS Lissajous wander |
| Eyes | no SVG: two-circle `mask-composite: intersect`, container query units, `atan2()`/`hypot()` pupil tracking in CSS |
| Blinking | pure CSS keyframes on `transform`, per-eye `--jdx-blink` timing |
| Pupils dilate on hover | `:root:has(a:hover)` flips a variable |
| Scroll reveals, redaction peel, title distortion, parallax | scroll-driven animations (`animation-timeline: view()` / `scroll()`) |
| "Declassified %" counter + scroll spy | `@property` integer + CSS counter; named view timelines + `timeline-scope` |
| Ink smoke | animated `@property` gradients on a quarter-size layer scaled 4× |
| Grain / VHS / RGB split | SVG `feTurbulence`, scanline gradients, `feColorMatrix` channel offsets |
| Section jumps + page changes | View Transitions (same-document and cross-document) |
| Hidden "how it's built" panel | press `?` or open "Declassify the source" in the footer |
| Custom cursor | a trailing ring, only for a real mouse (`(hover: hover) and (pointer: fine)`); fades when the mouse leaves; touch, no-JS and reduced motion keep the normal cursor |
| Right-click menu | native `popover="auto"` (Esc + click-away for free); Shift+F10 / Menu key work; Shift + right-click, links, images and selected text keep the browser menu |
| Text selection | off page-wide with `user-select`, except the Discord handle, GitHub link and prices |

`prefers-reduced-motion` turns off all motion, scares and flicker. `prefers-contrast: more` removes the darkness overlays. Browsers without scroll-driven animations get a static, fully visible page.

## Effect quality (sight levels)

The site picks one of three tiers and sets `data-fx` on `<html>`. Every tier keeps the same look; lower tiers swap expensive tricks for cheaper ones.

| Tier | Toggle label | What changes |
| --- | --- | --- |
| `full` | SIGHT: FULL | everything |
| `balanced` | SIGHT: LIMITED | pre-rendered grain only, no live SVG filters, no blend modes on full-screen layers, flashlight stays a transformed element |
| `low` | SIGHT: MIN | balanced + static smoke, simpler eyes (no fibres/lashes), no scanlines or VHS bands |

How it's chosen:

1. `?fx=full`, `?fx=balanced` or `?fx=low` in the URL always wins.
2. Otherwise the choice saved earlier in this visit (sessionStorage, gone when the tab closes).
3. `prefers-reduced-motion` forces `low`.
4. Cheap hints give a first guess: data saver, touch vs mouse, screen pixels × devicePixelRatio, and (weakly) `hardwareConcurrency`. `deviceMemory` is not used.
5. Frame sampling makes the real decision: ~2 s after load, then during scrolling. Below ~45 fps for two windows in a row drops one tier. It never goes back up during a visit.

The SIGHT toggle in the top bar cycles tiers by hand, and the "how it's built" panel shows the current tier and why. No cookies, no analytics, nothing leaves the browser.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

Pushing to `main` deploys through GitHub Actions (`.github/workflows/pages.yml`).

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Changing prices

Every price on the site comes from one file: `assets/data/prices.js`. Change a number there and it updates everywhere (the services list, the showpiece line and the easter egg). Each price shows as "from $X"; use `null` for "quote on request", which is also what visitors see if JavaScript is off. The word "from" and the "quote on request" text are set at the top of the same file.

## Filling in placeholders

Nothing unfinished shows on the live site. Missing pieces are left out and marked with a `TODO` HTML comment where they go; search `index.html` for `TODO`:

- bot invite / info link (Jinzo & Cosmou case)
- Minecraft screenshot, tools used and gallery link
- Workout App screenshot and tools used
- a real Jinzo / Cosmou screenshot to replace the preview card
- `og:image` (1200×630)

Project images live in `assets/img/`. The Skyscrob diagram and the bots preview card are generated by `node tools/make-previews.js`. The about photo is `assets/img/jay.jpg`, a 4:3 crop of the GitHub avatar (`assets/img/github-avatar.png`).

## Contact details

- Discord server invite: `https://discord.gg/nGysyw7MgS` (the Discord / book / open-a-case buttons)
- Email: stored split as `data-u` + `data-d` on `#email` in `index.html`, so it never appears whole in the HTML; `main.js` joins it into the text and the mailto.

## Licence

Source-available, view only: you can read and learn from this code, but not copy, redistribute or reuse it (modified or not) as your own site or in commercial work without written permission. See [LICENSE](LICENSE). The self-hosted fonts in `assets/fonts/` are SIL Open Font License 1.1 (licence texts included).
