import "server-only";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { assertRateLimit } from "@/lib/rate-limit";
import { lookupPlace, nearbyPlaces, searchPlaces, type OsmPlace } from "@/lib/osm/places";
import { distanceM, type GeoPoint, type OsmType, type PlaceResult } from "@/lib/places-shared";

export type { PlaceResult };

type DbRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  cuisine: string | null;
  lat: number | null;
  lng: number | null;
  osm_type: OsmType | null;
  osm_id: number | null;
  distance_m: number | null;
};

const fromDb = (r: DbRow): PlaceResult => ({
  key: `db:${r.id}`,
  id: r.id,
  osm: r.osm_type && r.osm_id ? { type: r.osm_type, id: r.osm_id } : null,
  name: r.name,
  address: r.address,
  city: r.city,
  cuisine: r.cuisine,
  distanceM: r.distance_m,
});

const fromOsm = (p: OsmPlace, near?: GeoPoint): PlaceResult => ({
  key: `osm:${p.osmType}:${p.osmId}`,
  id: null,
  osm: { type: p.osmType, id: p.osmId },
  name: p.name,
  address: p.address,
  city: p.city,
  cuisine: p.cuisine,
  distanceM: near ? distanceM(near, p) : null,
});

/** DB rows win over the same OSM place, so saved places keep their id. */
function merge(db: PlaceResult[], osm: PlaceResult[]) {
  const seen = new Set(db.filter((r) => r.osm).map((r) => `${r.osm!.type}:${r.osm!.id}`));
  return [...db, ...osm.filter((r) => !seen.has(`${r.osm!.type}:${r.osm!.id}`))];
}

/**
 * Text search across our restaurants (incl. user-added ones) and OpenStreetMap.
 * If OSM is unavailable we still return our own matches, plus the error.
 */
export async function findPlaces(userId: string, query: string, near?: GeoPoint) {
  await assertRateLimit(`search:${userId}`, 20, 60);
  const supabase = await createSupabaseServerClient();
  const [db, osm] = await Promise.allSettled([
    supabase.rpc("search_restaurants", { p_query: query, p_lat: near?.lat ?? null, p_lng: near?.lng ?? null }),
    searchPlaces(query, near),
  ]);
  if (db.status === "rejected" || db.value.error) throw db.status === "rejected" ? db.reason : db.value.error;
  const results = merge(
    (db.value.data as DbRow[]).map(fromDb),
    osm.status === "fulfilled" ? osm.value.map((p) => fromOsm(p, near)) : [],
  );
  return { results, osmError: osm.status === "rejected" ? (osm.reason as Error) : null };
}

/** Restaurants around a point, nearest first. */
export async function placesNear(userId: string, at: GeoPoint) {
  await assertRateLimit(`nearby:${userId}`, 20, 60);
  const supabase = await createSupabaseServerClient();
  const [db, osm] = await Promise.allSettled([
    supabase.rpc("restaurants_near", { p_lat: at.lat, p_lng: at.lng, p_radius_m: 1500 }),
    nearbyPlaces(at, 1500),
  ]);
  if (db.status === "rejected" || db.value.error) throw db.status === "rejected" ? db.reason : db.value.error;
  const results = merge(
    (db.value.data as DbRow[]).map(fromDb),
    osm.status === "fulfilled" ? osm.value.map((p) => fromOsm(p, at)) : [],
  ).sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  return { results, osmError: osm.status === "rejected" ? (osm.reason as Error) : null };
}

/**
 * Saves an OSM place to our DB (or returns the existing row). Details are
 * re-fetched from OSM rather than trusted from the client, which is why this
 * runs with the service role: users can't insert OSM rows directly.
 */
export async function importOsmPlace(userId: string, osmType: OsmType, osmId: number): Promise<string | null> {
  const db = createSupabaseServiceClient();
  const existing = await db
    .from("restaurants")
    .select("id")
    .eq("osm_type", osmType)
    .eq("osm_id", osmId)
    .maybeSingle();
  if (existing.data) return existing.data.id;

  await assertRateLimit(`import:${userId}`, 30, 3600);
  const place = await lookupPlace(osmType, osmId);
  if (!place) return null;

  const { data, error } = await db
    .from("restaurants")
    .upsert(
      {
        source: "osm",
        osm_type: osmType,
        osm_id: osmId,
        name: place.name.slice(0, 120),
        address: place.address?.slice(0, 240) ?? null,
        city: place.city?.slice(0, 120) ?? null,
        country: place.country?.slice(0, 80) ?? null,
        cuisine: place.cuisine?.slice(0, 80) ?? null,
        lat: place.lat,
        lng: place.lng,
        created_by: userId,
      },
      { onConflict: "osm_type,osm_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
