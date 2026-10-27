# AGCC Scorer — Cricket Tournament Web App

Mobile-first cricket scoring and tournament management starter for **Arati Gram Cricket Carnival**. Runs as a static website and can be hosted on GitHub Pages.

## Included
- Live score panel, overs, target, current run rate and ball-by-ball history
- Batter figures: runs, balls, fours, sixes, strike rate, out/not out
- Bowler figures: overs, runs, wickets and economy
- Wide, No Ball, Bye, Leg Bye, penalty, wicket, undo and strike swap
- Teams, squads, player roles and Playing XI selection
- Fixtures and loading a fixture into live scorer
- Basic points table (win 2, tie/no result 1)
- Admin settings, JSON export/import and reset
- Share score text using device share sheet or clipboard
- Supabase starter SQL schema

## Run locally
Open `index.html` in a browser. No build step is required. Data is saved in the current browser using localStorage.

## Publish with GitHub Pages
1. Create a GitHub repository, e.g. `agcc-scorer`.
2. Upload every file from this folder to the repository root.
3. Open **Settings → Pages**.
4. Choose **Deploy from a branch**, branch `main`, folder `/(root)`, then Save.
5. Wait for the deployment URL.

## Important limitations
- **Local mode is the default.** Scores and teams live in the browser that entered them. A share link does not sync the live score to other devices.
- The current UI is a usable starter, not an official scorebook: run-outs, retired hurt, no-ball + bat runs in one combined action, over-by-over bowler changes, strike rotation nuances, and detailed NRR calculations need further development.
- Points table currently determines wins from completed fixtures; NRR is a placeholder.
- The Admin page is not password protected. Do not expose sensitive operations on a public website.
- `config.js` is a placeholder. The SQL schema is provided for a Supabase database, but this frontend does **not yet sync records to Supabase**. Add authenticated database integration and proper Row Level Security before claiming shared live scoring.
- Never put a Supabase `service_role` key or any secret in GitHub Pages code. Browser apps may only use the public anon/publishable key with correct RLS policies.

## Supabase setup (database schema only)
1. Create a project in Supabase.
2. Open SQL Editor and run `supabase-schema.sql`.
3. Keep RLS enabled. The included policies allow public SELECT only; add authenticated admin policies for writes.
4. To enable actual shared live sync, the application code must be extended to read/write teams, players, matches, innings and deliveries through Supabase Auth and the JS client. That integration is not active in this starter.

## Tournament defaults
Preloaded teams are sample AGCC team names. Edit or delete them and create your real teams and players in the Teams & Players tab.
