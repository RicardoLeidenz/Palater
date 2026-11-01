"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit";
import { REPORT_REASONS } from "@/lib/moderation-shared";

const schema = z.object({
  dishId: z.uuid(),
  reason: z.enum(REPORT_REASONS.map((r) => r.key) as [string, ...string[]]),
  details: z
    .string()
    .trim()
    .max(500, "Keep it under 500 characters.")
    .transform((v) => v || null),
});

/** Flags a shared dish name for the admin to review. */
export async function reportDish(input: { dishId: string; reason: string; details: string }) {
  const user = await getCurrentUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  try {
    await assertRateLimit(`report:${user.id}`, 20, 3600);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false as const, error: e.message };
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("dish_reports").insert({
    dish_id: parsed.data.dishId,
    reason: parsed.data.reason,
    details: parsed.data.details,
    reporter_id: user.id,
  });
  if (error?.code === "23505") return { ok: true as const, alreadyReported: true };
  if (error) return { ok: false as const, error: "Couldn't send your report. Please try again." };
  return { ok: true as const, alreadyReported: false };
}
