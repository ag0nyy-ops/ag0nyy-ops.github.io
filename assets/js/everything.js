/* jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable (LICENSE)

   "I want to see EVERYTHING you can do": the button at the end of the commissions page.
   Click it and 100 boxes fade in (assets/data/everything.js), each one a real thing with its
   own level and price. Drag any box by its top tab: it shoves the others, which spring back
   home (assets/js/wall.js). Click again to hide them. The fade always plays, even with
   reduce-motion on, because it only runs after a click. */
(() => {
  'use strict';
  const data = window.EVERYTHING;
  const section = document.getElementById('everything');
  if (!data || !section || !window.JayWall) return;

  const btn = section.querySelector('.everything__btn');
  const stage = section.querySelector('.everything__stage');
  const note = section.querySelector('.everything__note');
  const P = window.PRICES || { currency: '$', label: 'from' };
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  let wall = null, built = false, busy = false;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function build() {
    stage.replaceChildren(...data.items.map(([cat, level, title, line, price, per, flags = '']) => {
      const c = data.cats[cat];
      const box = el('article', 'thing');
      const grip = el('div', 'thing__grip'); grip.setAttribute('aria-hidden', 'true');
      grip.append(el('i'), el('i'), el('i'));
      const body = el('div', 'thing__body');
      const foot = el('div', 'thing__foot');
      const tag = el('span', 'thing__tag', flags.includes('b') ? 'built it before' : flags.includes('y') ? 'yes or no first' : '');
      if (flags.includes('b')) tag.classList.add('thing__tag--built');
      foot.append(el('b', 'thing__price', `${P.label} ${P.currency}${price}${per || ''}`), tag);
      body.append(el('p', 'thing__cat', `${c.name} · Level ${level} · ${c.levels[level - 1]}`), el('h3', 'thing__title', title), el('p', 'thing__line', line), foot);
      box.append(grip, body);
      return box;
    }));
    built = true;
  }

  async function show() {
    if (!built) build();
    stage.hidden = false;
    wall = window.JayWall(stage);
    const boxes = [...stage.children];
    // fade in, a few at a time (opacity + the separate `translate` property, so the physics transform stays free)
    const fades = boxes.map((b, i) => b.animate(
      [{ opacity: 0, translate: '0 16px' }, { opacity: 1, translate: '0 0' }],
      { duration: 520, delay: Math.min(i * 14, 1200), easing: EASE, fill: 'backwards' }));
    btn.textContent = 'Hide everything';
    btn.setAttribute('aria-expanded', 'true');
    scrollTo({ top: scrollY + stage.getBoundingClientRect().top - 110, behavior: 'smooth' });
    await Promise.all(fades.map((a) => a.finished.catch(() => {})));
    wall.refresh();
  }

  async function hide() {
    const fades = [...stage.children].map((b, i) => b.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: 260, delay: Math.min(i * 4, 300), easing: 'ease-in', fill: 'forwards' }));
    btn.textContent = 'I want to see EVERYTHING you can do';
    btn.setAttribute('aria-expanded', 'false');
    await Promise.all(fades.map((a) => a.finished.catch(() => {})));
    if (wall) { wall.destroy(); wall = null; }
    stage.hidden = true;
    fades.forEach((a) => a.cancel());
  }

  btn.hidden = false;
  if (note) note.hidden = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    try { await (stage.hidden ? show() : hide()); } finally { busy = false; }
  });
})();
