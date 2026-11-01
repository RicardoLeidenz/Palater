-- Per-user summaries. security invoker + RLS on ratings means these only ever
-- see the caller's own ratings; the explicit user filter keeps plans cheap.

-- Restaurants you've rated at least one dish at, most recent visit first.
create or replace function public.my_visited_restaurants()
returns table (
  id uuid, name text, cuisine text, city text, address text,
  dishes_rated bigint, avg_score numeric, best_score smallint,
  visit_days bigint, last_visit timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select lr.*, d.restaurant_id
    from public.latest_ratings lr
    join public.dishes d on d.id = lr.dish_id
    where lr.user_id = (select auth.uid())
  ),
  days as (
    select d.restaurant_id, count(distinct (r.created_at at time zone 'utc')::date) as visit_days, max(r.created_at) as last_visit
    from public.ratings r
    join public.dishes d on d.id = r.dish_id
    where r.user_id = (select auth.uid())
    group by d.restaurant_id
  )
  select r.id, r.name, r.cuisine, r.city, r.address,
         count(*) as dishes_rated,
         round(avg(m.score), 1) as avg_score,
         max(m.score)::smallint as best_score,
         days.visit_days,
         days.last_visit
  from mine m
  join public.restaurants r on r.id = m.restaurant_id
  join days on days.restaurant_id = r.id
  group by r.id, days.visit_days, days.last_visit
  order by days.last_visit desc
$$;

-- "Your palate": headline numbers for the signed-in user.
create or replace function public.my_stats()
returns table (restaurants_visited bigint, dishes_rated bigint, avg_score numeric, photos bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(distinct d.restaurant_id),
         count(*),
         round(avg(lr.score), 1),
         (select count(*) from public.dish_photos p where p.user_id = (select auth.uid()))
  from public.latest_ratings lr
  join public.dishes d on d.id = lr.dish_id
  where lr.user_id = (select auth.uid())
$$;

-- Keep want_to_try.updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger want_to_try_touch
  before update on public.want_to_try
  for each row execute function public.touch_updated_at();
