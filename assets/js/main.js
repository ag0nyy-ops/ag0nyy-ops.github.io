/* JAY // DOSSIER: eyes, scramble, reveals, cursor.
   No dependencies. Everything that moves checks prefers-reduced-motion. */
(() => {
  'use strict';

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = motionQuery.matches;
  motionQuery.addEventListener?.('change', (e) => {
    reduceMotion = e.matches;
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
  });

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const rand = (min, max) => Math.random() * (max - min) + min;

  /* ------------------------------------------------------------------
     1. Watching eyes
     ------------------------------------------------------------------ */
  const eyesWrap = document.querySelector('.hero__eyes');
  const mainEye = eyesWrap?.querySelector('.eye--main');

  if (eyesWrap && mainEye) {
    // smaller watchers: x/y in % of hero, w in px, mobile = keep on small screens
    const minis = [
      { x: 6,  y: 14, w: 90,  mobile: true },
      { x: 44, y: 9,  w: 64 },
      { x: 30, y: 78, w: 110 },
      { x: 58, y: 84, w: 70,  mobile: true },
      { x: 88, y: 12, w: 80 },
      { x: 70, y: 70, w: 58 },
      { x: 80, y: 90, w: 54,  mobile: true },
    ];
    const small = window.innerWidth < 760;

    minis.forEach((m) => {
      if (small && !m.mobile) return;
      const clone = mainEye.cloneNode(true);
      clone.querySelector('defs')?.remove();
      clone.classList.replace('eye--main', 'eye--mini');
      clone.style.left = m.x + '%';
      clone.style.top = m.y + '%';
      clone.style.width = m.w + 'px';
      eyesWrap.appendChild(clone);
    });

    const eyes = [...eyesWrap.querySelectorAll('.eye')].map((svg) => ({
      svg,
      iris: svg.querySelector('.eye__iris'),
      rect: null,
      x: 0, y: 0,
    }));

    const measure = () => eyes.forEach((e) => { e.rect = e.svg.getBoundingClientRect(); });
    measure();
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('scroll', measure, { passive: true });

    let target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let lastInput = 0;
    const setTarget = (x, y) => { target = { x, y }; lastInput = performance.now(); };
    window.addEventListener('pointermove', (e) => setTarget(e.clientX, e.clientY), { passive: true });
    window.addEventListener('pointerdown', (e) => setTarget(e.clientX, e.clientY), { passive: true });

    // only animate while the hero is on screen
    let heroVisible = true;
    new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; })
      .observe(eyesWrap.parentElement);

    const MAX_X = 30, MAX_Y = 16; // travel in viewBox units

    const tick = (now) => {
      requestAnimationFrame(tick);
      if (!heroVisible) return;

      let tx = target.x, ty = target.y;
      if (reduceMotion) {
        tx = ty = null; // eyes rest, looking straight ahead
      } else if (now - lastInput > 4000) {
        // idle (or touch device): drift around slowly
        tx = window.innerWidth  * (0.5 + 0.4 * Math.sin(now / 2300));
        ty = window.innerHeight * (0.5 + 0.3 * Math.cos(now / 3100));
      }

      for (const e of eyes) {
        let gx = 0, gy = 0;
        if (tx !== null && e.rect) {
          const cx = e.rect.left + e.rect.width / 2;
          const cy = e.rect.top + e.rect.height / 2;
          const dx = tx - cx, dy = ty - cy;
          const a = Math.atan2(dy, dx);
          const t = Math.min(Math.hypot(dx, dy) / 350, 1);
          gx = Math.cos(a) * MAX_X * t;
          gy = Math.sin(a) * MAX_Y * t;
        }
        const k = reduceMotion ? 1 : 0.12;
        e.x += (gx - e.x) * k;
        e.y += (gy - e.y) * k;
        e.iris.setAttribute('transform', `translate(${e.x.toFixed(2)} ${e.y.toFixed(2)})`);
      }
    };
    requestAnimationFrame(tick);

    // random blinking
    const blink = (e) => {
      if (!reduceMotion && heroVisible) {
        e.svg.classList.add('is-blinking');
        setTimeout(() => e.svg.classList.remove('is-blinking'), 130);
        if (Math.random() < 0.2) {
          setTimeout(() => e.svg.classList.add('is-blinking'), 260);
          setTimeout(() => e.svg.classList.remove('is-blinking'), 390);
        }
      }
      setTimeout(() => blink(e), rand(2200, 7000));
    };
    eyes.forEach((e) => setTimeout(() => blink(e), rand(800, 4000)));
  }

  /* ------------------------------------------------------------------
     2. Scramble + glitch text
     ------------------------------------------------------------------ */
  const GLYPHS = '!<>-_\\/[]{}=+*^?#%&01▓░█';

  const scramble = (el) => {
    const final = el.dataset.text || el.textContent;
    el.dataset.text = final;
    if (reduceMotion) { el.textContent = final; return; }

    const duration = 700;
    const start = performance.now();
    const frame = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const settled = Math.floor(p * final.length);
      let out = '';
      for (let i = 0; i < final.length; i++) {
        out += i < settled || final[i] === ' '
          ? final[i]
          : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame);
      else glitchPulse(el);
    };
    requestAnimationFrame(frame);
  };

  const glitchPulse = (el) => {
    if (reduceMotion) return;
    el.classList.add('is-glitching');
    setTimeout(() => el.classList.remove('is-glitching'), 300);
  };

  // headings keep their real text for screen readers via aria-label
  document.querySelectorAll('[data-scramble]').forEach((el) => {
    el.setAttribute('aria-label', el.textContent.trim());
    el.addEventListener('mouseenter', () => scramble(el));
  });

  // hero name: occasional glitch twitch
  const heroName = document.querySelector('.hero__name [data-glitch]');
  if (heroName) {
    setTimeout(() => glitchPulse(heroName), 1200);
    setInterval(() => { if (Math.random() < 0.5) glitchPulse(heroName); }, 4500);
  }

  /* ------------------------------------------------------------------
     3. Scroll reveals
     ------------------------------------------------------------------ */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        // small stagger for siblings revealed together
        const siblings = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
        const delay = Math.min(siblings.indexOf(el), 5) * 70;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('is-in');
        el.querySelectorAll('[data-scramble]').forEach((h) => setTimeout(() => scramble(h), delay + 150));
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ------------------------------------------------------------------
     4. Custom cursor (mouse/trackpad only, never with reduced motion)
     ------------------------------------------------------------------ */
  const cursor = document.querySelector('.cursor');
  if (cursor && finePointer && !reduceMotion) {
    document.documentElement.classList.add('has-cursor');
    const dot = cursor.querySelector('.cursor__dot');
    const ring = cursor.querySelector('.cursor__ring');
    const label = cursor.querySelector('.cursor__label');
    let mx = -100, my = -100, rx = -100, ry = -100;

    window.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      cursor.classList.remove('is-hidden');
    }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));

    const follow = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);

    document.addEventListener('mouseover', (e) => {
      const hit = e.target.closest('[data-cursor], a, button');
      cursor.classList.toggle('is-hover', !!hit);
      label.textContent = hit?.closest('[data-cursor]')?.dataset.cursor || '';
    });

    // turn the custom cursor off if the user switches on reduced motion
    motionQuery.addEventListener?.('change', (e) => {
      if (e.matches) document.documentElement.classList.remove('has-cursor');
    });
  }

  /* ------------------------------------------------------------------
     5. Small stuff
     ------------------------------------------------------------------ */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const src = document.querySelector(btn.dataset.copy);
      const status = btn.parentElement.querySelector('.contact__status');
      try {
        await navigator.clipboard.writeText(src.textContent.trim());
        if (status) status.textContent = 'Copied. Send me a DM.';
      } catch {
        if (status) status.textContent = 'Copy failed. Select the handle manually.';
      }
    });
  });

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
