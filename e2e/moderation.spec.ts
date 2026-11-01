import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";
import { serviceClient } from "../tests/helpers/supabase";

const MAISON_CLE = "/r/a0000000-0000-4000-8000-000000000001";
const LUCCA = "/r/a0000000-0000-4000-8000-000000000004";
let startedAt: string;

// Restore the seeded moderation state after each test.
async function reset() {
  const db = serviceClient();
  await db.from("dish_reports").delete().gte("created_at", startedAt);
  await db.from("dishes").update({ hidden: false }).eq("name", "Cacio e peppe");
  await db.from("dish_reports").update({ status: "open", reviewed_by: null, reviewed_at: null }).neq("status", "open");
}
test.beforeAll(async () => {
  startedAt = new Date().toISOString();
  await serviceClient().from("rate_limits").delete().neq("key", "");
});
test.afterEach(reset);

const row = (page: Page, dish: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: dish, exact: true }) });

test("anyone can report a dish name, once", async ({ page }) => {
  await signInAs(page, "Ben");
  await page.goto(MAISON_CLE);
  for (const expected of ["Thanks, we'll take a look.", "You've already reported this dish. Thanks!"]) {
    await row(page, "Kir royale").getByRole("button", { name: "Rate Kir royale" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Report this dish name" }).click();
    await sheet.getByRole("button", { name: "Not on this menu" }).click();
    await sheet.getByLabel("Report details").fill("They stopped serving it.");
    await sheet.getByRole("button", { name: "Send report" }).click();
    await expect(sheet.getByRole("status")).toHaveText(expected);
    await page.keyboard.press("Escape");
  }
});

test("admin hides a reported duplicate, then restores it", async ({ page, browser }) => {
  await signInAs(page, "Ana");
  await page.goto("/profile");
  await expect(page.getByRole("link", { name: /Moderation.*1 open/ })).toBeVisible();
  await page.getByRole("link", { name: /Moderation/ }).click();

  const queue = page.getByRole("list", { name: "Open reports" });
  const card = queue.getByRole("listitem").filter({ hasText: "Cacio e peppe" }).first();
  await expect(card).toContainText("Duplicate of another dish");
  await expect(card).toContainText("Same as Cacio e pepe, just misspelled.");

  // Renaming to an existing name on the same menu is refused.
  await card.getByRole("button", { name: "Fix the name" }).click();
  await card.getByLabel("Corrected dish name").fill("Cacio e pepe");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("alert")).toContainText("already has that name");
  await card.getByRole("button", { name: "Cancel" }).click();

  await card.getByRole("button", { name: "Hide from menu" }).click();
  await expect(page.getByText("All clear")).toBeVisible();
  await expect(page.getByRole("list", { name: "Hidden dishes" })).toContainText("Cacio e peppe");

  // Gone from the shared menu for everyone else.
  const ben = await (await browser.newContext()).newPage();
  await signInAs(ben, "Ben");
  await ben.goto(LUCCA);
  await expect(ben.getByRole("heading", { name: "Cacio e pepe", exact: true })).toBeVisible();
  await expect(ben.getByRole("heading", { name: "Cacio e peppe", exact: true })).toHaveCount(0);

  await page.getByRole("list", { name: "Hidden dishes" }).getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("No hidden dishes.")).toBeVisible();
  await ben.reload();
  await expect(ben.getByRole("heading", { name: "Cacio e peppe", exact: true })).toBeVisible();
});

test("non-admins can't open the admin area", async ({ page }) => {
  await signInAs(page, "Ben");
  // The page streams behind the loading skeleton, so the status is already
  // 200 when the admin check runs; Next then renders the not-found UI instead.
  await page.goto("/admin/reports");
  await expect(page.getByText("Nothing on this plate")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reported dishes" })).toHaveCount(0);
  await expect(page.getByText("Cacio e peppe")).toHaveCount(0);
  await page.goto("/profile");
  await expect(page.getByRole("link", { name: /Moderation/ })).toHaveCount(0);
});
