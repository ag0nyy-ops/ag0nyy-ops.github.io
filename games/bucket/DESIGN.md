# Bucket (basketball)

Half-court arcade basketball, street rules. 1 on 1, 2 on 2 or 3 on 3 against the CPU, plus a shoot around with no defense. Online 5v5 is a later idea.

## How it plays

- **Moving:** left stick moves. Flick the right stick for a dribble move: sideways is a crossover, back is a step-back, forward is a hesi. A defender drifting the wrong way, or one who just reached, loses their feet. Four moves in a row with someone on you and you can lose the handle.
- **Passing and screens:** R1 or cross passes toward the left stick. L1 or triangle calls the nearest teammate over to set a screen; a defender who runs into it is stuck for a moment.
- **Shooting has no timing meter and no green line.** Hold square, L2 or R2 to rise. The view drops into first person at the rim and the world slows down. Each stick is one hand: the left stick aims the guide hand, the right stick the shooting hand. The ring on the rim is the drop zone: both hands have to sit inside it for the ball to go down, and how close to the middle decides make or miss. Letting go releases the shot. The hands drift and pull harder the longer you hang, and you can't hang forever. A contest shrinks the ring; a defender in the air shrinks it more, so waiting for them to come down is a real choice. Layups and dunks have a bigger ring and less time. Misses go where the hands were off: low is short, sideways rims out that way.
- **Defense:** stay in front, hold the right stick up for hands (slower feet), square to jump (contest, block, rebound), R1 or cross to reach for a steal (miss and you are off balance), L1 to switch players.
- **Rules:** make it, lose it (the other side checks at the top). After a steal or a defensive rebound, take it back past the arc before you shoot. 2s and 3s, 14 second shot clock, game to 11, 15 or 21. No fouls, no out of bounds.
- **No stat training.** The CPU levels (Rookie, Pro, Legend) change how well it shoots, how late it reads you and how often it reaches.
- **Keyboard:** W A S D move, arrows (or I J K L) for dribble moves, hold space to shoot, E pass or steal, Q screen or switch, P or Esc pause. In the air W A S D is the guide hand and the arrows (or the mouse) the shooting hand, so a thumb can stay on space.

## Code

- `sim.js` is the game: court, rules, shots and the CPU, with no drawing or DOM. Every player is driven by an intent object each frame (from the controller, the CPU, or later another browser), which keeps the door open for online play.
- `game.js` draws the court through a small 3D camera (the broadcast view and the shooter's eyes are the same camera), reads input, plays the sounds and runs the menus.
- Saves under `jay.bucket.v1`: the last game settings and a win-loss record per setting.
