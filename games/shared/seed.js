/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   Seeded CPU players ("dummies"), the same way Folkstyle rolls its wrestlers.
   Every dummy gets a fresh 32-bit seed. The seed feeds a small random generator and every
   personality number is drawn from it in a fixed order, so the same seed always makes the same
   player. There is no stat training: variety comes only from the seed, never from grinding.
   The dummy keeps its own generator (R) for its in-match choices too, so it plays the same way
   from the same seed.

   const d = makeDummy(newSeed(), { pace: [2.4, 6], reach: [0, 1] }, [['slasher', (p) => p.pace < 3]], 'all rounder');
   d.p.pace, d.style, d.tag ('3F2A'), d.R(), d.rand(a, b) */

/* mulberry32 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed() {
  try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return (Math.random() * 4294967296) >>> 0; }
}

/* the short tag shown on screen: the first 4 hex digits */
export function seedTag(seed) { return (seed >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4); }

/* ranges: { name: [lo, hi] } drawn in the order written. styles: [[label, (p) => bool], ...], first match wins. */
export function makeDummy(seed, ranges, styles = [], fallback = 'all rounder') {
  seed >>>= 0;
  const R = rng(seed), rand = (a, b) => a + (b - a) * R();
  const p = {};
  for (const [k, [lo, hi]] of Object.entries(ranges)) p[k] = rand(lo, hi);
  const hit = styles.find(([, test]) => test(p));
  return { seed, R, rand, p, style: hit ? hit[0] : fallback, tag: seedTag(seed) };
}

/* "dummy a: slasher, seed 3F2A" */
export function dummyLabel(name, d) { return `${name}: ${d.style}, seed ${d.tag}`; }
