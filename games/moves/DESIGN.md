# Moves (gymnastics)

Side-on floor routine judged on what your body actually does. **The controls are a first take** (Jay gave no specifics), so they can change.

## Controls

| | Controller | Keyboard |
| --- | --- | --- |
| Run | Right stick toward the far side | Arrow toward the far side, held |
| Hurdle | Left stick up (arms up) | W |
| Punch | Let the right stick go, flick it as the rings meet | Let go, tap an arrow as the rings meet |
| Back / front salto | Flick back / forward | Arrow back / forward |
| Twisting salto | Flick diagonally up and back (or forward) | Two arrows |
| Jump | Flick straight up | Arrow up |
| Tuck / pike | L2 / R2, how far you pull is how tight | F / J |
| Twist faster | Left stick down (arms in) | S |
| Steady the landing | Left stick left or right | A / D |
| Finish | Left stick up once still | W |
| Pause | Options / Start | P or Esc |

## How it works

- **Takeoff sets everything.** Run speed and punch timing give height and spin. Run-up is a trade: the longer you run, the faster you go, but the less floor you have to land on.
- **In the air** spin stays the same and your shape changes how fast it turns: tuck is fastest, pike next, laid out slowest. Twists work the same with the arms. The dial top right shows where your head points, and a hollow ring shows where you'd end up if you opened now.
- **Landing.** Unfinished or extra rotation becomes lean. It's an upside-down pendulum: push against it until you're still, then arms up to finish. Past the edge of the balance bar you take a step; a fourth step is a fall.
- **Connections.** Flick again the instant you land a salto and you rebound into the next skill (+0.1 if it counts).
- **Judging.** D is the value of what you threw plus 0.5 for each routine requirement (a front salto, a back salto, a double). E is 10 minus deductions: steps, falls, loose shapes, bent body, legs apart, low, twist not finished, no finish, out of bounds. Every skill is open from the first pass. Nothing is earned by grinding; only the best routine score is saved.
- **Modes:** Routine (4 passes, judged and saved), Free floor (practice), Free floor at half speed (for learning the timing), CPU vs CPU (watch).
- **CPU vs CPU.** Main menu, "CPU vs CPU". Two seeded dummies, Dummy A and Dummy B, take turns: one pass each, four passes each, judged like a routine (requirements count). The one waiting stands just off the floor with a hollow head; both carry a letter. It starts by itself, the HUD shows a chip per side (`dummy a: twister, seed 3F2A` and the running total) and no player prompts. Pause with Options / Start, B, P or Esc; the pause menu shows both seeds and can start a new match or quit to menu. After the result it waits a few seconds and starts a new match with new seeds. Watch games are never saved.
- **Seeding** (the Folkstyle way, `../shared/seed.js`). Each dummy is `makeDummy(newSeed(), DUMMY_RANGES, DUMMY_STYLES)`, re-rolled every match, and uses its own generator for every choice it makes (what to throw, when it punches, when it opens, how it steadies). Same body and physics as you; the numbers are trade-offs: ambition (more D, more falls), runup (speed vs room to land), focus (sharp punch vs sharp spin read), open (early or late opener), shape (tuck, pike or layout), twist, front vs back, link (connections), reflex (fast but soft vs slow but firm landing), tidy (form), room (floor kept spare), think (corner pause), nerve (goes big again after a fall). Styles, first match wins: twister, power tumbler, connector, clean lines, spot lander, else all rounder.
- **Code split for this:** `sim.js` now holds the whole pass (Performer, driven by a plain control frame) and the CPU (CpuGymnast), so a match can run headless; `game.js` feeds it the pad or the CPU.
- **No flashing.** Nothing blinks, the camera never moves, and with reduce motion on the walk back to the corner is skipped.
- Floor first, then beam or vault later.

Code: `sim.js` is the body, the pass, the CPU and the judging (no drawing), `game.js` is input, screens and drawing.
