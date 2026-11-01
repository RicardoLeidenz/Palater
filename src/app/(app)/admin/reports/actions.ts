"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.uuid();

// Each action re-checks admin status; RLS enforces it again in the database.
async function adminClient() {
  const user = await getCurrentUser();
  if (!(await isAdmin())) throw new Error("Not an admin");
  return { user, supabase: await createSupabaseServerClient() };
}

async function closeReports(dishId: string, status: "dismissed" | "actioned") {
  const { user, supabase } = await adminClient();
  return supabase
    .from("dish_reports")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("dish_id", dishId)
    .eq("status", "open");
}

/** The name is fine: close the reports, keep the dish. */
export async function dismissReports(dishId: string): Promise<Result> {
  if (!uuid.safeParse(dishId).success) return { ok: false, error: "Unknown dish." };
  const { error } = await closeReports(dishId, "dismissed");
  if (error) return { ok: false, error: "Couldn't update the reports." };
  refresh();
  return { ok: true };
}

/** Removes the dish from the shared menu. People who rated it keep their history. */
export async function hideDish(dishId: string): Promise<Result> {
  if (!uuid.safeParse(dishId).success) return { ok: false, error: "Unknown dish." };
  const { supabase } = await adminClient();
  const { error } = await supabase.from("dishes").update({ hidden: true }).eq("id", dishId);
  if (error) return { ok: false, error: "Couldn't hide the dish." };
  await closeReports(dishId, "actioned");
  refresh();
  return { ok: true };
}

export async function unhideDish(dishId: string): Promise<Result> {
  if (!uuid.safeParse(dishId).success) return { ok: false, error: "Unknown dish." };
  const { supabase } = await adminClient();
  const { error } = await supabase.from("dishes").update({ hidden: false }).eq("id", dishId);
  if (error) return { ok: false, error: "Couldn't restore the dish." };
  refresh();
  return { ok: true };
}

/** Fixes a misspelled dish name. */
export async function renameDish(dishId: string, name: string): Promise<Result> {
  const parsed = z.object({ id: uuid, name: z.string().trim().min(1).max(80) }).safeParse({ id: dishId, name });
  if (!parsed.success) return { ok: false, error: "Names must be 1–80 characters." };
  const { supabase } = await adminClient();
  const { error } = await supabase.from("dishes").update({ name: parsed.data.name }).eq("id", dishId);
  if (error?.code === "23505") return { ok: false, error: "Another dish on this menu already has that name. Hide this one instead." };
  if (error) return { ok: false, error: "Couldn't rename the dish." };
  await closeReports(dishId, "actioned");
  refresh();
  return { ok: true };
}
