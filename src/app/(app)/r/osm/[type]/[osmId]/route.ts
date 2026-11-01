import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { importOsmPlace } from "@/lib/restaurants";
import { OsmUnavailableError } from "@/lib/osm/client";
import { RateLimitError } from "@/lib/rate-limit";

const TYPES = new Set(["node", "way", "relation"]);

// Opening an OSM search result saves it (verified against OSM) and redirects
// to its permanent restaurant page.
export async function GET(request: NextRequest, ctx: RouteContext<"/r/osm/[type]/[osmId]">) {
  const { type, osmId } = await ctx.params;
  const id = Number(osmId);
  if (!TYPES.has(type) || !Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.redirect(new URL("/search", request.nextUrl.origin));
  }

  const user = await getCurrentUser();
  try {
    const restaurantId = await importOsmPlace(user.id, type as "node" | "way" | "relation", id);
    if (!restaurantId) {
      return NextResponse.redirect(new URL("/search?missing=1", request.nextUrl.origin));
    }
    return NextResponse.redirect(new URL(`/r/${restaurantId}`, request.nextUrl.origin));
  } catch (e) {
    if (e instanceof OsmUnavailableError || e instanceof RateLimitError) {
      return new NextResponse(e.message, { status: 503, headers: { "Retry-After": "5" } });
    }
    throw e;
  }
}
