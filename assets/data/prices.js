/* ==========================================================================
   PRICES — the one place every price on the site comes from.
   --------------------------------------------------------------------------
   To change a price: edit the number below and save. That's it.
   - amount: a number in dollars, or null for "not set yet" (shows "on request")
   - per:    optional suffix, e.g. '/mo'
   Every <b data-price="key"> in index.html is filled from this list. If
   JavaScript is off, those spots simply say "on request".
   ========================================================================== */
window.PRICES = {
  currency: '$',
  items: {
    // websites
    'clean-site':       { amount: 75 },
    'custom-showpiece': { amount: 300 },

    // add-ons
    'extra-page':       { amount: 25 },
    'domain-hosting':   { amount: 30 },        // client pays for the domain itself
    'care-plan':        { amount: 15, per: '/mo' },

    // other commissions (fill these in when you're ready)
    'discord-bots':     { amount: null },
    'minecraft-builds': { amount: null },
    'roblox':           { amount: null },
    'skins':            { amount: null },
    'graphics':         { amount: null },
  },
};

/* fill in the page (runs now for what's already parsed, and again once the
   whole page is ready for anything further down, like the footer) */
(function () {
  var cfg = window.PRICES;
  function fill() {
    var els = document.querySelectorAll('[data-price]');
    for (var i = 0; i < els.length; i++) {
      var item = cfg.items[els[i].getAttribute('data-price')];
      if (!item || item.amount == null) continue;   // keep "on request"
      els[i].textContent = cfg.currency + item.amount + (item.per || '');
    }
  }
  fill();
  document.addEventListener('DOMContentLoaded', fill);
})();
