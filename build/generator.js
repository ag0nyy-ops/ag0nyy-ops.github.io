/* ==========================================================================
   SiteGen: turns a few answers into a one-page sample website.
   --------------------------------------------------------------------------
   Pure and deterministic: the same answers + the same design code always
   give the same page. No network, no storage. Works in the browser
   (window.SiteGen) and in Node (module.exports) for testing.

   The design code (seed) only drives the look: palette, fonts, layout,
   patterns. Typing a name or a phone number never reshuffles the design.
   ========================================================================== */
(function (root) {
  'use strict';

  /* ---------- seeded randomness ---------- */
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seedStr) {
    var a = hashStr(seedStr) || 1;
    function next() { // mulberry32
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      range: function (lo, hi) { return lo + next() * (hi - lo); },
      int: function (lo, hi) { return Math.floor(lo + next() * (hi - lo + 1)); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      chance: function (p) { return next() < p; },
      weighted: function (obj) { // { key: weight }
        var keys = Object.keys(obj), total = 0, i;
        for (i = 0; i < keys.length; i++) total += obj[keys[i]];
        var x = next() * total;
        for (i = 0; i < keys.length; i++) { x -= obj[keys[i]]; if (x <= 0) return keys[i]; }
        return keys[keys.length - 1];
      },
    };
  }
  function newSeed() {
    var c = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
    var buf = null;
    try { buf = (root.crypto || {}).getRandomValues && root.crypto.getRandomValues(new Uint32Array(6)); } catch (e) {}
    for (var i = 0; i < 6; i++) s += c[(buf ? buf[i] : Math.floor(Math.random() * 1e9)) % c.length];
    return s;
  }

  /* ---------- color ---------- */
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    var hex = function (x) { return ('0' + Math.round(x * 255).toString(16)).slice(-2); };
    return '#' + hex(f(0)) + hex(f(8)) + hex(f(4));
  }
  function lum(hex) {
    var c = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  /* walk lightness until the color reads on `against` */
  function readable(h, s, l, against, min, dir) {
    var c = hsl(h, s, l), n = 0;
    while (contrast(c, against) < min && n < 60) { l += dir; c = hsl(h, s, l); n++; }
    return c;
  }

  /* ---------- content data ---------- */
  var ICONS = {
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
    cup: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/><path d="M6 1v3M10 1v3M14 1v3"/>',
    utensils: '<path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    home: '<path d="M3 9.5 12 2l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>',
    sparkle: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="M19 3v4M17 5h4"/>',
    dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    car: '<path d="M3 16v-4l2.2-5.2A2 2 0 0 1 7 5.5h10a2 2 0 0 1 1.8 1.3L21 12v4z"/><path d="M3 12h18"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
    paw: '<circle cx="5.5" cy="10" r="2"/><circle cx="9" cy="5.5" r="2"/><circle cx="15" cy="5.5" r="2"/><circle cx="18.5" cy="10" r="2"/><path d="M8 17.5c0-2.8 1.8-5 4-5s4 2.2 4 5c0 2-1.8 3-4 3s-4-1-4-3z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  };
  function icon(name, cls) {
    return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.star) + '</svg>';
  }

  /* Each industry: what to call it, its icon and button, starter services,
     why-us points, taglines, hues it usually looks good in, and the features
     (keys of FEATURES) its customers tend to need, most important first. */
  var INDUSTRIES = {
    barber: {
      label: 'Barber shop', noun: 'barber shop', icon: 'scissors', cta: 'Book a cut', svcTitle: 'Services', svc: { menu: 3, cards: 2, numbered: 1 },
      services: [['Haircut', 'Clean cut, styled how you like it.', '25'], ['Skin fade', 'Tight blend, sharp line.', '30'], ['Beard trim', 'Shaped, lined and oiled.', '15'], ['Hot towel shave', 'Old-school straight razor shave.', '30'], ['Kids cut', '12 and under.', '18'], ['Line up', 'Edge up between cuts.', '12']],
      points: [['clock', 'Walk-ins welcome', 'Stop by, or book ahead and skip the wait.'], ['scissors', 'Sharp every time', 'Fades, tapers and classic cuts done right.'], ['users', 'Neighborhood shop', 'Good cuts, good music, good conversation.']],
      taglines: ['Sharp cuts, no wait.', 'Fresh cuts. Clean lines.', 'Your neighborhood barber.', 'Look sharp. Feel sharp.'],
      closers: ['Walk in or book ahead and leave looking sharp.', 'Pull up a chair.'],
      hues: [215, 355, 150, 28, 0], features: ['booking', 'pricelist', 'gallery', 'reviews', 'instagram'],
      hours: 'Tue–Fri 9am–7pm, Sat 8am–4pm',
    },
    salon: {
      label: 'Hair salon', noun: 'hair salon', icon: 'scissors', cta: 'Book an appointment', svcTitle: 'Services', svc: { menu: 2, cards: 3, numbered: 1 },
      services: [['Women’s cut', 'Consult, wash, cut and style.', '55'], ['Color', 'All-over color, tailored to you.', '90'], ['Balayage', 'Soft, hand-painted highlights.', '160'], ['Blowout', 'Smooth, bouncy, done.', '40'], ['Men’s cut', 'Cut and style.', '35'], ['Treatment', 'Deep conditioning for healthy hair.', '30']],
      points: [['sparkle', 'Color you’ll love', 'From subtle gloss to big changes.'], ['heart', 'Relaxed chairs', 'Take an hour for yourself.'], ['calendar', 'Easy to book', 'Pick a time that works for you.']],
      taglines: ['Hair you’ll love leaving with.', 'Cut. Color. Confidence.', 'Your best hair day, every day.', 'Good hair starts here.'],
      closers: ['Book a chair and take an hour for yourself.', 'Come in for a consult anytime.'],
      hues: [330, 300, 20, 170, 270], features: ['booking', 'gallery', 'pricelist', 'reviews', 'instagram'],
      hours: 'Tue–Sat 9am–7pm',
    },
    beauty: {
      label: 'Nails, lashes & spa', noun: 'beauty studio', icon: 'sparkle', cta: 'Book now', svcTitle: 'Services', svc: { menu: 3, cards: 2 },
      services: [['Gel manicure', 'Long-lasting shine.', '40'], ['Pedicure', 'Soak, scrub and polish.', '45'], ['Lash extensions', 'Full set, natural or dramatic.', '120'], ['Brow shaping', 'Wax or thread.', '18'], ['Facial', 'Cleanse, exfoliate and glow.', '70'], ['Fill', 'Keep your set looking fresh.', '35']],
      points: [['sparkle', 'Spotless studio', 'Clean tools, every client.'], ['heart', 'Detail-obsessed', 'We take our time so it lasts.'], ['calendar', 'Book in seconds', 'Pick your service and time.']],
      taglines: ['Little luxuries, done right.', 'Polished. Pampered. Perfect.', 'Treat yourself.', 'Glow on your schedule.'],
      closers: ['Treat yourself, you earned it.', 'Book your next set today.'],
      hues: [330, 350, 280, 15, 170], features: ['booking', 'gallery', 'pricelist', 'instagram', 'reviews'],
      hours: 'Mon–Sat 10am–7pm, Sun 11am–5pm',
    },
    restaurant: {
      label: 'Restaurant', noun: 'restaurant', icon: 'utensils', cta: 'See the menu', svcTitle: 'Menu', svc: { menu: 5, cards: 1 },
      services: [['House burger', 'Double patty, cheddar, house sauce.', '14'], ['Street tacos', 'Three tacos, onion, cilantro, salsa.', '12'], ['Chicken plate', 'Grilled, with rice and greens.', '16'], ['Loaded fries', 'Cheese, peppers, scallion.', '9'], ['Soup of the day', 'Ask your server.', '7'], ['Dessert', 'Rotating and made in-house.', '8']],
      points: [['utensils', 'Made from scratch', 'Real ingredients, cooked fresh.'], ['users', 'Bring everyone', 'Room for the whole crew.'], ['bag', 'Takeout ready', 'Call ahead and pick it up hot.']],
      taglines: ['Good food. Good people.', 'Made fresh, served hot.', 'Come hungry.', 'Your new regular spot.'],
      closers: ['Dine in, take out, or call ahead.', 'Come hungry, leave happy.'],
      hues: [8, 25, 45, 90, 0], features: ['menu', 'ordering', 'reviews', 'gallery', 'maps'],
      hours: 'Mon–Thu 11am–9pm, Fri–Sat 11am–10pm, Sun 11am–8pm',
    },
    cafe: {
      label: 'Café or bakery', noun: 'café', icon: 'cup', cta: 'See the menu', svcTitle: 'Menu', svc: { menu: 5, cards: 2 },
      services: [['Latte', 'Double shot, steamed milk.', '5'], ['Cold brew', 'Steeped 18 hours.', '4.50'], ['Croissant', 'Butter, baked every morning.', '4'], ['Breakfast sandwich', 'Egg, cheese, choice of meat.', '8'], ['Muffin', 'Ask what’s fresh today.', '3.50'], ['Tea', 'Loose leaf, hot or iced.', '3.50']],
      points: [['cup', 'Fresh every morning', 'Baked and brewed in-house.'], ['heart', 'Stay a while', 'Wi-Fi, plugs and good seats.'], ['bag', 'Grab and go', 'In and out in minutes.']],
      taglines: ['Good coffee. Better mornings.', 'Freshly baked, every day.', 'Your daily ritual.', 'Come for the coffee, stay for the vibe.'],
      closers: ['Stop in for a coffee and stay a while.', 'See you in the morning.'],
      hues: [28, 20, 150, 200, 40], features: ['menu', 'ordering', 'instagram', 'gallery', 'reviews'],
      hours: 'Mon–Fri 6:30am–3pm, Sat–Sun 7am–2pm',
    },
    auto: {
      label: 'Auto repair', noun: 'auto repair shop', icon: 'car', cta: 'Get a quote', svcTitle: 'What we fix', svc: { cards: 3, numbered: 2, menu: 1 },
      services: [['Oil change', 'Conventional or synthetic, fast.', ''], ['Brakes', 'Pads, rotors and inspections.', ''], ['Diagnostics', 'Check engine light? We’ll find it.', ''], ['Tires & alignment', 'Mount, balance and align.', ''], ['A/C & heating', 'Stay comfortable year-round.', ''], ['Suspension', 'Shocks, struts and steering.', '']],
      points: [['shield', 'Honest quotes', 'We explain it before we fix it.'], ['wrench', 'Done right', 'Experienced techs, quality parts.'], ['clock', 'Back on the road', 'Most jobs done same day.']],
      taglines: ['Honest repairs. Fair prices.', 'We fix it right the first time.', 'Keep your car on the road.', 'Straight answers, solid work.'],
      closers: ['Call for a quote or bring it by.', 'We’ll get you back on the road.'],
      hues: [215, 0, 45, 200, 220], features: ['quote', 'booking', 'reviews', 'maps'],
      hours: 'Mon–Fri 8am–6pm, Sat 9am–2pm',
    },
    contractor: {
      label: 'Contractor or handyman', noun: 'contractor', icon: 'home', cta: 'Get a free quote', svcTitle: 'What we do', svc: { cards: 3, numbered: 3 },
      services: [['Kitchen remodels', 'Cabinets, counters, tile.', ''], ['Bathrooms', 'Updates and full remodels.', ''], ['Decks & fences', 'Built to last.', ''], ['Drywall & paint', 'Patch, finish and paint.', ''], ['Flooring', 'LVP, tile and hardwood.', ''], ['Handyman jobs', 'The little list, done.', '']],
      points: [['shield', 'Licensed & insured', 'Covered from start to finish.'], ['check', 'Clear quotes', 'No surprise charges.'], ['home', 'Clean job sites', 'We treat your home like ours.']],
      taglines: ['Built right. Built to last.', 'Your home, done right.', 'Quality work, on time.', 'From fix-ups to full remodels.'],
      closers: ['Tell us about your project for a free quote.', 'Let’s build something good.'],
      hues: [28, 210, 40, 150, 15], features: ['quote', 'beforeafter', 'reviews', 'servicearea'],
      hours: 'Mon–Fri 7am–5pm',
    },
    trades: {
      label: 'Plumbing, electric or HVAC', noun: 'service company', icon: 'bolt', cta: 'Call for service', svcTitle: 'Services', svc: { cards: 3, numbered: 2 },
      services: [['Repairs', 'Fast fixes for everyday problems.', ''], ['Installs', 'New equipment, done to code.', ''], ['Emergency service', 'When it can’t wait.', ''], ['Inspections', 'Know what you’re working with.', ''], ['Maintenance', 'Keep it running all year.', ''], ['Upgrades', 'Better, safer, more efficient.', '']],
      points: [['clock', 'Fast response', 'We pick up and we show up.'], ['shield', 'Licensed & insured', 'Work done to code.'], ['check', 'Upfront pricing', 'Know the price before we start.']],
      taglines: ['Fast, honest service.', 'We show up. We fix it.', 'Fixed right, the first time.', 'Your local pros.'],
      closers: ['Call now and talk to a real person.', 'Fast service when you need it.'],
      hues: [215, 200, 15, 45, 0], features: ['emergency', 'quote', 'servicearea', 'reviews'],
      hours: 'Mon–Fri 7am–6pm, emergency calls 24/7',
    },
    landscaping: {
      label: 'Lawn care & landscaping', noun: 'lawn care company', icon: 'leaf', cta: 'Get a free quote', svcTitle: 'Services', svc: { cards: 3, numbered: 2 },
      services: [['Mowing', 'Weekly or every other week.', ''], ['Cleanups', 'Spring and fall, top to bottom.', ''], ['Mulch & beds', 'Fresh beds, crisp edges.', ''], ['Snow removal', 'Driveways and walks.', ''], ['Trimming', 'Shrubs and hedges.', ''], ['Landscaping', 'Plants, rock and design.', '']],
      points: [['leaf', 'Yards that pop', 'Clean lines, healthy lawns.'], ['calendar', 'Reliable schedule', 'Same day every week.'], ['check', 'Simple pricing', 'Flat rates, no surprises.']],
      taglines: ['The best lawn on the block.', 'Clean cuts, every week.', 'Your yard, handled.', 'Curb appeal, done for you.'],
      closers: ['Get a free quote for your yard.', 'Sit back, we’ve got the yard.'],
      hues: [140, 100, 160, 80, 35], features: ['quote', 'beforeafter', 'servicearea', 'reviews'],
      hours: 'Mon–Sat 7am–7pm',
    },
    cleaning: {
      label: 'Cleaning service', noun: 'cleaning service', icon: 'sparkle', cta: 'Get a quote', svcTitle: 'Services', svc: { cards: 3, numbered: 2 },
      services: [['Home cleaning', 'Weekly, biweekly or monthly.', ''], ['Deep clean', 'Top to bottom, every corner.', ''], ['Move-out clean', 'Get your deposit back.', ''], ['Office cleaning', 'After hours, no disruption.', ''], ['Windows', 'Inside and out.', ''], ['Carpets', 'Fresh and spotless.', '']],
      points: [['sparkle', 'Spotless, guaranteed', 'Not happy? We come back.'], ['shield', 'Trusted team', 'Background-checked and insured.'], ['calendar', 'Your schedule', 'Weekly, monthly or one-time.']],
      taglines: ['Come home to clean.', 'Spotless, every time.', 'More time for you.', 'Clean, without lifting a finger.'],
      closers: ['Get a quote in minutes.', 'Leave the cleaning to us.'],
      hues: [180, 200, 160, 220, 260], features: ['quote', 'booking', 'servicearea', 'reviews'],
      hours: 'Mon–Sat 8am–6pm',
    },
    fitness: {
      label: 'Gym or fitness studio', noun: 'gym', icon: 'dumbbell', cta: 'Book a free class', svcTitle: 'Classes', svc: { cards: 3, numbered: 2, menu: 1 },
      services: [['Strength', 'Lift with a plan.', ''], ['HIIT', 'Fast, hard, done in 45.', ''], ['Personal training', 'One-on-one coaching.', ''], ['Open gym', 'Train on your own time.', ''], ['Mobility', 'Move better, hurt less.', ''], ['Youth athletics', 'Speed and strength for teens.', '']],
      points: [['dumbbell', 'Real coaching', 'Every class is coached.'], ['users', 'Good people', 'A community that shows up.'], ['calendar', 'Classes all day', 'Early, lunch and evening.']],
      taglines: ['Stronger every week.', 'Show up. Get strong.', 'Train hard. Have fun.', 'Your strongest year starts here.'],
      closers: ['Your first class is on us.', 'Come train with us.'],
      hues: [15, 0, 80, 200, 45], features: ['classes', 'booking', 'gallery', 'instagram'],
      hours: 'Mon–Fri 5am–9pm, Sat–Sun 7am–2pm',
    },
    retail: {
      label: 'Shop or boutique', noun: 'shop', icon: 'bag', cta: 'Visit the shop', svcTitle: 'What we carry', svc: { cards: 4, numbered: 1 },
      services: [['New arrivals', 'Fresh in every week.', ''], ['Local makers', 'Made close to home.', ''], ['Gifts', 'Something for everyone.', ''], ['Home goods', 'Small things that make a room.', ''], ['Accessories', 'Finishing touches.', ''], ['Gift cards', 'Never the wrong size.', '']],
      points: [['bag', 'Hand-picked', 'Everything chosen with care.'], ['heart', 'Locally owned', 'Shop small, shop local.'], ['tag', 'New every week', 'Always something new to find.']],
      taglines: ['Find something you love.', 'Shop small. Shop local.', 'Good things, hand-picked.', 'Your new favorite shop.'],
      closers: ['Stop in and say hi.', 'Come see what’s new.'],
      hues: [330, 28, 170, 260, 45], features: ['shop', 'instagram', 'maps', 'reviews'],
      hours: 'Tue–Sat 10am–6pm, Sun 12pm–5pm',
    },
    tailor: {
      label: 'Tailor or alterations', noun: 'tailor shop', icon: 'scissors', cta: 'Get a quote', svcTitle: 'Services', svc: { menu: 3, cards: 2 },
      services: [['Hemming', 'Pants, skirts and dresses.', '15'], ['Taking in', 'A better fit through the body.', '25'], ['Suits', 'Jackets, sleeves and trousers.', '40'], ['Wedding & formal', 'Gowns and bridesmaid dresses.', ''], ['Zippers & repairs', 'Fixed fast.', '15'], ['Custom pieces', 'Made to measure.', '']],
      points: [['scissors', 'Perfect fit', 'Measured and fitted by hand.'], ['clock', 'Quick turnaround', 'Most jobs ready in days.'], ['heart', 'Careful with your clothes', 'Treated like our own.']],
      taglines: ['Clothes that fit like they should.', 'The perfect fit.', 'Altered to fit you.', 'Fit, finished.'],
      closers: ['Bring it in for a fitting.', 'Most alterations ready in days.'],
      hues: [215, 28, 350, 160, 270], features: ['pricelist', 'quote', 'gallery', 'reviews'],
      hours: 'Mon–Fri 10am–6pm, Sat 10am–3pm',
    },
    photography: {
      label: 'Photographer', noun: 'photography studio', icon: 'camera', cta: 'Check availability', svcTitle: 'Sessions', svc: { cards: 3, menu: 2, numbered: 1 },
      services: [['Portraits', 'Solo, couples and family.', ''], ['Weddings', 'The whole day, start to finish.', ''], ['Senior photos', 'Your year, your style.', ''], ['Events', 'Parties and corporate.', ''], ['Headshots', 'Clean, sharp, professional.', ''], ['Products', 'Photos that sell.', '']],
      points: [['camera', 'Natural shots', 'No stiff poses.'], ['clock', 'Fast delivery', 'Edited gallery within two weeks.'], ['heart', 'Fun to work with', 'You’ll forget the camera is there.']],
      taglines: ['Moments worth keeping.', 'Your story, beautifully told.', 'Photos you’ll actually frame.', 'Real moments, real people.'],
      closers: ['Check dates and let’s plan your session.', 'Let’s make something worth framing.'],
      hues: [0, 30, 200, 300, 160], features: ['gallery', 'booking', 'contact', 'instagram'],
      hours: 'By appointment, 7 days a week',
    },
    pet: {
      label: 'Pet grooming or care', noun: 'pet care business', icon: 'paw', cta: 'Book a visit', svcTitle: 'Services', svc: { menu: 2, cards: 3 },
      services: [['Full groom', 'Bath, cut, nails and ears.', '65'], ['Bath & brush', 'Fresh and fluffy.', '40'], ['Nail trim', 'Quick and calm.', '15'], ['Puppy intro', 'A gentle first groom.', '35'], ['Doggy daycare', 'Play all day.', '30'], ['Dog walking', '30 minutes around the block.', '20']],
      points: [['paw', 'Gentle hands', 'Calm, patient and kind.'], ['heart', 'Treated like family', 'We love them like ours.'], ['calendar', 'Easy booking', 'Pick a day, we’ll do the rest.']],
      taglines: ['Happy pets, happy owners.', 'Fresh, fluffy and loved.', 'Tails wagging since day one.', 'The good boys’ favorite spot.'],
      closers: ['Book a visit, treats included.', 'Your pet is in good hands.'],
      hues: [180, 40, 330, 200, 100], features: ['booking', 'gallery', 'pricelist', 'reviews'],
      hours: 'Mon–Sat 8am–5pm',
    },
    other: {
      label: 'Something else', noun: 'local business', icon: 'star', cta: 'Get in touch', svcTitle: 'What we do', svc: { cards: 3, numbered: 2 },
      services: [['Service one', 'Tell customers what you do.', ''], ['Service two', 'One line about it.', ''], ['Service three', 'Keep it short and clear.', '']],
      points: [['heart', 'Locally owned', 'Proud to serve our neighbors.'], ['check', 'Done right', 'Quality you can count on.'], ['phone', 'Easy to reach', 'Call and talk to a real person.']],
      taglines: ['Proudly local.', 'Here to help.', 'Quality you can count on.', 'Your neighbors, at your service.'],
      closers: ['Call or stop by anytime.', 'We’d love to help.'],
      hues: [215, 150, 28, 270, 0], features: ['contact', 'gallery', 'reviews', 'maps'],
      hours: 'Mon–Fri 9am–5pm',
    },
  };

  /* things a customer can be sold, as plain phrases that read in a sentence */
  var FEATURES = {
    booking:     { name: 'online booking', detail: 'customers pick a time from their phone, day or night', heavy: true },
    menu:        { name: 'an online menu', detail: 'easy to update when prices change' },
    ordering:    { name: 'order-ahead', detail: 'a pickup or delivery button that links to your ordering', heavy: true },
    quote:       { name: 'a quote request form', detail: 'jobs land in your inbox with the details you need' },
    gallery:     { name: 'a photo gallery', detail: 'show off your best work' },
    beforeafter: { name: 'before & after photos', detail: 'the fastest way to prove your work' },
    reviews:     { name: 'a Google reviews section', detail: 'your best reviews, front and center' },
    maps:        { name: 'map & directions', detail: 'one tap to get to your door' },
    contact:     { name: 'a contact form', detail: 'messages go straight to your email' },
    pricelist:   { name: 'a full price list', detail: 'no more “how much?” calls' },
    instagram:   { name: 'Instagram links', detail: 'a link-in-bio page that matches your site' },
    servicearea: { name: 'a service area map', detail: 'show which towns you cover' },
    emergency:   { name: 'a 24/7 call button', detail: 'big, fast and always on top' },
    classes:     { name: 'a class schedule', detail: 'times and spots, easy to read on a phone', heavy: true },
    shop:        { name: 'a product showcase', detail: 'show what’s in store before they visit', heavy: true },
    spanish:     { name: 'a Spanish version', detail: 'the whole site, also en español', heavy: true },
    seo:         { name: 'Google search setup', detail: 'so people nearby can find you' },
    domain:      { name: 'your own .com', detail: 'set up so you own it' },
  };

  /* words in "what should your site do?" that point at a feature */
  var GOAL_WORDS = [
    [/book|appoint|schedul|reserv/i, 'booking'],
    [/order|pick ?up|delivery|deliver|doordash|uber ?eats|grubhub|toast/i, 'ordering'],
    [/menu/i, 'menu'],
    [/quote|estimate|bid/i, 'quote'],
    [/before.*after/i, 'beforeafter'],
    [/photo|pic|gallery|portfolio|my work|my cuts|see my|show.*(work|off)/i, 'gallery'],
    [/review|rating|testimon/i, 'reviews'],
    [/insta|tiktok|social|facebook/i, 'instagram'],
    [/sell|store|product|shop online|inventory/i, 'shop'],
    [/price|cost|rate/i, 'pricelist'],
    [/spanish|espa[nñ]ol|bilingual|latino|hispan/i, 'spanish'],
    [/class|schedule|session/i, 'classes'],
    [/emergency|24\/?7|after hours/i, 'emergency'],
    [/google|search|seo|found|find us/i, 'seo'],
    [/contact|message|email|form/i, 'contact'],
    [/map|direction|locat/i, 'maps'],
    [/area|towns|cities|cover/i, 'servicearea'],
  ];

  var COLORS = {
    red: { h: 356, s: 68 }, orange: { h: 22, s: 80 }, gold: { h: 42, s: 78 }, green: { h: 148, s: 48 },
    teal: { h: 176, s: 60 }, blue: { h: 214, s: 70 }, purple: { h: 268, s: 52 }, pink: { h: 332, s: 66 },
    brown: { h: 26, s: 38 }, mono: { h: 220, s: 0 },
  };

  /* fonts, all Google Fonts. d = display, b = body, up = uppercase headings */
  var FONTS = {
    classic:  [{ d: 'DM Serif Display', b: 'Inter', dw: 400 }, { d: 'Playfair Display', b: 'Source Sans 3', dw: 700 }, { d: 'Libre Baskerville', b: 'Lato', dw: 700, ds: .92 }, { d: 'Fraunces', b: 'Inter', dw: 600 }],
    modern:   [{ d: 'Space Grotesk', b: 'Inter', dw: 700 }, { d: 'Manrope', b: 'Manrope', dw: 800 }, { d: 'Sora', b: 'Inter', dw: 700 }, { d: 'Outfit', b: 'Inter', dw: 700 }],
    bold:     [{ d: 'Anton', b: 'Inter', dw: 400, up: 1, ls: .01 }, { d: 'Bebas Neue', b: 'Barlow', dw: 400, up: 1, ls: .02, ds: 1.12 }, { d: 'Archivo Black', b: 'Archivo', dw: 400, ds: .9 }, { d: 'Oswald', b: 'Inter', dw: 700, up: 1 }],
    friendly: [{ d: 'Fredoka', b: 'Nunito', dw: 600 }, { d: 'Baloo 2', b: 'Nunito Sans', dw: 800 }, { d: 'Poppins', b: 'Poppins', dw: 700 }, { d: 'Quicksand', b: 'Nunito', dw: 700 }],
    luxury:   [{ d: 'Cormorant Garamond', b: 'Montserrat', dw: 600, ds: 1.1 }, { d: 'Bodoni Moda', b: 'Jost', dw: 600 }, { d: 'Italiana', b: 'Raleway', dw: 400, ds: 1.05 }, { d: 'Playfair Display', b: 'Jost', dw: 500 }],
    minimal:  [{ d: 'Inter Tight', b: 'Inter', dw: 700, ls: -.02 }, { d: 'Instrument Serif', b: 'Inter', dw: 400, ds: 1.1 }, { d: 'IBM Plex Sans', b: 'IBM Plex Sans', dw: 600 }, { d: 'DM Sans', b: 'DM Sans', dw: 700, ls: -.02 }],
  };

  /* how each vibe likes to look */
  var VIBES = {
    classic:  { label: 'Classic',  dark: .25, sat: [40, 62], light: [30, 40], bgSat: [18, 34], radius: [6, 10],  btn: { pill: 1, soft: 2, square: 1 }, hero: { split: 3, editorial: 2, center: 2 }, pattern: { lines: 2, dots: 1, none: 2 } },
    modern:   { label: 'Modern',   dark: .3,  sat: [55, 80], light: [42, 52], bgSat: [8, 20],  radius: [14, 22], btn: { pill: 2, soft: 2 },           hero: { split: 3, card: 3, center: 1 },      pattern: { grid: 2, dots: 2, blobs: 2 } },
    bold:     { label: 'Bold',     dark: .45, sat: [70, 92], light: [45, 55], bgSat: [6, 14],  radius: [0, 4],   btn: { square: 3, pill: 1 },          hero: { poster: 4, split: 2, editorial: 1 }, pattern: { stripes: 2, grid: 1, none: 1 } },
    friendly: { label: 'Friendly', dark: .08, sat: [55, 78], light: [45, 55], bgSat: [30, 55], radius: [18, 28], btn: { pill: 4 },                     hero: { card: 3, split: 2, center: 2 },      pattern: { blobs: 3, dots: 2, waves: 2 } },
    luxury:   { label: 'Luxury',   dark: .55, sat: [22, 42], light: [32, 42], bgSat: [10, 22], radius: [0, 2],   btn: { square: 2, line: 2 },          hero: { center: 3, editorial: 2, split: 1 }, pattern: { lines: 2, none: 3, rings: 1 } },
    minimal:  { label: 'Minimal',  dark: .2,  sat: [30, 60], light: [38, 48], bgSat: [0, 6],   radius: [8, 12],  btn: { soft: 2, square: 1, line: 1 }, hero: { editorial: 3, center: 2, split: 2 }, pattern: { none: 4, grid: 1 } },
  };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clean(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 120); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function aOrAn(w) { return /^[aeiou]/i.test(w) ? 'an' : 'a'; }
  function listJoin(arr) {
    if (arr.length <= 1) return arr.join('');
    if (arr.length === 2) return arr[0] + ' and ' + arr[1];
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }
  function phoneFmt(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    if (d.length === 10) return { show: '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6), tel: '+1' + d };
    var t = clean(p, 30);
    return { show: t, tel: d ? (t.trim()[0] === '+' ? '+' : '') + d : '' };
  }
  function monogram(name, logo) {
    if (logo) return clean(logo, 4);
    var words = name.replace(/[^\w\s&'’-]/g, ' ').split(/\s+/).filter(function (w) { return w && !/^(the|and|&|of|a|llc|inc|co)$/i.test(w); });
    if (!words.length) return '★';
    return (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase();
  }

  /* "Haircut $25", "Fade - 30", "Brakes" → { name, price } */
  function parseServices(text) {
    return String(text || '').split(/[\n,;•]+/).map(function (line) {
      line = clean(line, 70);
      if (!line) return null;
      var m = line.match(/^(.*?)[\s:–—-]*\$?\s*(\d{1,4}(?:\.\d{2})?)\s*\+?\s*$/);
      if (m && m[1].trim()) return { name: m[1].replace(/[\s:–—-]+$/, '').trim(), price: m[2] };
      return { name: line, price: '' };
    }).filter(Boolean).slice(0, 9);
  }
  /* "Mon–Fri 9–6, Sat 10–4" → [["Mon–Fri", "9–6"], ["Sat", "10–4"]] */
  function parseHours(text) {
    return String(text || '').split(/[\n,;]+/).map(function (line) {
      line = clean(line, 60);
      if (!line) return null;
      var i = line.search(/\d|closed|by appoint|24\/7|open/i);
      if (i <= 0) return ['', line];
      return [line.slice(0, i).trim().replace(/[:–—-]$/, '').trim(), line.slice(i).trim()];
    }).filter(Boolean).slice(0, 8);
  }

  /* ---------- design ---------- */
  function design(inputs, seed) {
    var ind = INDUSTRIES[inputs.type] || INDUSTRIES.other;
    var vibeKey = VIBES[inputs.vibe] ? inputs.vibe : 'modern';
    var vibe = VIBES[vibeKey];
    var r = rng(seed + '|' + vibeKey + '|' + (inputs.type || 'other') + '|' + (inputs.color || ''));

    var pref = COLORS[inputs.color];
    var hue = pref ? pref.h + r.range(-5, 5) : r.pick(ind.hues) + r.range(-12, 12);
    var sat = pref ? (pref.s === 0 ? 0 : Math.min(pref.s, vibe.sat[1] + 10)) : r.range(vibe.sat[0], vibe.sat[1]);
    var dark = r.chance(vibe.dark);
    var bgHue = r.chance(.6) ? hue : (vibeKey === 'luxury' || r.chance(.5) ? 40 : hue + 180);
    var bgSat = pref && pref.s === 0 ? 0 : r.range(vibe.bgSat[0], vibe.bgSat[1]);
    var shift = r.pick([28, -32, 150, 180, 40]);
    var p = {};
    if (!dark) {
      p.bg = hsl(bgHue, bgSat, r.range(95.5, 97.5));
      p.surface = hsl(bgHue, bgSat, 99.3);
      p.soft = hsl(hue, Math.max(sat * .45, 6), 91);
      p.ink = hsl(hue, Math.min(sat, 30), 11);
      p.muted = hsl(hue, Math.min(sat, 12), 36);
      p.line = hsl(bgHue, Math.min(bgSat + 6, 22), 86);
      p.accent = readable(hue, sat, r.range(vibe.light[0], vibe.light[1]), '#ffffff', 4.6, -1.5);
      p.accentInk = readable(hue, sat, 40, p.bg, 4.6, -1.5);
      p.accent2 = hsl(hue + shift, Math.max(sat - 10, 0), 62);
      p.hdr = p.bg;
    } else {
      p.bg = hsl(hue, Math.min(bgSat + 8, 28), r.range(6, 9));
      p.surface = hsl(hue, Math.min(bgSat + 8, 24), 11.5);
      p.soft = hsl(hue, Math.min(sat, 28), 16);
      p.ink = hsl(hue, Math.min(sat, 18), 94);
      p.muted = hsl(hue, Math.min(sat, 12), 72);
      p.line = hsl(hue, Math.min(sat, 16), 21);
      p.accent = readable(hue, Math.max(sat, pref && pref.s === 0 ? 0 : 55), r.range(56, 66), p.bg, 5, 1.5);
      p.accentInk = p.accent;
      p.accent2 = hsl(hue + shift, Math.max(sat - 10, 0), 48);
      p.hdr = p.bg;
    }
    p.onAccent = contrast(p.accent, '#ffffff') >= contrast(p.accent, '#0b0b0b') ? '#ffffff' : '#0b0b0b';

    var fonts = r.pick(FONTS[vibeKey]);
    var hero = r.weighted(vibe.hero);
    var svc = r.weighted(ind.svc);
    var svcList = inputs._services && inputs._services.length ? inputs._services : ind.services.map(function (s) { return { price: s[2] }; });
    if (svc === 'menu' && !svcList.some(function (s) { return s.price; }) && !/restaurant|cafe/.test(inputs.type || '')) svc = 'cards';
    var d = {
      seed: seed, vibe: vibeKey, dark: dark, palette: p, fonts: fonts, hero: hero, services: svc,
      pattern: r.weighted(vibe.pattern),
      radius: Math.round(r.range(vibe.radius[0], vibe.radius[1])),
      btn: r.weighted(vibe.btn),
      artShape: r.pick(['circle', 'arch', 'blob', 'square']),
      about: r.pick(['points', 'split', 'band']),
      headerStyle: r.pick(['bar', 'float', 'center']),
      ctaStyle: r.pick(['band', 'card']),
      mapSeed: r.int(1, 1e6),
      eyebrowStyle: r.pick(['line', 'dot', 'plain']),
    };
    if (hero === 'poster') d.headerStyle = 'bar';
    return d;
  }

  function patternCss(kind, color, size) {
    var c = encodeURIComponent(color);
    switch (kind) {
      case 'dots': return "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22'%3E%3Ccircle cx='3' cy='3' r='1.6' fill='" + c + "'/%3E%3C/svg%3E\")";
      case 'grid': return "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Cpath d='M36 0H0v36' fill='none' stroke='" + c + "' stroke-width='1'/%3E%3C/svg%3E\")";
      case 'stripes': return 'repeating-linear-gradient(135deg,' + color + ' 0 2px,transparent 2px 14px)';
      case 'lines': return 'repeating-linear-gradient(0deg,' + color + ' 0 1px,transparent 1px 28px)';
      case 'waves': return "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='20'%3E%3Cpath d='M0 10q15-10 30 0t30 0' fill='none' stroke='" + c + "' stroke-width='1.5'/%3E%3C/svg%3E\")";
      case 'rings': return 'repeating-radial-gradient(circle at 80% 20%,' + color + ' 0 1px,transparent 1px 26px)';
      case 'blobs': return 'radial-gradient(circle at 15% 20%,' + color + ' 0 120px,transparent 121px),radial-gradient(circle at 90% 85%,' + color + ' 0 160px,transparent 161px)';
      default: return 'none';
    }
  }

  /* a little stylized street map with a pin, different per design */
  function mapSvg(d) {
    var r = rng('map' + d.mapSeed), p = d.palette, lines = '', i;
    for (i = 0; i < 6; i++) {
      var y = r.int(20, 280), y2 = y + r.int(-60, 60);
      lines += '<path d="M-10 ' + y + ' L410 ' + y2 + '" stroke="' + p.surface + '" stroke-width="' + r.int(6, 14) + '"/>';
    }
    for (i = 0; i < 5; i++) {
      var x = r.int(20, 380), x2 = x + r.int(-80, 80);
      lines += '<path d="M' + x + ' -10 L' + x2 + ' 310" stroke="' + p.surface + '" stroke-width="' + r.int(5, 12) + '"/>';
    }
    var park = '<rect x="' + r.int(30, 260) + '" y="' + r.int(20, 180) + '" width="' + r.int(60, 110) + '" height="' + r.int(40, 80) + '" rx="10" fill="' + p.accent2 + '" opacity=".35"/>';
    var water = '<path d="M-10 ' + r.int(230, 270) + ' C 120 ' + r.int(200, 260) + ', 260 ' + r.int(260, 300) + ', 410 ' + r.int(220, 260) + ' L410 310 L-10 310z" fill="' + p.accent2 + '" opacity=".22"/>';
    return '<svg class="map" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Map (sample)">' +
      '<rect width="400" height="300" fill="' + p.soft + '"/>' + water + park + lines +
      '<g transform="translate(200 150)"><circle r="34" fill="' + p.accent + '" opacity=".18"/><path d="M0 8c0 0-16-15-16-27a16 16 0 0 1 32 0c0 12-16 27-16 27z" fill="' + p.accent + '"/><circle cy="-19" r="6" fill="' + p.onAccent + '"/></g></svg>';
  }

  /* ---------- content ---------- */
  function content(inputs, seed) {
    var ind = INDUSTRIES[inputs.type] || INDUSTRIES.other;
    var r = rng(seed + '|content|' + (inputs.type || 'other'));
    var name = clean(inputs.name, 60) || 'Your Business';
    var city = clean(inputs.city, 50);
    var services = parseServices(inputs.services);
    var custom = services.length > 0;
    if (!custom) services = ind.services.map(function (s) { return { name: s[0], desc: s[1], price: s[2] }; });
    services.forEach(function (s, i) {
      if (s.desc) return;
      var match = ind.services.filter(function (d) { return d[0].toLowerCase().split(/\W/)[0] === s.name.toLowerCase().split(/\W/)[0]; })[0];
      s.desc = match ? match[1] : ['Done right, every time.', 'Ask us about it.', 'Quality you can count on.', 'Call for details.', 'A customer favorite.'][i % 5];
    });
    var tagline = clean(inputs.tagline, 80) || r.pick(ind.taglines);
    var named = services.slice(0, 3).map(function (s) { return s.name.toLowerCase(); });
    var where = city ? ' in ' + city : '';
    var lead = custom
      ? name + ' is ' + aOrAn(ind.noun) + ' ' + ind.noun + where + ', offering ' + listJoin(named) + '. ' + r.pick(ind.closers)
      : name + ' is ' + aOrAn(ind.noun) + ' ' + ind.noun + where + '. ' + r.pick(ind.closers);
    var hours = parseHours(inputs.hours);
    var sampleHours = !hours.length;
    if (sampleHours) hours = parseHours(ind.hours);
    return {
      ind: ind, name: name, city: city, phone: phoneFmt(inputs.phone || ''), tagline: tagline, lead: lead,
      services: services, hours: hours, sampleHours: sampleHours, mono: monogram(name, clean(inputs.logo, 4)),
      about: name + ' is proud to serve ' + (city || 'the neighborhood') + '. ' + ind.points.map(function (p) { return p[2]; }).join(' '),
      points: ind.points,
    };
  }

  /* ---------- page ---------- */
  function render(inputs, seed) {
    inputs = inputs || {};
    var c = content(inputs, seed);
    var d = design(Object.assign({}, inputs, { _services: parseServices(inputs.services) }), seed);
    var p = d.palette, f = d.fonts, ind = c.ind;
    var year = new Date().getFullYear();
    var tel = c.phone.tel ? 'tel:' + c.phone.tel : '#visit';
    var callLabel = c.phone.show ? 'Call ' + c.phone.show : 'Call us';
    var ctaHref = /menu|class|carry|session/i.test(ind.cta) ? '#services' : (/quote|touch|availability/i.test(ind.cta) ? '#contact' : tel);

    var fontsUrl = 'https://fonts.googleapis.com/css2?family=' +
      [f.d, f.b].filter(function (x, i, a) { return a.indexOf(x) === i; })
        .map(function (n) { return n.replace(/ /g, '+') + (n === f.b ? ':wght@400;600;700' : (f.dw && f.dw !== 400 ? ':wght@' + f.dw : '')); }).join('&family=') + '&display=swap';

    var eyebrow = esc(ind.label + (c.city ? ' · ' + c.city : ''));
    var btns = '<div class="actions"><a class="btn" href="' + esc(ctaHref) + '">' + esc(ind.cta) + ' ' + icon('arrow') + '</a>' +
      (c.phone.show ? '<a class="btn ghost" href="' + esc(tel) + '">' + icon('phone') + ' ' + esc(c.phone.show) + '</a>' : '') + '</div>';
    var firstHours = c.hours[0] ? (c.hours[0][0] ? c.hours[0][0] + ' ' : '') + c.hours[0][1] : '';
    var chips = '<div class="chip chip-a">' + icon('clock') + '<span><b>Open</b> ' + esc(firstHours) + '</span></div>' +
      (c.city ? '<div class="chip chip-b">' + icon('pin') + '<span>' + esc(c.city) + '</span></div>' : '');
    var art = '<div class="art art-' + d.artShape + '" aria-hidden="true"><div class="art-in">' + icon(ind.icon, 'art-ic') + '<span class="art-mono">' + esc(c.mono) + '</span></div>' + chips + '</div>';

    var heroInner;
    switch (d.hero) {
      case 'poster':
        heroInner = '<section class="hero hero-poster"><div class="wrap"><p class="eyebrow">' + eyebrow + '</p><h1>' + esc(c.name) + '</h1><p class="sub">' + esc(c.tagline) + '</p><p class="lead">' + esc(c.lead) + '</p>' + btns + '</div>' + icon(ind.icon, 'poster-ic') + '</section>';
        break;
      case 'center':
        heroInner = '<section class="hero hero-center"><div class="wrap"><div class="seal">' + icon(ind.icon) + '</div><p class="eyebrow">' + eyebrow + '</p><h1>' + esc(c.tagline) + '</h1><p class="lead">' + esc(c.lead) + '</p>' + btns + '</div></section>';
        break;
      case 'editorial':
        heroInner = '<section class="hero hero-editorial"><div class="wrap"><p class="eyebrow">' + eyebrow + '</p><h1>' + esc(c.tagline) + '</h1><div class="ed-row"><p class="lead">' + esc(c.lead) + '</p>' + btns + '</div>' +
          '<dl class="facts"><div><dt>' + icon('clock') + ' Hours</dt><dd>' + esc(firstHours) + '</dd></div>' +
          (c.phone.show ? '<div><dt>' + icon('phone') + ' Call</dt><dd><a href="' + esc(tel) + '">' + esc(c.phone.show) + '</a></dd></div>' : '') +
          (c.city ? '<div><dt>' + icon('pin') + ' Find us</dt><dd>' + esc(c.city) + '</dd></div>' : '') + '</dl></div></section>';
        break;
      case 'card':
        heroInner = '<section class="hero hero-card"><div class="wrap"><div class="hero-box"><div class="hero-copy"><p class="eyebrow">' + eyebrow + '</p><h1>' + esc(c.tagline) + '</h1><p class="lead">' + esc(c.lead) + '</p>' + btns + '</div>' + art + '</div></div></section>';
        break;
      default:
        heroInner = '<section class="hero hero-split"><div class="wrap"><div class="hero-copy"><p class="eyebrow">' + eyebrow + '</p><h1>' + esc(c.tagline) + '</h1><p class="lead">' + esc(c.lead) + '</p>' + btns + '</div>' + art + '</div></section>';
    }

    var svcItems = c.services.map(function (s, i) {
      var price = s.price ? '$' + esc(s.price) : '';
      if (d.services === 'menu') return '<li class="m-item"><div class="m-top"><span class="m-name">' + esc(s.name) + '</span><span class="m-dots"></span><span class="m-price">' + (price || 'Ask') + '</span></div><p>' + esc(s.desc) + '</p></li>';
      if (d.services === 'numbered') return '<li class="n-item"><span class="n-no">' + ('0' + (i + 1)).slice(-2) + '</span><div><h3>' + esc(s.name) + '</h3><p>' + esc(s.desc) + '</p></div>' + (price ? '<span class="n-price">' + price + '</span>' : '') + '</li>';
      return '<li class="card"><span class="card-ic">' + icon(i === 0 ? ind.icon : ['check', 'star', 'heart', 'clock', 'shield', 'tag', 'sparkle', 'users'][i % 8]) + '</span><h3>' + esc(s.name) + '</h3><p>' + esc(s.desc) + '</p>' + (price ? '<span class="price">' + price + '</span>' : '') + '</li>';
    }).join('');
    var svcSection = '<section class="services" id="services"><div class="wrap"><div class="sec-head"><p class="eyebrow">' + esc(ind.svcTitle) + '</p><h2>' + esc(ind.svcTitle === 'Menu' ? 'What’s cooking' : 'What we do best') + '</h2></div><ul class="svc svc-' + d.services + '">' + svcItems + '</ul></div></section>';

    var points = c.points.map(function (pt) { return '<li><span class="pt-ic">' + icon(pt[0]) + '</span><h3>' + esc(pt[1]) + '</h3><p>' + esc(pt[2]) + '</p></li>'; }).join('');
    var aboutSection = '<section class="about about-' + d.about + '" id="about"><div class="wrap"><div class="about-copy"><p class="eyebrow">About</p><h2>Why ' + esc(c.city ? c.city : 'folks') + ' choose ' + esc(c.name) + '</h2><p class="lead">' + esc(c.about) + '</p></div><ul class="points">' + points + '</ul></div></section>';

    var hoursRows = c.hours.map(function (h) { return '<tr><th>' + esc(h[0] || 'Hours') + '</th><td>' + esc(h[1]) + '</td></tr>'; }).join('');
    var visitSection = '<section class="visit" id="visit"><div class="wrap"><div class="sec-head"><p class="eyebrow">Visit</p><h2>Come see us</h2></div><div class="visit-grid">' +
      '<div class="vcard"><h3>' + icon('clock') + ' Hours</h3><table>' + hoursRows + '</table>' + (c.sampleHours ? '<p class="note">Sample hours</p>' : '') + '</div>' +
      '<div class="vcard"><h3>' + icon('pin') + ' Find us</h3><p class="big">' + esc(c.city || 'Your address here') + '</p>' +
      (c.phone.show ? '<p><a class="tel" href="' + esc(tel) + '">' + icon('phone') + ' ' + esc(c.phone.show) + '</a></p>' : '') +
      '<a class="btn sm" href="#visit">Get directions ' + icon('arrow') + '</a></div>' +
      '<div class="vmap">' + mapSvg(d) + '</div></div></div></section>';

    var ctaSection = '<section class="cta cta-' + d.ctaStyle + '" id="contact"><div class="wrap"><div class="cta-in"><div><h2>' + esc(r1(ind.closers, d.seed)) + '</h2><p>' + esc(c.name) + (c.city ? ' · ' + esc(c.city) : '') + '</p></div><div class="actions"><a class="btn inv" href="' + esc(ctaHref === tel ? tel : '#contact') + '">' + esc(ind.cta) + '</a>' +
      '<a class="btn ghost inv-ghost" href="' + esc(tel) + '">' + icon('phone') + ' ' + esc(callLabel) + '</a></div></div></div></section>';

    var nav = '<nav class="links"><a href="#services">' + esc(ind.svcTitle) + '</a><a href="#about">About</a><a href="#visit">Visit</a></nav>';
    var header = '<header class="top top-' + d.headerStyle + '"><div class="wrap"><a class="brand" href="#top"><span class="mono">' + esc(c.mono) + '</span><span class="bname">' + esc(c.name) + '</span></a>' + nav + '<a class="btn sm" href="' + esc(tel) + '">' + icon('phone') + '<span class="hide-sm"> Call</span></a></div></header>';

    var R = d.radius;
    var btnRadius = { pill: '999px', soft: Math.max(R, 8) + 'px', square: Math.min(R, 3) + 'px', line: '0px' }[d.btn];
    var css = [
      ':root{--bg:' + p.bg + ';--surface:' + p.surface + ';--soft:' + p.soft + ';--ink:' + p.ink + ';--muted:' + p.muted + ';--line:' + p.line +
        ';--accent:' + p.accent + ';--accent-ink:' + p.accentInk + ';--on-accent:' + p.onAccent + ';--accent2:' + p.accent2 + ';--hdr:' + p.hdr +
        ';--r:' + R + 'px;--r-btn:' + btnRadius + ";--display:'" + f.d + "',Georgia,serif;--body:'" + f.b + "',system-ui,sans-serif;--dw:" + (f.dw || 700) +
        ';--ds:' + (f.ds || 1) + ';--ls:' + (f.ls || 0) + 'em;--tt:' + (f.up ? 'uppercase' : 'none') + ';--pattern:' + patternCss(d.pattern, d.dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)') + ';--color-scheme:' + (d.dark ? 'dark' : 'light') + '}',
      BASE_CSS,
    ].join('\n');

    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(c.name) + (c.city ? ' | ' + esc(c.city) : '') + '</title><meta name="robots" content="noindex">' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="' + esc(fontsUrl) + '" rel="stylesheet">' +
      '<style>' + css + '</style></head><body class="btn-' + d.btn + (d.dark ? ' dark' : '') + ' eb-' + d.eyebrowStyle + '">' +
      '<div class="sample">Sample design for <b>' + esc(c.name) + '</b> · not a live site yet</div>' + header +
      '<main id="top">' + heroInner + svcSection + aboutSection + visitSection + ctaSection + '</main>' +
      '<footer class="foot"><div class="wrap"><span>© ' + year + ' ' + esc(c.name) + (c.city ? ' · ' + esc(c.city) : '') + '</span><span class="credit">Sample design by jay.</span></div></footer>' +
      '</body></html>';
  }
  function r1(arr, seed) { return arr[hashStr(seed + 'cta') % arr.length]; }

  /* the stylesheet every generated page shares; the variables above make it look different */
  var BASE_CSS = [
    '*,*::before,*::after{box-sizing:border-box}html{scroll-behavior:smooth;color-scheme:var(--color-scheme)}',
    'body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}',
    'a{color:inherit}.wrap{width:min(1140px,100% - 40px);margin-inline:auto}',
    'svg.ic{width:1.1em;height:1.1em;flex:none;vertical-align:-.15em}',
    '.sample{background:#111;color:#ddd;font:13px/1.4 system-ui,sans-serif;text-align:center;padding:7px 14px}.sample b{color:#fff}',
    'h1,h2,h3{font-family:var(--display);font-weight:var(--dw);line-height:1.06;margin:0 0 .4em;text-transform:var(--tt);letter-spacing:var(--ls)}',
    'h1{font-size:calc(clamp(2.5rem,6.2vw,4.6rem) * var(--ds))}h2{font-size:calc(clamp(1.9rem,4vw,2.9rem) * var(--ds))}h3{font-size:calc(1.22rem * var(--ds))}',
    '.eyebrow{font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--accent-ink);margin:0 0 14px;display:flex;align-items:center;gap:10px}',
    '.eb-line .eyebrow::before{content:"";width:28px;height:2px;background:currentColor}.eb-dot .eyebrow::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor}',
    '.lead{font-size:1.12rem;color:var(--muted);max-width:58ch;margin:0 0 26px}',
    '.btn{display:inline-flex;align-items:center;gap:8px;padding:13px 22px;border-radius:var(--r-btn);background:var(--accent);color:var(--on-accent);text-decoration:none;font-weight:700;border:2px solid var(--accent);transition:transform .15s,filter .15s;white-space:nowrap}',
    '.btn:hover{transform:translateY(-2px);filter:brightness(1.07)}.btn.sm{padding:9px 15px;font-size:.92rem}',
    '.btn.ghost{background:transparent;color:var(--ink);border-color:var(--line)}.btn-line .btn{background:transparent;color:var(--accent-ink);border-width:0 0 2px;padding-inline:2px}.btn-line .btn.ghost{color:var(--ink);border-color:var(--line)}',
    '.actions{display:flex;flex-wrap:wrap;gap:12px}',
    /* header */
    'header.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--hdr) 90%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}',
    'header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:68px}',
    '.top-float{border:0!important;background:transparent!important;padding-top:12px}.top-float .wrap{background:var(--surface);border:1px solid var(--line);border-radius:calc(var(--r) + 6px);padding:0 10px 0 14px;box-shadow:0 8px 30px rgba(0,0,0,.08);min-height:60px}',
    '.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:var(--display);font-weight:var(--dw);font-size:1.18rem;line-height:1.1;text-transform:var(--tt);min-width:0}',
    '.bname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mono{display:grid;place-items:center;width:38px;height:38px;flex:none;border-radius:min(var(--r),12px);background:var(--accent);color:var(--on-accent);font-family:var(--body);font-weight:800;font-size:.85rem;letter-spacing:.02em}',
    'nav.links{display:flex;gap:24px;font-size:.95rem}nav.links a{text-decoration:none;opacity:.8}nav.links a:hover{opacity:1}',
    '.top-center .wrap{display:grid;grid-template-columns:1fr auto 1fr}.top-center nav.links{order:-1}.top-center .btn{justify-self:end}',
    /* heroes */
    '.hero{position:relative;padding:84px 0 92px;overflow:hidden}',
    '.hero-split::before,.hero-center::before,.hero-card::before,.hero-editorial::before{content:"";position:absolute;inset:0;background:var(--pattern);pointer-events:none;mask-image:linear-gradient(to bottom,#000,transparent 85%);-webkit-mask-image:linear-gradient(to bottom,#000,transparent 85%)}',
    '.hero .wrap{position:relative}',
    '.hero-split .wrap{display:grid;grid-template-columns:1.1fr .9fr;gap:56px;align-items:center}',
    '.art{position:relative;aspect-ratio:1;max-width:460px;width:100%;justify-self:center}',
    '.art-in{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(circle at 30% 25%,color-mix(in srgb,var(--accent2) 55%,transparent),transparent 60%),var(--accent);color:var(--on-accent);overflow:hidden}',
    '.art-in::after{content:"";position:absolute;inset:0;background:var(--pattern);opacity:.9}',
    '.art-circle .art-in{border-radius:50%}.art-arch .art-in{border-radius:999px 999px var(--r) var(--r)}.art-square .art-in{border-radius:calc(var(--r) * 2)}.art-blob .art-in{border-radius:58% 42% 55% 45%/48% 58% 42% 52%}',
    '.art-ic{width:42%;height:42%;stroke-width:1.2;opacity:.95;position:relative;z-index:1}',
    '.art-mono{position:absolute;bottom:13%;font-weight:800;letter-spacing:.3em;font-size:.9rem;opacity:.75;z-index:1}',
    '.chip{position:absolute;display:flex;align-items:center;gap:10px;background:var(--surface);color:var(--ink);border:1px solid var(--line);padding:11px 15px;border-radius:min(var(--r) + 4px,16px);box-shadow:0 14px 34px rgba(0,0,0,.14);font-size:.9rem;max-width:80%}',
    '.chip .ic{color:var(--accent-ink)}.chip-a{left:-6%;bottom:16%}.chip-b{right:-4%;top:12%}',
    '.hero-center{text-align:center}.hero-center .wrap{max-width:860px}.hero-center .lead{margin-inline:auto}.hero-center .actions,.hero-center .eyebrow{justify-content:center}',
    '.seal{display:inline-grid;place-items:center;width:72px;height:72px;border-radius:50%;border:1.5px solid var(--accent-ink);color:var(--accent-ink);margin-bottom:22px}.seal svg{width:32px;height:32px}',
    '.hero-poster{background:var(--accent);color:var(--on-accent);padding:96px 0 104px}.hero-poster::before{content:"";position:absolute;inset:0;background:var(--pattern);opacity:.8}',
    '.hero-poster h1{font-size:calc(clamp(3rem,10vw,8rem) * var(--ds));line-height:.92;max-width:14ch}.hero-poster .sub{font-family:var(--display);font-size:clamp(1.3rem,2.6vw,1.9rem);margin:0 0 12px;text-transform:var(--tt)}',
    '.hero-poster .eyebrow,.hero-poster .lead{color:inherit;opacity:.88}.hero-poster .btn{background:var(--on-accent);color:var(--accent);border-color:var(--on-accent)}.hero-poster .btn.ghost{background:transparent;color:var(--on-accent);border-color:currentColor}',
    '.poster-ic{position:absolute;right:-4%;bottom:-12%;width:min(48vw,520px);height:auto;opacity:.13;stroke-width:1}',
    '.hero-editorial h1{font-size:calc(clamp(2.8rem,7.4vw,6rem) * var(--ds));max-width:16ch;line-height:.98}',
    '.ed-row{display:flex;flex-wrap:wrap;gap:22px 48px;align-items:flex-end;justify-content:space-between;margin-top:26px}.ed-row .lead{margin:0}',
    '.facts{display:grid;grid-template-columns:repeat(3,1fr);margin:56px 0 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.facts>div{padding:20px 22px 20px 0}.facts>div+div{padding-left:22px;border-left:1px solid var(--line)}',
    '.facts dt{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);display:flex;gap:8px;align-items:center}.facts dd{margin:6px 0 0;font-weight:600}',
    '.hero-card{padding:36px 0 70px}.hero-box{display:grid;grid-template-columns:1.15fr .85fr;gap:40px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:calc(var(--r) + 10px);padding:clamp(28px,5vw,64px);box-shadow:0 24px 60px rgba(0,0,0,.08)}',
    /* sections */
    'section{padding:88px 0}.sec-head{margin-bottom:38px;max-width:640px}',
    '.services{background:var(--surface);border-block:1px solid var(--line)}',
    '.svc{list-style:none;margin:0;padding:0}',
    '.svc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}',
    '.card{position:relative;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);padding:26px}.card p{margin:0;color:var(--muted)}',
    '.card-ic{display:grid;place-items:center;width:46px;height:46px;border-radius:min(var(--r),14px);background:var(--soft);color:var(--accent-ink);margin-bottom:16px}.card-ic svg{width:22px;height:22px}',
    '.price{position:absolute;top:24px;right:24px;font-weight:800;color:var(--accent-ink)}',
    '.svc-menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:6px 56px}',
    '.m-item{padding:16px 0;border-bottom:1px dashed var(--line)}.m-top{display:flex;align-items:baseline;gap:10px}.m-name{font-family:var(--display);font-weight:var(--dw);font-size:calc(1.2rem * var(--ds));text-transform:var(--tt)}',
    '.m-dots{flex:1;border-bottom:2px dotted var(--line);transform:translateY(-4px)}.m-price{font-weight:800;color:var(--accent-ink)}.m-item p{margin:4px 0 0;color:var(--muted);font-size:.95rem}',
    '.svc-numbered{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:0 40px}',
    '.n-item{display:flex;gap:20px;align-items:flex-start;padding:24px 0;border-top:1px solid var(--line)}.n-no{font-family:var(--display);font-size:2rem;line-height:1;color:var(--accent-ink);min-width:2ch}.n-item p{margin:0;color:var(--muted)}.n-item h3{margin-bottom:4px}.n-price{margin-left:auto;font-weight:800}',
    '.about .wrap{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:start}',
    '.points{list-style:none;margin:0;padding:0;display:grid;gap:16px}.points li{display:grid;grid-template-columns:auto 1fr;column-gap:16px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:20px}',
    '.points h3{margin:0 0 2px;font-size:calc(1.08rem * var(--ds))}.points p{grid-column:2;margin:0;color:var(--muted)}',
    '.pt-ic{grid-row:span 2;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:var(--accent);color:var(--on-accent)}.pt-ic svg{width:20px;height:20px}',
    '.about-band .wrap{grid-template-columns:1fr}.about-band .points{grid-template-columns:repeat(3,1fr)}',
    '.about-split .about-copy{position:sticky;top:110px}',
    '.visit{background:var(--soft)}',
    '.visit-grid{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:18px}',
    '.vcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:26px}.vcard h3{display:flex;gap:10px;align-items:center}.vcard h3 svg{color:var(--accent-ink)}',
    '.vcard table{width:100%;border-collapse:collapse;font-size:.96rem}.vcard th{text-align:left;font-weight:600;padding:7px 12px 7px 0;vertical-align:top}.vcard td{padding:7px 0;color:var(--muted);text-align:right}.vcard tr+tr{border-top:1px solid var(--line)}',
    '.vcard .big{font-size:1.2rem;font-weight:700;margin:0 0 6px}.tel{display:inline-flex;gap:8px;align-items:center;text-decoration:none;font-weight:600}.note{font-size:.8rem;color:var(--muted);margin:10px 0 0}',
    '.vmap{border-radius:var(--r);overflow:hidden;border:1px solid var(--line);min-height:240px}.map{display:block;width:100%;height:100%;min-height:240px}',
    '.cta-band{background:var(--ink);color:var(--bg)}.cta-card .cta-in{background:var(--accent);color:var(--on-accent);border-radius:calc(var(--r) + 8px);padding:clamp(28px,5vw,56px)}',
    '.cta-in{display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between}.cta-in h2{margin:0 0 6px;max-width:20ch}.cta-in p{margin:0;opacity:.75}',
    '.cta-band .btn.inv{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}.cta-band .inv-ghost{color:var(--bg);border-color:color-mix(in srgb,var(--bg) 40%,transparent)}',
    '.cta-card .btn.inv{background:var(--on-accent);color:var(--accent);border-color:var(--on-accent)}.cta-card .inv-ghost{color:var(--on-accent);border-color:currentColor}',
    '.btn-line .cta .btn,.btn-line .hero-poster .btn{border-width:2px;padding-inline:20px}',
    '.foot{padding:28px 0;font-size:.88rem;color:var(--muted)}.foot .wrap{display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between}.credit{opacity:.75}',
    /* phones */
    '@media (max-width:860px){nav.links{display:none}.top-center .wrap{display:flex}.hero{padding:56px 0 64px}.hero-split .wrap,.hero-box,.about .wrap{grid-template-columns:1fr;gap:36px}',
    '.art{max-width:340px}.chip-a{left:0}.chip-b{right:0}.facts{grid-template-columns:1fr}.facts>div+div{padding-left:0;border-left:0;border-top:1px solid var(--line)}',
    '.about-band .points{grid-template-columns:1fr}.about-split .about-copy{position:static}.visit-grid{grid-template-columns:1fr}section{padding:64px 0}.svc-menu{grid-template-columns:1fr}}',
    '@media (max-width:520px){.wrap{width:calc(100% - 32px)}.hide-sm{display:none}.btn{padding:12px 18px}.actions .btn{flex:1 1 auto;justify-content:center}.price{position:static;display:block;margin-top:10px}.poster-ic{width:70vw}}',
    '@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.btn{transition:none}}',
  ].join('\n');

  /* ---------- the sales pitch ---------- */
  function suggest(inputs, cfg) {
    var ind = INDUSTRIES[inputs.type] || INDUSTRIES.other;
    var goals = String(inputs.goals || '');
    var fromGoals = [];
    GOAL_WORDS.forEach(function (g) { if (g[0].test(goals) && fromGoals.indexOf(g[1]) < 0) fromGoals.push(g[1]); });
    var services = parseServices(inputs.services);
    var list = fromGoals.slice();
    ind.features.forEach(function (k) { if (list.indexOf(k) < 0) list.push(k); });
    if (services.some(function (s) { return s.price; }) && list.indexOf('pricelist') < 0 && list.indexOf('menu') < 0) list.splice(2, 0, 'pricelist');
    if (/24\s*\/?\s*7|24 hours|emergency/i.test(inputs.hours || '') && list.indexOf('emergency') < 0) list.unshift('emergency');
    list = list.filter(function (k) { return k !== 'domain' && k !== 'seo'; });

    var heavyAsked = fromGoals.filter(function (k) { return FEATURES[k] && FEATURES[k].heavy; }).length;
    var tier = heavyAsked >= 2 || fromGoals.length >= 4 ? 'premium'
      : (inputs.type === 'other' || !inputs.type) && !fromGoals.length && services.length <= 3 ? 'starter' : 'standard';

    var tiers = {};
    Object.keys(cfg.tiers).forEach(function (key) {
      var t = cfg.tiers[key], feats = list.slice(0, t.extraFeatures || 0);
      tiers[key] = { key: key, name: t.name, amount: t.amount, blurb: t.blurb, includes: t.includes, features: feats };
    });
    var out = { tier: tier, features: list, tiers: tiers, currency: cfg.currency };
    out.headline = headlineFor(out, tier);
    return out;
  }
  /* "Get this live for $150 with features like X, Y and Z!" for any tier */
  function headlineFor(sg, key) {
    var t = sg.tiers[key];
    var names = key === 'starter'
      ? ['a tap-to-call button', FEATURES.maps.name, 'a phone-first layout']
      : t.features.slice(0, 3).map(function (k) { return FEATURES[k].name; });
    return 'Get this live for ' + sg.currency + t.amount + ' with features like ' + listJoin(names) + '!';
  }

  var api = {
    render: render, suggest: suggest, headlineFor: headlineFor, listJoin: listJoin, newSeed: newSeed, design: design, contrast: contrast,
    parseServices: parseServices, parseHours: parseHours, phoneFmt: phoneFmt,
    INDUSTRIES: INDUSTRIES, VIBES: VIBES, COLORS: COLORS, FEATURES: FEATURES,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SiteGen = api;
})(typeof window !== 'undefined' ? window : globalThis);
