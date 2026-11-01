import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDish, createTestUser, deleteTestUser, serviceClient, type TestUser } from "./helpers/supabase";

let alice: TestUser;
let bob: TestUser;
let restaurantId: string;
let dishA: string;
let dishB: string;

beforeAll(async () => {
  [alice, bob] = await Promise.all([createTestUser(), createTestUser()]);
  const { restaurant, dish } = await createTestDish(alice);
  restaurantId = restaurant.id;
  dishA = dish.id;
  dishB = (
    await alice.client.from("dishes").insert({ restaurant_id: restaurantId, name: "Second dish", created_by: alice.id }).select().single()
  ).data!.id;

  const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  // Alice: dish A rated twice on different days (latest 8), dish B once (6).
  await serviceClient()
    .from("ratings")
    .insert([
      { user_id: alice.id, dish_id: dishA, score: 4, created_at: day(10) },
      { user_id: alice.id, dish_id: dishA, score: 8, created_at: day(2) },
      { user_id: alice.id, dish_id: dishB, score: 6, created_at: day(2) },
      // Bob rates the same restaurant very differently.
      { user_id: bob.id, dish_id: dishA, score: 1, created_at: day(1) },
    ])
    .throwOnError();
});

afterAll(async () => {
  await serviceClient().from("restaurants").delete().eq("id", restaurantId);
  await Promise.all([deleteTestUser(alice), deleteTestUser(bob)]);
});

describe("my_stats", () => {
  it("summarises only your latest ratings", async () => {
    const { data } = await alice.client.rpc("my_stats").single<Record<string, number>>();
    expect(Number(data!.restaurants_visited)).toBe(1);
    expect(Number(data!.dishes_rated)).toBe(2);
    expect(Number(data!.avg_score)).toBe(7); // (8 + 6) / 2, ignores the old 4 and Bob's 1
  });

  it("is empty for someone with no ratings", async () => {
    const fresh = await createTestUser();
    const { data } = await fresh.client.rpc("my_stats").single<Record<string, number | null>>();
    expect(Number(data!.dishes_rated)).toBe(0);
    expect(data!.avg_score).toBeNull();
    await deleteTestUser(fresh);
  });
});

describe("my_visited_restaurants", () => {
  it("lists restaurants with your averages, visit days and best score", async () => {
    const { data } = await alice.client.rpc("my_visited_restaurants");
    const row = (data as Record<string, unknown>[]).find((r) => r.id === restaurantId)!;
    expect(Number(row.dishes_rated)).toBe(2);
    expect(Number(row.avg_score)).toBe(7);
    expect(Number(row.best_score)).toBe(8);
    expect(Number(row.visit_days)).toBe(2);
  });

  it("never mixes in other people's ratings", async () => {
    const { data } = await bob.client.rpc("my_visited_restaurants");
    const row = (data as Record<string, unknown>[]).find((r) => r.id === restaurantId)!;
    expect(Number(row.dishes_rated)).toBe(1);
    expect(Number(row.best_score)).toBe(1);
  });
});

describe("want_to_try", () => {
  it("can't hold both a restaurant and a dish, or neither", async () => {
    const both = await alice.client.from("want_to_try").insert({ restaurant_id: restaurantId, dish_id: dishA });
    expect(both.error).not.toBeNull();
    const neither = await alice.client.from("want_to_try").insert({});
    expect(neither.error).not.toBeNull();
  });

  it("doesn't allow saving the same thing twice", async () => {
    await alice.client.from("want_to_try").insert({ dish_id: dishB }).throwOnError();
    const again = await alice.client.from("want_to_try").insert({ dish_id: dishB });
    expect(again.error?.code).toBe("23505");
  });

  it("bumps updated_at when the status changes", async () => {
    const { data: before } = await alice.client.from("want_to_try").select("id, updated_at").eq("dish_id", dishB).single();
    await new Promise((r) => setTimeout(r, 20));
    const { data: after } = await alice.client
      .from("want_to_try")
      .update({ status: "visited" })
      .eq("id", before!.id)
      .select("updated_at")
      .single();
    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(new Date(before!.updated_at).getTime());
  });
});
