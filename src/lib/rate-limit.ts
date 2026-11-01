import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export class RateLimitError extends Error {
  constructor() {
    super("You're going a bit fast. Wait a few seconds and try again.");
    this.name = "RateLimitError";
  }
}

/** Throws RateLimitError when `key` exceeds `limit` hits per `windowSeconds`. */
export async function assertRateLimit(key: string, limit: number, windowSeconds: number) {
  const { data, error } = await createSupabaseServiceClient().rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  if (!data) throw new RateLimitError();
}
