// Types and helpers used by both server code and client components.
// Must not import anything server-only.

export type OsmType = "node" | "way" | "relation";
export type GeoPoint = { lat: number; lng: number };

/** A search result: either already in our DB (`id`) or an OSM place not yet saved. */
export type PlaceResult = {
  key: string;
  id: string | null;
  osm: { type: OsmType; id: number } | null;
  name: string;
  address: string | null;
  city: string | null;
  cuisine: string | null;
  distanceM: number | null;
};

export function distanceM(a: GeoPoint, b: GeoPoint) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number | null) {
  if (m == null) return null;
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}
