import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("signed-out visitors are sent to login", async ({ page }) => {
  await page.goto("/visited");
  await expect(page).toHaveURL(/\/login\?next=%2Fvisited/);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("sign in, move between tabs, sign out", async ({ page }) => {
  await signInAs(page, "Ana");
  await expect(page.getByRole("heading", { name: /Hungry, Ana/ })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Want to try" }).click();
  await expect(page.getByRole("heading", { name: "Want to try" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Want to try" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "Your profile" }).click();
  await expect(page.getByRole("heading", { name: "Ana Ribeiro" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
