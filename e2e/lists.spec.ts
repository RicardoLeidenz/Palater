import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";
import { serviceClient } from "../tests/helpers/supabase";

const MAISON_CLE = "/r/a0000000-0000-4000-8000-000000000001";
let startedAt: string;

test.beforeAll(() => {
  startedAt = new Date().toISOString();
});
test.afterEach(async () => {
  const db = serviceClient();
  await db.from("ratings").delete().gte("created_at", startedAt);
  await db.from("want_to_try").delete().gte("created_at", startedAt);
});

const row = (page: Page, dish: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: dish, exact: true }) });

test("save a dish, rate it, and move it to visited", async ({ page }) => {
  await signInAs(page, "Ben");
  await page.goto(MAISON_CLE);

  await row(page, "Escargots").getByRole("button", { name: "Save Escargots to want to try" }).click();
  await expect(row(page, "Escargots").getByRole("button", { name: "Remove Escargots from want to try" })).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Want to try" }).click();
  const toTry = page.getByRole("list", { name: "To try" });
  await expect(toTry.getByRole("heading", { name: "Escargots" })).toBeVisible();

  await toTry.getByRole("link", { name: /Escargots/ }).click();
  await row(page, "Escargots").getByRole("button", { name: "Rate Escargots" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "9", exact: true }).click();
  await sheet.getByRole("button", { name: "Save rating" }).click();

  await expect(sheet.getByRole("heading", { name: "Tried it!" })).toBeVisible();
  await sheet.getByRole("button", { name: "Move to visited" }).click();
  await expect(sheet).toBeHidden();

  await page.goto("/want-to-try");
  const tried = page.getByRole("list", { name: "Tried from your list" });
  await expect(tried.getByRole("heading", { name: "Escargots" })).toBeVisible();
  await expect(tried.getByText("You rated it 9")).toBeVisible();
  await expect(page.getByRole("list", { name: "To try" }).getByRole("heading", { name: "Escargots" })).toBeHidden();
});

test("save and unsave a restaurant; it shows in the sidebar", async ({ page }) => {
  await signInAs(page, "Ana");
  await page.goto(MAISON_CLE);
  const save = page.getByRole("button", { name: "Add to want to try" });
  await save.click();
  await expect(page.getByRole("button", { name: "Saved to want to try" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Your palate" }).getByText("Maison Clé")).toBeVisible();

  await page.getByRole("button", { name: "Saved to want to try" }).click();
  await expect(page.getByRole("button", { name: "Add to want to try" })).toBeVisible();
});

test("visited and profile summarise my ratings", async ({ page }) => {
  await signInAs(page, "Ana");
  await page.goto("/visited");
  const visited = page.getByRole("list", { name: "Restaurants you've visited" });
  await expect(visited.getByRole("listitem")).toHaveCount(4);
  await expect(visited.getByRole("listitem").first()).toContainText("Trattoria Lucca"); // most recent visit
  await expect(visited.getByRole("listitem").filter({ hasText: "Maison Clé" })).toContainText("4 dishes rated");

  await page.goto("/profile");
  await expect(page.getByText("Dishes rated")).toBeVisible();
  const best = page.getByRole("list").filter({ hasText: "Crème brûlée" });
  await expect(best.getByRole("listitem").first()).toContainText("Crème brûlée");
});
