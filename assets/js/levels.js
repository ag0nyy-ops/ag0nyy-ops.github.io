/* jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable (LICENSE)

   Commission cards.
   1. Opening a card shoves the other cards on its row off the screen sideways, one after
      another like a pile-up, then the card widens into the gap. Cards on other rows stay put.
      Closing runs it backwards.
   2. Inside an open card the levels are tabs: click one and the box swaps to that level's
      info (Quick fix -> Support plan), sliding in from the side.

   3. Every card has a grip tab on top: drag a card anywhere on the page and the cards it hits get
      knocked around, then they all spring back home (assets/js/wall.js, same as the big wall).

   It only adds motion and tabs. Without this script each card is still a plain <details>
   dropdown that lists its levels. Nothing here can make the page scroll sideways: the page
   clips horizontal overflow and cards leave by transform only. The animation always plays,
   even with "reduce motion" turned on, because it only ever runs after a click. */
(() => {
  'use strict';
  const section = document.getElementById('wants');
  if (!section) return;

  const root = document.documentElement;
  const cards = [...section.querySelectorAll('.want')];
  root.classList.add('js-levels');

  let busy = false;

  /* the grip tab on top of every card, and the physics that goes with it */
  cards.forEach((card) => {
    const grip = document.createElement('div'); grip.className = 'thing__grip'; grip.setAttribute('aria-hidden', 'true');
    grip.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    card.prepend(grip);
  });
  const wall = window.JayWall ? window.JayWall(section, { items: () => cards.filter((c) => !c.hidden), busy: () => busy }) : null;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rect = (el) => el.getBoundingClientRect();
  const done = (anims) => Promise.all(anims.map((a) => a.finished.catch(() => {})));
  const EASE = 'cubic-bezier(.22,1,.36,1)';

  /* the cards to shove: by default the ones on the same row as `card` (same top edge), or only
     those in `only`. Nearest first, each with the side it goes to: left of the card goes left,
     right of it goes right. */
  function others(card, only) {
    const c = rect(card), cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    return cards.filter((o) => o !== card && !o.hidden && (only ? only.has(o) : Math.abs(rect(o).top - c.top) < 8))
      .map((el) => {
        const r = rect(el), ox = r.left + r.width / 2, oy = r.top + r.height / 2;
        const dir = ox < cx ? -1 : 1;
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

  /* ---------------- the level tabs ---------------- */
  const tabState = new Map();

  function buildTabs(card) {
    const d = card.querySelector('.want__d');
    const levels = [...d.querySelectorAll('.levels > .level')];
    if (!levels.length) return;
    const ui = document.createElement('div'); ui.className = 'level-ui';
    const tablist = document.createElement('div'); tablist.className = 'level-tabs'; tablist.setAttribute('role', 'tablist');
    const frame = document.createElement('div'); frame.className = 'level-panel'; frame.setAttribute('role', 'tabpanel');
    const inner = document.createElement('div'); inner.className = 'level-panel__inner';
    frame.append(inner);

    const tabs = levels.map((lv, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'level-tab'; b.setAttribute('role', 'tab');
      b.append(lv.querySelector('.level__name').cloneNode(true), lv.querySelector('.level__price').cloneNode(true));
      b.addEventListener('click', () => select(card, i));
      b.addEventListener('keydown', (e) => {
        const n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!n) return;
        e.preventDefault();
        const j = (i + n + levels.length) % levels.length;
        tabState.get(card).tabs[j].focus(); select(card, j);
      });
      tablist.append(b);
      return b;
    });
    ui.append(tablist, frame);
    d.insertBefore(ui, d.querySelector('.levels'));
    tabState.set(card, { levels, tabs, inner, frame, i: -1, swapping: false });
    select(card, 0, false);
  }

  // the box shows one level's info: name and price, what you get, who it's for, the DM button
  function render(st, i) {
    const lv = st.levels[i];
    const head = document.createElement('div'); head.className = 'level__head';
    const name = document.createElement('span'); name.className = 'level__title';
    name.textContent = lv.querySelector('.level__name').textContent.replace(/^\d+/, '');
    head.append(name, lv.querySelector('.level__price').cloneNode(true));
    st.inner.replaceChildren(head, ...[...lv.querySelector('.level__body').cloneNode(true).children]);
  }

  async function select(card, i, animate = true) {
    const st = tabState.get(card);
    if (!st || st.swapping || st.i === i) return;
    const dir = i > st.i ? 1 : -1;
    st.tabs.forEach((b, j) => { b.setAttribute('aria-selected', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    if (!animate || st.i < 0) { render(st, i); st.i = i; return; }

    st.swapping = true;
    const h0 = st.frame.offsetHeight;
    // the old info is pushed out to the side, the new info slides in from the other side
    await st.inner.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dir * 36}px)` }],
      { duration: 150, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
    render(st, i); st.i = i;
    const h1 = st.frame.offsetHeight;
    st.inner.getAnimations().forEach((a) => a.cancel());
    const moves = [st.inner.animate([{ opacity: 0, transform: `translateX(${dir * 36}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 260, easing: EASE })];
    if (h0 !== h1) moves.push(st.frame.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 260, easing: EASE }));
    await done(moves);
    st.swapping = false;
  }

  /* ---------------- open / close ---------------- */
  async function open(card) {
    const d = card.querySelector('.want__d');
    const movers = others(card);
    card._pushed = new Set(movers.map((m) => m.el));
    root.style.overflowAnchor = 'none';

    if (movers.length) {
      // the impact: the card takes a hit as the others on its row are knocked away
      card.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }],
        { duration: 300, delay: 40, easing: 'ease-out' });
      const out = movers.map((m, i) => m.el.animate(
        [{ transform: 'none' }, { transform: offscreen(m, i) }],
        { duration: 380, delay: Math.min(i * 22, 110), easing: 'cubic-bezier(.6,.05,.9,.5)', fill: 'forwards' }));
      await done(out);
      movers.forEach((m) => { m.el.hidden = true; });
      out.forEach((a) => a.cancel());
    }

    // the card widens into the gap and its levels unfold
    const old = rect(card);
    card.classList.add('is-open'); d.open = true;
    const now = rect(card);
    card.style.justifySelf = 'start';
    const flip = card.animate([
      { width: old.width + 'px', transform: `translate(${old.left - now.left}px, ${old.top - now.top}px)` },
      { width: now.width + 'px', transform: 'none' },
    ], { duration: 440, easing: EASE });
    await done([flip]);
    card.style.justifySelf = '';
    root.style.overflowAnchor = '';
    settle(card);
  }

  async function close(card) {
    const d = card.querySelector('.want__d');
    d.open = false;                  // the levels fold up first, still wide
    await wait(440);
    root.style.overflowAnchor = 'none';
    const old = rect(card);
    card.classList.remove('is-open');
    const pushed = card._pushed || new Set();
    pushed.forEach((o) => { o.hidden = false; });
    const now = rect(card);
    const movers = others(card, pushed);
    select(card, 0, false);

    // the others on the row drive back in from the sides, nearest first
    const back = movers.map((m, i) => m.el.animate(
      [{ transform: offscreen(m, i) }, { transform: 'none' }],
      { duration: 460, delay: Math.min(i * 22, 110), easing: 'cubic-bezier(.1,.6,.3,1)', fill: 'backwards' }));
    card.style.justifySelf = 'start';
    const flip = card.animate([
      { width: old.width + 'px', transform: `translate(${old.left - now.left}px, ${old.top - now.top}px)` },
      { width: now.width + 'px', transform: 'none' },
    ], { duration: 440, easing: EASE });
    await done([flip, ...back]);
    card.style.justifySelf = '';
    root.style.overflowAnchor = '';
    card._pushed = null;
    settle(card);
  }

  async function toggle(card) {
    if (busy) return;
    if (wall) wall.settle();         // cards that are still springing home snap back before the layout changes
    busy = true;
    try { await (card.classList.contains('is-open') ? close(card) : open(card)); }
    finally { busy = false; if (wall) wall.refresh(); }
  }

  cards.filter((c) => c.classList.contains('want--levels')).forEach((card) => {
    buildTabs(card);
    card.querySelector('.want__d > summary').addEventListener('click', (e) => { e.preventDefault(); toggle(card); });
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const card = section.querySelector('.want.is-open');
    if (card) toggle(card);
  });
})();
