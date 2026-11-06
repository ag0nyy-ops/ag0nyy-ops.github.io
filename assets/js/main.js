/* JAY // DOSSIER
   intro · watching eyes · scramble/glitch · reveals · cursor · preview · magnetic
   No dependencies. Everything that moves checks prefers-reduced-motion. */
(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js-ok'); // tells the inline failsafe in index.html we're alive
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
      root.classList.remove('has-cursor');
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    }
  });

  /* shared pointer state */
  const ptr = { x: innerWidth / 2, y: innerHeight / 2, last: -1e9, hot: false };
  const onPtr = (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.last = performance.now(); };
  addEventListener('pointermove', onPtr, { passive: true });
  addEventListener('pointerdown', onPtr, { passive: true });
  document.addEventListener('mouseover', (e) => { ptr.hot = !!e.target.closest('a, button, [data-cursor]'); });

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

  /* ------------------------------------------------------------------
     2. Watching eyes
     Real eyelids: the upper/lower lid curves, aperture clip and lashes are
     regenerated from one "openness" value (0 closed, 1 open, >1 wide) that
     runs on a spring, with blinks layered on top.
     ------------------------------------------------------------------ */
  const mainEye = document.querySelector('.eye--main');
  const eyes = [];
  let away = false;
  document.addEventListener('mouseleave', () => { away = true; });
  document.addEventListener('mouseenter', () => { away = false; });

  let introEnd = Infinity;
  introDone.then(() => { introEnd = performance.now(); });

  const LASH_T = [0.14, 0.3, 0.5, 0.7, 0.86];
  const LASH_L = [8, 11, 13, 11, 8];
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // lid geometry for a given openness (o >= 0)
  const shape = (o) => {
    const cu = 100 - 114 * o;              // upper lid control point: 100 closed -> -14 open
    const cl = 100 + 34 * o;               // lower lid control point: 100 closed -> 134 open
    const c = clamp(1 - o, 0, 1);          // closedness, for the lashes
    let lash = '';
    for (let i = 0; i < LASH_T.length; i++) {
      const t = LASH_T[i], mt = 1 - t;
      const px = mt * mt * 8 + 2 * mt * t * 100 + t * t * 192;
      const py = mt * mt * 60 + 2 * mt * t * cu + t * t * 60;
      const tx = 184;                      // dx/dt is constant for this curve
      const ty = 2 * mt * (cu - 60) + 2 * t * (60 - cu);
      let nx = ty, ny = -tx;
      let len = Math.hypot(nx, ny); nx /= len; ny /= len;
      nx = lerp(nx, nx * 0.4, c); ny = lerp(ny, 0.9, c);   // lashes droop as the lid closes
      len = Math.hypot(nx, ny); nx /= len; ny /= len;
      const L = LASH_L[i];
      lash += `M${px.toFixed(1)} ${py.toFixed(1)}l${(nx * L).toFixed(1)} ${(ny * L).toFixed(1)}`;
    }
    return {
      aperture: `M8 60 Q100 ${cu.toFixed(2)} 192 60 Q100 ${cl.toFixed(2)} 8 60Z`,
      upper: `M8 60 Q100 ${cu.toFixed(2)} 192 60`,
      lower: `M8 60 Q100 ${cl.toFixed(2)} 192 60`,
      crease: `M24 ${(54 - 6 * o).toFixed(2)} Q100 ${(cu - 16 * o).toFixed(2)} 176 ${(54 - 6 * o).toFixed(2)}`,
      lash,
    };
  };

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
      // every eye needs its own clipPath id
      const id = 'eye-clip-' + n;
      svg.querySelector('clipPath').id = id;
      svg.querySelector('.eye__inner').setAttribute('clip-path', `url(#${id})`);
      eyes.push({
        svg,
        main: svg.classList.contains('eye--main'),
        iris: svg.querySelector('.eye__iris'),
        rays: svg.querySelector('.eye__rays'),
        pupil: svg.querySelector('.eye__pupil'),
        el: {
          aperture: svg.querySelector('.eye__aperture'),
          fill: svg.querySelector('.eye__fill'),
          upper: svg.querySelector('.eye__lid--upper'),
          lower: svg.querySelector('.eye__lid--lower'),
          crease: svg.querySelector('.eye__crease'),
          lash: svg.querySelector('.eye__lash'),
        },
        x: 0, y: 0, r: 11, rot: rand(0, 360), seed: n * 1.7, visible: true,
        o: reduce ? 1 : 0, v: 0, drawn: -1,
        openDelay: svg.classList.contains('eye--main') ? 150 : rand(300, 1400),
        blinkAt: -1, fearUntil: 0,
      });
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const e = eyes.find((o) => o.svg === en.target);
        if (e) e.visible = en.isIntersecting;
      });
    });
    eyes.forEach((e) => io.observe(e.svg));

    const draw = (e, o) => {
      const g = shape(Math.max(0, o));
      e.el.aperture.setAttribute('d', g.aperture);
      e.el.fill.setAttribute('d', g.aperture);
      e.el.upper.setAttribute('d', g.upper);
      e.el.lower.setAttribute('d', g.lower);
      e.el.crease.setAttribute('d', g.crease);
      e.el.lash.setAttribute('d', g.lash);
      e.drawn = o;
    };

    // blink curve: fast close, tiny hold, slower open
    const blinkAmount = (e, now) => {
      if (e.blinkAt < 0) return 0;
      const t = now - e.blinkAt;
      if (t < 0) return 0;
      if (t < 75) return Math.pow(t / 75, 2);
      if (t < 115) return 1;
      if (t < 300) return 1 - easeOut((t - 115) / 185);
      e.blinkAt = -1;
      return 0;
    };
    const blink = (e, delay = 0) => { e.blinkAt = performance.now() + delay; };

    const MAX_X = 30, MAX_Y = 16;
    let wasAsleep = false;

    const tick = (now) => {
      requestAnimationFrame(tick);
      const idleFor = now - ptr.last;
      const asleep = idleFor > 16000 && !reduce;
      const drowsy = idleFor > 7000;

      // waking up from a nap: everybody startles
      if (wasAsleep && !asleep) eyes.forEach((e) => { e.v += 0.32; e.fearUntil = now + 700; blink(e, 450); });
      wasAsleep = asleep;

      for (const e of eyes) {
        if (!e.visible) continue;

        if (reduce) {
          if (e.drawn !== 1) { e.o = 1; e.v = 0; draw(e, 1); }
          e.iris.setAttribute('transform', 'translate(0 0)');
          continue;
        }

        // where to look
        let tx = ptr.x, ty = ptr.y;
        if (idleFor > 3500) {
          tx = innerWidth * (0.5 + 0.42 * Math.sin(now / 2100 + e.seed));
          ty = innerHeight * (0.5 + 0.35 * Math.cos(now / 2900 + e.seed));
        }
        const rc = e.svg.getBoundingClientRect();
        const dx = tx - (rc.left + rc.width / 2);
        const dy = ty - (rc.top + rc.height / 2);
        const a = Math.atan2(dy, dx);
        const reach = Math.min(Math.hypot(dx, dy) / (rc.width + 160), 1);
        let gx = Math.cos(a) * MAX_X * reach;
        let gy = Math.sin(a) * MAX_Y * reach;
        if (asleep) { gx = 0; gy = 10; }

        // how open the eye wants to be
        let target = 1;
        if (now < introEnd + e.openDelay) target = 0;
        else if (asleep) target = 0;
        else if (drowsy) target = 0.5 + 0.07 * Math.sin(now / 650 + e.seed);
        else if (away) target = 0.38;
        else if (ptr.hot) target = 1.14;

        // spring: overshoots a little when snapping open
        e.v += (target - e.o) * 0.085;
        e.v *= 0.76;
        e.o += e.v;

        const open = Math.max(0, e.o) * (1 - blinkAmount(e, now));
        if (Math.abs(open - e.drawn) > 0.002) draw(e, open);

        // pupil: dilates near clickable things, pinpoints when startled
        const pr = now < e.fearUntil ? 6.5 : ptr.hot && !drowsy ? 16 : 11;
        e.x = lerp(e.x, gx, 0.1);
        e.y = lerp(e.y, gy, 0.1);
        e.r = lerp(e.r, pr, 0.14);
        e.rot += 0.04;
        e.iris.setAttribute('transform', `translate(${e.x.toFixed(2)} ${e.y.toFixed(2)})`);
        e.pupil.setAttribute('r', e.r.toFixed(2));
        e.rays?.setAttribute('transform', `rotate(${e.rot.toFixed(2)} 100 60)`);
      }
    };
    requestAnimationFrame(tick);

    const awake = () => !reduce && performance.now() > introEnd + 1500 && performance.now() - ptr.last < 16000;

    // each eye blinks on its own rhythm, sometimes twice
    const blinkLoop = (e) => {
      if (awake() && e.visible) {
        blink(e);
        if (Math.random() < 0.22) blink(e, 340);
      }
      setTimeout(() => blinkLoop(e), rand(2600, 7200));
    };
    eyes.forEach((e) => setTimeout(() => blinkLoop(e), rand(2000, 5000)));

    // every so often they all blink at once. creepy on purpose.
    const syncBlink = () => {
      if (awake()) eyes.forEach((e) => blink(e));
      setTimeout(syncBlink, rand(15000, 28000));
    };
    setTimeout(syncBlink, rand(9000, 15000));

    eyes.flinch = () => eyes.forEach((e) => { e.v += 0.28; e.fearUntil = performance.now() + 600; blink(e, 160); });
  }

  /* ------------------------------------------------------------------
     2b. Jolts + signal interference
     ------------------------------------------------------------------ */
  const staticEl = document.querySelector('.static');
  const jolt = () => {
    if (reduce) return;
    root.classList.remove('is-jolt');
    void root.offsetWidth; // restart the animation
    root.classList.add('is-jolt');
    setTimeout(() => root.classList.remove('is-jolt'), 450);
  };
  const interfere = () => {
    if (reduce || document.hidden || !staticEl || root.classList.contains('intro-playing')) return;
    let frames = 0;
    const paint = () => {
      const bars = [];
      const n = 3 + ((Math.random() * 5) | 0);
      for (let i = 0; i < n; i++) {
        const top = Math.random() * 100;
        const h = Math.random() * (i ? 2.5 : 8) + 0.25;
        bars.push(`linear-gradient(#fff, #fff) 0 ${top.toFixed(1)}% / 100% ${h.toFixed(2)}% no-repeat`);
      }
      staticEl.style.background = bars.join(', ');
      staticEl.style.transform = `translateX(${(Math.random() * 18 - 9).toFixed(1)}px)`;
    };
    root.classList.add('is-interference');
    const step = () => {
      paint();
      if (++frames < 5) setTimeout(step, 40 + Math.random() * 45);
      else { root.classList.remove('is-interference'); staticEl.style.background = ''; }
    };
    step();
    const name = document.querySelector('.hero__name [data-glitch]');
    if (name) { name.classList.add('is-glitching'); setTimeout(() => name.classList.remove('is-glitching'), 320); }
  };
  const scheduleInterference = () => setTimeout(() => { interfere(); scheduleInterference(); }, rand(13000, 26000));
  scheduleInterference();

  // click on empty space: the page flinches, and so do they
  addEventListener('click', (ev) => {
    if (reduce || ev.target.closest('a, button, input, [data-cursor], .redacted')) return;
    jolt();
    if (Math.random() < 0.5) setTimeout(interfere, 60);
    eyes.flinch?.();
  });

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
