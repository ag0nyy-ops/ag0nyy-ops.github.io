/* jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable (LICENSE)

   JayWall: boxes you can drag around by their top tab, with collisions.

   - Every box has a home (its place in the grid) and is tied to it by a spring.
   - Drag a box by its grip (the tab at its top) and it pushes the boxes it hits. Those get
     knocked along, then spring back home, and they push each other too.
   - Let go and the box springs home as well, still colliding, so it can never pass through
     the others.

   It's plain boxes with transforms: the stage clips its edge so nothing can scroll sideways,
   and every box is kept inside the stage. When nothing is moving the loop stops.

   Usage:  const wall = JayWall(stageElement);   // boxes = children with class "thing",
           the drag handle inside each = class "thing__grip"
           wall.refresh()  // re-measure after the layout changed
           wall.destroy()                                                                   */
(function () {
  'use strict';

  window.JayWall = function JayWall(stage, opts) {
    const o = Object.assign({ k: 150, c: 15, bounce: 0.25, passes: 8, sub: 2, maxFling: 1400, grabK: 1100, grabC: 66, heavy: 3 }, opts);
    let bodies = [], drag = null, raf = 0, last = 0;
    let W = 0, H = 0;
    const pointer = { x: 0, y: 0, cx: 0, cy: 0 };

    function measure() {
      const prev = new Map(bodies.map((b) => [b.el, b]));
      W = stage.clientWidth; H = stage.clientHeight;
      bodies = [...stage.children].filter((e) => e.classList.contains('thing')).map((el) => {
        const p = prev.get(el);
        return { el, hx: el.offsetLeft, hy: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight,
          ox: p ? p.ox : 0, oy: p ? p.oy : 0, vx: p ? p.vx : 0, vy: p ? p.vy : 0, im: 1 };
      });
    }

    const left = (b) => b.hx + b.ox, top = (b) => b.hy + b.oy;

    // two boxes overlap: push them apart along the shortest way out, and bounce a little
    function collide(a, b) {
      const ox = Math.min(left(a) + a.w, left(b) + b.w) - Math.max(left(a), left(b));
      const oy = Math.min(top(a) + a.h, top(b) + b.h) - Math.max(top(a), top(b));
      if (ox <= 0 || oy <= 0) return;
      const wa = a.im, wb = b.im;       // inverse masses: the held box is heavy, so it moves less
      const total = wa + wb;
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

    function keepInside(b) {            // never leave the stage
      const x = Math.min(Math.max(left(b), 0), Math.max(0, W - b.w));
      const y = Math.min(Math.max(top(b), 0), Math.max(0, H - b.h));
      if (x !== left(b)) { b.ox = x - b.hx; b.vx = 0; }
      if (y !== top(b)) { b.oy = y - b.hy; b.vy = 0; }
    }

    function step(dt) {
      let tx = 0, ty = 0;
      if (drag) {
        const s = stage.getBoundingClientRect();
        pointer.x = pointer.cx - s.left; pointer.y = pointer.cy - s.top;
        tx = pointer.x - drag.gx - drag.body.hx; ty = pointer.y - drag.gy - drag.body.hy;
        // scroll the page when you drag near its top or bottom edge
        if (pointer.cy < 70) scrollBy(0, -14); else if (pointer.cy > innerHeight - 70) scrollBy(0, 14);
      }
      for (const b of bodies) {
        if (drag && drag.body === b) {
          // the held box follows the pointer on a strong spring: it is a real, heavy box, so
          // boxes that are jammed against the wall or each other can stop it
          b.vx += (o.grabK * (tx - b.ox) - o.grabC * b.vx) * dt;
          b.vy += (o.grabK * (ty - b.oy) - o.grabC * b.vy) * dt;
        } else {
          b.vx += (-o.k * b.ox - o.c * b.vx) * dt; b.vy += (-o.k * b.oy - o.c * b.vy) * dt;
        }
        b.ox += b.vx * dt; b.oy += b.vy * dt;
      }
      for (let p = 0; p < o.passes; p++) {
        for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) collide(bodies[i], bodies[j]);
        for (const b of bodies) keepInside(b);
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
      const grip = e.target.closest('.thing__grip');
      if (!grip || e.button > 0) return;
      const body = bodies.find((b) => b.el === grip.closest('.thing'));
      if (!body) return;
      e.preventDefault();
      const s = stage.getBoundingClientRect();
      pointer.cx = e.clientX; pointer.cy = e.clientY;
      drag = { body, gx: e.clientX - s.left - left(body), gy: e.clientY - s.top - top(body), id: e.pointerId };
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

    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    const ro = new ResizeObserver(() => { measure(); wake(); });
    ro.observe(stage);
    measure();

    return {
      refresh() { measure(); wake(); },
      destroy() {
        cancelAnimationFrame(raf); raf = 0; ro.disconnect();
        stage.removeEventListener('pointerdown', down); stage.removeEventListener('pointermove', move);
        stage.removeEventListener('pointerup', up); stage.removeEventListener('pointercancel', up);
        bodies.forEach((b) => { b.el.style.transform = ''; });
      },
      get bodies() { return bodies; },
    };
  };
})();
