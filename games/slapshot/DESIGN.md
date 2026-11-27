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

## Files

- `sim.js`: rink, physics, goalies and computer players, no DOM.
- `game.js`: input (shared `Input`, deadzone from shared settings), menus, drawing, sound.
- Team colours come from `palette()`; home are circles, away are diamonds, you have a ring and a YOU marker. Nothing flashes; puck trail and ice spray are off with reduced motion.
