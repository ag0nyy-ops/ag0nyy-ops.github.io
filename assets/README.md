# Jay's shared assets

One place for the look: tokens, fonts, icons, brand images and a small base stylesheet. New sites and apps pull from here instead of copying the look around. Everything is served from `https://ag0nyy-ops.github.io/assets/`.

```
tokens/   tokens.css, tokens.json, Tokens.swift   colours, fonts, type scale, spacing, shape, motion
css/      base.css                                reset, type scale, label/title/stamp/button/card/inputs
fonts/    *.woff2 + OFL licence texts             IBM Plex Mono/Sans, UnifrakturMaguntia (see fonts/README.md)
icons/    42 SVG icons + LICENSES.md              24px grid, 1.5 stroke, all drawn for this repo
brand/    mark, app icons, favicons, avatar,      resized from the artwork in banners/ (see brand/README.md)
          README banner, OG image, MISSING-* slots
```

`css/style.css` and `js/` belong to the portfolio itself and aren't part of the kit. The site's `:root` in `css/style.css` is the source of truth for the look, so if it is re-themed, update `tokens/` to match.

**Licence:** these are my own assets, under the repo's `LICENSE` (free for my own projects, not for reuse by others). The fonts are SIL OFL 1.1 and keep their own licence texts. Icon sources are in `icons/LICENSES.md`.

## From a website

```html
<link rel="icon" href="https://ag0nyy-ops.github.io/assets/brand/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="https://ag0nyy-ops.github.io/assets/brand/apple-touch-icon-180.png">
<meta property="og:image" content="https://ag0nyy-ops.github.io/assets/brand/og-default-1200x630.jpg">
<link rel="stylesheet" href="https://ag0nyy-ops.github.io/assets/css/base.css">   <!-- also loads tokens + fonts -->
```

Then use the tokens (`var(--fg)`, `var(--mono)`, `var(--space-4)`) and the classes `.btn`, `.btn--solid`, `.card`, `.label`, `.title`, `.stamp`, `.field`. An icon that takes the text colour:

```html
<i class="icon" style="--i:url(https://ag0nyy-ops.github.io/assets/icons/arrow-right.svg)"></i>
```

(Use a full or root-relative URL there, because a `url()` inside a custom property resolves against `base.css`, not your page. `<img src="...svg">` also works, but it draws in black: `currentColor` doesn't pass through an `<img>`.)

## From a Tauri app

An app should work offline, so copy the files in rather than linking to the site. From the app's root:

```bash
mkdir -p src/jay/{tokens,css,fonts,icons}
B=https://ag0nyy-ops.github.io/assets
curl -fsSL $B/tokens/tokens.css -o src/jay/tokens/tokens.css
curl -fsSL $B/css/base.css -o src/jay/css/base.css
for f in ibm-plex-mono-400-latin ibm-plex-mono-600-latin ibm-plex-sans-latin unifrakturmaguntia-400-latin; do
  curl -fsSL $B/fonts/$f.woff2 -o src/jay/fonts/$f.woff2; done
curl -fsSL $B/fonts/OFL-IBM-Plex.txt -o src/jay/fonts/OFL-IBM-Plex.txt
curl -fsSL $B/fonts/OFL-UnifrakturMaguntia.txt -o src/jay/fonts/OFL-UnifrakturMaguntia.txt
curl -fsSL $B/brand/app-icon-1024.png -o app-icon.png && npx tauri icon app-icon.png
```

Keep the same folder layout (`css/`, `tokens/` and `fonts/` side by side) so the relative `@import` and font paths in the CSS keep working, then `import "./jay/css/base.css"` in your entry file. `npx tauri icon` generates every icon size from the 1024px source.

## From a SwiftUI app

1. Copy `tokens/Tokens.swift` into the project.
2. iOS can't load `.woff2`. Download the TTF/OTF files from the upstream links in `fonts/README.md`, add them to the app target, and list them under "Fonts provided by application" (`UIAppFonts`) in Info.plist. Keep the OFL texts with them.
3. For the app icon, drag `brand/app-icon-1024.png` into the asset catalog's AppIcon slot (square, no transparency, iOS rounds it).

```swift
import SwiftUI

struct Home: View {
    var body: some View {
        VStack(alignment: .leading, spacing: JaySpace.s4) {
            Text("File 01 / Commissions").jayLabel()
            Text("Jay").font(.jayGoth(72)).foregroundColor(.jayFg)
            Text("Reading text is IBM Plex Sans.").font(.jaySans()).foregroundColor(.jayMuted)
            Button("Open") { }.buttonStyle(JayButtonStyle(solid: true))
        }
        .jayCard()
        .padding(JaySpace.s5)
        .background(Color.jayBg.ignoresSafeArea())
    }
}
```

`Tokens.swift` hasn't been compiled yet (no Swift toolchain where it was written), so expect to fix a typo or two the first time you build it.

## Adding to the kit

- New icon: draw it on the 24px grid in the same style, add a row to `icons/LICENSES.md` if it isn't original.
- New brand image: keep it compressed, and fill a `MISSING-*` slot instead of adding a second copy.
- New colour: don't. The look is black and white, with every grey made from `--bg` and `--fg`.
