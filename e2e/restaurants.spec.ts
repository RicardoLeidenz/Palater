import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";
import { serviceClient } from "../tests/helpers/supabase";

test.beforeAll(async () => {
  await serviceClient().from("rate_limits").delete().neq("key", "");
});

test.afterAll(async () => {
  await serviceClient().from("restaurants").delete().like("name", "Zz Test Diner%");
});

// These touch the public OSM services a handful of times; responses are
// cached server-side, so re-runs mostly hit the cache.

test("use my location lists nearby restaurants", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 30.2665, longitude: -97.735 });
  await signInAs(page, "Ana");

  await page.getByRole("button", { name: "Use my location" }).click();
  const list = page.getByRole("list", { name: /Restaurants near/ });
  await expect(list).toBeVisible({ timeout: 20_000 });
  await expect(list.getByRole("link", { name: /Pecan Street Café/ })).toBeVisible();

  await page.getByRole("button", { name: "Forget" }).click();
  await expect(page.getByRole("button", { name: "Use my location" })).toBeVisible();
});

test("denied location falls back to city search", async ({ page }) => {
  await signInAs(page, "Ana");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText(/Location access is off/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "City" })).toBeVisible();
});

test("search by name and open a restaurant with its menu and my scores", async ({ page }) => {
  await signInAs(page, "Ana");
  const search = page.getByRole("searchbox", { name: "Search restaurants" });
  await search.fill("koyo");
  await search.press("Enter");

  await page.getByRole("link", { name: /Kōyō Ramen/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Kōyō Ramen" })).toBeVisible();
  await expect(page.getByText("Visited 1 time")).toBeVisible();
  const ramen = page.getByRole("listitem").filter({ hasText: "Tonkotsu ramen" });
  await expect(ramen.getByText("9")).toBeVisible();
});

test("adding a restaurant suggests a likely duplicate first", async ({ page }) => {
  await signInAs(page, "Ben");
  await page.goto("/restaurants/new?name=Maison%20Cle");
  await page.getByRole("textbox", { name: "City" }).fill("Austin");
  await page.getByRole("button", { name: "Add restaurant" }).click();

  const dupes = page.getByRole("list", { name: "Possible duplicates" });
  await expect(dupes.getByRole("link", { name: /Maison Clé/ })).toBeVisible({ timeout: 20_000 });
  await dupes.getByRole("link", { name: /Maison Clé/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Maison Clé" })).toBeVisible();
});

test("adding a brand-new restaurant", async ({ page }) => {
  await signInAs(page, "Ben");
  const name = `Zz Test Diner ${Date.now()}`;
  await page.goto(`/restaurants/new?name=${encodeURIComponent(name)}`);
  await page.getByRole("combobox", { name: "Cuisine" }).fill("Diner");
  await page.getByRole("button", { name: "Add restaurant" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("No dishes yet")).toBeVisible();

  // Adding a near-identical name is flagged, but can be confirmed as a different place.
  await page.goto(`/restaurants/new?name=${encodeURIComponent(name + "!")}`);
  await page.getByRole("button", { name: "Add restaurant" }).click();
  const dupes = page.getByRole("list", { name: "Possible duplicates" });
  await expect(dupes.getByRole("link", { name })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /different place/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: `${name}!` })).toBeVisible({ timeout: 20_000 });
});
