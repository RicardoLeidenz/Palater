import "server-only";
import { createHash } from "node:crypto";
import { publicEnv, serverEnv } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * All OpenStreetMap traffic (Photon, Nominatim) goes through here. It enforces the usage policies
 * of the public instances:
 *   - identifying User-Agent with a contact address
 *   - a cross-instance throttle (~1 req/s per service, stored in Postgres)
 *   - a shared cache, so repeated searches never hit OSM twice
 * The browser never talks to OSM services directly.
 */

export type OsmService = "photon" | "nominatim";

const MIN_INTERVAL_MS: Record<OsmService, number> = {
  nominatim: 1100, // hard policy: max 1 req/s
  photon: 500, // fair use
};

// If the queue is longer than this, fail fast instead of making the user wait.
const MAX_WAIT_MS = 4000;
const TIMEOUT_MS = 12_000;

export class OsmUnavailableError extends Error {
  constructor(message = "Place search is busy right now. Please try again in a moment.") {
    super(message);
    this.name = "OsmUnavailableError";
  }
}

function userAgent() {
  return `Palater/0.1 (+${publicEnv.NEXT_PUBLIC_SITE_URL}; ${serverEnv().OSM_CONTACT_EMAIL})`;
}

export async function osmFetch<T>(
  service: OsmService,
  url: string,
  opts: { ttlSeconds: number; init?: RequestInit },
): Promise<T> {
  const db = createSupabaseServiceClient();
  const body = typeof opts.init?.body === "string" ? opts.init.body : "";
  const key = `${service}:${createHash("sha256").update(url + "\n" + body).digest("hex")}`;

  const { data: hit } = await db
    .from("geo_cache")
    .select("payload")
    .eq("key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (hit) return hit.payload as T;

  const { data: waitMs, error: throttleError } = await db.rpc("claim_osm_slot", {
    p_service: service,
    p_interval_ms: MIN_INTERVAL_MS[service],
  });
  if (throttleError) throw throttleError;
  if (waitMs > MAX_WAIT_MS) throw new OsmUnavailableError();
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));

  let res: Response;
  try {
    res = await fetch(url, {
      ...opts.init,
      headers: { "User-Agent": userAgent(), Accept: "application/json", ...opts.init?.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new OsmUnavailableError("Couldn't reach OpenStreetMap. Check your connection and try again.");
  }
  if (res.status === 429 || res.status >= 500) throw new OsmUnavailableError();
  if (!res.ok) throw new Error(`${service} responded ${res.status}`);

  const payload = (await res.json()) as T;
  await db.from("geo_cache").upsert({
    key,
    payload,
    expires_at: new Date(Date.now() + opts.ttlSeconds * 1000).toISOString(),
  });
  // Lazily purge expired rows now and then.
  if (Math.random() < 0.02) {
    await db.from("geo_cache").delete().lt("expires_at", new Date().toISOString());
  }
  return payload;
}
