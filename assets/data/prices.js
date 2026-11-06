/* ==========================================================================
   PRICES — the one place every price on the site comes from.
   --------------------------------------------------------------------------
   To change a price: edit the number below and save. That's it.
   - amount: a number in dollars, or null → shows "quote on request"
   - per:    optional text after the number, e.g. ' per fix' or '/mo'
   - or:     optional second price, shown as "…, or $15/mo care plan"
   Every <b data-price="key"> in index.html is filled from this list.
   If JavaScript is off, those spots say "quote on request".
   ========================================================================== */
window.PRICES = {
  currency: '$',
  label: 'from',                      // word in front of every price
  onRequest: 'quote on request',      // shown when amount is null
  items: {
    'websites':         { amount: 75 },                     // 01 websites + landing pages
    'web-apps':         { amount: 150 },                    // 02 custom web apps + tools
    'ai':               { amount: 100 },                    // 03 ai chatbots + integrations
    'automation':       { amount: 40 },                     // 04 automation + scripts
    'discord-bots':     { amount: 50 },                     // 05 discord bots + server setup
    'mobile':           { amount: null },                   // 06 ios / mobile prototypes
    'maintenance':      { amount: 15, per: ' per fix',      // 07 fixes + maintenance
                          or: { amount: 15, per: '/mo care plan' } },
    'custom-showpiece': { amount: 300 },                    // the "like this one" line
  },
};

/* fill in the page: now for what's already parsed, and again once the whole
   page is ready (for anything further down, like the easter egg) */
(function () {
  var cfg = window.PRICES;
  function money(p) { return cfg.currency + p.amount + (p.per || ''); }
  function fill() {
    var els = document.querySelectorAll('[data-price]');
    for (var i = 0; i < els.length; i++) {
      var item = cfg.items[els[i].getAttribute('data-price')];
      if (!item) continue;
      els[i].textContent = item.amount == null
        ? cfg.onRequest
        : cfg.label + ' ' + money(item) + (item.or ? ', or ' + money(item.or) : '');
    }
  }
  fill();
  document.addEventListener('DOMContentLoaded', fill);
})();
