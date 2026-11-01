import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";

/** The area the user is searching in, remembered for 30 days. Coordinates are rounded to ~110 m. */
export type SearchLocation = { lat: number; lng: number; label: string };

const COOKIE = "palater_loc";
const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(120),
});

export async function getSearchLocation(): Promise<SearchLocation | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function setSearchLocation(loc: SearchLocation) {
  (await cookies()).set(COOKIE, JSON.stringify(schema.parse(loc)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function clearSearchLocation() {
  (await cookies()).delete(COOKIE);
}
