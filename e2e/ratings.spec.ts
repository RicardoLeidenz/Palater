import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";
import { serviceClient } from "../tests/helpers/supabase";

const MAISON_CLE = "/r/a0000000-0000-4000-8000-000000000001";
let startedAt: string;

test.beforeAll(async () => {
  startedAt = new Date().toISOString();
  await serviceClient().from("rate_limits").delete().neq("key", "");
});

// Put the seed data back the way we found it.
test.afterAll(async () => {
  const db = serviceClient();
  await db.from("ratings").delete().gte("created_at", startedAt);
  await db.from("dishes").delete().like("name", "Zz Test%");
});

const row = (page: Page, dish: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: dish, exact: true }) });
const sheet = (page: Page) => page.getByRole("dialog");

test("rate a dish with a score and a comment", async ({ page }) => {
  await signInAs(page, "Ana");
  await page.goto(MAISON_CLE);

  await row(page, "Escargots").getByRole("button", { name: "Rate Escargots" }).click();
  await expect(sheet(page).getByRole("heading", { name: "Escargots" })).toBeVisible();

  // Saving without a score is caught.
  await sheet(page).getByRole("button", { name: "Save rating" }).click();
  await expect(sheet(page).getByText("Pick a score first.")).toBeVisible();

  await sheet(page).getByRole("button", { name: "7", exact: true }).click();
  await sheet(page).getByLabel(/Why this score/).fill("Plenty of garlic, a bit chewy.");
  await sheet(page).getByRole("button", { name: "Save rating" }).click();

  await expect(sheet(page)).toBeHidden();
  await expect(row(page, "Escargots").getByText("7", { exact: true })).toBeVisible();
  await expect(row(page, "Escargots").getByText("“Plenty of garlic, a bit chewy.”")).toBeVisible();
});

test("re-rating keeps history and shows the latest score", async ({ page }) => {
  await signInAs(page, "Ana");
  await page.goto(MAISON_CLE);

  await row(page, "Steak tartare").getByRole("button", { name: /Your score for Steak tartare: 8/ }).click();
  await expect(sheet(page).getByRole("button", { name: "8", exact: true })).toHaveAttribute("aria-pressed", "true");
  const history = sheet(page).getByRole("region", { name: "Your rating history" });
  await expect(history.getByRole("listitem")).toHaveCount(2);

  await sheet(page).getByRole("button", { name: "9", exact: true }).click();
  await sheet(page).getByRole("button", { name: "Save new rating" }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(row(page, "Steak tartare").getByText("9", { exact: true })).toBeVisible();

  await row(page, "Steak tartare").getByRole("button", { name: /Your score for Steak tartare: 9/ }).click();
  await expect(history.getByRole("listitem")).toHaveCount(3);
});

test("typing a dish that's already on the menu suggests it instead of adding a duplicate", async ({ page }) => {
  await signInAs(page, "Ana");
  await page.goto(MAISON_CLE);
  await page.getByRole("button", { name: "Rate a dish" }).click();

  await sheet(page).getByLabel("Dish name").fill("creme brule");
  const suggestions = sheet(page).getByRole("list", { name: "Matching dishes on the menu" });
  await suggestions.getByRole("button", { name: /Crème brûlée/ }).click();

  await expect(page.getByRole("dialog", { name: "Crème brûlée" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Crème brûlée" }).getByRole("button", { name: "10", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("add a new dish to the shared menu and rate it right away", async ({ page }) => {
  await signInAs(page, "Ben");
  await page.goto(MAISON_CLE);
  await page.getByRole("button", { name: "Rate a dish" }).click();

  await sheet(page).getByLabel("Dish name").fill("Zz Test Soufflé");
  await sheet(page).getByRole("button", { name: "Dessert", exact: true }).click();
  await sheet(page).getByLabel(/Description/).fill("Grand Marnier");
  await sheet(page).getByRole("button", { name: /Add “Zz Test Soufflé” and rate it/ }).click();

  const rate = page.getByRole("dialog", { name: "Zz Test Soufflé" });
  await expect(rate).toBeVisible();
  await rate.getByRole("button", { name: "8", exact: true }).click();
  await rate.getByRole("button", { name: "Save rating" }).click();
  await expect(rate).toBeHidden();

  await expect(row(page, "Zz Test Soufflé").getByText("8", { exact: true })).toBeVisible();
  await expect(row(page, "Zz Test Soufflé").getByText("Grand Marnier")).toBeVisible();
});

test("filters show only my rated dishes, best first", async ({ page }) => {
  await signInAs(page, "Ana");
  await page.goto(MAISON_CLE);
  await page.getByRole("button", { name: "My top rated" }).click();
  const names = await page.getByRole("listitem").getByRole("heading", { level: 3 }).allTextContents();
  expect(names[0]).toBe("Crème brûlée");
  expect(names).not.toContain("Kir royale");

  await page.getByRole("button", { name: "Rated by me" }).click();
  await expect(page.getByRole("heading", { name: "Kir royale" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Duck confit" })).toBeVisible();
});

test("another user sees the shared menu but none of my scores or comments", async ({ page }) => {
  await signInAs(page, "Ben");
  await page.goto(MAISON_CLE);
  await expect(row(page, "Duck confit").getByText("4", { exact: true })).toBeVisible(); // Ben's own score
  await expect(page.getByText("Crispy skin, the cherry jus made it.")).toBeHidden(); // Ana's comment
  await expect(row(page, "Crème brûlée").getByRole("button", { name: "Rate Crème brûlée" })).toBeVisible();
});
