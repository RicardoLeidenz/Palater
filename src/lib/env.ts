import { z } from "zod";

// Public values are inlined into the browser bundle at build time, so they must
// be referenced as literal `process.env.NEXT_PUBLIC_*` expressions.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Sent with every OSM request, as Nominatim/Photon/Overpass policies require.
  OSM_CONTACT_EMAIL: z.email(),
  PHOTON_URL: z.url().default("https://photon.komoot.io"),
  NOMINATIM_URL: z.url().default("https://nominatim.openstreetmap.org"),
  OVERPASS_URL: z.url().default("https://overpass-api.de/api/interpreter"),
  // Lets seeded demo users sign in with a password. Never honored in production.
  ENABLE_DEV_LOGIN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true" && process.env.NODE_ENV !== "production"),
  DEMO_USER_PASSWORD: z.string().min(8).default("palater-demo"),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser");
  }
  cached ??= serverSchema.parse(process.env);
  return cached;
}
