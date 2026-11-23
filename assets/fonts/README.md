# Fonts

Only fonts under the SIL Open Font License 1.1 live here, which allows self-hosting and commercial use. Each licence text sits next to its fonts.

| File | Family | Weight | PostScript name (for Swift) | Licence file |
| --- | --- | --- | --- | --- |
| `ibm-plex-mono-400-latin.woff2` (+ `-latin-ext`) | IBM Plex Mono | 400 | `IBMPlexMono-Regular` | `OFL-IBM-Plex.txt` |
| `ibm-plex-mono-600-latin.woff2` (+ `-latin-ext`) | IBM Plex Mono | 600 | `IBMPlexMono-SemiBold` | `OFL-IBM-Plex.txt` |
| `ibm-plex-sans-latin.woff2` (+ `-latin-ext`) | IBM Plex Sans | 400 | `IBMPlexSans-Regular` | `OFL-IBM-Plex.txt` |
| `unifrakturmaguntia-400-latin.woff2` | UnifrakturMaguntia | 400 | `UnifrakturMaguntia` | `OFL-UnifrakturMaguntia.txt` |

These are web subsets (Latin; the `-latin-ext` files add accented letters). `tokens/tokens.css` loads the `-latin` ones; add the `-latin-ext` files with a `unicode-range` if you need them.

**iOS and other native apps** can't load `.woff2`. Get the full TTF/OTF files from upstream and bundle those, with the same licence text:

- IBM Plex: https://github.com/IBM/plex (releases)
- UnifrakturMaguntia: https://github.com/google/fonts/tree/main/ofl/unifrakturmaguntia
