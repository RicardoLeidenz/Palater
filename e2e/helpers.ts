import type { Page } from "@playwright/test";

/** Uses the dev-only demo login (requires ENABLE_DEV_LOGIN=true and `npm run seed`). */
export async function signInAs(page: Page, who: "Ana" | "Ben") {
  await page.goto("/login");
  await page.getByRole("button", { name: `Sign in as ${who} (demo)` }).click();
  await page.waitForURL("/");
}
