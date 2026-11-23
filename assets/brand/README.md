# Brand

Everything here is made from the artwork already in this repo (`assets/banners/`, `assets/favicon.svg`), resized and compressed. The full-size originals and the other social banners stay in `assets/banners/`, so nothing is duplicated.

## What's here

| Use | File |
| --- | --- |
| Logo mark (the eye), any colour via `currentColor` | `mark.svg` |
| App icon source, square, no rounded corners | `app-icon.svg`, `app-icon-1024.png` |
| iOS / Tauri icon source (`npx tauri icon assets/brand/app-icon-1024.png` makes every size) | `app-icon-1024.png` |
| PWA / Android | `icon-192.png`, `icon-512.png` |
| Apple touch icon | `apple-touch-icon-180.png` |
| Favicon | `favicon.ico` (16/32/48), `favicon-16.png`, `favicon-32.png`, `favicon-48.png`; or the site's rounded `../favicon.svg` |
| Avatar (the sigil) | `avatar-512.jpg` (for uploads), `avatar-256.webp`, `avatar-128.webp` |
| README banner, 3:1 | `readme-banner-1280x427.webp` |
| Default OG / link preview, 1200x630 | `og-default-1200x630.jpg` (the portfolio's own preview is `../og-image.jpg`) |

## Empty slots

Zero-byte files named `MISSING-...` are placeholders for artwork that doesn't exist yet. Replace the file with the real one and drop the `MISSING-` prefix:

- `MISSING-wordmark-jay.svg`: the hollow blackletter "Jay" as a clean vector (today it only exists inside the banners)
- `MISSING-wordmark-jay-light.svg`: the same, for light backgrounds
- `MISSING-mark-light.svg`: the eye mark for light backgrounds
- `MISSING-android-adaptive-foreground.png`: the mark on transparent, with safe-zone padding, for Android adaptive icons
- `MISSING-readme-banner-light.webp`: README banner for GitHub's light theme

Rebuild or resize the PNG/WebP files from `app-icon.svg` and the banners in `assets/banners/`; keep new images compressed (WebP or optimised PNG/JPG, no file over ~100KB).
