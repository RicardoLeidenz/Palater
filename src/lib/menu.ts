import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MenuDish } from "@/lib/menu-shared";

export { CATEGORIES } from "@/lib/menu-shared";
export type { Category, MenuDish } from "@/lib/menu-shared";

export type Restaurant = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  cuisine: string | null;
  lat: number | null;
  lng: number | null;
  source: "osm" | "user";
  osm_type: string | null;
  osm_id: number | null;
};

/** Everything the restaurant page needs. Private data comes back for the current user only (RLS). */
export async function getRestaurantPage(id: string) {
  const supabase = await createSupabaseServerClient();

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("id, name, address, city, country, cuisine, lat, lng, source, osm_type, osm_id")
    .eq("id", id)
    .maybeSingle<Restaurant>();
  if (error) throw error;
  if (!restaurant) return null;

  const { data: dishes, error: dishError } = await supabase
    .from("dishes")
    .select("id, name, description, category, hidden")
    .eq("restaurant_id", id)
    .order("name");
  if (dishError) throw dishError;

  const dishIds = dishes.map((d) => d.id);
  const [latest, visits] = await Promise.all([
    dishIds.length
      ? supabase.from("latest_ratings").select("dish_id, score, note, created_at").in("dish_id", dishIds)
      : Promise.resolve({ data: [], error: null }),
    dishIds.length
      ? supabase.from("ratings").select("created_at").in("dish_id", dishIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (latest.error) throw latest.error;
  if (visits.error) throw visits.error;

  const byDish = new Map(latest.data.map((r) => [r.dish_id as string, r]));
  const menu: MenuDish[] = dishes.map((d) => {
    const r = byDish.get(d.id);
    return {
      ...d,
      myRating: r ? { score: r.score, note: r.note, createdAt: r.created_at } : null,
    };
  });

  // A "visit" is a distinct day on which you rated something here.
  const days = [...new Set(visits.data.map((v) => (v.created_at as string).slice(0, 10)))].sort();
  return {
    restaurant,
    menu,
    visitCount: days.length,
    lastVisit: days.at(-1) ?? null,
  };
}
