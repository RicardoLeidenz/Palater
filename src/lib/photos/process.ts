import "server-only";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const FULL_MAX_PX = 1600;
const THUMB_PX = 240;

export class UnsupportedImageError extends Error {
  constructor() {
    super("That file isn't a photo we can read. Try a JPEG, PNG or WebP image.");
    this.name = "UnsupportedImageError";
  }
}

export type ProcessedPhoto = {
  full: { data: Buffer; width: number; height: number };
  thumb: { data: Buffer; width: number; height: number };
};

/**
 * Re-encodes an uploaded photo whatever the client sent:
 *  - applies the EXIF orientation, then drops ALL metadata (EXIF incl. GPS,
 *    XMP, IPTC, ICC) — sharp never copies metadata unless asked to
 *  - full size: fits within 1600×1600, WebP
 *  - thumbnail: 240×240 center crop, WebP
 * Decoding is bounded to guard against decompression bombs.
 */
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  if (input.byteLength === 0 || input.byteLength > MAX_UPLOAD_BYTES) throw new UnsupportedImageError();

  const base = () =>
    sharp(input, { failOn: "error", limitInputPixels: 50_000_000, animated: false }).rotate();

  try {
    const meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
    if (!meta.format || !["jpeg", "png", "webp", "gif", "avif", "tiff", "heif"].includes(meta.format)) {
      throw new UnsupportedImageError();
    }

    const [full, thumb] = await Promise.all([
      base()
        .resize(FULL_MAX_PX, FULL_MAX_PX, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true }),
      base()
        .resize(THUMB_PX, THUMB_PX, { fit: "cover", position: "attention" })
        .webp({ quality: 72 })
        .toBuffer({ resolveWithObject: true }),
    ]);

    return {
      full: { data: full.data, width: full.info.width, height: full.info.height },
      thumb: { data: thumb.data, width: thumb.info.width, height: thumb.info.height },
    };
  } catch (e) {
    if (e instanceof UnsupportedImageError) throw e;
    // sharp throws plain Errors for corrupt or unsupported input.
    throw new UnsupportedImageError();
  }
}
