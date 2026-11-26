# Shared base for the games on /games

Every game in `games/<slug>/` builds on this folder. Keep it plain HTML, CSS and ES modules: no framework, no build step, no third-party requests.

## Files

- `settings.js`: global settings, saved in `localStorage` under `jay.games.settings.v1`. `loadSettings()`, `saveSettings(s)`, `palette(s)` (team colours for the picked colour-vision mode), `reducedMotion(s)`. The settings panel lives on the hub, `games/index.html` + `games/hub.js`.
- `input.js`: `new Input(keymap)`, then `input.poll()` once per frame. Read `input.state` (`lx ly rx ry` sticks after the radial deadzone, `lt rt` triggers 0..1, `btn.A` etc.), `input.down(name)`, `input.pressed(name)` (this frame only), `input.nav()` for menus, `input.lastDevice` (`controller` or `keyboard`). Button names follow the standard gamepad layout: `A B X Y LB RB LT RT SELECT START LS RS UP DOWN LEFT RIGHT` (PlayStation: cross, circle, square, triangle, L1, R1, L2, R2, share, options). A keymap action named after a button also presses that button, so menus work the same on both devices.
- `game.css`: the game screen look: full-window canvas `#c`, menu overlay `.overlay`, `.menu`, `.stats`, `.blurbs`, `table.keys`, `table.board`.

## Rules every game follows

- **Controller first, keyboard fallback.** Every action has a key. Show the right prompts for `input.lastDevice`.
- **Deadzone comes from settings.** Never hard-code one; Jay's left stick drifts. Read raw sticks only through `input.js`.
- **Colour.** The page is black and white (`#060606`, `#ececec`, greys from those). Team colours come only from `palette()`. Colour is never the only cue: teams and the player also differ by shape, outline or a label.
- **No flashing or strobing, ever.** No full-screen flashes, no blinking faster than about once a second, no camera shake. When `reducedMotion()` is true, also drop screen motion that isn't gameplay.
- **Easy to learn, hard to master.** Arcade feel, deep controls. No grind: no unlocks or stats earned by repetition (Sprint's training uses your best drill grade, not time spent).
- **Paths are relative** (`../games.css`, `../shared/input.js`), so a branch can be tried from a raw-file CDN before it is merged.
- **Each game page** has a menu with Play, Controls and a way back to `../`, pauses on Start/Options and Esc/P, and saves its own data under `jay.<slug>.v1`.
- Same file header as the rest of the site (© 2026 Jay, source viewable, not reusable).
