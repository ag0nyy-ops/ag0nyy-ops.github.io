# Tackle (football)

Arcade football, side view in the spirit of old-school pocket football games. Short drives, quick plays.

- **One stick and one trigger.** The ball carrier holds the ball in one hand, picked at random every play and shown on the carrier. Ball in the left hand: left stick + L2. Right hand: right stick + R2. The other side does nothing, so muscle memory can't run the play.
- **Passing (QB):** hold the trigger to drop back; the stick aims a throw arc; pull deeper for more zip, release to throw. Receivers run simple routes picked before the snap.
- **Running:** stick moves, quick flick sideways = juke, trigger = stiff-arm or burst (short meter that refills, not a stat).
- **Defense:** in v1 the other team's drives are simulated between yours, so you only play offense. Later: you pick a defender and the same rule applies (random hand = which stick and trigger).
- **Kicking:** on 4th down you can punt or try a field goal. The field goal is a needle that swings across a box; pull the live trigger while it's inside. Longer kicks swing faster into a smaller box.
- **Difficulty** only changes how fast the defense reads the play, never player speed. All-Pro can also switch the hand after a catch.
- **No stat training.** Players are equal; you get better, they don't.
- Keyboard: left hand = WASD + Shift, right hand = arrows + Right Shift (or IJKL + Space). The prompt on screen always shows which side is live.

## Seeded dummies

The CPU team is a dummy rolled from a fresh 32-bit seed every game (`makeTeam` in `sim.js`, built on `../shared/seed.js`), the same way Folkstyle rolls its wrestlers. The difficulty is still how good the defense is (how fast it reads the play); the seed only changes how it plays, with trade-offs instead of raw strength. It uses its own random source for its choices, so a seed always plays the same way.

- Offense numbers: `tempo` (time at the line), `runCall`, `deep` (love of the deep shot), `patience` (how long the QB holds), `open` (room it wants before it throws), `gamble` (forced throws, long kicks), `vision` (how hard the runner cuts), `juke`, `burst` (meter it keeps), `goFor` (4th down).
- Defense numbers: `lean` (reads the pass fast and the run late, or the other way round), `cushion` (corners play off: deep help vs. underneath room), `blitz` (a backer leaves the back to rush), `pursuit` (pursuit angle), `safe` (how far the safety leans).
- Styles, first match: gunslinger, ground and pound, blitz happy, ball hawk, run stopper, else balanced.
- In your games the dummy plays the defense and its offensive numbers shape the simulated drives a little (deep teams score more touchdowns and fewer field goals, gamblers turn it over more, running teams eat clock). Its style and seed tag show under the score and in the pause menu.

## CPU vs CPU

"CPU vs CPU" on the main menu plays a whole game between Dummy A and Dummy B, both drives on the field, at the skill picked in "CPU vs CPU skill" and the usual game length. The dummy's offense plays through the same stick and trigger a player does (`cpuControl`): it reads the coverage imperfectly, misses by a little on long or hurried throws, and picks when to juke and burst. The match flow lives in `newMatch` / `matchTick` so it can be tested in node. Options / Start, Esc or P pauses (New match, Quit to menu). After the final it shows the result for a few seconds and starts again with two new seeds. Watch games are not recorded.
