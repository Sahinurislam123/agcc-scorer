# AGCC Scorer — Admin Scorer + Public User View

Mobile-first static cricket scorer for Arati Gram Cricket Carnival. Deploy the files in this folder to the root of the GitHub Pages repository.

## Pages
- `index.html` — scorer/admin page. Supabase admin-role users can edit scores and tournament data.
- `user-view.html` — public read-only view for live score, scorecard, ball history, all saved fixtures, teams/players, points table, and sharing links.
- Share Live Match and Share Tournament buttons create public links that work on GitHub Pages.

## Supabase setup
1. Open `config.js` and retain your project's Supabase URL and **publishable/anon key**. Never place a `service_role` or secret key in browser code.
2. In Supabase, make sure `public.app_state` exists and its SELECT RLS policy permits public read (`using (true)`). Admin insert/update policies should check `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`.
3. In Supabase Auth, create the admin user, then set its **app_metadata** role to `admin` using a trusted server-side/admin method. Do not use user-editable `user_metadata` for authorization.
4. In Supabase Dashboard > Database > Publications, enable `app_state` in `supabase_realtime`.
5. Ensure the `app_state` table is in the `public` schema, with `id = 'main'` and a JSONB `state` column.
6. Deploy all files in the repository root. GitHub Pages should serve `index.html` as the default page.

## Public sharing
- Tournament: `user-view.html?view=tournament`
- Live match: `user-view.html?view=match&match=<current-match-id>`

The public page never renders score-edit controls. It reads the shared `app_state` snapshot and listens to Supabase Realtime changes. Public visibility requires the public SELECT policy and correct Supabase configuration.

## Important notes
- The app currently stores the tournament as a single `app_state` JSON snapshot. The live match scorecard is the current match stored in that snapshot; the fixtures list retains fixture status/results. This is not a database of permanent scorecards for every past match yet.
- Public user view is read-only. In cloud-configured mode, the admin scorer blocks write actions unless the current Supabase session has `app_metadata.role = admin`. RLS remains the actual security boundary.
- A local-only browser mode is useful for testing but does not sync across devices. Set a valid publishable key to enable cloud mode.
- Verify the actual Supabase URL/key, RLS policies, admin role, and Realtime publication in your project before relying on it for a live event. This package has not been authenticated against your live Supabase project from this environment.
