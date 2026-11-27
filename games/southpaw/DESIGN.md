# Southpaw (boxing)

Side-on arcade boxing, all about the arms.

- **Triggers throw punches.** L2 = left hand, R2 = right hand. How far you pull sets power: a light pull is a quick jab, a full pull lands hard but leaves you open longer.
- **Right stick picks the punch** at the moment of the throw: neutral = straight, sideways = hook, down = uppercut, up = to the head vs body (down-and-hold).
- **Left stick moves your feet:** in, out, circle. Stance (orthodox or southpaw) switches with a click of the left stick.
- **Defense:** L1 / R1 raise the guard on that side; quick right stick flick = slip; both bumpers = shell.
- **Stamina** drops with every punch thrown and missed, recovers when you are not throwing. Knockdowns from damage, not a timer.
- **No stat training.** Rounds of 60–90 s against computer fighters with different styles.
- Keyboard: F / J punches (hold longer for power), WASD feet, arrows pick punch, E / U guards.

## Seeded dummies

- Every computer fighter (the five opponents, the practice partner and both CPU vs CPU corners) is a dummy rolled from a fresh seed with `makeDummy` from `../shared/seed.js`, re-rolled every bout. The opponent card (Rook to The Clerk) stays the skill level; the seed only changes how it boxes, and it uses its own generator for every in-fight choice, so a seed always boxes the same way.
- Rolled in this order (all trade-offs, no raw strength): `tempo` 0.75–1.3 × time between attacks, `react` 0.9–1.12 × reaction time, `range` −0.12–+0.1 m preferred distance, `power` ±0.12 trigger pull, `guard` 0–1 (more guard, fewer slips), `feet` 0–1 bounce and stepping out, `read` 0.75–1.25 × punishing misses and covering up, `gamble` 0.04–0.3 chance to throw without checking reach, `pacing` −8–+8 stamina % where it backs off, `flow` 0.7–1.4 × gap inside a combo, `body` 0–1 head vs body, `flash` 0–1 hooks and uppercuts over straights, `switchy` 0–1 (over 0.8 it switches stance out of range), `rhythm` 1.6–3.2 bounce frequency.
- Style, first match wins: brawler (flash > 0.72 and works inside), volume puncher (tempo < 0.88), out-boxer (range > 0.04 and feet > 0.5), counter puncher (read > 1.1), body snatcher (body > 0.72), else all rounder.
- The opponent's style and 4-digit seed tag show under its health bar and in the pause menu.

## CPU vs CPU

- Main menu → **CPU vs CPU**. Pick the card each corner boxes as (or Random, re-picked every bout), then Start. Choices are saved.
- Both corners run the computer fighter's brain with their own seeds; your buttons do nothing. Names read Dummy A (left, solid) and Dummy B (right, outline), each with a `dummy a: brawler, seed 3F2A` line on the HUD. Your trigger meters, prompts and YOU tag are hidden.
- No corner screen between rounds. The result stays up for 6 s, then a new bout starts with new seeds. Options, Circle, P or Esc pauses; the pause menu has New bout and Quit to menu. Watched bouts never touch your record.
