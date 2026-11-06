/* JAY // DOSSIER — the only JavaScript on the page.
   Rule: JS never animates anything. It only does what CSS can't:
     1. tell CSS where the cursor is            (--mx, --my on <html>)
     2. tell CSS where each eye sits            (--ex, --ey on each .eye)
     3. notice idle / away / scares             (data-idle, data-away, data-scare)
     4. same-page view transitions, copy, the right-click menu, "?" shortcut
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
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const onPointer = (e) => {
    px = e.clientX; py = e.clientY;
    // the custom ring (and hiding the native cursor) only ever switches on
    // for a real mouse; touch and pen keep the browser's default behaviour
    if (e.pointerType === 'mouse' && finePointer.matches && !('cursor' in root.dataset)) {
      root.dataset.cursor = '';
    }
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

  /* 4b. copy the Discord handle (button, the handle itself, or the menu) */
  const toast = document.querySelector('.toast');
  let toastT;
  const say = (msg) => {
    const status = document.querySelector('.contact__status');
    if (status) status.textContent = msg;
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('is-on');
      clearTimeout(toastT);
      toastT = setTimeout(() => toast.classList.remove('is-on'), 2200);
    }
  };
  const copyHandle = async () => {
    const handle = document.getElementById('discord-handle')?.textContent.trim();
    try {
      await navigator.clipboard.writeText(handle);
      say(`> copied ${handle}. send me a DM.`);
    } catch {
      say('> copy failed. select the handle and copy it manually.');
    }
  };
  document.querySelectorAll('[data-copy]').forEach((el) => {
    el.addEventListener('click', () => {
      // if they're drag-selecting the text, let them; don't hijack it
      const sel = getSelection();
      if (sel && !sel.isCollapsed && el.contains(sel.anchorNode)) return;
      copyHandle();
    });
  });

  /* 4c. right-click menu
     - only replaces the menu on a real mouse right-click, or Shift+F10 / the
       Menu key; touch long-press keeps the native behaviour
     - Shift + right-click, links, images, form fields and selected text all
       keep the browser's own menu (open in new tab, copy, Inspect…)
     - it never touches keyboard shortcuts: F12, Ctrl+Shift+I etc. aren't
       contextmenu events, so they're untouched
     - Esc and click-away are handled natively by popover="auto" */
  const ctx = document.getElementById('ctx');
  if (ctx && typeof ctx.showPopover === 'function') {
    const items = [...ctx.querySelectorAll('[role="menuitem"]')];
    let fromKeyboard = false, opener = null, leaving = false;

    // Shift+F10 and the Menu key fire a contextmenu event right after keydown
    addEventListener('keydown', (e) => {
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        fromKeyboard = true;
        setTimeout(() => { fromKeyboard = false; }, 400);
      }
    }, true);

    const isOpen = () => ctx.matches(':popover-open');
    const close = () => { if (isOpen()) ctx.hidePopover(); };

    document.addEventListener('contextmenu', (e) => {
      const kb = fromKeyboard;
      fromKeyboard = false;
      const t = e.target instanceof Element ? e.target : document.body;
      if (t.closest('#ctx')) { e.preventDefault(); return; }
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (!kb) {
        if (e.shiftKey || !finePointer.matches || e.pointerType === 'touch' || e.pointerType === 'pen') return;
        if (t.closest('a[href], img, video, pre, code')) return;
        const sel = getSelection();
        if (sel && !sel.isCollapsed && sel.toString().trim()) return;
      }
      e.preventDefault();
      opener = document.activeElement;
      leaving = false;
      ctx.showPopover();

      // position: at the cursor, or next to the focused element for keyboard
      const w = ctx.offsetWidth, h = ctx.offsetHeight;
      let x = e.clientX, y = e.clientY;
      if (kb || (x === 0 && y === 0)) {
        const anchor = opener && opener !== document.body ? opener : null;
        const r = anchor ? anchor.getBoundingClientRect() : null;
        x = r ? r.left + 8 : (innerWidth - w) / 2;
        y = r ? r.bottom + 6 : (innerHeight - h) / 2;
      }
      ctx.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px';
      ctx.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
      items[0].focus({ preventScroll: true });
    });

    // arrow-key navigation, like a real menu
    ctx.addEventListener('keydown', (e) => {
      const i = items.indexOf(document.activeElement);
      const go = (n) => { e.preventDefault(); items[(n + items.length) % items.length].focus(); };
      if (e.key === 'ArrowDown') go(i + 1);
      else if (e.key === 'ArrowUp') go(i - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(items.length - 1);
      else if (e.key === 'Tab') { e.preventDefault(); close(); }
      else if (e.key === ' ' && document.activeElement?.tagName === 'A') { e.preventDefault(); document.activeElement.click(); }
    });

    ctx.addEventListener('click', (e) => {
      const item = e.target.closest('[role="menuitem"]');
      if (!item) return;
      if (item.dataset.action === 'copy') copyHandle();
      if (item.matches('a[href^="#"]')) leaving = true;   // navigation moves focus itself
      close();
    });

    // give focus back to wherever it was when the menu opened
    ctx.addEventListener('toggle', (e) => {
      if (e.newState !== 'closed') return;
      if (!leaving && opener && opener.isConnected && (document.activeElement === document.body || ctx.contains(document.activeElement))) {
        opener.focus({ preventScroll: true });
      }
    });

    addEventListener('scroll', close, { passive: true });
    addEventListener('resize', close, { passive: true });
    // close when the tab is hidden (not on window blur: devtools and native
    // menus blur the window too, and that would slam the menu shut)
    document.addEventListener('visibilitychange', () => { if (document.hidden) close(); });
  }

  /* 4d. easter egg: "?" opens the source panel.
     Not "/": Firefox uses "/" for quick find, and we never steal browser shortcuts.
     Any modifier other than Shift (which "?" needs) means it's someone else's shortcut. */
  const source = document.getElementById('source');
  addEventListener('keydown', (e) => {
    if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    if (!source) return;
    source.open = true;
    source.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
  });
})();
