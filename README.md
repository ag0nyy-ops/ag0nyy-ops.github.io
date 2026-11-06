# ag0nyy-ops.github.io

My portfolio and commissions page: Discord bots, iOS apps, Roblox/Minecraft and websites.

**Live:** [https://ag0nyy-ops.github.io](https://ag0nyy-ops.github.io/)

## Stack

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies.

- `index.html`: the page
- `assets/css/style.css`: all styles
- `assets/js/main.js`: boot intro, watching eyes, glitch/scramble text, scroll reveals, custom cursor, project preview
- `uploader/` and `privacy.html`: homepage and privacy policy for my uploader app (keep these URLs stable)

Every animation respects `prefers-reduced-motion`. The boot intro plays once per browser session (clear `sessionStorage` to see it again). The page works without JavaScript; you just lose the effects.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

Pushing to `main` deploys through GitHub Actions (`.github/workflows/pages.yml`).

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Filling in placeholders

Search the code for `[` and `TODO` to find everything that still needs real content:

- screenshots go in `assets/img/`, then replace the `[screenshot here]` spans with `<img src="assets/img/…" alt="…" loading="lazy">`
- prices are the `$[__]` values in the Services section
- the Discord handle is `#discord-handle` in the Contact section
