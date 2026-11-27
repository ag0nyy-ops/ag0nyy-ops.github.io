# Slapshot (hockey)

Top-down 3-on-3 arcade hockey with computer goalies. **These controls are a proposal** (Jay gave no specifics), now playable so they can be changed.

## Controls

| | Controller | Keyboard (+ mouse) |
| --- | --- | --- |
| Skate | Left stick, with momentum | W A S D |
| Hard stop | L2 | Shift |
| Stickhandle | Right stick moves the blade around you | Arrow keys, or point with the mouse |
| Shoot | Right stick: hold it back, flick it forward | Hold an arrow, tap the opposite one. Mouse: hold the button, let go |
| Pass | R1, toward where you push the left stick | E |
| Saucer pass | R2, lifts over sticks | R |
| Body check | L1 | Q |
| Poke check | A quick push of the right stick at the puck | Tap an arrow at the puck, or click |
| Switch player | Cross / A | Space |
| Pause | Options / Start | P or Esc |

## How it plays

- Wind-up under 0.4 s is a wrist shot (fast release, goalie reads it late). Longer is a slapshot, harder up to 1 s, but you slow down, defenders step into the lane and the goalie reads it early.
- Shots go where you flick; a dashed line and a ring show the aim and the wind-up while you hold.
- One-timers: wind up before a pass arrives and flick as it lands.
- Moving the blade (stickhandling) makes poke checks miss more. A missed check or poke costs you a moment.
- No stat training and no unlocks: every skater is the same. Three levels (Rookie, Pro, All-Star) change the computer's speed, decisions and goalie. Records are W-L-T per level, saved under `jay.slapshot.v1`.
- 3 periods of 1 to 4 minutes, sudden-death overtime if tied. Practice mode is you, a puck and a goalie.

## Seeded dummies

Each computer team is a dummy rolled from a fresh seed with `makeDummy` from `../shared/seed.js` (the way Folkstyle rolls its wrestlers), re-rolled every new game. The level is still the skill; the seed only changes how the team plays, and each number is a trade-off, not raw strength. The team uses its own `R` for every choice it makes, so a seed always plays the same way.

| roll | range | what it changes |
| --- | --- | --- |
| think | 0.8–1.25 | decision delay, times the level's |
| shoot | 0.4–0.8 | chance to shoot on a look from good ice |
| range | 190–275 | farthest it shoots from |
| slap | 0.2–0.7 | slapshot wind-ups over quick wristers |
| snipe | 0–1 | aims tight to the post: harder to save, misses more |
| pass | 0.7–1.3 | pass-first under pressure |
| drive | 0.75–1.2 | where the carrier sets up: deep or at the point |
| dangle | 0.5–1.5 | stickhandles through pressure or skates around it |
| width | 0.75–1.3 | spacing of the support skaters |
| poke | 0.35–0.8 | how often the pressuring defender pokes |
| hit | 0.4–1.6 | how often it throws checks (misses stumble) |
| forecheck | 0–1 | how high the third skater sits: pressure or guard the slot |
| chase | 80–150 | how close a second skater must be to join a loose-puck chase |
| depth | 0.8–1.2 | how far its goalie plays out of the net |

Styles, first match wins: `hit > 1.32` enforcer, `slap > 0.58` cannon, `pass > 1.15` playmaker, `dangle > 1.25` dangler, else two way. In a normal game your AI teammates play with your team's roll, and the CPU's style and seed tag show top right (`cpu: cannon, seed 3F2A`) and on the pause menu.

## CPU vs CPU

`CPU vs CPU` on the main menu (with `CPU vs CPU level` to pick Rookie, Pro or All-Star; periods use the Periods option). Both teams run the computer AI at that level with their own seeds; your input only pauses (Options / Start, Circle / B, P or Esc), and the pause menu has New match (new seeds) and Quit to menu. The teams are Dummy A (circles) and Dummy B (diamonds), with `dummy a: STYLE, seed 3F2A` lines on the HUD; no YOU marker or control tips. After the final it shows the result for a few seconds, then starts a new match with new seeds by itself. Watch games are not recorded. On a first visit from a touch screen the page opens straight into CPU vs CPU.

## Files

- `sim.js`: rink, physics, goalies, computer players and their seed rolls, no DOM. `new Game({ watch: true, seeds })` runs a CPU vs CPU match headless.
- `game.js`: input (shared `Input`, deadzone from shared settings), menus, drawing, sound.
- Team colours come from `palette()`; home are circles, away are diamonds, you have a ring and a YOU marker. Nothing flashes; puck trail and ice spray are off with reduced motion.
