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
    'data':             { amount: 15 },                     // data analysis + dashboards
    'it-support':       { amount: 10, per: '/session' },    // IT support + troubleshooting
    'security':         { amount: 30 },                    // security basics: logins, tokens, protection
    // --- levels: each card's first level uses the card's own price above; these are levels 2 and 3 ---
    'data-report':      { amount: 40 },                    // data: report
    'data-dashboard':   { amount: 90 },                    // data: dashboard
    'it-setup':         { amount: 25 },                     // it: setup day
    'it-plan':          { amount: 20, per: '/mo' },         // it: support plan
    'security-standard':{ amount: 80 },                    // security: standard
    'security-full':    { amount: 140 },                    // security: full basics
    'discord-bot':      { amount: 35 },                    // discord: one custom bot
    'discord-system':   { amount: 150 },                    // discord: the full system
    'website-small':    { amount: 60 },                    // websites: small site
    'web-app-standard': { amount: 110 },                    // web apps: app with accounts
    'web-app-full':     { amount: 220 },                    // web apps: full app
    // --- the big jobs (estimates: the final price is quoted after a feasibility check) ---
    'embedded':         { amount: 150 },                    // embedded + hardware projects
    'ios-app':          { amount: 250 },                    // a full custom iOS app
    'ai-assistant':     { amount: 150 },                    // an AI assistant wired into your tools
    'backends':         { amount: 30 },                    // APIs, backends + hosting
    'websites':         { amount: 25 },                     // websites + landing pages
    'web-apps':         { amount: 40 },                    // 02 custom web apps + tools
    'ai':               { amount: 40 },                    // 03 ai chatbots + integrations
    'automation':       { amount: 15 },                     // 04 automation + scripts
    'discord-bots':     { amount: 15 },                     // 05 discord bots + server setup
    'mobile':           { amount: 50 },                    // ios / mobile prototypes
    'maintenance':      { amount: 10, per: ' per fix',      // 07 fixes + maintenance
                          or: { amount: 10, per: '/mo care plan' } },
    'custom-showpiece': { amount: 120 },                    // the "like this one" line
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
