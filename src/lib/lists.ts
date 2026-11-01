import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Stats = { restaurantsVisited: number; dishesRated: number; avgScore: number | null; photos: number };

export const getStats = cache(async (): Promise<Stats> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_stats").single<{
    restaurants_visited: number;
    dishes_rated: number;
    avg_score: number | null;
    photos: number;
  }>();
  if (error) throw error;
  return {
    restaurantsVisited: Number(data.restaurants_visited),
    dishesRated: Number(data.dishes_rated),
    avgScore: data.avg_score == null ? null : Number(data.avg_score),
    photos: Number(data.photos),
  };
});

export type VisitedRestaurant = {
  id: string;
  name: string;
  cuisine: string | null;
  city: string | null;
  dishesRated: number;
  avgScore: number;
  bestScore: number;
  visitDays: number;
  lastVisit: string;
};

export async function getVisited(): Promise<VisitedRestaurant[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_visited_restaurants");
  if (error) throw error;
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    cuisine: r.cuisine as string | null,
    city: r.city as string | null,
    dishesRated: Number(r.dishes_rated),
    avgScore: Number(r.avg_score),
    bestScore: Number(r.best_score),
    visitDays: Number(r.visit_days),
    lastVisit: r.last_visit as string,
  }));
}

/** Your best dishes across all restaurants (latest rating per dish). */
export async function getTopDishes(limit = 5) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("latest_ratings")
    .select("score, note, dishes!inner(id, name, restaurants!inner(id, name))")
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  type Row = { score: number; note: string | null; dishes: { id: string; name: string; restaurants: { id: string; name: string } } };
  return (data as unknown as Row[]).map((r) => ({
    score: r.score,
    note: r.note,
    dishId: r.dishes.id,
    dishName: r.dishes.name,
    restaurantId: r.dishes.restaurants.id,
    restaurantName: r.dishes.restaurants.name,
  }));
}

export type WantItem = {
  id: string;
  status: "want" | "visited";
  createdAt: string;
  kind: "restaurant" | "dish";
  restaurantId: string;
  restaurantName: string;
  subtitle: string | null;
  dishName: string | null;
  /** Your latest score for the dish, or your best score at the restaurant. */
  myScore: number | null;
};

export const getWantList = cache(async (): Promise<WantItem[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("want_to_try")
    .select(
      "id, status, created_at, restaurant:restaurants(id, name, cuisine, city), dish:dishes(id, name, restaurant:restaurants(id, name, city))",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  type R = { id: string; name: string; cuisine?: string | null; city: string | null };
  type Row = { id: string; status: "want" | "visited"; created_at: string; restaurant: R | null; dish: { id: string; name: string; restaurant: R } | null };
  const rows = data as unknown as Row[];

  const dishIds = rows.flatMap((r) => (r.dish ? [r.dish.id] : []));
  const restaurantIds = rows.flatMap((r) => (r.restaurant ? [r.restaurant.id] : []));
  const [dishScores, restaurantScores] = await Promise.all([
    dishIds.length
      ? supabase.from("latest_ratings").select("dish_id, score").in("dish_id", dishIds)
      : Promise.resolve({ data: [] as { dish_id: string; score: number }[] }),
    restaurantIds.length
      ? supabase.from("latest_ratings").select("score, dishes!inner(restaurant_id)").in("dishes.restaurant_id", restaurantIds)
      : Promise.resolve({ data: [] }),
  ]);
  const byDish = new Map((dishScores.data ?? []).map((r) => [r.dish_id, r.score]));
  const byRestaurant = new Map<string, number>();
  for (const r of (restaurantScores.data ?? []) as unknown as { score: number; dishes: { restaurant_id: string } }[]) {
    byRestaurant.set(r.dishes.restaurant_id, Math.max(byRestaurant.get(r.dishes.restaurant_id) ?? 0, r.score));
  }

  return rows.flatMap((r): WantItem[] => {
    if (r.dish) {
      return [{
        id: r.id,
        status: r.status,
        createdAt: r.created_at,
        kind: "dish",
        restaurantId: r.dish.restaurant.id,
        restaurantName: r.dish.restaurant.name,
        subtitle: r.dish.restaurant.city,
        dishName: r.dish.name,
        myScore: byDish.get(r.dish.id) ?? null,
      }];
    }
    if (r.restaurant) {
      return [{
        id: r.id,
        status: r.status,
        createdAt: r.created_at,
        kind: "restaurant",
        restaurantId: r.restaurant.id,
        restaurantName: r.restaurant.name,
        subtitle: [r.restaurant.cuisine, r.restaurant.city].filter(Boolean).join(" · ") || null,
        dishName: null,
        myScore: byRestaurant.get(r.restaurant.id) ?? null,
      }];
    }
    return []; // dish/restaurant hidden or deleted
  });
});

/** Which of this restaurant and its dishes are on your list. */
export async function getWantState(restaurantId: string, dishIds: string[]) {
  const supabase = await createSupabaseServerClient();
  const filter = dishIds.length
    ? `restaurant_id.eq.${restaurantId},dish_id.in.(${dishIds.join(",")})`
    : `restaurant_id.eq.${restaurantId}`;
  const { data, error } = await supabase.from("want_to_try").select("restaurant_id, dish_id, status").or(filter);
  if (error) throw error;
  return {
    restaurant: data.find((r) => r.restaurant_id === restaurantId)?.status ?? null,
    dishes: new Map(data.filter((r) => r.dish_id).map((r) => [r.dish_id as string, r.status as "want" | "visited"])),
  };
}
