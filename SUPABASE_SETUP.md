# Hosting the app with Supabase

This wires the app to a free **Supabase** backend (Postgres + login) and a free
static host, so your friends can use it from their own phones on a real domain.

With **no** env vars set, the app keeps running purely on `localStorage` (handy
for local development). It switches to Supabase automatically once the two
`PUBLIC_SUPABASE_*` variables are present.

## 1. Create the Supabase project
1. Sign up at [supabase.com](https://supabase.com) and create a new project (free tier). Pick a region near you.
2. In the dashboard go to **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates the tables, the security policies, and the `login()` function.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `PUBLIC_SUPABASE_URL`
   - **anon public** key → `PUBLIC_SUPABASE_ANON_KEY`

## 2. Run it locally against Supabase
```bash
cp .env.example .env      # then paste your URL + anon key into .env
npm run dev
```
On first load with an empty database, the app **seeds** itself from `src/lib/mockData.ts`
(teams, questions, the `taskmaster` / `crawl2026` admin login, etc.).

Then log in as **taskmaster / crawl2026**, open **Opsætning**, set up your real
teams / contestants / questions, hit **Generér manglende** to create the player
logins, and **Kopiér alle** to send them out. Each player's password equals their
username.

## 3. Deploy the frontend (free, with a domain)
The app builds to plain static files (`build/`), so any static host works.
**Cloudflare Pages** is the smoothest:

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `build`
4. Add the two environment variables (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`) under **Settings → Environment variables**, then redeploy.
5. **Custom domain:** Pages → your project → **Custom domains → Set up a domain**. (Buy the domain from Cloudflare Registrar / Porkbun for ~$10/yr, or use the free `*.pages.dev` URL.)

Vercel and Netlify work too — same idea (build command `npm run build`, output `build`, set the two env vars).

## 4. Stop the database from pausing
Supabase free projects pause after ~7 days of inactivity, and waking them is a
manual click. The included GitHub Action [`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml)
pings the DB every 3 days so it never sleeps. To enable it, add two **repository
secrets** (GitHub → Settings → Secrets and variables → Actions):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

(Belt-and-suspenders: also click **Restore** in the Supabase dashboard the day before the crawl, just in case.)

## How data is stored
- **`game_config`** — one JSON row with teams/contestants/questions/tasks/rounds/ratings/bonus. Only you (the taskmaster) write this, so a single row is safe.
- **`answers`** — one row per (question, contestant). Players write their own, so simultaneous submissions never clobber each other. "Lås op" in Opsætning deletes the row → the player's canvas reopens.
- **`accounts`** — logins. Passwords are **never** sent to the browser: login goes through the `login()` SQL function, and the client only ever reads usernames/roles.

## Security notes (please read)
This is built for a friendly party game, not a bank. Current posture:
- **Passwords are protected** (write-only from the client, checked server-side).
- **Answers are readable with the anon key.** A technically-minded contestant could, in theory, query other people's answers/drawings before the crawl and cheat. If you want to close that, the proper fix is real per-user auth (Supabase Auth) with row-level policies, or routing reads through credential-checked SQL functions. Ask and I can implement it.
- **Drawings** are stored as PNG data URLs in the `answers.value` column. Fine for ~10 friends; for many more, move them to Supabase Storage and keep only a URL.
