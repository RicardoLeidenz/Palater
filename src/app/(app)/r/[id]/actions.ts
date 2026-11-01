"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit";
import type { Category, DishSuggestion, RatingEntry } from "@/lib/menu-shared";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.uuid();
const categorySchema = z.enum(["starter", "main", "dessert", "drink"]).nullable();

async function limited<T>(key: string, limit: number, windowSeconds: number, fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    await assertRateLimit(key, limit, windowSeconds);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }
  return fn();
}

/** Existing dishes at this restaurant that match what's being typed. */
export async function suggestDishes(restaurantId: string, query: string): Promise<DishSuggestion[]> {
  const user = await getCurrentUser();
  if (!uuid.safeParse(restaurantId).success || query.trim().length < 2) return [];
  try {
    await assertRateLimit(`suggest:${user.id}`, 120, 60);
  } catch {
    return [];
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("suggest_dishes", { p_restaurant: restaurantId, p_query: query.slice(0, 80) });
  return (data ?? []).map((d: DishSuggestion & { similarity: number }) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    category: d.category,
  }));
}

const addDishSchema = z.object({
  restaurantId: uuid,
  name: z.string().trim().min(1, "Give the dish a name.").max(80, "Keep the name under 80 characters."),
  description: z
    .string()
    .trim()
    .max(200, "Keep the description under 200 characters.")
    .transform((v) => v || null),
  category: categorySchema,
});

/**
 * Adds a dish to the shared menu. If a dish with the same normalized name
 * already exists, returns that one instead so the user can rate it.
 */
export async function addDish(input: {
  restaurantId: string;
  name: string;
  description: string;
  category: Category | null;
}): Promise<Result<{ dish: DishSuggestion; existed: boolean }>> {
  const user = await getCurrentUser();
  const parsed = addDishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { restaurantId, name, description, category } = parsed.data;

  return limited<{ dish: DishSuggestion; existed: boolean }>(`add-dish:${user.id}`, 40, 3600, async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("dishes")
      .insert({ restaurant_id: restaurantId, name, description, category, created_by: user.id })
      .select("id, name, description, category")
      .single();

    if (error?.code === "23505") {
      // Same name after normalization ("Crème brûlée" vs "creme brulee").
      const { data: existing } = await supabase
        .from("dishes")
        .select("id, name, description, category")
        .eq("restaurant_id", restaurantId)
        .eq("name_normalized", (await supabase.rpc("normalize_name", { t: name })).data)
        .maybeSingle();
      if (existing) return { ok: true, data: { dish: existing, existed: true } };
      return { ok: false, error: "That dish is already on the menu." };
    }
    if (error) return { ok: false, error: "Couldn't add the dish. Please try again." };

    refresh();
    return { ok: true, data: { dish: data, existed: false } };
  });
}

const rateSchema = z.object({
  dishId: uuid,
  score: z.number().int().min(1, "Pick a score from 1 to 10.").max(10, "Pick a score from 1 to 10."),
  note: z
    .string()
    .trim()
    .max(280, "Keep your comment under 280 characters.")
    .transform((v) => v || null),
});

/** Saves a rating. Re-rating adds a new entry; history is kept. */
export async function rateDish(input: { dishId: string; score: number; note: string }): Promise<Result<null>> {
  const user = await getCurrentUser();
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  return limited<null>(`rate:${user.id}`, 120, 3600, async () => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("ratings").insert({
      dish_id: parsed.data.dishId,
      score: parsed.data.score,
      note: parsed.data.note,
      user_id: user.id,
    });
    if (error) return { ok: false, error: "Couldn't save your rating. Please try again." };
    refresh();
    return { ok: true, data: null };
  });
}

/** Your past ratings of a dish, newest first. */
export async function getRatingHistory(dishId: string): Promise<RatingEntry[]> {
  await getCurrentUser();
  if (!uuid.safeParse(dishId).success) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ratings")
    .select("id, score, note, created_at")
    .eq("dish_id", dishId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => ({ id: r.id, score: r.score, note: r.note, createdAt: r.created_at }));
}

/** Removes one entry from your history. */
export async function deleteRating(ratingId: string): Promise<Result<null>> {
  await getCurrentUser();
  if (!uuid.safeParse(ratingId).success) return { ok: false, error: "Unknown rating." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ratings").delete().eq("id", ratingId);
  if (error) return { ok: false, error: "Couldn't delete that rating." };
  refresh();
  return { ok: true, data: null };
}
