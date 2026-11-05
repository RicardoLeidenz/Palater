# Palater

Save the restaurants you visit and rate the dishes you eat there. Restaurants and
dish names are shared; **scores, comments, plate photos and want-to-try lists are
private to each person**, enforced in the database, not just the UI.

**Live demo: [palater.netlify.app](https://palater.netlify.app)**. Sign in with Google; anything you rate stays private to you.

- **Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage) · Tailwind CSS 4
- **Places:** OpenStreetMap via Photon (search, nearby) and Nominatim (cities, addresses, verified lookups)
- **Photos:** resized in the browser, re-encoded with `sharp` on the server (all metadata, including GPS, stripped)

---

## Contents

1. [Local setup](#local-setup)
2. [Environment variables](#environment-variables)
3. [Scripts](#scripts)
4. [Testing](#testing)
5. [Deploying](#deploying)
6. [What it costs](#what-it-costs)
7. [How it works](#how-it-works)

---

## Local setup

**Prerequisites:** Node.js 20+ (24 recommended), and Docker Desktop (or OrbStack) running, since Supabase runs locally in containers.

```bash
git clone https://github.com/RicardoLeidenz/palater.git
cd palater
npm install

# 1. Start Postgres, Auth and Storage locally (first run pulls images, ~5 min)
npx supabase start

# 2. Create .env.local from the example and fill in the keys
cp .env.example .env.local
npx supabase status          # copy API URL, anon key and service_role key into .env.local

# 3. Apply migrations + shared seed data, then create the demo users
npm run db:seed

# 4. Run the app
npm run dev                  # http://localhost:3000
```

Without Google credentials you can still use everything: with `ENABLE_DEV_LOGIN=true`,
the login page shows **Sign in as Ana (demo)** (an admin) and **Sign in as Ben (demo)**.
Supabase Studio (a database UI) runs at http://127.0.0.1:54323.

### Google sign-in locally (optional)

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an
   **OAuth client ID** of type *Web application*.
2. Authorized redirect URI: `http://127.0.0.1:54321/auth/v1/callback`
3. Put the client ID and secret in `supabase/.env` (see `supabase/.env.example`), then restart:
   `npx supabase stop && npx supabase start`.

### Seed data

`supabase/seed.sql` adds six fictional Austin restaurants with ~40 dishes (shared data).
`npm run seed` (or `npm run db:seed`, which also resets the DB) creates two demo users with
private ratings, comments, plate photos (generated illustrations), want-to-try items and one
open moderation report. The seed script refuses to run against a non-local database.

---

## Environment variables

All secrets live in environment variables; see [`.env.example`](.env.example).

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Public anon (or publishable) key. Safe to expose; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS. Used only for the OSM cache, throttling, rate limits and saving verified OSM places. Never used to read private data |
| `NEXT_PUBLIC_SITE_URL` | browser + server | Public URL of the app (OAuth redirects, User-Agent) |
| `OSM_CONTACT_EMAIL` | server | Contact address sent in the User-Agent, as OSM usage policies require |
| `PHOTON_URL`, `NOMINATIM_URL` | server, optional | Point at self-hosted instances instead of the public ones |
| `ENABLE_DEV_LOGIN` | server, dev only | Shows demo sign-in buttons. **Ignored when `NODE_ENV=production`** |
| `DEMO_USER_PASSWORD` | dev only | Password for seeded demo users |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` | `supabase/.env` | Google OAuth for the *local* Supabase stack |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm start` | Production build / serve it (stop `dev` first; they share `.next`) |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit, database and privacy tests (needs local Supabase running) |
| `npm run test:e2e` | Playwright end-to-end tests on a phone and a desktop viewport |
| `npm run db:start` / `db:stop` | Start / stop local Supabase |
| `npm run db:reset` | Re-apply all migrations + `seed.sql` |
| `npm run seed` | (Re)create demo users and their private data |
| `npm run db:seed` | `db:reset` + `seed` |

---

## Testing

```bash
npm test                         # ~80 tests, a few seconds
PW_CHANNEL=chrome npm run test:e2e   # ~40 browser tests; uses your installed Chrome
```

(Or run `npx playwright install chromium` once and drop `PW_CHANNEL`.)

- **`tests/privacy.test.ts`** signs in as real users against the local database and tries
  to read, write, overwrite and delete each other's ratings, comments, photos (rows *and*
  storage files, signed URLs, folder listings) and want-to-try lists, through tables, views,
  joins and as an admin. It also checks users can't make themselves admin, insert unverified
  OSM places, or edit shared dishes. If you change a policy, this suite is the safety net;
  temporarily loosening a policy makes it fail loudly.
- **`tests/photo-process.test.ts`** feeds a phone-style JPEG with GPS + camera EXIF through
  the pipeline and asserts nothing survives, rotation is applied, and sizes are right.
- **`tests/osm-client.test.ts`** checks caching, the User-Agent, throttling and graceful
  failure with mocked OSM responses.
- **`e2e/`** covers sign-in, search, nearby, adding restaurants (duplicate suggestions),
  rating/re-rating, dish suggestions, photos (upload → view → replace → remove, EXIF
  stripped, invisible to others), want-to-try → visited, and moderation.
  The e2e tests make a handful of real, cached requests to Photon/Nominatim.

CI (`.github/workflows/ci.yml`) runs lint, typecheck and `npm test` against a real
Supabase stack on every push.

---

## Deploying

The recommended setup is **Supabase (hosted)** for the database, auth and storage, and
**Vercel** or **Netlify** for the Next.js app. Both deploy from this repository. The live demo
runs on Netlify (see [Netlify instead of Vercel](#netlify-instead-of-vercel)).

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com/dashboard). Pick a region near your users.
2. Link and push the schema (migrations create all tables, policies and the private `plate-photos` bucket):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   Don't run the seed scripts against production.
3. **Authentication → Providers:**
   - Enable **Google** and paste the client ID and secret (below).
   - **Disable Email.** Palater is Google-only. Locally the email provider stays on only so demo/test users can sign in.
4. **Authentication → URL Configuration:**
   - Site URL: `https://your-domain`
   - Redirect URLs: `https://your-domain/auth/callback`

### 2. Google OAuth

In Google Cloud Console → APIs & Services:

1. **OAuth consent screen:** app name *Palater*, your support email, scopes `email`, `profile`, `openid`. Publish it.
2. **Credentials → OAuth client ID (Web):**
   - Authorized JavaScript origins: `https://your-domain`
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`

### 3. Vercel

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new) (framework: Next.js, defaults are fine).
2. Add environment variables (Production):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_SITE_URL=https://your-domain`, `OSM_CONTACT_EMAIL`.
   Do **not** set `ENABLE_DEV_LOGIN`.
3. Deploy, then add your custom domain and update the Supabase/Google URLs above to match.

### Netlify instead of Vercel

1. Import the repo at [app.netlify.com](https://app.netlify.com). `netlify.toml` sets the build
   command, Node version and Next.js adapter, so leave the build settings as detected.
2. Add the same environment variables as for Vercel. After the first deploy, set
   `NEXT_PUBLIC_SITE_URL` to the real `*.netlify.app` URL and redeploy (it's baked in at build time).
3. Under **Access & security → Visitor access**, turn site protection off, or visitors get a Netlify login page.
4. In Google's consent screen **Branding**, use `https://your-domain/privacy` as the privacy policy link.

`netlify.toml` excludes `OSM_CONTACT_EMAIL` from Netlify's secrets scanning because the privacy
page displays it as the contact address.

### 4. Make yourself admin

After signing in once with Google, run in the Supabase SQL editor:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

The **Moderation** card then appears on your Profile page (`/admin/reports`).

### Before real traffic

- **Map tiles** on the "add restaurant" map use `tile.openstreetmap.org`, which is only
  for light use. Switch to a tile provider (see costs) if the app grows.
- **Photon/Nominatim** public instances are fair-use. Requests are cached and throttled,
  but at scale use a commercial geocoder or self-host Photon (`PHOTON_URL`).
- Keep Supabase **Point-in-Time Recovery / backups** in mind once data matters (Pro plan has daily backups).

---

## What it costs

Supabase and Vercel prices were checked in November 2026; confirm on each provider's pricing page before relying on them.

| Service | Used for | Free tier | When you outgrow it |
|---|---|---|---|
| **Supabase** | Postgres, Google auth, private photo storage | $0: 500 MB database, 1 GB file storage, 5 GB egress, 50,000 monthly active users, 2 projects. **Free projects pause after 1 week without activity** | **Pro, from $25/month**: 8 GB database, 100 GB storage, 250 GB egress, 100,000 MAU, no pausing, daily backups. Overages: $0.125/GB database, $0.0213/GB storage, $0.09/GB egress, $0.00325/MAU |
| **Vercel** | Hosting the Next.js app | Hobby $0: 100 GB transfer, 1M function invocations, 4 h active CPU per month. **Personal, non-commercial use only** | **Pro $20/month** per member: 1 TB transfer, commercial use allowed; usage-based beyond that |
| **Google OAuth** | Sign-in | Free | Free |
| **Photon** (komoot) | Restaurant search and "near me" | Free, fair use | Self-host Photon (a server with ~100 GB+ disk for the planet extract) or a paid geocoder (e.g. Geoapify, Stadia Maps) |
| **Nominatim** (OSMF) | City search, address lookup, verifying places | Free, max 1 request/second, no heavy use | Same as above |
| **OSM map tiles** | Pin picker when adding a restaurant | Free for light use with attribution | A tile provider, e.g. MapTiler or Stadia Maps (both have free tiers, then paid) |
| **GitHub Actions** | CI | 2,000 minutes/month free for private repos | Per-minute billing |
| **Domain** (optional) | Custom URL | – | ~$10–20/year |

**Rough monthly cost:**

- **Personal use / friends & family:** **$0**. Supabase Free + Vercel Hobby comfortably fit
  thousands of ratings and photos (each photo is ~150–300 KB full size + ~10 KB thumbnail,
  so 1 GB holds roughly 4,000 photos). Expect the free Supabase project to pause if nobody
  uses it for a week; it resumes from the dashboard.
- **Launching publicly / commercially:** **~$45/month** (Supabase Pro $25 + Vercel Pro $20),
  plus a geocoder/tile provider once traffic is meaningful (often free → ~$10–50/month).

---

## How it works

### Privacy model

Enforced by Postgres row-level security (`supabase/migrations/…_core_schema.sql`):

| Data | Who can read | Who can write |
|---|---|---|
| `restaurants`, `dishes` | any signed-in user | users add; only admins edit/hide. OSM places are inserted by the server after verifying them with OSM |
| `ratings` (score + comment) | **owner only** | owner; append-only (re-rating adds a row, history kept) |
| `dish_photos` + storage files | **owner only** | owner, inside their own `<user_id>/` folder |
| `want_to_try` | **owner only** | owner |
| `dish_reports` | reporter (own) and admins | users file; admins resolve |
| caches, throttle, rate limits | nobody (service role only) | server |

Admins can moderate shared dish names but **cannot** see anyone's ratings, comments or photos.
Photos are served through signed URLs that expire after 1 hour, created with the viewer's own
session, so storage policies refuse to sign other people's files.

### OpenStreetMap usage

All OSM traffic goes through the server (`src/lib/osm/`):
- identifying `User-Agent` with a contact email;
- shared Postgres cache (search/nearby 24 h, cities/addresses 30 days, place lookups 7 days);
- a cross-instance throttle (≤1 request/second to Nominatim, ≤2/second to Photon) that fails
  fast with a friendly message instead of queueing;
- per-user rate limits; search only on submit (no live autocomplete); coordinates rounded to ~110 m.

Places are stored in our own `restaurants` table with their OSM type/id, so OSM places and
user-added places behave the same. Menus are crowdsourced; OSM has no menu data.

### Project layout

```
src/
  app/
    (app)/                 signed-in pages: explore, search, r/[id] (restaurant), visited,
                           want-to-try, profile, admin/reports, restaurants/new, location
    auth/                  OAuth callback, sign-out
    login/                 Google sign-in (+ dev-only demo login)
  components/              UI: sheets, rating sheet, add-dish sheet, lists, sidebar…
  lib/
    osm/                   cached + throttled Photon/Nominatim client
    photos/                server image processing, signed URLs, browser-side resize
    supabase/              server/browser clients
  proxy.ts                 session refresh + redirect signed-out visitors
supabase/
  migrations/              schema, RLS, storage policies, SQL functions
  seed.sql                 shared demo restaurants and dishes
scripts/seed.ts            demo users + private data
tests/                     Vitest: privacy/RLS, SQL, photo pipeline, OSM client
e2e/                       Playwright flows
```
