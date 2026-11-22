/* jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable (LICENSE)

   "Everything I can do": 100 different things, each with its own level and its own price.
   Used by assets/js/everything.js on the commissions page.

   Pricing rule: every price is a "from" price. Each category has three levels and a starting
   price per level (the same numbers as the level tabs on the commission cards in prices.js):
     data 60 / 120 / 250      it support 20 / 60 / 120    security 100 / 200 / 350
     discord 50 / 100 / 250   websites 75 / 150 / 300     web apps 150 / 300 / 500
     automation 40 / 100 / 200   ai 100 / 200 / 300       backends 100 / 200 / 400
     hardware + mobile 100 / 300 / 500
   A box never costs less than its level's starting price, and the harder things in a level
   cost up to about 1.6x that. Hardware and iOS apps say "yes or no first" because I check that
   they can be done before any money moves.

   Item: [category, level (1-3), title, one line, price, per?, flags]
   flags: "b" = I have built this before (it exists in skyscrob or my Discord bots),
          "y" = yes or no first. */
window.EVERYTHING = {
  cats: [
    { name: 'Data',              levels: ['Quick answer', 'Report', 'Dashboard'] },
    { name: 'IT support',        levels: ['Quick fix', 'Setup day', 'Support plan'] },
    { name: 'Security basics',   levels: ['Basics', 'Standard', 'Full basics'] },
    { name: 'Discord',           levels: ['Server setup', 'One custom bot', 'The full system'] },
    { name: 'Websites',          levels: ['Landing page', 'Small site', 'Showpiece'] },
    { name: 'Web apps',          levels: ['Small tool', 'App with accounts', 'Full app'] },
    { name: 'Automation',        levels: ['Script', 'Workflow', 'System'] },
    { name: 'AI',                levels: ['Helper', 'Assistant', 'Full assistant'] },
    { name: 'Backends + APIs',   levels: ['Small API', 'API + database', 'Full backend'] },
    { name: 'Hardware + mobile', levels: ['Prototype', 'Device project', 'Full build'] },
  ],
  items: [
    // ---- data ----
    [0, 1, 'Clean a messy spreadsheet', 'Fix dates, duplicates and typos so it is usable.', 60],
    [0, 1, 'Answer one data question', 'A query or pivot table and a short written answer.', 60],
    [0, 1, 'Turn a CSV into a chart', 'One clear chart you can drop into a doc or a post.', 70],
    [0, 1, 'Merge two spreadsheets', 'Match rows from two sources into one clean sheet.', 80],
    [0, 2, 'Monthly report that re-runs', 'Several sources in, one repeatable report out.', 120],
    [0, 2, 'Member or sales stats', 'Counts, trends and top lists from your exports.', 130],
    [0, 2, 'Survey results breakdown', 'Responses cleaned, grouped and charted.', 150],
    [0, 3, 'Live dashboard', 'Charts that update from your data on their own.', 250],
    [0, 3, 'Data pipeline', 'Pulls from an API or sheet on a schedule into a database.', 350],
    [0, 3, 'Report sent on a schedule', 'A finished report lands in Discord or email every week.', 280],
    // ---- it support ----
    [1, 1, 'Fix an account lockout', 'Get you back into an account and make it safer.', 20, '/session'],
    [1, 1, 'Clean up a slow computer', 'Find what is slowing it down and fix it.', 20, '/session'],
    [1, 1, 'Set up two-factor login', 'Turn on 2FA and store the backup codes properly.', 25, '/session'],
    [1, 1, 'Fix email or calendar sync', 'Sort out accounts that will not sync.', 25, '/session'],
    [1, 2, 'Set up a new computer', 'Apps, accounts, backups and settings in one go.', 60],
    [1, 2, 'Backups that actually work', 'Automatic backups, tested with a real restore.', 70],
    [1, 2, 'Password manager setup', 'Move your logins in and show you how to use it.', 60],
    [1, 3, 'Monthly support plan', 'A regular check-in plus fixes as they come up.', 40, '/mo'],
    [1, 3, 'Small team setup', 'Accounts, shared files and permissions for a small group.', 150],
    [1, 3, 'Document your setup', 'A written guide so anyone can fix it later.', 120],
    // ---- security basics ----
    [2, 1, 'Check a site\'s basics', 'Headers, cookies and exposed secrets, with a fix list.', 100],
    [2, 1, 'Find leaked keys in a repo', 'Scan your code and its whole history for secrets.', 100, null, 'b'],
    [2, 1, 'Move secrets out of your code', 'Environment variables and a safe place to keep keys.', 110],
    [2, 1, 'Add a Discord login', 'OAuth2 sign-in with Discord, done safely.', 150],
    [2, 2, 'Google or GitHub login', 'OAuth2 sign-in with safe token handling.', 200],
    [2, 2, 'Lock down sessions and cookies', 'HttpOnly, Secure and SameSite set properly.', 200, null, 'b'],
    [2, 2, 'Stop CSRF on your forms', 'A token plus an origin check on every change.', 220, null, 'b'],
    [2, 2, 'Secret scanner for your repo', 'Fails the build if a key ever gets committed.', 200, null, 'b'],
    [2, 3, 'Encrypt stored tokens', 'Tokens encrypted at rest and tied to where they live.', 350, null, 'b'],
    [2, 3, 'Security write-up and review', 'What is covered, what is not, and what to fix next.', 400],
    // ---- discord ----
    [3, 1, 'Server setup', 'Roles, channels and permissions set up properly.', 50, null, 'b'],
    [3, 1, 'Welcome message and rules', 'A welcome post and a rules command.', 50, null, 'b'],
    [3, 1, 'Built-in AutoMod rules', 'Spam, invite links and blocked words, with staff alerts.', 60, null, 'b'],
    [3, 1, 'Role menus', 'Let members pick their own roles with buttons.', 70, null, 'b'],
    [3, 2, 'Moderation bot', 'Warn, timeout, kick and ban, every action saved as a case.', 100, null, 'b'],
    [3, 2, 'Role applications', 'A form, staff review, and approve or deny.', 120, null, 'b'],
    [3, 2, 'Counting game bot', 'A counting channel that even accepts math like 2x+5=45.', 100, null, 'b'],
    [3, 3, 'Moderation with escalation', 'Repeat offenders get stricter results, with appeals and a log.', 250, null, 'b'],
    [3, 3, 'AI chat bot', 'Replies in character and looks up your real rules.', 280, null, 'b'],
    [3, 3, 'The whole server system', 'Moderation, applications, welcome and AI chat, end to end.', 300, null, 'b'],
    // ---- websites ----
    [4, 1, 'One-page site', 'A single page that does one job.', 75],
    [4, 1, 'Link-in-bio page', 'All your links on one fast page.', 75],
    [4, 1, 'Event page', 'Date, place, details and a way to reach you.', 85],
    [4, 1, 'Menu or price list page', 'Your services or menu, easy to read on a phone.', 90],
    [4, 2, 'Small business site', 'Up to about five pages with a contact path that works.', 150],
    [4, 2, 'Portfolio site', 'Show your work properly, in your own style.', 180],
    [4, 2, 'Site refresh', 'Take an old site and rebuild it faster and cleaner.', 160],
    [4, 3, 'Showpiece site', 'A custom, memorable site with hand-built effects.', 300],
    [4, 3, 'Interactive landing page', 'Animation and interaction that make people stay.', 350],
    [4, 3, 'A site with its own design system', 'Fonts, colours and pieces that stay consistent.', 400],
    // ---- web apps ----
    [5, 1, 'Calculator or converter', 'One small tool that does one thing well.', 150],
    [5, 1, 'Tracker', 'Track anything in a simple, fast tool.', 160],
    [5, 1, 'Form that fills a spreadsheet', 'Collect answers and keep them in one sheet.', 150],
    [5, 1, 'Countdown or timer page', 'A clean page for events, launches or goals.', 150],
    [5, 2, 'Tool with logins', 'A small app where each person has an account.', 300],
    [5, 2, 'Booking or sign-up page', 'People sign up and you see who is coming.', 330],
    [5, 2, 'Admin panel', 'A page to manage your data without touching code.', 350],
    [5, 3, 'Multi-user app with roles', 'Roles, permissions and a real database.', 500],
    [5, 3, 'Team dashboard app', 'Charts and tables for a team, with logins.', 550],
    [5, 3, 'A full product build', 'Several features, deployed, with written notes.', 700],
    // ---- automation ----
    [6, 1, 'Rename and sort files', 'A script that tidies a folder for you.', 40],
    [6, 1, 'Pull a public page into a sheet', 'Collect info from a public page, respecting its rules.', 50],
    [6, 1, 'Daily reminder', 'A message to Discord or email on a schedule.', 40],
    [6, 1, 'Bulk edit script', 'Change hundreds of items at once without clicking.', 60],
    [6, 2, 'Spreadsheet to Discord alerts', 'A new row sends a message to your server.', 100],
    [6, 2, 'Auto-posting bot', 'Posts updates to your server on a schedule.', 100],
    [6, 2, 'Form that triggers several steps', 'One submission kicks off a chain of actions.', 120],
    [6, 3, 'Multi-step workflow', 'Several tools chained so the boring work runs itself.', 200],
    [6, 3, 'Monitoring with alerts', 'Checks something and tells you when it breaks.', 220],
    [6, 3, 'Automation that retries and logs', 'Keeps running and keeps a record when things fail.', 250],
    // ---- ai ----
    [7, 1, 'Chatbot for your FAQ', 'Answers the questions you keep getting.', 100],
    [7, 1, 'Summarize long text', 'Turn long threads or documents into short summaries.', 100],
    [7, 1, 'Reply drafter you review', 'Drafts replies that you read and send yourself.', 120],
    [7, 1, 'Rewrite in your voice', 'Your text, cleaned up and still sounding like you.', 100],
    [7, 2, 'Bot that looks things up', 'Pulls real answers from your data instead of guessing.', 200],
    [7, 2, 'Ask your documents', 'Search and question your own files.', 220],
    [7, 2, 'Server assistant with your real rules', 'Answers members from your actual rules and info.', 200, null, 'b'],
    [7, 3, 'Assistant that asks before it acts', 'Proposes actions and waits for a human to confirm.', 300, null, 'b'],
    [7, 3, 'Model picker with usage limits', 'A smarter model for hard questions, with budgets.', 350, null, 'b'],
    [7, 3, 'AI wired into your tools', 'Connected to your systems, like my Discord bots.', 320, null, 'b'],
    // ---- backends + apis ----
    [8, 1, 'A small API', 'A few endpoints that return what you need.', 100],
    [8, 1, 'Webhook receiver', 'Catches events from another service and acts on them.', 100],
    [8, 1, 'Hosting setup', 'Get something deployed and running online.', 100],
    [8, 1, 'Domain and HTTPS', 'Point your domain at your site over a secure connection.', 100],
    [8, 2, 'API with a database', 'Store and read your data safely.', 200],
    [8, 2, 'Login-protected API', 'Only the right people can use it.', 250],
    [8, 2, 'Scheduled jobs', 'Tasks that run on their own at set times.', 200],
    [8, 3, 'A full backend', 'Database, logins, scheduled jobs and deployment.', 400],
    [8, 3, 'Cloudflare Worker app', 'Serverless and fast, like my project skyscrob.', 450, null, 'b'],
    [8, 3, 'Backups and monitoring', 'Your data backed up and problems noticed early.', 400],
    // ---- hardware + mobile ----
    [9, 1, 'Phone app prototype', 'A clickable prototype to test an idea.', 100],
    [9, 1, 'Sensor reading logger', 'A board that records readings to a file or screen.', 150, null, 'y'],
    [9, 1, 'LED or button project', 'A small device you can interact with.', 120, null, 'y'],
    [9, 1, 'Raspberry Pi dashboard', 'Show readings from a Pi on a web page.', 150, null, 'y'],
    [9, 2, 'Microcontroller project', 'Firmware for a board, scoped together first.', 300, null, 'y'],
    [9, 2, 'Device that sends Discord alerts', 'A board that messages your server when something happens.', 350, null, 'y'],
    [9, 2, 'iOS app in SwiftUI', 'A native app built and tested with you.', 400, null, 'y'],
    [9, 3, 'Hardware and app together', 'A device and an app that work as one.', 600, null, 'y'],
    [9, 3, 'A full iOS app', 'Built end to end. You provide the Apple developer account.', 500, null, 'y'],
    [9, 3, 'Something unusual', 'If we can pull it off, we do it. I say yes or no first.', 500, null, 'y'],
  ],
};
