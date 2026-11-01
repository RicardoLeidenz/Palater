/**
 * Creates the demo users and their private data (ratings, want-to-try).
 * Shared restaurants and dishes come from supabase/seed.sql.
 *
 *   npx supabase db reset && npm run seed
 *
 * Uses the service-role key, so it refuses to run against a non-local URL.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const password = process.env.DEMO_USER_PASSWORD ?? "palater-demo";

if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
  console.error(`Refusing to seed non-local Supabase at ${url}`);
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

type SeedRating = { dish: string; restaurant: string; score: number; note?: string; daysAgo: number };

const USERS: {
  email: string;
  name: string;
  isAdmin?: boolean;
  ratings: SeedRating[];
  wantRestaurants: string[];
  wantDishes: { dish: string; restaurant: string }[];
}[] = [
  {
    email: "ana@demo.palater.local",
    name: "Ana Ribeiro",
    isAdmin: true,
    ratings: [
      { restaurant: "Maison Clé", dish: "Steak tartare", score: 7, note: "A little under-seasoned.", daysAgo: 60 },
      { restaurant: "Maison Clé", dish: "Steak tartare", score: 8, note: "Much better this time, great yolk.", daysAgo: 14 },
      { restaurant: "Maison Clé", dish: "Duck confit", score: 9, note: "Crispy skin, the cherry jus made it.", daysAgo: 14 },
      { restaurant: "Maison Clé", dish: "Crème brûlée", score: 10, note: "Perfect crack.", daysAgo: 14 },
      { restaurant: "Maison Clé", dish: "French onion soup", score: 6, daysAgo: 60 },
      { restaurant: "Nopal & Smoke", dish: "Birria tacos", score: 9, note: "Ask for extra consomé.", daysAgo: 30 },
      { restaurant: "Nopal & Smoke", dish: "Elote", score: 8, daysAgo: 30 },
      { restaurant: "Nopal & Smoke", dish: "Horchata", score: 5, note: "Too sweet for me.", daysAgo: 30 },
      { restaurant: "Kōyō Ramen", dish: "Tonkotsu ramen", score: 9, note: "Rich broth, perfect egg.", daysAgo: 7 },
      { restaurant: "Kōyō Ramen", dish: "Gyoza", score: 7, daysAgo: 7 },
      { restaurant: "Kōyō Ramen", dish: "Yuzu highball", score: 8, daysAgo: 7 },
      { restaurant: "Trattoria Lucca", dish: "Cacio e pepe", score: 9, note: "Silky, loads of pepper.", daysAgo: 3 },
      { restaurant: "Trattoria Lucca", dish: "Tiramisù", score: 7, daysAgo: 3 },
    ],
    wantRestaurants: ["Saffron Table"],
    wantDishes: [
      { restaurant: "Kōyō Ramen", dish: "Spicy miso ramen" },
      { restaurant: "Nopal & Smoke", dish: "Mole enchiladas" },
    ],
  },
  {
    email: "ben@demo.palater.local",
    name: "Ben Okafor",
    ratings: [
      { restaurant: "Maison Clé", dish: "Duck confit", score: 4, note: "Dry. Not for me.", daysAgo: 20 },
      { restaurant: "Pecan Street Café", dish: "Smash burger", score: 10, note: "Best burger in town.", daysAgo: 5 },
      { restaurant: "Pecan Street Café", dish: "Pecan pie", score: 8, daysAgo: 5 },
      { restaurant: "Saffron Table", dish: "Butter chicken", score: 9, daysAgo: 12 },
      { restaurant: "Saffron Table", dish: "Garlic naan", score: 10, daysAgo: 12 },
    ],
    wantRestaurants: ["Trattoria Lucca"],
    wantDishes: [{ restaurant: "Maison Clé", dish: "Steak frites" }],
  },
];

async function main() {
  const { data: dishes, error } = await admin
    .from("dishes")
    .select("id, name, restaurants!inner(id, name)");
  if (error) throw error;
  const dishId = (restaurant: string, dish: string) => {
    const d = dishes.find(
      (x) => x.name === dish && (x.restaurants as unknown as { name: string }).name === restaurant,
    );
    if (!d) throw new Error(`Seed dish not found: ${restaurant} / ${dish}`);
    return d.id;
  };
  const { data: restaurants } = await admin.from("restaurants").select("id, name");
  const restaurantId = (name: string) => {
    const r = restaurants?.find((x) => x.name === name);
    if (!r) throw new Error(`Seed restaurant not found: ${name}`);
    return r.id;
  };

  for (const u of USERS) {
    // Recreate the user so re-running the seed is idempotent.
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find((x) => x.email === u.email);
    if (existing) await admin.auth.admin.deleteUser(existing.id);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });
    if (createError) throw createError;
    const userId = created.user.id;

    if (u.isAdmin) {
      await admin.from("profiles").update({ is_admin: true }).eq("id", userId).throwOnError();
    }

    await admin
      .from("ratings")
      .insert(
        u.ratings.map((r) => ({
          user_id: userId,
          dish_id: dishId(r.restaurant, r.dish),
          score: r.score,
          note: r.note ?? null,
          created_at: daysAgo(r.daysAgo),
        })),
      )
      .throwOnError();

    await admin
      .from("want_to_try")
      .insert([
        ...u.wantRestaurants.map((name) => ({ user_id: userId, restaurant_id: restaurantId(name) })),
        ...u.wantDishes.map((w) => ({ user_id: userId, dish_id: dishId(w.restaurant, w.dish) })),
      ])
      .throwOnError();

    console.log(`✓ ${u.name} <${u.email}>: ${u.ratings.length} ratings${u.isAdmin ? " (admin)" : ""}`);
  }
  console.log(`\nDemo password: ${password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
