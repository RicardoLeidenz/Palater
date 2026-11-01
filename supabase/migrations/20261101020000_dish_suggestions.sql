-- Existing dishes at a restaurant that look like what the user is typing.
-- Used for live suggestions while adding a dish, to prevent near-duplicates.
-- Our own database, so per-keystroke calls are fine (unlike OSM services).
create or replace function public.suggest_dishes(p_restaurant uuid, p_query text)
returns table (id uuid, name text, description text, category text, similarity real)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select public.normalize_name(p_query) as nq)
  select d.id, d.name, d.description, d.category,
         greatest(
           extensions.similarity(d.name_normalized, q.nq),
           extensions.word_similarity(q.nq, d.name_normalized)
         ) as similarity
  from public.dishes d, q
  where d.restaurant_id = p_restaurant
    and not d.hidden
    and q.nq is not null
    and (
      -- normalize_name strips punctuation, so % and _ can't reach LIKE.
      d.name_normalized like q.nq || '%'
      or d.name_normalized like '% ' || q.nq || '%'
      or extensions.similarity(d.name_normalized, q.nq) > 0.3
      or extensions.word_similarity(q.nq, d.name_normalized) > 0.5
    )
  order by (d.name_normalized = q.nq) desc, similarity desc, d.name
  limit 6
$$;
