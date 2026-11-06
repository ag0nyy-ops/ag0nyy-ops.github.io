/* JAY // DOSSIER
   intro · watching eyes · scramble/glitch · reveals · cursor · preview · magnetic
   No dependencies. Everything that moves checks prefers-reduced-motion. */
(() => {
  'use strict';

  const root = document.documentElement;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = motionQuery.matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => Math.random() * (b - a) + a;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  motionQuery.addEventListener?.('change', (e) => {
    reduce = e.matches;
    if (reduce) {
      root.classList.remove('has-cursor', 'is-away');
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    }
  });

  /* shared pointer state */
  const ptr = { x: innerWidth / 2, y: innerHeight / 2, last: -1e9, hot: false };
  const onPtr = (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.last = performance.now(); };
  addEventListener('pointermove', onPtr, { passive: true });
  addEventListener('pointerdown', onPtr, { passive: true });
  document.addEventListener('mouseover', (e) => { ptr.hot = !!e.target.closest('a, button, [data-cursor]'); });
  document.addEventListener('mouseleave', () => { if (!reduce && fine) root.classList.add('is-away'); });
  document.addEventListener('mouseenter', () => root.classList.remove('is-away'));

  /* ------------------------------------------------------------------
     1. Boot sequence
     ------------------------------------------------------------------ */
  const intro = document.querySelector('.intro');
  const introDone = new Promise((resolve) => {
    if (!intro || root.classList.contains('no-intro')) {
      intro?.remove();
      root.classList.remove('intro-playing');
      return resolve();
    }
    const log = intro.querySelector('.intro__log');
    const lines = ['> establishing secure link', '> file located: J-018', '> subject: Jay', '> clearance: granted'];
    let i = 0, finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      intro.classList.add('is-seam');
      setTimeout(() => {
        intro.classList.add('is-open');
        root.classList.remove('intro-playing');
        try { sessionStorage.setItem('seen', '1'); } catch (e) { /* private mode */ }
        resolve();
        setTimeout(() => intro.remove(), 1200);
      }, 380);
    };
    const next = () => {
      if (finished) return;
      if (i >= lines.length) return void setTimeout(finish, 180);
      log.textContent += (i ? '\n' : '') + lines[i++];
      setTimeout(next, 200);
    };
    next();
    intro.addEventListener('click', finish);
    addEventListener('keydown', finish, { once: true });
  });
  introDone.then(() => setTimeout(() => root.classList.add('eye-ready'), 1100));

  /* ------------------------------------------------------------------
     2. Watching eyes
     ------------------------------------------------------------------ */
  const mainEye = document.querySelector('.eye--main');
  const eyes = [];

  if (mainEye) {
    // detailed iris: radial fibres
    const rays = mainEye.querySelector('.eye__rays');
    rays.textContent = '';
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      const r2 = k % 3 === 0 ? 34 : k % 3 === 1 ? 30.5 : 28;
      const l = document.createElementNS(SVGNS, 'line');
      l.setAttribute('x1', (100 + Math.cos(a) * 24.5).toFixed(2));
      l.setAttribute('y1', (60 + Math.sin(a) * 24.5).toFixed(2));
      l.setAttribute('x2', (100 + Math.cos(a) * r2).toFixed(2));
      l.setAttribute('y2', (60 + Math.sin(a) * r2).toFixed(2));
      rays.appendChild(l);
    }

    const cloneEye = (cls) => {
      const c = mainEye.cloneNode(true);
      c.querySelector('defs')?.remove();
      c.classList.replace('eye--main', cls);
      return c;
    };

    // small watchers around the hero edges
    const minis = document.querySelector('.hero__minis');
    const spots = [
      { x: 5, y: 30, w: 84, m: 1 }, { x: 22, y: 17, w: 52 }, { x: 74, y: 18, w: 60 },
      { x: 88, y: 40, w: 76, m: 1 }, { x: 64, y: 62, w: 48 }, { x: 8, y: 52, w: 46, m: 1 },
    ];
    const small = innerWidth < 760;
    spots.forEach((s) => {
      if (!minis || (small && !s.m)) return;
      const c = cloneEye('eye--mini');
      Object.assign(c.style, { left: s.x + '%', top: s.y + '%', width: s.w + 'px' });
      minis.appendChild(c);
    });

    // one more at the end of the page, watching you leave
    const footerSlot = document.querySelector('.footer__eye');
    if (footerSlot) footerSlot.appendChild(cloneEye('eye--footer'));

    document.querySelectorAll('.eye').forEach((svg, n) => {
      eyes.push({
        svg,
        iris: svg.querySelector('.eye__iris'),
        rays: svg.querySelector('.eye__rays'),
        pupil: svg.querySelector('.eye__pupil'),
        x: 0, y: 0, r: 11, rot: rand(0, 360), seed: n * 1.7, visible: true,
      });
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const e = eyes.find((o) => o.svg === en.target);
        if (e) e.visible = en.isIntersecting;
      });
    });
    eyes.forEach((e) => io.observe(e.svg));

    const MAX_X = 30, MAX_Y = 16;
    const tick = (now) => {
      requestAnimationFrame(tick);
      const idle = now - ptr.last > 3500;
      for (const e of eyes) {
        if (!e.visible) continue;
        let gx = 0, gy = 0, pr = 11;
        if (!reduce) {
          let tx = ptr.x, ty = ptr.y;
          if (idle) {
            tx = innerWidth * (0.5 + 0.42 * Math.sin(now / 2100 + e.seed));
            ty = innerHeight * (0.5 + 0.35 * Math.cos(now / 2900 + e.seed));
          }
          const rc = e.svg.getBoundingClientRect();
          const dx = tx - (rc.left + rc.width / 2);
          const dy = ty - (rc.top + rc.height / 2);
          const a = Math.atan2(dy, dx);
          const t = Math.min(Math.hypot(dx, dy) / (rc.width + 160), 1);
          gx = Math.cos(a) * MAX_X * t;
          gy = Math.sin(a) * MAX_Y * t;
          pr = ptr.hot && !idle ? 16 : 11; // dilate when you're about to click something
          e.rot += 0.04;
        }
        const k = reduce ? 1 : 0.1;
        e.x = lerp(e.x, gx, k);
        e.y = lerp(e.y, gy, k);
        e.r = lerp(e.r, pr, reduce ? 1 : 0.12);
        e.iris.setAttribute('transform', `translate(${e.x.toFixed(2)} ${e.y.toFixed(2)})`);
        e.pupil.setAttribute('r', e.r.toFixed(2));
        e.rays?.setAttribute('transform', `rotate(${e.rot.toFixed(2)} 100 60)`);
      }
    };
    requestAnimationFrame(tick);

    const blinkOnce = (e) => {
      e.svg.classList.add('is-blinking');
      setTimeout(() => e.svg.classList.remove('is-blinking'), 130);
    };
    const blinkLoop = (e) => {
      if (!reduce && e.visible && root.classList.contains('eye-ready')) {
        blinkOnce(e);
        if (Math.random() < 0.2) setTimeout(() => blinkOnce(e), 260);
      }
      setTimeout(() => blinkLoop(e), rand(2400, 7500));
    };
    eyes.forEach((e) => setTimeout(() => blinkLoop(e), rand(1500, 4500)));

    // click anywhere: everything flinches
    addEventListener('pointerdown', () => {
      if (reduce || !root.classList.contains('eye-ready')) return;
      eyes.forEach((e) => e.visible && blinkOnce(e));
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     3. Scramble + glitch
     ------------------------------------------------------------------ */
  const SYMBOLS = '!<>-_\\/[]{}=+*^?#%&01';
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  const glitchPulse = (el) => {
    if (reduce || !el.hasAttribute('data-glitch')) return;
    el.classList.add('is-glitching');
    setTimeout(() => el.classList.remove('is-glitching'), 320);
  };

  const scramble = (el) => {
    const final = el.dataset.text ?? el.textContent;
    el.dataset.text = final;
    if (reduce) { el.textContent = final; return; }
    const set = el.dataset.scramble === 'letters' ? LETTERS : SYMBOLS;
    cancelAnimationFrame(el._raf);
    const dur = Math.min(900, 280 + final.length * 45);
    const start = performance.now();
    const frame = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const settled = Math.floor(p * final.length);
      let out = '';
      for (let i = 0; i < final.length; i++) {
        const ch = final[i];
        out += i < settled || ch === ' ' ? ch : set[(Math.random() * set.length) | 0];
      }
      el.textContent = out;
      if (p < 1) el._raf = requestAnimationFrame(frame);
      else glitchPulse(el);
    };
    el._raf = requestAnimationFrame(frame);
  };

  document.querySelectorAll('[data-scramble]').forEach((el) => {
    const text = el.textContent.trim();
    if (/^H\d$/.test(el.tagName)) el.setAttribute('aria-label', text);
    const trigger = el.closest('a') || el;
    trigger.addEventListener('mouseenter', () => scramble(el));
  });

  const heroName = document.querySelector('.hero__name [data-glitch]');
  if (heroName) {
    introDone.then(() => setTimeout(() => glitchPulse(heroName), 900));
    setInterval(() => { if (Math.random() < 0.45) glitchPulse(heroName); }, 4200);
  }

  /* ------------------------------------------------------------------
     4. Scroll reveals (+ redaction wipe, heading scramble)
     ------------------------------------------------------------------ */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const sibs = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
        const delay = Math.min(Math.max(sibs.indexOf(el), 0), 4) * 80;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('is-in');
        el.querySelectorAll('[data-scramble]').forEach((h) => setTimeout(() => scramble(h), delay + 120));
        setTimeout(() => el.querySelectorAll('.redact').forEach((r) => r.classList.add('is-done')), delay + 1500);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ------------------------------------------------------------------
     5. Scroll: hero parallax, progress counter, active nav
     ------------------------------------------------------------------ */
  const stage = document.querySelector('.hero__stage');
  const progress = document.querySelector('[data-progress]');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY;
    const max = root.scrollHeight - innerHeight;
    if (progress) progress.textContent = String(Math.round(clamp(y / (max || 1), 0, 1) * 100)).padStart(3, '0');
    if (stage && !reduce && y < innerHeight * 1.3) {
      const p = y / innerHeight;
      stage.style.transform = `translate3d(0, ${(y * 0.35).toFixed(1)}px, 0) scale(${(1 + p * 0.3).toFixed(3)})`;
      stage.style.opacity = String(clamp(1 - p * 0.95, 0, 1));
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  const navLinks = [...document.querySelectorAll('.topbar__nav a')];
  const navIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.hash === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach((s) => navIO.observe(s));

  /* ------------------------------------------------------------------
     6. Cursor, magnetic buttons, project preview (mouse only)
     ------------------------------------------------------------------ */
  const cursor = document.querySelector('.cursor');
  if (cursor && fine && !reduce) {
    root.classList.add('has-cursor');
    const dot = cursor.querySelector('.cursor__dot');
    const ring = cursor.querySelector('.cursor__ring');
    const label = cursor.querySelector('.cursor__label');
    const coords = cursor.querySelector('.cursor__coords');
    let rx = -100, ry = -100;
    const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, '0');

    addEventListener('pointermove', (e) => {
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      coords.style.transform = `translate3d(${e.clientX + 16}px, ${e.clientY + 14}px, 0)`;
      coords.textContent = `x ${pad(e.clientX)} · y ${pad(e.clientY)}`;
      cursor.classList.remove('is-hidden');
    }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));

    const follow = () => {
      rx = lerp(rx, ptr.x, 0.18);
      ry = lerp(ry, ptr.y, 0.18);
      ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);

    document.addEventListener('mouseover', (e) => {
      const hit = e.target.closest('[data-cursor], a, button');
      cursor.classList.toggle('is-hover', !!hit);
      label.textContent = hit?.closest('[data-cursor]')?.dataset.cursor || '';
    });

    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${(dx * 0.25).toFixed(1)}px, ${(dy * 0.35).toFixed(1)}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });

    const preview = document.querySelector('.preview');
    if (preview) {
      let px = ptr.x, py = ptr.y;
      document.querySelectorAll('.case').forEach((c) => {
        c.addEventListener('mouseenter', () => {
          if (innerWidth <= 900) return;
          preview.innerHTML = c.querySelector('.case__media')?.innerHTML || '';
          preview.classList.add('is-on');
        });
        c.addEventListener('mouseleave', () => preview.classList.remove('is-on'));
      });
      const loop = () => {
        requestAnimationFrame(loop);
        const w = preview.offsetWidth, h = preview.offsetHeight;
        let tx = ptr.x + 32;
        if (tx + w > innerWidth - 16) tx = ptr.x - w - 32;
        const nx = lerp(px, tx, 0.16);
        const vx = nx - px;
        px = nx;
        py = lerp(py, ptr.y - h / 2, 0.16);
        preview.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotate(${clamp(vx * 0.35, -9, 9).toFixed(2)}deg)`;
      };
      requestAnimationFrame(loop);
    }
  }

  /* ------------------------------------------------------------------
     7. Small stuff
     ------------------------------------------------------------------ */
  const clock = document.querySelector('[data-clock]');
  if (clock) {
    const fmt = () => { clock.textContent = new Date().toLocaleTimeString('en-GB'); };
    fmt();
    setInterval(fmt, 1000);
  }

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

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
