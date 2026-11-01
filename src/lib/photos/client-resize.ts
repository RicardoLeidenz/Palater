// Runs in the browser before upload. Keeps uploads small on mobile data, and
// because the image is redrawn on a canvas, EXIF (incl. GPS) never leaves the
// phone. The server re-processes and strips metadata again regardless.

const MAX_EDGE = 2048;
const QUALITY = 0.88;

export async function prepareForUpload(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the EXIF rotation, so portrait shots stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Formats the browser can't decode (e.g. HEIC on desktop Chrome): let the
    // server try, it will reply with a clear error if it can't either.
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  return blob ?? file;
}
