-- Restaurant search support: OSM request throttling, per-user rate limits,
-- and spatial/fuzzy lookups over our own restaurants table.

-- ─── OSM throttle (server-only) ─────────────────────────────────────────────
-- Public OSM services allow ~1 request/second. Serverless instances don't
-- share memory, so the "next allowed slot" lives in Postgres.

create table public.osm_throttle (
  service text primary key,
  next_slot timestamptz not null default now()
);
alter table public.osm_throttle enable row level security;
revoke all on public.osm_throttle from anon, authenticated;

-- Reserves the next request slot for a service and returns how many
-- milliseconds the caller must wait before sending its request.
create or replace function public.claim_osm_slot(p_service text, p_interval_ms integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot timestamptz;
begin
  insert into public.osm_throttle as t (service, next_slot)
  values (p_service, clock_timestamp() + make_interval(secs => p_interval_ms / 1000.0))
  on conflict (service) do update
    set next_slot = greatest(t.next_slot, clock_timestamp()) + make_interval(secs => p_interval_ms / 1000.0)
  returning next_slot - make_interval(secs => p_interval_ms / 1000.0) into slot;

  return greatest(0, ceil(extract(epoch from (slot - clock_timestamp())) * 1000))::integer;
end;
$$;

-- ─── Per-user rate limits (server-only) ─────────────────────────────────────

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Fixed-window counter. Returns true if the request is allowed.
create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  win timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, win, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into n;

  -- Opportunistic cleanup of old windows.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return n <= p_limit;
end;
$$;

revoke execute on function public.claim_osm_slot(text, integer) from public, anon, authenticated;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;

-- Expired cache rows are cleaned up lazily by the server; this index keeps it cheap.
create index geo_cache_expires_idx on public.geo_cache (expires_at);

-- ─── Lookups over our own restaurants (RLS applies: security invoker) ───────

-- Restaurants within a radius, nearest first.
create or replace function public.restaurants_near(p_lat double precision, p_lng double precision, p_radius_m integer default 1500)
returns table (
  id uuid, name text, address text, city text, cuisine text,
  lat double precision, lng double precision, osm_type text, osm_id bigint, distance_m double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id, r.name, r.address, r.city, r.cuisine, r.lat, r.lng, r.osm_type, r.osm_id,
         extensions.st_distance(r.location, extensions.st_point(p_lng, p_lat, 4326)::extensions.geography) as distance_m
  from public.restaurants r
  where r.location is not null
    and extensions.st_dwithin(r.location, extensions.st_point(p_lng, p_lat, 4326)::extensions.geography, p_radius_m)
  order by distance_m
  limit 60
$$;

-- Fuzzy name search, optionally ranked by distance.
create or replace function public.search_restaurants(p_query text, p_lat double precision default null, p_lng double precision default null)
returns table (
  id uuid, name text, address text, city text, cuisine text,
  lat double precision, lng double precision, osm_type text, osm_id bigint, distance_m double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select public.normalize_name(p_query) as nq)
  select r.id, r.name, r.address, r.city, r.cuisine, r.lat, r.lng, r.osm_type, r.osm_id,
         case when p_lat is not null and r.location is not null
           then extensions.st_distance(r.location, extensions.st_point(p_lng, p_lat, 4326)::extensions.geography)
         end as distance_m
  from public.restaurants r, q
  where q.nq is not null
    and (r.name_normalized like '%' || q.nq || '%'
         or extensions.word_similarity(q.nq, r.name_normalized) > 0.45)
  order by extensions.word_similarity(q.nq, r.name_normalized) desc, distance_m nulls last
  limit 20
$$;

-- Likely duplicates for a place someone is about to add manually: similar
-- name nearby (if we know where it is), or same-ish name in the same city.
create or replace function public.restaurant_duplicates(
  p_name text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_city text default null
)
returns table (id uuid, name text, address text, city text, distance_m double precision, similarity real)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id, r.name, r.address, r.city,
         case when p_lat is not null and r.location is not null
           then extensions.st_distance(r.location, extensions.st_point(p_lng, p_lat, 4326)::extensions.geography)
         end as distance_m,
         extensions.similarity(r.name_normalized, public.normalize_name(p_name)) as similarity
  from public.restaurants r
  where extensions.similarity(r.name_normalized, public.normalize_name(p_name)) > 0.35
    and (
      (p_lat is not null and r.location is not null
        and extensions.st_dwithin(r.location, extensions.st_point(p_lng, p_lat, 4326)::extensions.geography, 300))
      or (p_city is not null and public.normalize_name(r.city) = public.normalize_name(p_city))
      or (p_lat is null and p_city is null)
    )
  order by similarity desc
  limit 5
$$;
