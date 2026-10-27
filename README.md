# AGCC Scorer — AGCC 2026/2027

Mobile-first cricket tournament scorer for GitHub Pages, with Supabase Auth, shared cloud scoreboard state and Realtime updates.

## Features
- Live scoreboard, overs, run rate, target, ball-by-ball history
- Batter and bowler scorecards
- Runs 0–6, wides, no-balls, byes, leg-byes, penalty, wicket-type selection
- Undo last recorded action (current browser session)
- Team and player management, Playing XI selection
- Fixtures, results and points table
- Share score, export/import JSON backup
- Supabase email/password admin login; only `app_metadata.role = admin` can write shared cloud state
- Supabase Realtime updates for visitors viewing the same scoreboard

## Before uploading to GitHub Pages
1. Open `config.js`.
2. Keep the provided Supabase URL. Replace `PASTE_YOUR_EXISTING_SUPABASE_PUBLISHABLE_KEY_HERE` with the **publishable/anon key** from Supabase Project Settings → API Keys. Never use a `service_role` or secret key in browser code.
3. Confirm `public.app_state` exists, RLS is enabled, and its SELECT policy is public while INSERT/UPDATE policies allow only authenticated users whose `app_metadata.role` is `admin`.
4. In Supabase Auth, create the admin user. In that user's **app_metadata** set `role` to `admin` (not user-editable `user_metadata`).
5. Ensure `app_state` is included in the `supabase_realtime` publication.
6. Upload all six files (`index.html`, `style.css`, `app.js`, `config.js`, `supabase-schema.sql`, `README.md`) to the repository root. Commit changes, then open the GitHub Pages URL.
7. Open Admin → Admin Login and sign in. On first admin sign-in, if no cloud snapshot exists, the current app state is uploaded as the initial shared snapshot.

## Important data behaviour
- `app_state` is the shared cloud snapshot. Visitors can read it and receive Realtime updates; only an admin account can save changes to cloud.
- A visitor's local browser may still hold its own cache. Admin sign-in pulls the current cloud snapshot.
- The supplied database schema creates the underlying cricket tables and `app_state`; this frontend currently uses `app_state` as its shared application snapshot rather than writing each delivery into the normalized `teams/players/matches/innings/deliveries` tables.
- Wicket type is recorded. For Run Out/Mankad, confirm the dismissed batter using the batter selector; advanced run-out crossing/strike logic is not yet a full official scorer implementation.
- Undo history is kept in memory and resets on page refresh. Export a JSON backup before major changes.
- External Supabase JS CDN and Google Fonts require an internet connection.

## If Supabase login fails
- Confirm the publishable/anon key is copied correctly into `config.js`.
- Confirm email/password login is enabled and the user exists.
- Check that `app_metadata.role` is exactly `admin` for the scorer account.
- Check RLS policies on `app_state`; do not disable RLS to make the app work.

## GitHub Pages
Repository → Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save.
