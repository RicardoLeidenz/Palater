# Palater: notes for Claude

@AGENTS.md

Palater is a mobile-first web app. People save restaurants they've visited and rate the
individual dishes they ate there. **Restaurants and dish names are shared; scores, comments,
plate photos and want-to-try lists are private to each user.** Setup, deployment and costs
are in [README.md](README.md). Read it before infrastructure work. This file covers what
the README doesn't: decisions, conventions and traps.

Owner: Ricardo Leidenz. GitHub: `RicardoLeidenz/palater` (public, so never commit secrets or personal details). Work on `main`.

## Status (2026-11-01)

All 7 planned phases of v1 are built, tested, committed and pushed:

1. Foundation, Google auth, app shell
2. Schema, RLS, seed and privacy tests
3. Restaurant search (OSM)
4. Shared menu and ratings
5. Plate photos
6. Want-to-try, visited, profile
7. Moderation, error states, README, CI

**Pending on the owner's side, not code:**
- Google OAuth credentials (owner will add them later; demo login works meanwhile).
- Hosted Supabase and Vercel deployment.

**Ideas for later:**
- Menu-photo scanning with Claude vision was offered and **deferred**. Don't build it unless asked.
- A "delete my account" button doesn't exist yet.

## Product decisions (don't undo without asking)

- **Name is "Palater"**, lowercase wordmark `pal<a>ter` with a terracotta "a". It is **not** "Palate" (that name is taken), even though the reference file says so.
- **All ratings are private.** No community scores, no rating counts, no public/private toggle. These were in the reference design and were deliberately removed.
- **No dish price field.** It was dropped on purpose.
- **Each rating has an optional comment** ("Why this score?", max 280 characters), shown in italics under the dish on the menu.
- **Re-rating appends a new row**, so history is kept and the menu shows the latest. Ratings are never updated in place. Changing only the photo doesn't add a rating row.
- **Menus are crowdsourced.** OSM has no menu data. Near-duplicate dishes are prevented by normalised names plus live suggestions as you type.
- **Visits are derived:** one visit is one distinct day you rated something at a restaurant. There's no visits table, and "Rate a dish" doubles as "log a visit".
- **"Move to visited"** on the want-to-try list is offered after rating, never automatic.
- **Google-only sign-in.** The dev-only demo login (Ana, who is admin, and Ben) is gated by `ENABLE_DEV_LOGIN` and is always off in production.
- **When something is ambiguous, ask the owner rather than guess.**

## Design

The source of truth is [natural-wine-example.html](natural-wine-example.html), the owner's reference.

- **Palette:** tokens in `src/app/globals.css` (sand, paper, line, terracotta, plum, sage, espresso, muted), exposed as Tailwind colours (`bg-plum`, `text-terracotta`, and so on).
- **Fonts:** Fraunces (serif, used for headings and scores) and DM Sans (body), via `next/font`.
- **Component classes:** `.btn`, `.btn-primary`, `.btn-saved`, `.chip`, `.chip-on`, `.card`, `.field`, `.eyebrow`, `.display`, `.skeleton`.
- **Sheets:** `.sheet` is a native `<dialog>` that's a bottom sheet on phones and a centred modal at 640px and up.
- **Layout:** main content plus a 300px sidebar ("Your palate" and "Want to try") at 860px and up. On phones it stacks.
- **Mobile first.** Rating at the table should take about 3 taps. The score grid is 5×2 on phones.
- **Light theme only,** matching the reference.
- **Every screen needs empty, loading and error states.** Use `EmptyState`, `ErrorState` and `Skeleton` from `src/components/states.tsx`. Client calls to server actions must catch failures and show `OFFLINE_MESSAGE` (`src/lib/offline.ts`) inline.

## Stack and architecture

- **Next.js 16.4, App Router, React 19, TypeScript, Tailwind 4.** APIs differ from older Next. Check `node_modules/next/dist/docs/` before using framework APIs.
  - `cacheComponents: false` is set on purpose: nearly every page is personalised.
  - Route protection lives in `src/proxy.ts` (the old "middleware" is now called "proxy").
  - Server actions call `refresh()` from `next/cache` to re-render the current page.
  - Page and layout props use the global `PageProps<"/route">`, `LayoutProps` and `RouteContext` types.
- **Supabase:** Postgres with PostGIS, pg_trgm and unaccent, plus Auth and Storage. It runs locally in Docker via the `supabase` CLI (a dev dependency, so use `npx supabase …`).
- **OpenStreetMap:**
  - Photon handles text search and "near me" (reverse lookup with amenity filters).
  - Nominatim handles cities, address geocoding and verifying a place before it's saved.
  - **Overpass was dropped**: it timed out repeatedly.
  - The add-restaurant map uses Leaflet with OSM tiles.
- **Images:**
  - In the browser, `src/lib/photos/client-resize.ts` caps photos at 2048px JPEG, so EXIF never leaves the phone.
  - On the server, `src/lib/photos/process.ts` uses `sharp` to rotate, **strip all metadata**, and produce a 1600px WebP plus a 240px square thumbnail.
- **Validation:** zod v4 (`z.uuid()`, `z.email()` and so on).

### Key files

| Path | What |
|---|---|
| `supabase/migrations/*_core_schema.sql` | Tables, **RLS policies**, the storage bucket and its policies |
| `supabase/migrations/*_places.sql` | `claim_osm_slot` throttle, `check_rate_limit`, `restaurants_near`, `search_restaurants`, `restaurant_duplicates` |
| `supabase/migrations/*_dish_suggestions.sql` | `suggest_dishes` |
| `supabase/migrations/*_visited_and_stats.sql` | `my_stats`, `my_visited_restaurants`, the `updated_at` trigger |
| `src/lib/supabase/server.ts` | `createSupabaseServerClient()` (the user, RLS applies) and `createSupabaseServiceClient()` (bypasses RLS) |
| `src/lib/auth.ts` / `admin.ts` | `getCurrentUser()` (verified via `getClaims`), `isAdmin()`, `requireAdmin()` |
| `src/lib/osm/client.ts` | `osmFetch`: cache, throttle, User-Agent, `OsmUnavailableError` |
| `src/lib/restaurants.ts` | Search, nearby and `importOsmPlace` (verify, then insert with the service role) |
| `src/lib/menu.ts`, `lists.ts` | Data for the restaurant page, visited, stats and want-to-try |
| `src/app/(app)/r/[id]/` | Restaurant page, `menu.tsx` (client), and actions for rating, photos and reports |
| `src/components/rating-sheet.tsx` | Score grid, comment, photo picker, history, move-to-visited, report |
| `src/app/(app)/admin/reports/` | Moderation queue |
| `scripts/seed.ts` | Demo users and their private data (local only) |

## Rules that must hold

- **Privacy is enforced in Postgres RLS and storage policies, not in the UI.**
  - Use the user client for anything user-facing.
  - Use the service client **only** for the OSM cache, throttle, rate limits, saving verified OSM places, and seeding/tests.
  - **Never** use the service client to read ratings, notes, photos or want-to-try data.
  - Admins can moderate dish names but **cannot** read anyone's private data. Keep it that way.
- **Changing a policy or table:**
  - Add a new migration (never edit an applied one).
  - Extend `tests/privacy.test.ts`.
  - Prove the test can fail by temporarily loosening the policy and watching it go red.
- **New SQL functions:**
  - Use `security invoker` so RLS applies, with `set search_path = ''`.
  - Fully qualify extension calls (`extensions.similarity`, `extensions.st_dwithin`, …).
  - Server-only functions: `security definer` and `revoke execute … from public, anon, authenticated`.
- **Photos:**
  - Files live at `<user_id>/<dish_id>/<uuid>-{full,thumb}.webp` in the private `plate-photos` bucket.
  - Serve them only through signed URLs (1 hour) created with the **viewer's own** client (`src/lib/photos/urls.ts`).
  - Use plain `<img>` (with an eslint-disable comment), not `next/image`, so private images never enter a shared cache.
  - Replacing a photo uploads the new files first and deletes the old ones only after the database row is updated.
- **OSM usage policy:**
  - All requests go through `osmFetch`: cached, throttled (Nominatim ≤1 request/second), with an identifying User-Agent.
  - Search only on submit; **never live autocomplete against OSM**.
  - Round coordinates to ~110 m (`roundCoord`).
  - Live suggestions are fine against *our own* DB (dishes).
- **Server-only vs client code:**
  - Modules importing `server-only` (`lib/restaurants.ts`, `lib/menu.ts`, `lib/lists.ts`, `lib/osm/*`, `lib/photos/process.ts`, `lib/photos/urls.ts` …) must never be imported by a `"use client"` file.
  - Shared types and helpers live in `*-shared.ts` files (`places-shared`, `menu-shared`, `moderation-shared`) or `similarity.ts`.
  - Type-only imports (`import type`) are fine.
  - This bug has already happened once.
- **Inputs:** validate everything in server actions with zod, rate-limit writes with `assertRateLimit`, and only accept relative paths for `?next=` (`safeNextPath`).

## Local environment traps

- **Docker:** Docker Desktop's CLI is at `~/.docker/bin` and isn't always on PATH in tool shells. Prefix Supabase commands with `export PATH="$HOME/.docker/bin:$PATH";` or they fail with "docker: command not found".
- **Don't run `next build` while `next dev` is running.** They share `.next`, and the dev server then serves stale CSS. To check a production build:
  1. Stop dev.
  2. Run `npx next build` and smoke-test with `next start`.
  3. `rm -rf .next`.
  4. Restart dev.
- **Production hides the demo login,** so e2e tests can only run against `next dev`.
- **Playwright's browser download is blocked** in this sandbox. Use the installed Chrome: `PW_CHANNEL=chrome npm run test:e2e`.
- **Stale types after a config change:** if `tsc` complains about missing `.next/dev/types/*`, the dev server is regenerating them. Wait and retry, or run `npx next typegen`.
- **Disk space:** the owner's disk once filled up (Docker images are large) and Docker stopped. If Supabase containers vanish, check `df -h` before debugging.
- **`.env.local`** holds the standard local Supabase keys and `OSM_CONTACT_EMAIL` (the owner's real address; keep it out of the repo). Never commit `.env*` except the `.env.example` files.
- **Local email login:** the local `supabase/config.toml` keeps the email provider enabled only so demo and test users can use password sign-in. Production must disable it (it's in the README).

## Commands

```bash
npx supabase start                 # local DB/auth/storage (needs Docker)
npm run db:seed                    # reset DB (migrations + seed.sql) + demo users/photos/reports
npx supabase migration up          # apply new migrations without wiping data
npm run dev                        # http://localhost:3000 — "Sign in as Ana (demo)" (admin) / Ben
npm run lint && npm run typecheck
npm test                           # Vitest: unit + DB + privacy (needs local Supabase)
PW_CHANNEL=chrome npm run test:e2e # Playwright, Pixel 7 + desktop projects (needs dev server)
```

## Testing conventions

- **Before calling any change done:** lint, typecheck, `npm test` and the relevant e2e specs should all pass. Then **look at it**: take Playwright screenshots on a Pixel 7 viewport and a 1280px desktop viewport, and compare them with the reference design.
- **Database tests** (`tests/*-db.test.ts`, `privacy.test.ts`):
  - Create throwaway users with `createTestUser()` from `tests/helpers/supabase.ts` and clean up in `afterAll`.
  - Vitest aliases `server-only` to a stub, so `lib/` modules can be imported.
- **E2E specs** mutate seed data:
  - Record `startedAt` and delete rows created after it in `afterEach`/`afterAll`.
  - Clear `rate_limits` in `beforeAll`.
  - Name throwaway records with a `Zz Test` prefix.
  - Locate by role and accessible name. Dish rows are `listitem`s containing an `h3`. Buttons have labels like `Rate <dish>`, `Your score for <dish>: N…` and `View your photo of <dish>`.
- **Streaming status codes:** pages stream behind `loading.tsx`, so `notFound()` inside a page still returns HTTP 200. Assert on the rendered "Nothing on this plate" content, not the status.
- **CI** (`.github/workflows/ci.yml`) runs lint, typecheck and `npm test` against a real Supabase stack on every push. E2E isn't in CI because it calls public OSM services.

## Code style

- **Comments:** short, explaining *why*. Avoid needless abstraction.
- **Formatting:** Prettier style with a print width of about 120. Format only the files you touched (`npx prettier --print-width 120 --write <files>`); there's no repo-wide Prettier config.
- **Server actions** return `{ ok: true, data? } | { ok: false, error }` with user-friendly error strings, and never throw for expected failures.
- **Copy:** friendly and plain, in American English.

## Workflow with the owner

- **Big features:** plan in phases. After each phase, run the app and tests, take screenshots, and summarise what works, what changed from the plan, and anything the owner should decide.
- **Committing:** commit and push to `origin main` after each completed phase or feature. The owner asked for this. Check the CI run with `gh run list` / `gh run watch`.
- **Commit messages:** a summary line plus bullet points, ending with the `Co-Authored-By` line the session specifies.
- **Pricing or limits** (Supabase, Vercel and so on): check the providers' pricing pages; don't quote from memory.
