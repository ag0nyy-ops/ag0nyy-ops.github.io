/* JAY // DOSSIER — the only JavaScript on the page.
   © 2026 Jay · https://ag0nyy-ops.github.io/ · source viewable, not reusable (LICENSE)
   Rule: JS never animates anything. It only does what CSS can't:
     1. tell CSS where the cursor is            (--mx, --my on <html>)
     2. tell CSS where each eye sits            (--jdx-ex, --jdx-ey on each .eye)
     3. notice idle / away / scares             (data-idle, data-away, data-scare)
     4. same-page view transitions, copy, the right-click menu, "?" shortcut
   Everything visual lives in style.css. */
(() => {
  'use strict';

  // signature for anyone who opens dev tools
  console.info(
    '%cJay%c  https://ag0nyy-ops.github.io/\nLooking at the source? Learn from it, don\u2019t lift it. Case jdx-hollow-81ca45.',
    'font: 600 16px/1.6 "UnifrakturMaguntia", serif',
    'font: 12px/1.6 "IBM Plex Mono", monospace; color: #888'
  );

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

  /* 2. eye centres → CSS. CSS does the atan2/hypot trigonometry itself.
     PERF: this used to run getBoundingClientRect() on every eye in every
     scroll frame (~2ms/frame in the profile). Now: only eyes that are on
     screen (IntersectionObserver), only once scrolling stops (scrollend, or a
     debounce where that event doesn't exist), and all reads happen before
     any writes so the browser never has to re-layout mid-loop. During the
     scroll itself the pupils simply hold their last aim. */
  const eyes = [...document.querySelectorAll('.eye')];
  const onScreen = new Set();
  const measure = () => {
    const rects = [];
    for (const el of onScreen) rects.push([el, el.getBoundingClientRect()]);   // reads…
    for (const [el, r] of rects) {                                              // …then writes
      if (!r.width) continue;
      el.style.setProperty('--jdx-ex', (r.left + r.width / 2).toFixed(1));
      el.style.setProperty('--jdx-ey', (r.top + r.height / 2).toFixed(1));
    }
  };
  if ('IntersectionObserver' in window) {
    const eyeIO = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target);
      measure();
    }, { rootMargin: '100px' });
    eyes.forEach((el) => eyeIO.observe(el));
  } else {
    eyes.forEach((el) => onScreen.add(el));
  }
  let settleT;
  if ('onscrollend' in window) addEventListener('scrollend', measure, { passive: true });
  else addEventListener('scroll', () => { clearTimeout(settleT); settleT = setTimeout(measure, 120); }, { passive: true });
  let resizeT;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(measure, 120); }, { passive: true });
  document.fonts?.ready.then(measure);
  setTimeout(measure, 1600); // after the intro lids have opened

  /* PERF: pause the time-based loops (radar, sigil, blinking, marquee…) in
     any area that's scrolled off screen. CSS reads .is-offscreen. */
  if ('IntersectionObserver' in window) {
    const areaIO = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle('is-offscreen', !e.isIntersecting);
    }, { rootMargin: '200px' });
    document.querySelectorAll('.hero, .tape, #services, .footer').forEach((el) => areaIO.observe(el));
  }

  /* 2b. scroll progress fallback. Browsers with scroll-driven animations do
     this in pure CSS (scroll(root) timeline). Others get --progress (0..1)
     and the "Declassified %" text from here, so the line and the meter
     stay in sync either way. */
  if (!(window.CSS && CSS.supports('animation-timeline: scroll()'))) {
    root.classList.add('no-sda');
    const pct = document.querySelector('.topbar__progress .pct');
    let pending = false;
    const update = () => {
      pending = false;
      const max = root.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      root.style.setProperty('--progress', p.toFixed(4));
      if (pct) pct.textContent = String(Math.round(p * 100)).padStart(2, '0') + '%';
    };
    const queue = () => { if (!pending) { pending = true; requestAnimationFrame(update); } };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue, { passive: true });
    update();
  }

  /* 2c. adaptive effects quality (full / balanced / low)
     The inline script in <head> already set a provisional data-fx from the
     URL, this visit's saved choice, or cheap hints. Here we measure real
     frame times and make the call:
       - first ~2s after load: the one moment the tier may go UP (if the
         hints were too cautious) or down
       - while scrolling: 1s windows; two windows in a row under ~45fps drop
         one tier. It never goes back up mid-visit, so it can't flap.
     A manual pick (toggle or ?fx=) switches the measuring off for the visit.
     Stored in sessionStorage only. No cookies, nothing sent anywhere. */
  const TIERS = ['low', 'balanced', 'full'];
  const LABEL = { full: 'Full', balanced: 'Limited', low: 'Min' };
  const fxState = {
    tier: root.dataset.fx || 'full',
    src: root.dataset.fxSrc || 'hints',
    fps: null,
  };
  const saveFx = () => { try { sessionStorage.setItem('fx', JSON.stringify({ tier: fxState.tier, src: fxState.src })); } catch (e) {} };
  const why = () => ({
    url: 'set by ?fx= in the address',
    manual: 'set by you',
    'reduced-motion': 'your system asks for reduced motion',
    hints: 'provisional, measuring…',
    auto: fxState.fps ? `picked automatically (measured ${Math.round(fxState.fps)} fps)` : 'picked automatically',
  })[fxState.src] || '';
  const renderFx = () => {
    root.dataset.fx = fxState.tier;
    root.dataset.fxSrc = fxState.src;
    document.querySelectorAll('[data-fx-label]').forEach((el) => { el.textContent = LABEL[fxState.tier]; });
    document.querySelectorAll('[data-fx-why]').forEach((el) => { el.textContent = `— ${why()}`; });
    const btn = document.querySelector('[data-sight]');
    if (btn) btn.setAttribute('aria-label', `Visual effects: ${LABEL[fxState.tier]}. Change`);
  };
  const setFx = (tier, src) => { fxState.tier = tier; fxState.src = src; saveFx(); renderFx(); };
  const stepDown = () => {
    const i = TIERS.indexOf(fxState.tier);
    if (i > 0) setFx(TIERS[i - 1], 'auto');
  };

  // count frames for `ms` milliseconds; resolves with fps (null if the tab was hidden)
  const measureFps = (ms) => new Promise((resolve) => {
    let frames = 0; const t0 = performance.now();
    const step = (t) => {
      if (document.hidden) return resolve(null);
      frames++;
      if (t - t0 < ms) requestAnimationFrame(step);
      else resolve((frames * 1000) / (t - t0));
    };
    requestAnimationFrame(step);
  });

  const autoFx = () => fxState.src === 'hints' || fxState.src === 'auto';
  // 1) the initial pick: only on a fresh visit (provisional "hints" tier)
  if (fxState.src === 'hints') {
    setTimeout(async () => {
      const fps = await measureFps(2000);
      if (fps == null || fxState.src !== 'hints') return;
      fxState.fps = fps;
      let i = TIERS.indexOf(fxState.tier);
      const saveData = !!(navigator.connection && navigator.connection.saveData);
      if (fps < 45) i = Math.max(0, i - 1);                                   // struggling: one step down
      else if (fps >= 55 && !saveData) i = Math.min(TIERS.length - 1, i + 1); // hints were too cautious: one step up
      setFx(TIERS[i], 'auto');
    }, 600);
  }
  // 2) while scrolling: sustained slowness drops a tier, never raises it
  let scrollSampling = false, slowWindows = 0;
  addEventListener('scroll', async () => {
    if (scrollSampling || !autoFx() || fxState.tier === 'low' || reduce.matches) return;
    scrollSampling = true;
    const fps = await measureFps(1000);
    scrollSampling = false;
    if (fps == null) return;
    fxState.fps = fps;
    slowWindows = fps < 45 ? slowWindows + 1 : 0;
    if (slowWindows >= 2) { slowWindows = 0; stepDown(); }
    else if (fxState.src === 'auto') renderFx();   // refresh the measured fps in the readout
  }, { passive: true });

  // 3) manual control: the SIGHT toggle cycles FULL → LIMITED → MIN
  const sight = document.querySelector('[data-sight]');
  if (sight) {
    sight.hidden = false;
    sight.addEventListener('click', () => {
      const order = ['full', 'balanced', 'low'];
      setFx(order[(order.indexOf(fxState.tier) + 1) % order.length], 'manual');
    });
  }
  if (fxState.src === 'url') saveFx();   // a ?fx= choice holds for the rest of the visit
  renderFx();

  /* 3a. cursor left the window → everything squints */
  document.addEventListener('mouseleave', () => { root.dataset.away = ''; });
  document.addEventListener('mouseenter', () => { delete root.dataset.away; });

  /* 3b. idle: drowsy at 7s (whisper appears at a random edge), asleep at 16s */
  const whisper = document.querySelector('.whisper');
  const edges = ['right', 'left', 'bottom'];
  let drowsyT, asleepT;
  let lastWake = 0;
  function wake() {
    // PERF: scroll/pointer fire every frame; resetting two timers that often is
    // pointless, so only do it a few times a second (unless we're idle now)
    const now = performance.now();
    if (now - lastWake < 250 && !root.dataset.idle) return;
    lastWake = now;
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
