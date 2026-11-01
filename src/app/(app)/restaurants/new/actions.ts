"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { geocodeAddress, searchPlaces, type GeoPoint } from "@/lib/osm/places";
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit";
import { distanceM, type PlaceResult } from "@/lib/places-shared";
import { nameSimilarity } from "@/lib/similarity";

export type AddRestaurantState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "duplicates"; candidates: PlaceResult[] };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const schema = z.object({
  name: z.string().trim().min(1, "Give the restaurant a name.").max(120, "That name is too long."),
  address: optionalText(240),
  city: optionalText(120),
  cuisine: optionalText(80),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  confirmed: z.literal("1").optional(),
});

export async function addRestaurant(_prev: AddRestaurantState, formData: FormData): Promise<AddRestaurantState> {
  const user = await getCurrentUser();
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string" && v !== ""),
  );
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", message: "Check the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  // No pin? Try to place it from the address so duplicate checks work by distance.
  let point: GeoPoint | null = input.lat != null && input.lng != null ? { lat: input.lat, lng: input.lng } : null;
  if (!point && input.address) {
    point = await geocodeAddress([input.address, input.city].filter(Boolean).join(", ")).catch(() => null);
  }

  const supabase = await createSupabaseServerClient();

  try {
    if (!input.confirmed) {
      await assertRateLimit(`search:${user.id}`, 20, 60);
      const candidates = await findDuplicates(input.name, point, input.city);
      if (candidates.length > 0) return { status: "duplicates", candidates };
    }
    // Only actually creating a place counts against this budget.
    await assertRateLimit(`add-restaurant:${user.id}`, 10, 3600);
  } catch (e) {
    if (e instanceof RateLimitError) return { status: "error", message: e.message };
    throw e;
  }

  const { data, error } = await supabase
    .from("restaurants")
    .insert({
      source: "user",
      name: input.name,
      address: input.address,
      city: input.city,
      cuisine: input.cuisine,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { status: "error", message: "Couldn't save the restaurant. Please try again." };

  redirect(`/r/${data.id}`);
}

/** Similar places in our DB and on OpenStreetMap near the given spot or in the same city. */
async function findDuplicates(name: string, point: GeoPoint | null, city: string | null): Promise<PlaceResult[]> {
  const supabase = await createSupabaseServerClient();
  const { data: db } = await supabase.rpc("restaurant_duplicates", {
    p_name: name,
    p_lat: point?.lat ?? null,
    p_lng: point?.lng ?? null,
    p_city: city,
  });
  const fromDb: PlaceResult[] = (db ?? []).map((r: { id: string; name: string; address: string | null; city: string | null; distance_m: number | null }) => ({
    key: `db:${r.id}`,
    id: r.id,
    osm: null,
    name: r.name,
    address: r.address,
    city: r.city,
    cuisine: null,
    distanceM: r.distance_m,
  }));

  // OSM check is best-effort; if it's down, DB matches are still useful.
  let fromOsm: PlaceResult[] = [];
  if (point || city) {
    const osm = await searchPlaces(city && !point ? `${name} ${city}` : name, point ?? undefined).catch(() => []);
    fromOsm = osm
      .filter((p) => nameSimilarity(p.name, name) >= 0.6)
      .filter((p) => (point ? distanceM(point, p) <= 300 : p.city?.toLowerCase() === city?.toLowerCase()))
      .slice(0, 3)
      .map((p) => ({
        key: `osm:${p.osmType}:${p.osmId}`,
        id: null,
        osm: { type: p.osmType, id: p.osmId },
        name: p.name,
        address: p.address,
        city: p.city,
        cuisine: null,
        distanceM: point ? distanceM(point, p) : null,
      }));
  }
  return [...fromDb, ...fromOsm];
}
