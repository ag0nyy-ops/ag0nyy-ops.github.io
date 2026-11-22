/* jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable (LICENSE)

   JayWall: boxes you can drag around by their top tab, with collisions.

   - Every box has a home (its place in the layout) and is tied to it by a spring.
   - Drag a box by its grip (the tab at its top) anywhere on the page. It is a heavy box: it
     pushes the boxes it hits, those get knocked along, then spring back home, and they push
     each other too.
   - Let go and the box springs home as well, still colliding, so it can never pass through
     the others.

   It's plain boxes with transforms. Boxes are kept inside the page, the page itself clips
   horizontal overflow so nothing can scroll sideways, and when nothing is moving the loop stops.

   Usage:
     JayWall(stage)                    // boxes = the stage's children with class "thing"
     JayWall(container, {              // or any boxes anywhere inside a container
       items: () => elements,          //   which boxes (called on every measure)
       handle: '.thing__grip',         //   the drag handle inside each box
       busy: () => false,              //   return true to pause measuring and dragging
     })
   Returns { refresh(), settle(), destroy(), bodies }.
     refresh() re-measure after the layout changed
     settle()  put every box back home at once, no spring                                       */
(function () {
  'use strict';

  window.JayWall = function JayWall(root, opts) {
    const o = Object.assign({
      k: 150, c: 15, bounce: 0.25, passes: 8, sub: 3, maxFling: 1400, maxSpeed: 2200,
      grabK: 1100, grabC: 66, heavy: 3, handle: '.thing__grip', busy: null,
      items: () => [...root.children].filter((e) => e.classList.contains('thing')),
    }, opts);
    let bodies = [], drag = null, raf = 0, last = 0;
    let W = 0, H = 0;                          // the page: boxes never leave it
    const pointer = { cx: 0, cy: 0 };
    const isBusy = () => !!(o.busy && o.busy());

    // where an element sits on the page, ignoring transforms (so animations can't skew it)
    function place(el) {
      let x = 0, y = 0;
      for (let e = el; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
      return [x, y];
    }

    function measure() {
      if (isBusy()) return;
      const prev = new Map(bodies.map((b) => [b.el, b]));
      const de = document.documentElement;
      W = de.clientWidth; H = Math.max(de.scrollHeight, innerHeight);
      bodies = [...o.items()].filter((el) => el.offsetParent !== null).map((el, i) => {
        const p = prev.get(el), [hx, hy] = place(el);
        return { el, hx, hy, w: el.offsetWidth, h: el.offsetHeight,
          ox: p ? p.ox : 0, oy: p ? p.oy : 0, vx: p ? p.vx : 0, vy: p ? p.vy : 0, im: 1, on: false, i };
      });
      prev.forEach((b, el) => { if (!bodies.some((x) => x.el === el)) el.style.transform = ''; });
    }

    const left = (b) => b.hx + b.ox, top = (b) => b.hy + b.oy;

    // two boxes overlap: push them apart along the shortest way out, and bounce a little
    function collide(a, b) {
      const ox = Math.min(left(a) + a.w, left(b) + b.w) - Math.max(left(a), left(b));
      const oy = Math.min(top(a) + a.h, top(b) + b.h) - Math.max(top(a), top(b));
      if (ox <= 0 || oy <= 0) return;
      const wa = a.im, wb = b.im, total = wa + wb;      // inverse masses: the held box is heavy, so it moves less
      if (ox < oy) {
        const n = left(a) + a.w / 2 < left(b) + b.w / 2 ? 1 : -1;     // direction from a to b
        a.ox -= n * ox * wa / total; b.ox += n * ox * wb / total;
        const rel = (b.vx - a.vx) * n;
        if (rel < 0) { const j = -(1 + o.bounce) * rel / total; a.vx -= j * wa * n; b.vx += j * wb * n; }
      } else {
        const n = top(a) + a.h / 2 < top(b) + b.h / 2 ? 1 : -1;
        a.oy -= n * oy * wa / total; b.oy += n * oy * wb / total;
        const rel = (b.vy - a.vy) * n;
        if (rel < 0) { const j = -(1 + o.bounce) * rel / total; a.vy -= j * wa * n; b.vy += j * wb * n; }
      }
    }

    function keepInside(b) {            // never leave the page
      const x = Math.min(Math.max(left(b), 0), Math.max(0, W - b.w));
      const y = Math.min(Math.max(top(b), 0), Math.max(0, H - b.h));
      if (x !== left(b)) { b.ox = x - b.hx; b.vx = 0; }
      if (y !== top(b)) { b.oy = y - b.hy; b.vy = 0; }
    }

    const speedCap = (b) => {            // fast boxes would skip over thin gaps, so cap the speed
      const v = Math.hypot(b.vx, b.vy);
      if (v > o.maxSpeed) { b.vx *= o.maxSpeed / v; b.vy *= o.maxSpeed / v; }
    };

    function step(dt) {
      let tx = 0, ty = 0;
      if (drag) {
        tx = pointer.cx + scrollX - drag.gx - drag.body.hx; ty = pointer.cy + scrollY - drag.gy - drag.body.hy;
        // scroll the page when you drag near its top or bottom edge
        if (pointer.cy < 70) scrollBy(0, -14); else if (pointer.cy > innerHeight - 70) scrollBy(0, 14);
      }
      for (const b of bodies) {
        if (drag && drag.body === b) {
          // the held box follows the pointer on a strong spring: it is a real, heavy box, so
          // boxes that are jammed against each other can slow it down
          b.vx += (o.grabK * (tx - b.ox) - o.grabC * b.vx) * dt;
          b.vy += (o.grabK * (ty - b.oy) - o.grabC * b.vy) * dt;
        } else {
          b.vx += (-o.k * b.ox - o.c * b.vx) * dt; b.vy += (-o.k * b.oy - o.c * b.vy) * dt;
        }
        speedCap(b);
        b.ox += b.vx * dt; b.oy += b.vy * dt;
        // boxes that are still at home can't be overlapping, so only moving ones are tested
        b.on = (drag && drag.body === b) || Math.abs(b.ox) > 0.05 || Math.abs(b.oy) > 0.05 || Math.abs(b.vx) > 0.5 || Math.abs(b.vy) > 0.5;
      }
      const act = bodies.filter((b) => b.on);
      for (let p = 0; p < o.passes; p++) {
        for (const a of act) {
          for (const b of bodies) if (b !== a && (!b.on || b.i > a.i)) collide(a, b);
        }
        for (const b of act) keepInside(b);
      }
    }

    function paint() {
      let moving = !!drag;
      for (const b of bodies) {
        const rest = Math.abs(b.ox) < 0.15 && Math.abs(b.oy) < 0.15 && Math.abs(b.vx) < 2 && Math.abs(b.vy) < 2;
        if (rest && !(drag && drag.body === b)) { if (b.ox || b.oy) { b.ox = b.oy = b.vx = b.vy = 0; b.el.style.transform = ''; } continue; }
        moving = true;
        b.el.style.transform = `translate3d(${b.ox.toFixed(2)}px, ${b.oy.toFixed(2)}px, 0)`;
      }
      return moving;
    }

    function frame(t) {
      const dt = Math.min((t - last) / 1000 || 1 / 60, 1 / 30);
      last = t;
      for (let i = 0; i < o.sub; i++) step(dt / o.sub);
      raf = paint() ? requestAnimationFrame(frame) : 0;
    }
    function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    function down(e) {
      if (isBusy()) return;
      const grip = e.target.closest(o.handle);
      if (!grip || e.button > 0) return;
      measure();                          // the page may have changed since the last measure
      const body = bodies.find((b) => b.el.contains(grip));
      if (!body) return;
      e.preventDefault();
      pointer.cx = e.clientX; pointer.cy = e.clientY;
      drag = { body, gx: e.clientX + scrollX - left(body), gy: e.clientY + scrollY - top(body), id: e.pointerId };
      body.im = 1 / o.heavy;
      body.el.classList.add('is-dragging');
      grip.setPointerCapture(e.pointerId);
      wake();
    }
    function move(e) { if (drag && e.pointerId === drag.id) { pointer.cx = e.clientX; pointer.cy = e.clientY; } }
    function up(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const b = drag.body;
      const cap = (v) => Math.max(-o.maxFling, Math.min(o.maxFling, v));
      b.vx = cap(b.vx); b.vy = cap(b.vy);           // a flick keeps its speed, then the home spring takes over
      b.im = 1;                                      // and it is an ordinary box again
      b.el.classList.remove('is-dragging');
      drag = null;
      wake();
    }

    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    const ro = new ResizeObserver(() => { measure(); wake(); });
    ro.observe(root);
    measure();

    return {
      refresh() { measure(); wake(); },
      settle() {
        if (drag) { drag.body.el.classList.remove('is-dragging'); drag = null; }
        cancelAnimationFrame(raf); raf = 0;
        bodies.forEach((b) => { b.ox = b.oy = b.vx = b.vy = 0; b.im = 1; b.el.style.transform = ''; });
      },
      destroy() {
        cancelAnimationFrame(raf); raf = 0; ro.disconnect();
        root.removeEventListener('pointerdown', down); root.removeEventListener('pointermove', move);
        root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', up);
        bodies.forEach((b) => { b.el.style.transform = ''; b.el.classList.remove('is-dragging'); });
      },
      get bodies() { return bodies; },
    };
  };
})();
