import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = "plate-photos";

// Long enough to browse a page, short enough that a leaked link soon stops working.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type PhotoUrls = { thumbUrl: string; fullUrl: string; width: number; height: number };

/**
 * Signed URLs for the current user's photos of the given dishes. Uses the
 * user's own client, so storage policies refuse to sign anyone else's files.
 */
export async function signedPhotoUrls(supabase: SupabaseClient, dishIds: string[]) {
  const result = new Map<string, PhotoUrls>();
  if (dishIds.length === 0) return result;

  const { data: photos, error } = await supabase
    .from("dish_photos")
    .select("dish_id, full_path, thumb_path, width, height")
    .in("dish_id", dishIds);
  if (error) throw error;
  if (!photos.length) return result;

  const paths = photos.flatMap((p) => [p.thumb_path, p.full_path]);
  const { data: signed, error: signError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (signError) throw signError;

  const byPath = new Map(signed.filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  for (const p of photos) {
    const thumbUrl = byPath.get(p.thumb_path);
    const fullUrl = byPath.get(p.full_path);
    if (thumbUrl && fullUrl) result.set(p.dish_id, { thumbUrl, fullUrl, width: p.width, height: p.height });
  }
  return result;
}
