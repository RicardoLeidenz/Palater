import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processPhoto, UnsupportedImageError } from "@/lib/photos/process";

/** A 400×200 JPEG tagged "rotate 90°" with camera and GPS EXIF, like a phone photo. */
async function phoneJpeg() {
  return sharp({ create: { width: 400, height: 200, channels: 3, background: "#b5573a" } })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: {
        IFD0: { Make: "TestPhone", Model: "Pro Max" },
        IFD3: {
          GPSLatitudeRef: "N",
          GPSLatitude: "30/1 16/1 0/1",
          GPSLongitudeRef: "W",
          GPSLongitude: "97/1 44/1 0/1",
        },
      },
    })
    .toBuffer();
}

describe("processPhoto", () => {
  it("the fixture really carries GPS and camera EXIF", async () => {
    const meta = await sharp(await phoneJpeg()).metadata();
    expect(meta.exif).toBeDefined();
    expect(meta.exif!.toString("latin1")).toContain("TestPhone");
    expect(meta.orientation).toBe(6);
  });

  it("strips all metadata, including GPS location, from both sizes", async () => {
    const out = await processPhoto(await phoneJpeg());
    for (const img of [out.full.data, out.thumb.data]) {
      const meta = await sharp(img).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.iptc).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(img.toString("latin1")).not.toContain("TestPhone");
    }
  });

  it("applies the EXIF rotation before discarding it", async () => {
    const out = await processPhoto(await phoneJpeg());
    expect([out.full.width, out.full.height]).toEqual([200, 400]);
  });

  it("downsizes large photos and makes a square thumbnail", async () => {
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#5e2a3c" } })
      .jpeg()
      .toBuffer();
    const out = await processPhoto(big);
    expect([out.full.width, out.full.height]).toEqual([1600, 1200]);
    expect([out.thumb.width, out.thumb.height]).toEqual([240, 240]);
  });

  it("rejects files that aren't images", async () => {
    await expect(processPhoto(Buffer.from("<svg onload=alert(1)>"))).rejects.toBeInstanceOf(UnsupportedImageError);
    await expect(processPhoto(Buffer.from("definitely not a jpeg"))).rejects.toBeInstanceOf(UnsupportedImageError);
    await expect(processPhoto(Buffer.alloc(0))).rejects.toBeInstanceOf(UnsupportedImageError);
  });
});
