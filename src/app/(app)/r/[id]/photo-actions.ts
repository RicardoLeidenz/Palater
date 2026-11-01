"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES, processPhoto, UnsupportedImageError } from "@/lib/photos/process";
import { PHOTO_BUCKET } from "@/lib/photos/urls";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Saves (or replaces) your photo of a dish. Runs as the signed-in user, so
 * storage policies only allow writing into your own folder.
 */
export async function uploadDishPhoto(formData: FormData): Promise<Result> {
  const user = await getCurrentUser();
  const dishId = z.uuid().safeParse(formData.get("dishId"));
  const file = formData.get("photo");
  if (!dishId.success || !(file instanceof File)) return { ok: false, error: "Something's missing. Try again." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "That photo is too large (8 MB max)." };

  try {
    await assertRateLimit(`photo:${user.id}`, 30, 3600);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  let processed;
  try {
    processed = await processPhoto(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof UnsupportedImageError) return { ok: false, error: e.message };
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const storage = supabase.storage.from(PHOTO_BUCKET);
  const stem = `${user.id}/${dishId.data}/${randomUUID()}`;
  const fullPath = `${stem}-full.webp`;
  const thumbPath = `${stem}-thumb.webp`;

  const { data: previous } = await supabase
    .from("dish_photos")
    .select("full_path, thumb_path")
    .eq("dish_id", dishId.data)
    .maybeSingle();

  const uploads = await Promise.all([
    storage.upload(fullPath, processed.full.data, { contentType: "image/webp", cacheControl: "31536000" }),
    storage.upload(thumbPath, processed.thumb.data, { contentType: "image/webp", cacheControl: "31536000" }),
  ]);
  if (uploads.some((u) => u.error)) {
    await storage.remove([fullPath, thumbPath]);
    return { ok: false, error: "Couldn't upload your photo. Check your connection and try again." };
  }

  const { error } = await supabase.from("dish_photos").upsert(
    {
      user_id: user.id,
      dish_id: dishId.data,
      full_path: fullPath,
      thumb_path: thumbPath,
      width: processed.full.width,
      height: processed.full.height,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,dish_id" },
  );
  if (error) {
    await storage.remove([fullPath, thumbPath]);
    return { ok: false, error: "Couldn't save your photo. Please try again." };
  }

  // Only now that the new photo is in place, delete the one it replaced.
  if (previous) await storage.remove([previous.full_path, previous.thumb_path]);

  refresh();
  return { ok: true };
}

export async function deleteDishPhoto(dishId: string): Promise<Result> {
  await getCurrentUser();
  if (!z.uuid().safeParse(dishId).success) return { ok: false, error: "Unknown dish." };

  const supabase = await createSupabaseServerClient();
  const { data: photo } = await supabase
    .from("dish_photos")
    .delete()
    .eq("dish_id", dishId)
    .select("full_path, thumb_path")
    .maybeSingle();
  if (photo) await supabase.storage.from(PHOTO_BUCKET).remove([photo.full_path, photo.thumb_path]);

  refresh();
  return { ok: true };
}
