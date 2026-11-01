import "server-only";
import { serverEnv } from "@/lib/env";
import { osmFetch } from "./client";

import type { GeoPoint, OsmType } from "@/lib/places-shared";

export type { GeoPoint, OsmType };

/** A place as returned by OSM search, before it is saved to our database. */
export type OsmPlace = {
  osmType: OsmType;
  osmId: number;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  cuisine: string | null;
  lat: number;
  lng: number;
};


const DAY = 86_400;
const FOOD_AMENITIES = ["restaurant", "cafe", "fast_food", "bar", "pub", "food_court", "ice_cream", "biergarten"];

const OSM_TYPE_FROM_LETTER: Record<string, OsmType> = { N: "node", W: "way", R: "relation" };
const LETTER_FROM_OSM_TYPE: Record<OsmType, string> = { node: "N", way: "W", relation: "R" };

/** ~110 m precision. Improves cache hits and avoids sending exact positions upstream. */
export const roundCoord = (n: number) => Math.round(n * 1000) / 1000;

function joinAddress(street?: string, housenumber?: string) {
  if (!street) return null;
  return housenumber ? `${housenumber} ${street}` : street;
}

export function prettyCuisine(raw: string | null | undefined) {
  if (!raw) return null;
  return raw
    .split(";")[0]
    .replaceAll("_", " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

// ─── Photon: text search ────────────────────────────────────────────────────

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type: string;
    osm_id: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    locality?: string;
    country?: string;
  };
};

export async function searchPlaces(query: string, near?: GeoPoint): Promise<OsmPlace[]> {
  const url = new URL("/api/", serverEnv().PHOTON_URL);
  url.searchParams.set("q", query.trim().slice(0, 100));
  url.searchParams.set("limit", "20");
  for (const a of FOOD_AMENITIES) url.searchParams.append("osm_tag", `amenity:${a}`);
  if (near) {
    url.searchParams.set("lat", String(roundCoord(near.lat)));
    url.searchParams.set("lon", String(roundCoord(near.lng)));
  }

  const data = await osmFetch<{ features: PhotonFeature[] }>("photon", url.toString(), { ttlSeconds: DAY });
  return data.features.flatMap((f) => {
    const place = fromPhoton(f);
    return place ? [place] : [];
  });
}

function fromPhoton(f: PhotonFeature): OsmPlace | null {
  const osmType = OSM_TYPE_FROM_LETTER[f.properties.osm_type];
  if (!f.properties.name || !osmType) return null;
  return {
    osmType,
    osmId: f.properties.osm_id,
    name: f.properties.name,
    address: joinAddress(f.properties.street, f.properties.housenumber),
    city: f.properties.city ?? f.properties.locality ?? f.properties.district ?? null,
    country: f.properties.country ?? null,
    cuisine: null,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  };
}

// ─── Photon reverse: what's around me ──────────────────────────────────────
// Photon's reverse endpoint with amenity filters is fast and reliable; the
// public Overpass instances often time out on this kind of query.

export async function nearbyPlaces(at: GeoPoint, radiusM = 1000): Promise<OsmPlace[]> {
  const url = new URL("/reverse", serverEnv().PHOTON_URL);
  url.searchParams.set("lat", String(roundCoord(at.lat)));
  url.searchParams.set("lon", String(roundCoord(at.lng)));
  url.searchParams.set("radius", String(radiusM / 1000));
  url.searchParams.set("limit", "40");
  for (const a of FOOD_AMENITIES) url.searchParams.append("osm_tag", `amenity:${a}`);

  const data = await osmFetch<{ features: PhotonFeature[] }>("photon", url.toString(), { ttlSeconds: DAY });
  return data.features.flatMap((f) => {
    const place = fromPhoton(f);
    return place ? [place] : [];
  });
}

// ─── Nominatim: cities, reverse geocoding, and verified lookups ─────────────
// Only ever called on explicit user action (submit/tap), never per keystroke.

type NominatimResult = {
  osm_type: OsmType;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
};

export type CityResult = { label: string; lat: number; lng: number };

export async function geocodeCity(query: string): Promise<CityResult[]> {
  const url = new URL("/search", serverEnv().NOMINATIM_URL);
  url.searchParams.set("q", query.trim().slice(0, 100));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("featureType", "settlement");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");

  const data = await osmFetch<NominatimResult[]>("nominatim", url.toString(), { ttlSeconds: 30 * DAY });
  return data.map((r) => {
    const a = r.address ?? {};
    const place = r.name ?? a.city ?? a.town ?? a.village ?? r.display_name.split(",")[0];
    const region = a.state ?? a.country;
    return {
      label: region && region !== place ? `${place}, ${region}` : place,
      lat: Number(r.lat),
      lng: Number(r.lon),
    };
  });
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const url = new URL("/search", serverEnv().NOMINATIM_URL);
  url.searchParams.set("q", address.trim().slice(0, 200));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  const data = await osmFetch<NominatimResult[]>("nominatim", url.toString(), { ttlSeconds: 30 * DAY });
  return data[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
}

export async function reverseGeocodeCity(at: GeoPoint): Promise<string | null> {
  const url = new URL("/reverse", serverEnv().NOMINATIM_URL);
  url.searchParams.set("lat", String(roundCoord(at.lat)));
  url.searchParams.set("lon", String(roundCoord(at.lng)));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "10");
  const data = await osmFetch<NominatimResult & { error?: string }>("nominatim", url.toString(), {
    ttlSeconds: 30 * DAY,
  });
  if (data.error) return null;
  const a = data.address ?? {};
  return a.city ?? a.town ?? a.village ?? a.municipality ?? data.name ?? null;
}

/** Fetches a place straight from OSM, so we only save places that really exist. */
export async function lookupPlace(osmType: OsmType, osmId: number): Promise<OsmPlace | null> {
  const url = new URL("/lookup", serverEnv().NOMINATIM_URL);
  url.searchParams.set("osm_ids", `${LETTER_FROM_OSM_TYPE[osmType]}${osmId}`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  const [r] = await osmFetch<NominatimResult[]>("nominatim", url.toString(), { ttlSeconds: 7 * DAY });
  if (!r) return null;
  const a = r.address ?? {};
  return {
    osmType,
    osmId,
    name: r.name || r.display_name.split(",")[0],
    address: joinAddress(a.road, a.house_number),
    city: a.city ?? a.town ?? a.village ?? a.suburb ?? null,
    country: a.country ?? null,
    cuisine: prettyCuisine(r.extratags?.cuisine),
    lat: Number(r.lat),
    lng: Number(r.lon),
  };
}
