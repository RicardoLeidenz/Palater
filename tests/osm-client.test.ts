import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { osmFetch, OsmUnavailableError } from "@/lib/osm/client";
import { serviceClient } from "./helpers/supabase";

const realFetch = globalThis.fetch;
let calls: { url: string; init?: RequestInit }[];

function mockFetch(respond: () => Response) {
  calls = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    // Supabase traffic goes to the real local DB; OSM traffic is mocked.
    if (url.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL!)) return realFetch(input, init);
    calls.push({ url, init });
    return respond();
  }) as typeof fetch;
}

beforeEach(async () => {
  await serviceClient().from("osm_throttle").delete().neq("service", "");
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("osmFetch", () => {
  it("identifies itself with a contact address in the User-Agent", async () => {
    mockFetch(() => Response.json({ ok: true }));
    await osmFetch("photon", `https://photon.test/api/?q=${randomUUID()}`, { ttlSeconds: 60 });
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("Palater/");
    expect(headers["User-Agent"]).toContain(process.env.OSM_CONTACT_EMAIL);
  });

  it("serves repeat requests from the cache instead of hitting OSM again", async () => {
    mockFetch(() => Response.json({ n: 1 }));
    const url = `https://photon.test/api/?q=${randomUUID()}`;
    const a = await osmFetch("photon", url, { ttlSeconds: 60 });
    const b = await osmFetch("photon", url, { ttlSeconds: 60 });
    expect(a).toEqual({ n: 1 });
    expect(b).toEqual({ n: 1 });
    expect(calls).toHaveLength(1);
  });

  it("spaces out Nominatim requests to at most ~1 per second", async () => {
    mockFetch(() => Response.json([]));
    const started = Date.now();
    await osmFetch("nominatim", `https://nominatim.test/search?q=${randomUUID()}`, { ttlSeconds: 60 });
    await osmFetch("nominatim", `https://nominatim.test/search?q=${randomUUID()}`, { ttlSeconds: 60 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(1000);
  });

  it("fails fast with a friendly error when the queue is too long", async () => {
    mockFetch(() => Response.json([]));
    // Pretend lots of requests are already queued.
    await serviceClient()
      .from("osm_throttle")
      .upsert({ service: "nominatim", next_slot: new Date(Date.now() + 30_000).toISOString() });
    await expect(
      osmFetch("nominatim", `https://nominatim.test/search?q=${randomUUID()}`, { ttlSeconds: 60 }),
    ).rejects.toBeInstanceOf(OsmUnavailableError);
    expect(calls).toHaveLength(0);
  });

  it("turns rate limiting and outages into OsmUnavailableError, and doesn't cache them", async () => {
    mockFetch(() => new Response("slow down", { status: 429 }));
    const url = `https://photon.test/api/?q=${randomUUID()}`;
    await expect(osmFetch("photon", url, { ttlSeconds: 60 })).rejects.toBeInstanceOf(OsmUnavailableError);
    mockFetch(() => Response.json({ recovered: true }));
    await expect(osmFetch("photon", url, { ttlSeconds: 60 })).resolves.toEqual({ recovered: true });
  });
});
