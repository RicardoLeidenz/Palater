import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, type TestUser } from "./helpers/supabase";

let user: TestUser;
beforeAll(async () => {
  user = await createTestUser();
});
afterAll(async () => {
  await deleteTestUser(user);
});

describe("server-only helpers are not callable from the browser", () => {
  it("users cannot fiddle with the OSM throttle or rate limits", async () => {
    const a = await user.client.rpc("claim_osm_slot", { p_service: "nominatim", p_interval_ms: 0 });
    expect(a.error).not.toBeNull();
    const b = await user.client.rpc("check_rate_limit", { p_key: "x", p_limit: 999, p_window_seconds: 1 });
    expect(b.error).not.toBeNull();
    const c = await user.client.from("rate_limits").select("*");
    expect(c.data ?? []).toEqual([]);
  });
});

describe("check_rate_limit", () => {
  it("allows up to the limit, then blocks", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const results = [];
    for (let i = 0; i < 4; i++) {
      const { data } = await serviceClient().rpc("check_rate_limit", { p_key: key, p_limit: 3, p_window_seconds: 60 });
      results.push(data);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});

describe("restaurant lookups (seed data)", () => {
  it("finds nearby restaurants, nearest first", async () => {
    const { data } = await user.client.rpc("restaurants_near", { p_lat: 30.2665, p_lng: -97.735, p_radius_m: 1500 });
    const names = (data as { name: string }[]).map((r) => r.name);
    expect(names.slice(0, 2)).toEqual(["Pecan Street Café", "Maison Clé"]);
  });

  it("search ignores accents and case", async () => {
    const { data } = await user.client.rpc("search_restaurants", { p_query: "KOYO" });
    expect((data as { name: string }[]).map((r) => r.name)).toContain("Kōyō Ramen");
  });

  it("flags a likely duplicate near an existing place", async () => {
    const { data } = await user.client.rpc("restaurant_duplicates", {
      p_name: "Maison Cle Bistro",
      p_lat: 30.2653,
      p_lng: -97.7291,
    });
    expect((data as { name: string }[]).map((r) => r.name)).toEqual(["Maison Clé"]);
  });

  it("doesn't flag a same-named place on the other side of the world", async () => {
    const { data } = await user.client.rpc("restaurant_duplicates", {
      p_name: "Maison Clé",
      p_lat: 48.8566,
      p_lng: 2.3522,
    });
    expect(data).toEqual([]);
  });
});
