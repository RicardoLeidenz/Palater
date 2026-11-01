/**
 * Privacy guarantees, enforced by Postgres row-level security and storage
 * policies. These run against the local Supabase (`npm run db:start`) as real
 * signed-in users, exactly as the browser or our server would talk to it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestDish,
  createTestUser,
  deleteTestUser,
  serviceClient,
  TINY_WEBP,
  type TestUser,
} from "./helpers/supabase";

let alice: TestUser;
let bob: TestUser;
let admin: TestUser;
let dishId: string;
let restaurantId: string;
let aliceRatingId: string;
let alicePhotoPath: string;

beforeAll(async () => {
  [alice, bob, admin] = await Promise.all([
    createTestUser(),
    createTestUser(),
    createTestUser({ admin: true }),
  ]);
  const { dish, restaurant } = await createTestDish(alice);
  dishId = dish.id;
  restaurantId = restaurant.id;

  const { data: rating } = await alice.client
    .from("ratings")
    .insert({ dish_id: dishId, score: 9, note: "Alice's secret note" })
    .select()
    .single()
    .throwOnError();
  aliceRatingId = rating!.id;

  alicePhotoPath = `${alice.id}/${dishId}/full.webp`;
  const { error: uploadError } = await alice.client.storage
    .from("plate-photos")
    .upload(alicePhotoPath, TINY_WEBP, { contentType: "image/webp" });
  if (uploadError) throw uploadError;
  await alice.client
    .from("dish_photos")
    .insert({
      dish_id: dishId,
      full_path: alicePhotoPath,
      thumb_path: `${alice.id}/${dishId}/thumb.webp`,
      width: 1,
      height: 1,
    })
    .throwOnError();

  await alice.client.from("want_to_try").insert({ dish_id: dishId }).throwOnError();
});

afterAll(async () => {
  await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
});

describe("ratings and notes", () => {
  it("owner can read their own rating and note", async () => {
    const { data } = await alice.client.from("ratings").select("score, note").eq("id", aliceRatingId);
    expect(data).toEqual([{ score: 9, note: "Alice's secret note" }]);
  });

  it("another user cannot read them, by id or by listing", async () => {
    const byId = await bob.client.from("ratings").select("*").eq("id", aliceRatingId);
    expect(byId.data).toEqual([]);
    const byDish = await bob.client.from("ratings").select("*").eq("dish_id", dishId);
    expect(byDish.data).toEqual([]);
    const byUser = await bob.client.from("ratings").select("*").eq("user_id", alice.id);
    expect(byUser.data).toEqual([]);
  });

  it("the latest_ratings view does not leak them", async () => {
    const { data } = await bob.client.from("latest_ratings").select("*").eq("dish_id", dishId);
    expect(data).toEqual([]);
  });

  it("they cannot be read through an embedded join on dishes", async () => {
    const { data } = await bob.client.from("dishes").select("id, ratings(score, note)").eq("id", dishId).single();
    expect(data?.ratings).toEqual([]);
  });

  it("admins cannot read other users' ratings either", async () => {
    const { data } = await admin.client.from("ratings").select("*").eq("id", aliceRatingId);
    expect(data).toEqual([]);
  });

  it("signed-out requests get nothing", async () => {
    const { data } = await anonClient().from("ratings").select("*");
    expect(data ?? []).toEqual([]);
  });

  it("another user cannot write a rating as the owner", async () => {
    const { error } = await bob.client
      .from("ratings")
      .insert({ dish_id: dishId, score: 1, user_id: alice.id });
    expect(error).not.toBeNull();
  });

  it("another user cannot delete the owner's rating", async () => {
    await bob.client.from("ratings").delete().eq("id", aliceRatingId);
    const { data } = await serviceClient().from("ratings").select("id").eq("id", aliceRatingId);
    expect(data).toHaveLength(1);
  });

  it("ratings are append-only: nobody can edit history", async () => {
    const { error } = await alice.client.from("ratings").update({ score: 1 }).eq("id", aliceRatingId);
    expect(error).not.toBeNull();
    const { data } = await serviceClient().from("ratings").select("score").eq("id", aliceRatingId).single();
    expect(data?.score).toBe(9);
  });

  it("re-rating keeps history and latest_ratings shows the newest", async () => {
    await alice.client.from("ratings").insert({ dish_id: dishId, score: 7 }).throwOnError();
    const history = await alice.client.from("ratings").select("score").eq("dish_id", dishId);
    expect(history.data).toHaveLength(2);
    const latest = await alice.client.from("latest_ratings").select("score").eq("dish_id", dishId);
    expect(latest.data).toEqual([{ score: 7 }]);
  });

  it("rejects scores outside 1–10", async () => {
    for (const score of [0, 11]) {
      const { error } = await alice.client.from("ratings").insert({ dish_id: dishId, score });
      expect(error).not.toBeNull();
    }
  });
});

describe("plate photos", () => {
  it("another user cannot see the photo row", async () => {
    const { data } = await bob.client.from("dish_photos").select("*").eq("dish_id", dishId);
    expect(data).toEqual([]);
  });

  it("another user cannot download the file", async () => {
    const { data, error } = await bob.client.storage.from("plate-photos").download(alicePhotoPath);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("another user cannot create a signed URL for it", async () => {
    const { data, error } = await bob.client.storage.from("plate-photos").createSignedUrl(alicePhotoPath, 60);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("another user cannot list the owner's folder", async () => {
    const { data } = await bob.client.storage.from("plate-photos").list(`${alice.id}/${dishId}`);
    expect(data ?? []).toEqual([]);
  });

  it("another user cannot overwrite or delete it", async () => {
    await bob.client.storage
      .from("plate-photos")
      .upload(alicePhotoPath, TINY_WEBP, { contentType: "image/webp", upsert: true });
    await bob.client.storage.from("plate-photos").remove([alicePhotoPath]);
    const { data } = await alice.client.storage.from("plate-photos").download(alicePhotoPath);
    expect(data).not.toBeNull();
  });

  it("nobody can upload into someone else's folder", async () => {
    const { error } = await bob.client.storage
      .from("plate-photos")
      .upload(`${alice.id}/${dishId}/planted.webp`, TINY_WEBP, { contentType: "image/webp" });
    expect(error).not.toBeNull();
  });

  it("a photo row cannot point at another user's files", async () => {
    const { error } = await bob.client.from("dish_photos").insert({
      dish_id: dishId,
      full_path: alicePhotoPath,
      thumb_path: alicePhotoPath,
      width: 1,
      height: 1,
    });
    expect(error).not.toBeNull();
  });

  it("the owner can create a signed URL", async () => {
    const { data } = await alice.client.storage.from("plate-photos").createSignedUrl(alicePhotoPath, 60);
    expect(data?.signedUrl).toMatch(/^http/);
  });

  it("the bucket is not public", async () => {
    const { data } = anonClient().storage.from("plate-photos").getPublicUrl(alicePhotoPath);
    const res = await fetch(data.publicUrl);
    expect(res.ok).toBe(false);
  });
});

describe("want-to-try list", () => {
  it("is private to its owner", async () => {
    const mine = await alice.client.from("want_to_try").select("*");
    expect(mine.data).toHaveLength(1);
    const theirs = await bob.client.from("want_to_try").select("*").eq("user_id", alice.id);
    expect(theirs.data).toEqual([]);
  });

  it("cannot be changed by another user", async () => {
    await bob.client.from("want_to_try").update({ status: "visited" }).eq("user_id", alice.id);
    const { data } = await alice.client.from("want_to_try").select("status").single();
    expect(data?.status).toBe("want");
  });
});

describe("profiles and admin flag", () => {
  it("users cannot read each other's profiles", async () => {
    const { data } = await bob.client.from("profiles").select("*").eq("id", alice.id);
    expect(data).toEqual([]);
  });

  it("users cannot make themselves admin", async () => {
    const { error } = await bob.client.from("profiles").update({ is_admin: true }).eq("id", bob.id);
    expect(error).not.toBeNull();
    const { data } = await serviceClient().from("profiles").select("is_admin").eq("id", bob.id).single();
    expect(data?.is_admin).toBe(false);
  });
});

describe("shared data", () => {
  it("restaurants and dishes are readable by any signed-in user", async () => {
    const r = await bob.client.from("restaurants").select("id").eq("id", restaurantId);
    expect(r.data).toHaveLength(1);
    const d = await bob.client.from("dishes").select("id").eq("id", dishId);
    expect(d.data).toHaveLength(1);
  });

  it("but not by signed-out visitors", async () => {
    const { data } = await anonClient().from("dishes").select("id").limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("users cannot insert OSM restaurants directly (only the server can, after verifying)", async () => {
    const { error } = await bob.client
      .from("restaurants")
      .insert({ source: "osm", osm_type: "node", osm_id: 1, name: "Fake OSM place", created_by: bob.id });
    expect(error).not.toBeNull();
  });

  it("users cannot add a dish on someone else's behalf", async () => {
    const { error } = await bob.client
      .from("dishes")
      .insert({ restaurant_id: restaurantId, name: "Impersonated dish", created_by: alice.id });
    expect(error).not.toBeNull();
  });

  it("near-duplicate dish names are rejected", async () => {
    const { data: dish } = await alice.client.from("dishes").select("name").eq("id", dishId).single();
    const { error } = await bob.client
      .from("dishes")
      .insert({ restaurant_id: restaurantId, name: `  ${dish!.name.toUpperCase()}!! `, created_by: bob.id });
    expect(error?.code).toBe("23505");
  });

  it("non-admins cannot edit or hide shared dishes", async () => {
    await bob.client.from("dishes").update({ hidden: true, name: "Vandalized" }).eq("id", dishId);
    const { data } = await serviceClient().from("dishes").select("name, hidden").eq("id", dishId).single();
    expect(data?.hidden).toBe(false);
    expect(data?.name).not.toBe("Vandalized");
  });

  it("server-only caches are not reachable", async () => {
    const { data } = await bob.client.from("geo_cache").select("*");
    expect(data ?? []).toEqual([]);
  });
});

describe("moderation", () => {
  let reportId: string;

  beforeAll(async () => {
    const { data } = await bob.client
      .from("dish_reports")
      .insert({ dish_id: dishId, reason: "misspelled" })
      .select()
      .single()
      .throwOnError();
    reportId = data!.id;
  });

  it("reporters see their own reports; other users don't", async () => {
    expect((await bob.client.from("dish_reports").select("id")).data).toHaveLength(1);
    expect((await alice.client.from("dish_reports").select("id").eq("id", reportId)).data).toEqual([]);
  });

  it("non-admins cannot resolve reports", async () => {
    await bob.client.from("dish_reports").update({ status: "dismissed" }).eq("id", reportId);
    const { data } = await serviceClient().from("dish_reports").select("status").eq("id", reportId).single();
    expect(data?.status).toBe("open");
  });

  it("admins can see and resolve reports", async () => {
    const { data } = await admin.client
      .from("dish_reports")
      .update({ status: "dismissed", reviewed_by: admin.id })
      .eq("id", reportId)
      .select();
    expect(data).toHaveLength(1);
  });

  it("hidden dishes disappear for others but stay visible to people who rated them", async () => {
    await admin.client.from("dishes").update({ hidden: true }).eq("id", dishId).throwOnError();
    expect((await bob.client.from("dishes").select("id").eq("id", dishId)).data).toEqual([]);
    expect((await alice.client.from("dishes").select("id").eq("id", dishId)).data).toHaveLength(1);
    await admin.client.from("dishes").update({ hidden: false }).eq("id", dishId).throwOnError();
  });
});
