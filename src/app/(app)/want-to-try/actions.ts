"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.uuid();

/** Adds or removes a restaurant or dish from your want-to-try list. */
export async function toggleWant(target: { restaurantId?: string; dishId?: string }): Promise<Result> {
  const user = await getCurrentUser();
  const column = target.dishId ? "dish_id" : "restaurant_id";
  const id = uuid.safeParse(target.dishId ?? target.restaurantId);
  if (!id.success) return { ok: false, error: "Unknown item." };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from("want_to_try").select("id").eq(column, id.data).maybeSingle();
  const { error } = existing
    ? await supabase.from("want_to_try").delete().eq("id", existing.id)
    : await supabase.from("want_to_try").insert({ [column]: id.data, user_id: user.id });
  if (error) return { ok: false, error: "Couldn't update your list. Please try again." };
  refresh();
  return { ok: true };
}

export async function setWantStatus(id: string, status: "want" | "visited"): Promise<Result> {
  await getCurrentUser();
  if (!uuid.safeParse(id).success || !["want", "visited"].includes(status)) return { ok: false, error: "Unknown item." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("want_to_try").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update your list. Please try again." };
  refresh();
  return { ok: true };
}

export async function removeWant(id: string): Promise<Result> {
  await getCurrentUser();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown item." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("want_to_try").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't remove it. Please try again." };
  refresh();
  return { ok: true };
}
