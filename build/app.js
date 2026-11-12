/* ==========================================================================
   Site builder page: reads the form, asks SiteGen for a page, shows it,
   pitches a package, and handles "Claim this site".
   State lives in the URL hash (#s=…) so a design can be reopened exactly.
   The hash never reaches a server. Nothing leaves the browser until claim.
   ========================================================================== */
(function () {
  'use strict';
  var G = window.SiteGen, CFG = window.BUILDER_CONFIG;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var FIELDS = ['name', 'type', 'city', 'phone', 'services', 'hours', 'goals', 'tagline', 'logo'];
  var DEMO = {
    barber: 'Northside Barber Co.', salon: 'Willow & Rye Salon', beauty: 'Gloss Nail Studio', restaurant: 'Lucky Seven Kitchen',
    cafe: 'Morning Ritual Café', auto: 'Eastside Auto Care', contractor: 'Ironwood Builders', trades: 'Bright Line Electric',
    landscaping: 'Green Acre Lawn Co.', cleaning: 'Fresh Start Cleaning', fitness: 'Forge Strength Club', retail: 'Main Street Goods',
    tailor: 'Stitch & Fit Tailors', photography: 'Golden Hour Studio', pet: 'Happy Tails Grooming', other: 'Lakeside Services',
  };

  var state = { seed: G.newSeed(), vibe: 'modern', color: '', device: innerWidth < 700 ? 'phone' : 'desktop', tier: null, tierTouched: false };
  var html = '', sugg = null, timer = 0;

  /* ---------- build the form controls ---------- */
  var typeSel = $('#f-type');
  Object.keys(G.INDUSTRIES).forEach(function (k) {
    var o = document.createElement('option'); o.value = k; o.textContent = G.INDUSTRIES[k].label; typeSel.appendChild(o);
  });
  Object.keys(G.VIBES).forEach(function (k) {
    $('#vibes').insertAdjacentHTML('beforeend', '<label class="chip"><input type="radio" name="vibe" value="' + k + '"><span>' + G.VIBES[k].label + '</span></label>');
  });
  var swatch = function (k, title, bg) {
    return '<label class="sw" title="' + title + '"><input type="radio" name="color" value="' + k + '" aria-label="' + title + '"><span style="background:' + bg + '"></span></label>';
  };
  $('#colors').insertAdjacentHTML('beforeend', swatch('', 'Surprise me', 'conic-gradient(#e5484d,#f5a524,#46a758,#0090ff,#8e4ec6,#e5484d)'));
  Object.keys(G.COLORS).forEach(function (k) {
    var c = G.COLORS[k];
    $('#colors').insertAdjacentHTML('beforeend', swatch(k, k === 'mono' ? 'Black & white' : k.charAt(0).toUpperCase() + k.slice(1),
      k === 'mono' ? 'linear-gradient(135deg,#111 50%,#f2f2f2 50%)' : 'hsl(' + c.h + ' ' + c.s + '% ' + (k === 'gold' ? 50 : 44) + '%)'));
  });
  $('#care').textContent = CFG.carePlan ? 'There’s also an ' + CFG.carePlan.text + ' at ' + CFG.currency + CFG.carePlan.amount + CFG.carePlan.per + '.' : '';
  $('#claim-discord').textContent = CFG.discord || '';

  /* ---------- state <-> form <-> hash ---------- */
  function readForm() {
    var v = {};
    FIELDS.forEach(function (f) { v[f] = (document.forms.form.elements[f].value || '').trim(); });
    v.vibe = state.vibe; v.color = state.color;
    return v;
  }
  function writeForm(v) {
    FIELDS.forEach(function (f) { if (v[f] != null) document.forms.form.elements[f].value = v[f]; });
    if (v.vibe && G.VIBES[v.vibe]) state.vibe = v.vibe;
    if (v.color != null && (v.color === '' || G.COLORS[v.color])) state.color = v.color;
  }
  function syncChoices() {
    $$('input[name=vibe]').forEach(function (i) { i.checked = i.value === state.vibe; });
    $$('input[name=color]').forEach(function (i) { i.checked = i.value === state.color; });
  }
  function enc(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function dec(s) { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))); }
  function saveHash() {
    var v = readForm(), slim = {};
    Object.keys(v).forEach(function (k) { if (v[k]) slim[k] = v[k]; });
    var h = '#s=' + enc({ i: slim, s: state.seed, t: state.tierTouched ? state.tier : undefined });
    try { history.replaceState(null, '', h); } catch (e) {}
  }
  function loadHash() {
    var m = location.hash.match(/^#s=([\w-]+)/);
    if (!m) return;
    try {
      var o = dec(m[1]);
      if (o.i) writeForm(o.i);
      if (typeof o.s === 'string' && /^[\w]{3,16}$/.test(o.s)) state.seed = o.s;
      if (o.t && CFG.tiers[o.t]) { state.tier = o.t; state.tierTouched = true; }
    } catch (e) {}
  }
  function shareLink() { saveHash(); return location.href; }

  /* what actually gets rendered: your answers, or an example while the name is empty */
  function effective() {
    var v = readForm(), demo = !v.name;
    if (demo) {
      v.name = DEMO[v.type] || DEMO.other;
      v.city = v.city || 'Saint Paul, MN';
      v.phone = v.phone || '(651) 555-0123';
    }
    return { v: v, demo: demo };
  }

  /* ---------- preview ---------- */
  var iframe = $('#preview'), frame = $('#frame'), stage = $('#stage');
  function fit() {
    var W = stage.clientWidth, R, H, s, fh;
    if (state.device === 'phone') {
      R = 390; s = Math.min(1, (W - 28) / R, 700 / 760); fh = Math.round(760 * s); H = 760;
      frame.style.width = Math.round(R * s) + 'px';
    } else {
      R = 1280; s = Math.min(1, W / R); fh = Math.max(360, Math.min(720, Math.round(W * .66))); H = fh / s;
      frame.style.width = W + 'px';
    }
    frame.style.height = fh + 'px';
    frame.className = 'frame frame--' + state.device;
    iframe.style.width = R + 'px';
    iframe.style.height = Math.ceil(H) + 'px';
    iframe.style.transform = 'scale(' + s + ')';
  }
  function show(doc, keepScroll) {
    var y = 0;
    try { if (keepScroll) y = iframe.contentWindow.scrollY; } catch (e) {}
    iframe.onload = function () { try { if (y) iframe.contentWindow.scrollTo(0, y); } catch (e) {} };
    iframe.srcdoc = doc;
    if (!$('#fs').hidden) $('#fs-frame').srcdoc = doc;
  }

  function update(keepScroll) {
    var e = effective();
    html = G.render(e.v, state.seed);
    show(html, keepScroll);
    $('#seed-code').textContent = state.seed;
    $('#demo-note').hidden = !e.demo;
    sugg = G.suggest(e.v, CFG);
    if (!state.tierTouched || !sugg.tiers[state.tier]) state.tier = sugg.tier;
    renderOffer();
    saveHash();
  }
  function later() { clearTimeout(timer); timer = setTimeout(function () { update(true); }, 260); }

  /* ---------- the pitch ---------- */
  function renderOffer() {
    $('#offer-head').textContent = G.headlineFor(sugg, state.tier);
    var out = '';
    ['starter', 'standard', 'premium'].forEach(function (k) {
      var t = sugg.tiers[k]; if (!t) return;
      var feats = t.features.map(function (f) { return '<li title="' + G.FEATURES[f].detail + '">' + G.FEATURES[f].name + '</li>'; }).join('');
      var inc = t.includes.map(function (x) { return '<li>' + x + '</li>'; }).join('');
      out += '<label class="tier' + (k === state.tier ? ' is-on' : '') + '"><input type="radio" name="tier" value="' + k + '"' + (k === state.tier ? ' checked' : '') + '>' +
        (k === sugg.tier ? '<span class="tier__best">Best fit</span>' : '') +
        '<span class="tier__name">' + t.name + '</span><span class="tier__price">' + CFG.currency + t.amount + '</span>' +
        '<span class="tier__blurb">' + t.blurb + '</span><ul>' + inc + feats + '</ul></label>';
    });
    $('#tiers').innerHTML = out;
  }
  $('#tiers').addEventListener('change', function (e) {
    if (e.target.name !== 'tier') return;
    state.tier = e.target.value; state.tierTouched = true;
    renderOffer(); saveHash();
  });

  /* ---------- controls ---------- */
  document.forms.form.addEventListener('input', function (e) {
    if (e.target.name === 'vibe') { state.vibe = e.target.value; update(true); return; }
    if (e.target.name === 'color') { state.color = e.target.value; update(true); return; }
    later();
  });
  document.forms.form.addEventListener('submit', function (e) { e.preventDefault(); });
  typeSel.addEventListener('change', function () { setServicesHint(); update(false); });
  function setServicesHint() {
    var ind = G.INDUSTRIES[typeSel.value] || G.INDUSTRIES.other;
    $('#f-services').placeholder = ind.services.slice(0, 4).map(function (s) { return s[0] + (s[2] ? ' $' + s[2] : ''); }).join('\n');
    $('#f-hours').placeholder = ind.hours;
  }
  function shuffle() { state.seed = G.newSeed(); update(false); }
  $('#shuffle').addEventListener('click', shuffle);
  $('#shuffle-2').addEventListener('click', function () { shuffle(); stage.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#fs-shuffle').addEventListener('click', shuffle);

  function setDevice(d) {
    state.device = d;
    $$('[data-device]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-device') === d)); });
    $('#fs').classList.toggle('fs--phone', d === 'phone');
    fit();
  }
  $$('[data-device]').forEach(function (b) { b.addEventListener('click', function () { setDevice(b.getAttribute('data-device')); }); });

  /* full screen */
  var lastFocus = null;
  function openFs() {
    lastFocus = document.activeElement;
    $('#fs').hidden = false; document.body.classList.add('locked');
    $('#fs-frame').srcdoc = html;
    $('#fs-close').focus();
  }
  function closeFs() {
    $('#fs').hidden = true; document.body.classList.remove('locked');
    if (lastFocus) lastFocus.focus();
  }
  $('#fullscreen').addEventListener('click', openFs);
  $('#fs-close').addEventListener('click', closeFs);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#fs').hidden && !$('#claim-dialog').open) { closeFs(); return; }
    var t = e.target.tagName;
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(t) || $('#claim-dialog').open) return;
    if (e.key === 's' || e.key === 'S') shuffle();
    if (e.key === 'f' || e.key === 'F') { $('#fs').hidden ? openFs() : closeFs(); }
  });

  /* ---------- claim ---------- */
  var dlg = $('#claim-dialog');
  function step(id) { ['#claim-ask', '#claim-done', '#claim-copy'].forEach(function (s) { $(s).hidden = s !== id; }); }
  function openClaim() {
    var v = readForm();
    if (!v.name) {
      if (!$('#fs').hidden) closeFs();
      var n = $('#f-name');
      n.setAttribute('aria-invalid', 'true');
      n.scrollIntoView({ behavior: 'smooth', block: 'center' });
      n.focus({ preventScroll: true });
      n.placeholder = 'Type your business name first';
      return;
    }
    var t = sugg.tiers[state.tier];
    $('#claim-name').textContent = v.name;
    $('#claim-pkg').textContent = t.name + ' · ' + CFG.currency + t.amount + ' · design ' + state.seed;
    $('#claim-err').textContent = '';
    step('#claim-ask');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(function () { $('#c-reach').focus(); }, 30);
  }
  $('#f-name').addEventListener('input', function () { this.removeAttribute('aria-invalid'); });
  $('#claim').addEventListener('click', openClaim);
  $('#fs-claim').addEventListener('click', openClaim);

  function packageInfo() {
    var v = readForm(), t = sugg.tiers[state.tier], d = G.design(Object.assign({}, v, { _services: G.parseServices(v.services) }), state.seed);
    var feats = t.features.map(function (f) { return G.FEATURES[f].name; });
    return {
      v: v, t: t, feats: feats,
      payload: {
        _subject: 'Site claim: ' + v.name + ' (' + t.name + ' ' + CFG.currency + t.amount + ')',
        business: { name: v.name, type: (G.INDUSTRIES[v.type] || {}).label, city: v.city, phone: v.phone, services: v.services, hours: v.hours, goals: v.goals, slogan: v.tagline, logo_letters: v.logo },
        design: { code: state.seed, vibe: d.vibe, color: v.color || 'surprise', layout: d.hero, services_style: d.services, fonts: d.fonts.d + ' + ' + d.fonts.b, accent: d.palette.accent, dark: d.dark, link: shareLink() },
        package: { tier: t.name, price: CFG.currency + t.amount, features: feats, includes: t.includes },
        contact: { name: $('#c-who').value.trim(), reach: $('#c-reach').value.trim(), note: $('#c-note').value.trim() },
        sent_at: new Date().toISOString(),
      },
    };
  }
  function asText(p) {
    var b = p.business, d = p.design, k = p.package, c = p.contact;
    return [
      'Hi Jay, I want this site built.', '',
      'Package: ' + k.tier + ' (' + k.price + ')' + (k.features.length ? ': ' + k.features.join(', ') : ''),
      'Design: ' + d.code + ' (' + d.vibe + ', ' + d.layout + ')',
      'Open my design: ' + d.link, '',
      'Business: ' + b.name + (b.type ? ' (' + b.type + ')' : ''),
      b.city ? 'City: ' + b.city : '', b.phone ? 'Phone: ' + b.phone : '', b.hours ? 'Hours: ' + b.hours : '',
      b.services ? 'Services: ' + b.services.replace(/\n+/g, ', ') : '', b.goals ? 'I want the site to: ' + b.goals : '', '',
      'My name: ' + (c.name || '-'), 'Reach me at: ' + c.reach, c.note ? 'Note: ' + c.note : '',
    ].filter(function (l, i, a) { return l !== '' || a[i - 1] !== ''; }).join('\n');
  }
  function looksReachable(s) { return /\S+@\S+\.\S+/.test(s) || s.replace(/\D/g, '').length >= 7; }

  $('#claim-send').addEventListener('click', function () {
    var reach = $('#c-reach').value.trim();
    if (!looksReachable(reach)) { $('#claim-err').textContent = 'Add an email or phone number so I can reply.'; $('#c-reach').focus(); return; }
    var info = packageInfo(), text = asText(info.payload), btn = this;
    var fallback = function () {
      if (CFG.claimEmail) {
        location.href = 'mailto:' + CFG.claimEmail + '?subject=' + encodeURIComponent(info.payload._subject) + '&body=' + encodeURIComponent(text);
        $('#claim-done-msg').textContent = 'Your email app should open with everything filled in. Hit send there and I’ll get back to you with a final quote.';
        step('#claim-done');
      } else {
        $('#claim-text').value = text;
        step('#claim-copy');
      }
    };
    if (!CFG.claimEndpoint) { fallback(); return; }
    btn.disabled = true; btn.textContent = 'Sending…';
    var body = { _subject: info.payload._subject, message: text, data: info.payload };
    if (/\S+@\S+\.\S+/.test(reach)) { body.email = reach; body._replyto = reach; }
    fetch(CFG.claimEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); step('#claim-done'); })
      .catch(fallback)
      .then(function () { btn.disabled = false; btn.textContent = 'Send it to Jay'; });
  });
  $('#claim-copy-btn').addEventListener('click', function () {
    var ta = $('#claim-text'), ok = function () { $('#claim-copy-status').textContent = 'Copied.'; };
    ta.select();
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(ok, function () { document.execCommand('copy'); ok(); });
    else { document.execCommand('copy'); ok(); }
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  /* phones: a floating "See my site" button while the form fills the screen */
  var jump = $('#jump'), formSeen = false, stageSeen = false;
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.target === stage) stageSeen = e.isIntersecting; else formSeen = e.isIntersecting; });
      jump.hidden = !(formSeen && !stageSeen);
    }, { threshold: 0.05 });
    io.observe(stage); io.observe($('#form'));
  }
  jump.addEventListener('click', function () { $('.toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  /* ---------- go ---------- */
  loadHash();
  setServicesHint();
  syncChoices();
  setDevice(state.device);
  update(false);
  var rt = 0;
  addEventListener('resize', function () { cancelAnimationFrame(rt); rt = requestAnimationFrame(fit); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { fit(); }).observe(stage);
})();
