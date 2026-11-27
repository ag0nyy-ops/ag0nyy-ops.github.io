# Sprint (track)

Side-on 100 m against seven computer runners. Built first.

- **Stride:** alternate L2 / R2 (F / J). Each stride is graded on rhythm (gap since the last stride vs an ideal that shortens from 0.26 s to 0.20 s over the first 40 m), trigger depth (full pull = full stride), and lean. Same trigger twice = stumble. Mashing is off rhythm, so it is slow.
- **Lean:** left stick up/down (W / S). Ideal is low and forward out of the blocks, tall by 40 m. Shown as a gauge with the target as a hollow box.
- **Start:** On your marks, Set, random hold, gun. Striding before the gun, or within 0.1 s of it, is a false start; two and you are out.
- **Dip:** Cross / Space just before the line takes up to 0.5 m off; dipping early costs speed.
- **Training:** three drills (Starts, Rhythm, Lean), each graded 0–100 with a letter. Your best grade in each sets one athlete stat (block power, top speed, drive acceleration). Best grade, not reps, so there is no grind.
- **Levels:** Club meet, State final, Nationals. A good untrained run wins State; Nationals needs training.
- Physics is in `sim.js`, separate from drawing, so it can be tuned with a script.
- **Seeded dummies:** every computer runner is rolled from a fresh seed each race (`../shared/seed.js`), 12 numbers in a fixed order: reaction, risk (guessing the gun), nerve (sleepy starts), drive (acceleration lag), fade (top-end loss over the last 40 m), surge (40–70 m push), cadence (turnover), block lean, rise distance, dip timing and dip skill, steadiness (race-to-race form). The level still sets the field's target times; each dummy's top speed is solved from its target and its own race shape, so the seed changes how it runs, not how fast. Styles, first match: gun hunter, drive phase, closer, long strider, all rounder. A dummy that guesses the gun is recalled and waits on the next start. Its in-race rolls use its own generator. In a race, the pause menu and results list each lane's style and seed tag.
- **CPU vs CPU:** main menu, CPU vs CPU, pick a level. Eight dummies (Dummy A to H) race on their own, the camera zooms to keep the whole field in view, and the HUD lists `dummy a: closer, seed 3F2A` for each. Pause with Options / P / Esc (B), the pause menu can re-roll or quit. After the result shows for a few seconds the next race starts with new seeds. Watch races save nothing.
