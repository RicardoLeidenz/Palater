-- Palater core schema.
--
-- Privacy model:
--   * restaurants, dishes      shared: any signed-in user can read and add.
--   * ratings, dish_photos,
--     want_to_try              private: row-level security limits every
--                              operation to the owning user. No exceptions,
--                              not even for admins.
--   * dish_reports             reporters see their own; admins see all.
--   * geo_cache, osm_throttle,
--     rate_limits              server-only (service role); no API access.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ─── Helpers ────────────────────────────────────────────────────────────────

-- Canonical form used for duplicate detection: "Crème Brûlée!" → "creme brulee".
-- Punctuation becomes spaces; letters in any script are kept.
create or replace function public.normalize_name(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(
    trim(regexp_replace(
      regexp_replace(
        lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))),
        '[[:punct:]]+', ' ', 'g'),
      '\s+', ' ', 'g')),
    '')
$$;

-- ─── Profiles ───────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false)
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Restaurants (shared) ───────────────────────────────────────────────────

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('osm', 'user')),
  osm_type text check (osm_type in ('node', 'way', 'relation')),
  osm_id bigint,
  name text not null check (char_length(trim(name)) between 1 and 120),
  name_normalized text generated always as (public.normalize_name(name)) stored,
  address text check (char_length(address) <= 240),
  city text check (char_length(city) <= 120),
  country text check (char_length(country) <= 80),
  cuisine text check (char_length(cuisine) <= 80),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  location extensions.geography(point, 4326) generated always as (
    case when lat is not null and lng is not null
      then extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
    end
  ) stored,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (osm_type, osm_id),
  check ((source = 'osm') = (osm_id is not null and osm_type is not null)),
  check ((lat is null) = (lng is null))
);

create index restaurants_location_idx on public.restaurants using gist (location);
create index restaurants_name_trgm_idx on public.restaurants using gin (name_normalized extensions.gin_trgm_ops);

-- ─── Dishes (shared, crowdsourced) ──────────────────────────────────────────

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  name_normalized text not null generated always as (public.normalize_name(name)) stored,
  description text check (char_length(description) <= 200),
  category text check (category in ('starter', 'main', 'dessert', 'drink')),
  hidden boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (restaurant_id, name_normalized)
);

create index dishes_name_trgm_idx on public.dishes using gin (name_normalized extensions.gin_trgm_ops);

-- ─── Ratings (private, append-only history) ─────────────────────────────────

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  -- Short optional comment explaining the score.
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now()
);

create index ratings_user_dish_idx on public.ratings (user_id, dish_id, created_at desc);

-- Each user's most recent rating per dish. security_invoker makes RLS on
-- ratings apply to whoever queries the view.
create view public.latest_ratings
with (security_invoker = true)
as
  select distinct on (user_id, dish_id) *
  from public.ratings
  order by user_id, dish_id, created_at desc, id desc;

-- ─── Plate photos (private) ─────────────────────────────────────────────────

create table public.dish_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  full_path text not null,
  thumb_path text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now(),
  -- One current photo per user per dish; replacing swaps the row.
  unique (user_id, dish_id),
  -- Files must live in the owner's storage folder.
  check (split_part(full_path, '/', 1) = user_id::text),
  check (split_part(thumb_path, '/', 1) = user_id::text)
);

-- ─── Want to try (private) ──────────────────────────────────────────────────

create table public.want_to_try (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  dish_id uuid references public.dishes (id) on delete cascade,
  status text not null default 'want' check (status in ('want', 'visited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(restaurant_id, dish_id) = 1),
  unique (user_id, restaurant_id),
  unique (user_id, dish_id)
);

-- ─── Moderation ─────────────────────────────────────────────────────────────

create table public.dish_reports (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (reason in ('duplicate', 'misspelled', 'not_on_menu', 'offensive', 'other')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- One open report per user per dish.
create unique index dish_reports_one_open_idx
  on public.dish_reports (dish_id, reporter_id) where status = 'open';

-- ─── Server-only tables ─────────────────────────────────────────────────────

create table public.geo_cache (
  key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.dishes enable row level security;
alter table public.ratings enable row level security;
alter table public.dish_photos enable row level security;
alter table public.want_to_try enable row level security;
alter table public.dish_reports enable row level security;
alter table public.geo_cache enable row level security;

-- Signed-out visitors get nothing from the API.
revoke all on all tables in schema public from anon;

-- profiles: see and edit your own; is_admin is not user-editable.
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- restaurants: shared. Users may add their own places; OSM places are
-- inserted by the server after verifying them against OSM.
create policy "restaurants: read" on public.restaurants
  for select to authenticated using (true);
create policy "restaurants: add user place" on public.restaurants
  for insert to authenticated
  with check (source = 'user' and created_by = (select auth.uid()));
create policy "restaurants: admin edit" on public.restaurants
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "restaurants: admin delete" on public.restaurants
  for delete to authenticated using ((select public.is_admin()));

-- dishes: shared menu. Hidden (moderated) dishes stay visible to admins and
-- to anyone who has already rated them, so personal history isn't lost.
create policy "dishes: read" on public.dishes
  for select to authenticated using (
    not hidden
    or (select public.is_admin())
    or exists (
      select 1 from public.ratings r
      where r.dish_id = dishes.id and r.user_id = (select auth.uid())
    )
  );
create policy "dishes: add" on public.dishes
  for insert to authenticated
  with check (created_by = (select auth.uid()) and hidden = false);
create policy "dishes: admin edit" on public.dishes
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "dishes: admin delete" on public.dishes
  for delete to authenticated using ((select public.is_admin()));

-- ratings: owner only. No update — re-rating appends a new row.
create policy "ratings: read own" on public.ratings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ratings: add own" on public.ratings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "ratings: delete own" on public.ratings
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.ratings from authenticated;

-- dish_photos: owner only.
create policy "photos: read own" on public.dish_photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "photos: add own" on public.dish_photos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "photos: update own" on public.dish_photos
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "photos: delete own" on public.dish_photos
  for delete to authenticated using (user_id = (select auth.uid()));

-- want_to_try: owner only.
create policy "want_to_try: read own" on public.want_to_try
  for select to authenticated using (user_id = (select auth.uid()));
create policy "want_to_try: add own" on public.want_to_try
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "want_to_try: update own" on public.want_to_try
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "want_to_try: delete own" on public.want_to_try
  for delete to authenticated using (user_id = (select auth.uid()));

-- dish_reports: file your own; admins review all.
create policy "reports: read own or admin" on public.dish_reports
  for select to authenticated using (reporter_id = (select auth.uid()) or (select public.is_admin()));
create policy "reports: file" on public.dish_reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open' and reviewed_by is null);
create policy "reports: admin review" on public.dish_reports
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- geo_cache: no policies → only the service role can touch it.
revoke all on public.geo_cache from authenticated;

-- ─── Storage: private plate photos ──────────────────────────────────────────
-- Objects live at <user_id>/<dish_id>/<file>. Only the owner can read,
-- write or delete inside their folder; signed URLs are created per request.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plate-photos', 'plate-photos', false, 5242880, array['image/webp'])
on conflict (id) do nothing;

create policy "plate photos: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'plate-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "plate photos: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'plate-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "plate photos: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'plate-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "plate photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'plate-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
