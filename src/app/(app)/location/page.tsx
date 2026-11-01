import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { geocodeCity, type CityResult } from "@/lib/osm/places";
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit";
import { OsmUnavailableError } from "@/lib/osm/client";
import { LocationPicker } from "@/components/location-picker";
import { EmptyState, ErrorState, Skeleton } from "@/components/states";
import { chooseCity } from "./actions";

export default async function LocationPage({ searchParams }: PageProps<"/location">) {
  const { city } = await searchParams;
  const q = typeof city === "string" ? city.trim() : "";

  return (
    <section className="max-w-xl">
      <div className="eyebrow">Where are you eating?</div>
      <h1 className="display mt-1.5 mb-6">Choose a city</h1>
      <LocationPicker defaultCity={q} />
      {q && (
        <Suspense key={q} fallback={<CitySkeleton />}>
          <CityResults query={q} />
        </Suspense>
      )}
    </section>
  );
}

async function CityResults({ query }: { query: string }) {
  const user = await getCurrentUser();
  let cities: CityResult[];
  try {
    await assertRateLimit(`city:${user.id}`, 10, 60);
    cities = await geocodeCity(query);
  } catch (e) {
    if (e instanceof RateLimitError || e instanceof OsmUnavailableError) {
      return <div className="mt-6"><ErrorState title="Couldn't search cities">{e.message}</ErrorState></div>;
    }
    throw e;
  }

  if (cities.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState title={`No city called “${query}”`}>Check the spelling, or try a nearby larger town.</EmptyState>
      </div>
    );
  }

  return (
    <ul className="mt-6" aria-label="Matching cities">
      {cities.map((c) => (
        <li key={`${c.lat},${c.lng}`} className="border-line border-b border-dashed">
          <form action={chooseCity}>
            <input type="hidden" name="lat" value={c.lat} />
            <input type="hidden" name="lng" value={c.lng} />
            <input type="hidden" name="label" value={c.label} />
            <button type="submit" className="flex w-full items-center justify-between py-4 text-left">
              <span className="font-semibold">{c.label}</span>
              <span className="text-terracotta text-sm">Choose →</span>
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

function CitySkeleton() {
  return (
    <div className="mt-6" aria-busy="true" aria-label="Searching cities">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="mb-3 h-12 w-full" />
      ))}
    </div>
  );
}
