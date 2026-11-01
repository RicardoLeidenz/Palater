import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";
import { serviceClient } from "../tests/helpers/supabase";

const MAISON_CLE = "/r/a0000000-0000-4000-8000-000000000001";
const DISH = "Escargots";
let photoFile: string;
let startedAt: string;

/** A phone-like JPEG with camera + GPS EXIF. */
async function makePhoto(color: string) {
  const buf = await sharp({ create: { width: 1200, height: 900, channels: 3, background: color } })
    .jpeg()
    .withMetadata({
      exif: {
        IFD0: { Make: "LeakyPhone" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "30/1 16/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "97/1 44/1 0/1" },
      },
    })
    .toBuffer();
  const file = path.join(mkdtempSync(path.join(tmpdir(), "palater-")), `${color.slice(1)}.jpg`);
  writeFileSync(file, buf);
  return file;
}

async function cleanup() {
  const db = serviceClient();
  const { data: rows } = await db.from("dish_photos").select("full_path, thumb_path").gte("created_at", startedAt);
  const paths = (rows ?? []).flatMap((r) => [r.full_path, r.thumb_path]);
  if (paths.length) await db.storage.from("plate-photos").remove(paths);
  await db.from("dish_photos").delete().gte("created_at", startedAt);
  await db.from("ratings").delete().gte("created_at", startedAt);
}

test.beforeAll(async () => {
  startedAt = new Date().toISOString();
  photoFile = await makePhoto("#c98a4b");
  await serviceClient().from("rate_limits").delete().neq("key", "");
});
test.afterEach(cleanup);

const row = (page: Page) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: DISH, exact: true }) });

test("add, view, replace and remove a plate photo", async ({ page }) => {
  await signInAs(page, "Ana");
  await page.goto(MAISON_CLE);
  await expect(row(page).getByRole("button", { name: `View your photo of ${DISH}` })).toHaveCount(0); // no placeholder

  // Rate with a photo from the library.
  await row(page).getByRole("button", { name: `Rate ${DISH}` }).click();
  const sheet = page.getByRole("dialog", { name: DISH });
  await sheet.getByRole("button", { name: "6", exact: true }).click();
  await sheet.getByLabel("Choose from library").setInputFiles(photoFile);
  await expect(sheet.getByRole("img", { name: `Your photo of ${DISH}` })).toBeVisible();
  await sheet.getByRole("button", { name: "Save rating" }).click();
  await expect(sheet).toBeHidden({ timeout: 15_000 });

  // Thumbnail next to the dish name opens the full image.
  const thumb = row(page).getByRole("button", { name: `View your photo of ${DISH}` });
  await expect(thumb).toBeVisible();
  await thumb.click();
  const full = page.getByRole("dialog", { name: `Your photo of ${DISH}` }).getByRole("img");
  await expect(full).toBeVisible();

  // What's stored has no EXIF/GPS and is served via a signed URL.
  const src = await full.getAttribute("src");
  expect(src).toContain("/object/sign/plate-photos/");
  const stored = Buffer.from(await (await page.request.get(src!)).body());
  const meta = await sharp(stored).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.exif).toBeUndefined();
  expect(stored.toString("latin1")).not.toContain("LeakyPhone");
  await page.keyboard.press("Escape");

  // Replace: old files are deleted from storage.
  const db = serviceClient();
  const before = (await db.from("dish_photos").select("full_path, thumb_path").gte("created_at", startedAt).single()).data!;
  await row(page).getByRole("button", { name: /Your score for Escargots/ }).click();
  await sheet.getByLabel("Replace photo").setInputFiles(await makePhoto("#5e2a3c"));
  await sheet.getByRole("button", { name: "Save photo" }).click();
  await expect(sheet).toBeHidden({ timeout: 15_000 });
  const after = (await db.from("dish_photos").select("full_path").gte("created_at", startedAt).single()).data!;
  expect(after.full_path).not.toBe(before.full_path);
  const { data: oldFile } = await db.storage.from("plate-photos").download(before.full_path);
  expect(oldFile).toBeNull();
  // Swapping only the photo doesn't add a rating to the history.
  expect((await db.from("ratings").select("id").gte("created_at", startedAt)).data).toHaveLength(1);

  // Remove.
  await row(page).getByRole("button", { name: /Your score for Escargots/ }).click();
  await sheet.getByRole("button", { name: "Remove photo" }).click();
  await sheet.getByRole("button", { name: "Save photo" }).click();
  await expect(sheet).toBeHidden({ timeout: 15_000 });
  await expect(row(page).getByRole("button", { name: `View your photo of ${DISH}` })).toHaveCount(0);
  expect((await db.from("dish_photos").select("id").gte("created_at", startedAt)).data).toEqual([]);
});

test("other people never see your photos", async ({ browser }) => {
  // Ana adds a photo…
  const ana = await (await browser.newContext()).newPage();
  await signInAs(ana, "Ana");
  await ana.goto(MAISON_CLE);
  await row(ana).getByRole("button", { name: `Rate ${DISH}` }).click();
  const sheet = ana.getByRole("dialog", { name: DISH });
  await sheet.getByRole("button", { name: "7", exact: true }).click();
  await sheet.getByLabel("Choose from library").setInputFiles(photoFile);
  await sheet.getByRole("button", { name: "Save rating" }).click();
  await expect(sheet).toBeHidden({ timeout: 15_000 });
  await expect(row(ana).getByRole("button", { name: `View your photo of ${DISH}` })).toBeVisible();

  // …Ben sees the dish, but no thumbnail.
  const ben = await (await browser.newContext()).newPage();
  await signInAs(ben, "Ben");
  await ben.goto(MAISON_CLE);
  await expect(row(ben).getByRole("heading", { name: DISH })).toBeVisible();
  await expect(row(ben).getByRole("img")).toHaveCount(0);
});
