import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDish, createTestUser, deleteTestUser, serviceClient, type TestUser } from "./helpers/supabase";

let user: TestUser;
let restaurantId: string;

beforeAll(async () => {
  user = await createTestUser();
  const { restaurant } = await createTestDish(user);
  restaurantId = restaurant.id;
  await user.client
    .from("dishes")
    .insert([
      { restaurant_id: restaurantId, name: "Crème brûlée", created_by: user.id },
      { restaurant_id: restaurantId, name: "Steak frites", created_by: user.id },
      { restaurant_id: restaurantId, name: "Moules frites", created_by: user.id },
    ])
    .throwOnError();
});
afterAll(async () => {
  await serviceClient().from("restaurants").delete().eq("id", restaurantId);
  await deleteTestUser(user);
});

const suggest = async (q: string) =>
  ((await user.client.rpc("suggest_dishes", { p_restaurant: restaurantId, p_query: q })).data as { name: string }[]).map(
    (d) => d.name,
  );

describe("suggest_dishes", () => {
  it("matches typos and missing accents", async () => {
    expect(await suggest("creme brule")).toContain("Crème brûlée");
  });
  it("matches a prefix and a later word", async () => {
    expect(await suggest("ste")).toContain("Steak frites");
    expect(await suggest("frit")).toEqual(expect.arrayContaining(["Steak frites", "Moules frites"]));
  });
  it("puts an exact match first", async () => {
    expect((await suggest("Moules frites"))[0]).toBe("Moules frites");
  });
  it("treats LIKE wildcards as plain text", async () => {
    expect(await suggest("%%")).toEqual([]);
    expect(await suggest("_")).toEqual([]);
  });
  it("leaves out dishes hidden by moderation", async () => {
    await serviceClient().from("dishes").update({ hidden: true }).eq("restaurant_id", restaurantId).eq("name", "Steak frites");
    expect(await suggest("steak")).not.toContain("Steak frites");
  });
});
