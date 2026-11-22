/* jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable (LICENSE)

   Commission cards: opening one shoves the others off the screen, sideways, one after
   another like a pile-up, then the card widens into the gap and its levels unfold.
   Closing runs it backwards: the levels fold up, then the others drive back in.

   It only adds motion. Without this script (or with reduced motion) each card is still a
   plain <details> dropdown. Nothing here can make the page scroll sideways: the page clips
   horizontal overflow, and the cards leave by transform only. */
(() => {
  'use strict';
  const section = document.getElementById('wants');
  if (!section) return;

  const root = document.documentElement;
  const cards = [...section.querySelectorAll('.want')];
  const label = section.querySelector('.more__k');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.add('js-levels');

  let busy = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rect = (el) => el.getBoundingClientRect();
  const done = (anims) => Promise.all(anims.map((a) => a.finished.catch(() => {})));

  /* everything that is not `card`, nearest first, with the side it gets shoved to:
     left of the card goes left, right of it goes right, and a card directly above or
     below goes left or right depending on whether it is above or below */
  function others(card) {
    const c = rect(card), cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    return cards.filter((o) => o !== card && !o.hidden).map((el) => {
      const r = rect(el), ox = r.left + r.width / 2, oy = r.top + r.height / 2;
      const dir = Math.abs(ox - cx) < 24 ? (oy < cy ? -1 : 1) : (ox < cx ? -1 : 1);
      // far enough that the whole card is past the screen edge
      const x = dir < 0 ? -(r.right + 80) : innerWidth - r.left + 80;
      return { el, dir, x, dist: Math.hypot(ox - cx, oy - cy) };
    }).sort((a, b) => a.dist - b.dist);
  }
  const offscreen = (m, i) => `translateX(${m.x}px) rotate(${m.dir * (7 + (i % 3) * 3)}deg)`;

  function settle(card) {            // bring the card into view if the layout moved it away
    const r = rect(card);
    if (r.top < 70 || r.top > innerHeight * 0.55) scrollTo({ top: scrollY + r.top - 100, behavior: 'smooth' });
  }

  async function open(card) {
    const d = card.querySelector('.want__d');
    const movers = others(card);

    if (reduce.matches) {
      movers.forEach((m) => { m.el.hidden = true; });
      if (label) label.hidden = true;
      card.classList.add('is-open'); d.open = true;
      settle(card);
      return;
    }

    root.style.overflowAnchor = 'none';
    // the impact: the card takes a hit as the others are knocked away
    card.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }],
      { duration: 300, delay: 40, easing: 'ease-out' });
    const out = movers.map((m, i) => m.el.animate(
      [{ transform: 'none' }, { transform: offscreen(m, i) }],
      { duration: 380, delay: Math.min(i * 22, 110), easing: 'cubic-bezier(.6,.05,.9,.5)', fill: 'forwards' }));
    await done(out);

    // they are gone: take them out of the layout so the card can widen into the gap
    const old = rect(card);
    movers.forEach((m) => { m.el.hidden = true; });
    if (label) label.hidden = true;
    out.forEach((a) => a.cancel());
    card.classList.add('is-open'); d.open = true;
    const now = rect(card);

    // the card slides and widens from where it was to where it is now
    card.style.justifySelf = 'start';
    const flip = card.animate([
      { width: old.width + 'px', transform: `translate(${old.left - now.left}px, ${old.top - now.top}px)` },
      { width: now.width + 'px', transform: 'none' },
    ], { duration: 440, easing: 'cubic-bezier(.22,1,.36,1)' });
    await done([flip]);
    card.style.justifySelf = '';
    root.style.overflowAnchor = '';
    settle(card);
  }

  async function close(card) {
    const d = card.querySelector('.want__d');
    d.querySelectorAll('.level[open]').forEach((l) => { l.open = false; });

    if (reduce.matches) {
      d.open = false; card.classList.remove('is-open');
      cards.forEach((o) => { o.hidden = false; }); if (label) label.hidden = false;
      return;
    }

    d.open = false;                  // the levels fold up first (a CSS transition), still wide
    await wait(440);
    root.style.overflowAnchor = 'none';
    const old = rect(card);
    card.classList.remove('is-open');
    cards.forEach((o) => { o.hidden = false; }); if (label) label.hidden = false;
    const now = rect(card);
    const movers = others(card);

    // the others drive back in from the sides, nearest first
    const back = movers.map((m, i) => m.el.animate(
      [{ transform: offscreen(m, i) }, { transform: 'none' }],
      { duration: 460, delay: Math.min(i * 22, 110), easing: 'cubic-bezier(.1,.6,.3,1)', fill: 'backwards' }));
    card.style.justifySelf = 'start';
    const flip = card.animate([
      { width: old.width + 'px', transform: `translate(${old.left - now.left}px, ${old.top - now.top}px)` },
      { width: now.width + 'px', transform: 'none' },
    ], { duration: 440, easing: 'cubic-bezier(.22,1,.36,1)' });
    await done([flip, ...back]);
    card.style.justifySelf = '';
    root.style.overflowAnchor = '';
    settle(card);
  }

  async function toggle(card) {
    if (busy) return;
    busy = true;
    try { await (card.classList.contains('is-open') ? close(card) : open(card)); }
    finally { busy = false; }
  }

  cards.filter((c) => c.classList.contains('want--levels')).forEach((card) => {
    const summary = card.querySelector('.want__d > summary');
    summary.addEventListener('click', (e) => { e.preventDefault(); toggle(card); });
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const card = section.querySelector('.want.is-open');
    if (card) toggle(card);
  });
})();
