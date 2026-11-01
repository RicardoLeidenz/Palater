import Link from "next/link";
import { formatDistance, type PlaceResult } from "@/lib/places-shared";
import { Skeleton } from "./states";

export function placeHref(p: PlaceResult) {
  return p.id ? `/r/${p.id}` : `/r/osm/${p.osm!.type}/${p.osm!.id}`;
}

export function PlaceList({ places, label }: { places: PlaceResult[]; label: string }) {
  return (
    <ul aria-label={label}>
      {places.map((p) => {
        const meta = [p.cuisine, p.address ?? p.city].filter(Boolean).join(" · ");
        const distance = formatDistance(p.distanceM);
        return (
          <li key={p.key} className="border-line border-b border-dashed">
            {/* OSM places are saved on first open, so don't prefetch them. */}
            <Link
              href={placeHref(p)}
              prefetch={p.id ? null : false}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 no-underline"
            >
              <div className="min-w-0">
                <h3 className="truncate text-[17px] font-semibold">{p.name}</h3>
                {meta && <p className="text-muted truncate text-sm">{meta}</p>}
              </div>
              {distance && <span className="text-muted font-serif">{distance}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function PlaceListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading restaurants">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="border-line border-b border-dashed py-4">
          <Skeleton className="mb-2 h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function OsmAttribution() {
  return (
    <p className="text-muted mt-6 text-xs">
      Place data ©{" "}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
        OpenStreetMap contributors
      </a>
    </p>
  );
}
