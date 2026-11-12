/* ==========================================================================
   SITE BUILDER SETTINGS: the only file you need to touch to change prices
   or where claims go.
   ========================================================================== */
window.BUILDER_CONFIG = {

  /* Where "Claim this site" sends things. Checked in this order:
     1. claimEndpoint: a form service URL that accepts a JSON POST
        (e.g. a Formspree form URL like https://formspree.io/f/xxxxxxx).
     2. claimEmail: opens the visitor's email app with everything filled in.
     3. both blank: the visitor gets their details to copy and your Discord. */
  claimEndpoint: '',   // TODO: paste the form endpoint URL
  claimEmail: 'jay.mz@icloud.com',
  discord: '.jaypatty',

  /* Prices. amount is in dollars. Kept the same as the Fiverr gig packages. */
  currency: '$',
  tiers: {
    starter: {
      name: 'Starter',
      amount: 85,
      blurb: 'This one-page site, live and on your phone screen.',
      includes: ['this design, built for real', 'tap-to-call button', 'hours, map and directions', 'one round of changes'],
    },
    standard: {
      name: 'Standard',
      amount: 195,
      blurb: 'The site plus the features your customers actually use.',
      includes: ['everything in Starter', 'your own .com set up', 'two rounds of changes'],
      extraFeatures: 3,          // how many of the guessed features this tier adds
    },
    premium: {
      name: 'Premium',
      amount: 425,
      blurb: 'The full setup, so the site works for you every day.',
      includes: ['everything in Standard', 'Google search setup', 'three rounds of changes'],
      extraFeatures: 6,
    },
  },
  carePlan: { amount: 15, per: '/mo', text: 'optional care plan for updates after launch' },
};
