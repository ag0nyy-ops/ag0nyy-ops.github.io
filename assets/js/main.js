/* JAY // DOSSIER — the only JavaScript on the page.
   Rule: JS never animates anything. It only does what CSS can't:
     1. tell CSS where the cursor is            (--mx, --my on <html>)
     2. tell CSS where each eye sits            (--ex, --ey on each .eye)
     3. notice idle / away / scares             (data-idle, data-away, data-scare)
     4. same-page view transitions, copy button, "/" shortcut
   Everything visual lives in style.css. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const rand = (a, b) => Math.random() * (b - a) + a;
  root.classList.add('js-ok');

  /* 1. cursor → CSS (batched to one write per frame) */
  let px = innerWidth / 2, py = innerHeight * 0.42, queued = false;
  const flush = () => {
    queued = false;
    root.style.setProperty('--mx', px.toFixed(1));
    root.style.setProperty('--my', py.toFixed(1));
  };
  const onPointer = (e) => {
    px = e.clientX; py = e.clientY;
    if (!queued) { queued = true; requestAnimationFrame(flush); }
    wake();
  };
  addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('pointerdown', onPointer, { passive: true });
  flush();

  /* 2. eye centres → CSS. CSS does the atan2/hypot trigonometry itself. */
  const eyes = [...document.querySelectorAll('.eye')];
  let measuring = false;
  const measure = () => {
    measuring = false;
    for (const el of eyes) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > innerHeight + 100 || !r.width) continue;
      el.style.setProperty('--ex', (r.left + r.width / 2).toFixed(1));
      el.style.setProperty('--ey', (r.top + r.height / 2).toFixed(1));
    }
  };
  const queueMeasure = () => { if (!measuring) { measuring = true; requestAnimationFrame(measure); } };
  addEventListener('scroll', queueMeasure, { passive: true });
  addEventListener('resize', queueMeasure, { passive: true });
  measure();
  document.fonts?.ready.then(measure);
  setTimeout(measure, 1600); // after the intro lids have opened

  /* 3a. cursor left the window → everything squints */
  document.addEventListener('mouseleave', () => { root.dataset.away = ''; });
  document.addEventListener('mouseenter', () => { delete root.dataset.away; });

  /* 3b. idle: drowsy at 7s (whisper appears at a random edge), asleep at 16s */
  const whisper = document.querySelector('.whisper');
  const edges = ['right', 'left', 'bottom'];
  let drowsyT, asleepT;
  function wake() {
    if (root.dataset.idle) delete root.dataset.idle;
    clearTimeout(drowsyT); clearTimeout(asleepT);
    drowsyT = setTimeout(() => {
      if (whisper) whisper.dataset.edge = edges[(Math.random() * edges.length) | 0];
      root.dataset.idle = 'drowsy';
    }, 7000);
    asleepT = setTimeout(() => { root.dataset.idle = 'asleep'; }, 16000);
  }
  ['keydown', 'scroll', 'touchstart'].forEach((t) => addEventListener(t, wake, { passive: true }));
  wake();

  /* 3c. the stare: every so often every eye snaps to look straight at you */
  const stare = () => {
    if (!reduce.matches && !document.hidden && !root.dataset.idle) {
      root.dataset.scare = 'stare';
      setTimeout(() => { delete root.dataset.scare; }, 2600);
    }
    setTimeout(stare, rand(30000, 55000));
  };
  setTimeout(stare, rand(12000, 20000));

  /* 4a. same-page view transitions: the new section is revealed through a
     circle growing from where you clicked (CSS reads --vt-x / --vt-y) */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hash.length < 2) return;
    const target = document.querySelector(a.hash);
    if (!target) return;
    if (!document.startViewTransition || reduce.matches) return; // native smooth scroll
    e.preventDefault();
    root.style.setProperty('--vt-x', e.clientX + 'px');
    root.style.setProperty('--vt-y', e.clientY + 'px');
    document.startViewTransition(() => {
      target.scrollIntoView({ behavior: 'instant', block: 'start' });
      history.pushState(null, '', a.hash);
      target.focus({ preventScroll: true });
    });
  });

  /* 4b. copy the Discord handle */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const src = document.querySelector(btn.dataset.copy);
      const status = document.querySelector('.contact__status');
      try {
        await navigator.clipboard.writeText(src.textContent.trim());
        if (status) status.textContent = '> copied to clipboard. send me a DM.';
      } catch {
        if (status) status.textContent = '> copy failed. select the handle and copy it manually.';
      }
    });
  });

  /* 4c. easter egg: "/" opens the source panel */
  const source = document.getElementById('source');
  addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.target.closest('input, textarea, [contenteditable]')) return;
    e.preventDefault();
    if (!source) return;
    source.open = true;
    source.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
  });
})();
