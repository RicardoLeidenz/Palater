"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { clearSearchLocation, setSearchLocation } from "@/lib/location";
import { reverseGeocodeCity, roundCoord } from "@/lib/osm/places";
import { assertRateLimit } from "@/lib/rate-limit";

const coords = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** Called after the browser hands us a position. Returns an error message or nothing. */
export async function saveCurrentPosition(lat: number, lng: number): Promise<string | void> {
  const user = await getCurrentUser();
  const p = coords.parse({ lat, lng });
  let label = "your location";
  try {
    await assertRateLimit(`reverse:${user.id}`, 10, 60);
    label = (await reverseGeocodeCity(p)) ?? label;
  } catch {
    // The label is cosmetic; keep going without it.
  }
  await setSearchLocation({ lat: roundCoord(p.lat), lng: roundCoord(p.lng), label });
}

export async function chooseCity(formData: FormData) {
  await getCurrentUser();
  const p = coords.extend({ label: z.string().min(1).max(120) }).parse({
    lat: Number(formData.get("lat")),
    lng: Number(formData.get("lng")),
    label: formData.get("label"),
  });
  await setSearchLocation({ lat: roundCoord(p.lat), lng: roundCoord(p.lng), label: p.label });
  redirect("/");
}

export async function forgetLocation() {
  await clearSearchLocation();
  redirect("/");
}
