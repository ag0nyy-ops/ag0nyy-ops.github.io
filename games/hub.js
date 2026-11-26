/* jay. — © 2026 Jay — source viewable, not reusable by others (LICENSE)
   The settings panel on /games: deadzone with a live stick view and a drift measurer,
   colour vision palette, volume and reduced motion. */
import { loadSettings, saveSettings, PALETTES } from './shared/settings.js';
import { rawSticks } from './shared/input.js';

const s = loadSettings();
const $ = (id) => document.getElementById(id);
const dz = $('deadzone'), pal = $('palette'), vol = $('volume'), motion = $('motion');

pal.innerHTML = Object.entries(PALETTES).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('');
dz.value = s.deadzone; pal.value = s.palette; vol.value = s.volume; motion.value = s.reduceMotion;

function sync() {
  s.deadzone = +dz.value; s.palette = pal.value; s.volume = +vol.value; s.reduceMotion = motion.value;
  saveSettings(s);
  $('deadzone-out').textContent = Math.round(s.deadzone * 100) + '%';
  $('volume-out').textContent = Math.round(s.volume * 100) + '%';
  const p = PALETTES[s.palette];
  $('swatches').innerHTML = ['home', 'away', 'mark'].map((k) => `<span style="--c:${p[k]}">${k === 'mark' ? 'you' : k}</span>`).join('');
}
[dz, pal, vol, motion].forEach((el) => el.addEventListener('input', sync));
sync();

/* live stick view: the dashed circle is the deadzone, the dot is the raw stick */
function drawStick(canvas, [x, y]) {
  const c = canvas.getContext('2d'), w = canvas.width, r = w / 2 - 8;
  c.clearRect(0, 0, w, w);
  c.strokeStyle = 'rgba(236,236,236,.32)'; c.lineWidth = 1;
  c.beginPath(); c.arc(w / 2, w / 2, r, 0, Math.PI * 2); c.stroke();
  c.setLineDash([4, 4]); c.strokeStyle = '#ececec';
  c.beginPath(); c.arc(w / 2, w / 2, r * s.deadzone, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  const inside = Math.hypot(x, y) <= s.deadzone;
  c.fillStyle = '#ececec'; c.beginPath(); c.arc(w / 2 + x * r, w / 2 + y * r, 6, 0, Math.PI * 2);
  inside ? c.stroke() : c.fill();
}
let measuring = null;
$('measure').addEventListener('click', () => {
  measuring = { until: performance.now() + 2000, max: 0 };
  $('measure').disabled = true; $('pad-status').textContent = 'Hands off both sticks for two seconds…';
});
function loop() {
  const raw = rawSticks();
  const status = $('pad-status');
  if (raw) {
    drawStick($('stick-l'), raw.l); drawStick($('stick-r'), raw.r);
    if (measuring) {
      measuring.max = Math.max(measuring.max, Math.hypot(...raw.l), Math.hypot(...raw.r));
      if (performance.now() > measuring.until) {
        const next = Math.min(0.5, Math.max(0.05, measuring.max * 1.25 + 0.02));
        dz.value = next.toFixed(2); sync();
        status.textContent = `Drift measured at ${Math.round(measuring.max * 100)}%. Deadzone set to ${Math.round(next * 100)}%.`;
        measuring = null; $('measure').disabled = false;
      }
    } else {
      status.textContent = `Connected: ${raw.id.replace(/\s*\(.*$/, '').slice(0, 48)}`;
      $('measure').disabled = false;
    }
  } else {
    drawStick($('stick-l'), [0, 0]); drawStick($('stick-r'), [0, 0]);
  }
  requestAnimationFrame(loop);
}
loop();
