import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getSearchLocation, type SearchLocation } from "@/lib/location";
import { findPlaces } from "@/lib/restaurants";
import { OsmAttribution, PlaceList, PlaceListSkeleton } from "@/components/place-list";
import { PartialResultsNotice, PlacesError } from "@/components/places-error";
import { EmptyState } from "@/components/states";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const [user, location] = await Promise.all([getCurrentUser(), getSearchLocation()]);

  return (
    <section className="max-w-2xl">
      <div className="eyebrow">{location ? `Searching near ${location.label}` : "Searching everywhere"}</div>
      <h1 className="display mt-1.5 mb-6 break-words">{query ? `“${query}”` : "Find a restaurant"}</h1>

      {query.length < 2 ? (
        <EmptyState title="What are you looking for?">
          Type a restaurant name in the search bar above, at least two letters.
        </EmptyState>
      ) : (
        <Suspense key={query} fallback={<PlaceListSkeleton />}>
          <Results userId={user.id} query={query} location={location} />
        </Suspense>
      )}

      {!location && (
        <p className="text-muted mt-6 text-sm">
          Results are better with a location.{" "}
          <Link href="/location" className="text-terracotta">
            Set your city
          </Link>
        </p>
      )}
    </section>
  );
}

async function Results({ userId, query, location }: { userId: string; query: string; location: SearchLocation | null }) {
  let data: Awaited<ReturnType<typeof findPlaces>>;
  try {
    data = await findPlaces(userId, query, location ?? undefined);
  } catch (e) {
    return <PlacesError error={e} />;
  }

  const addHref = `/restaurants/new?name=${encodeURIComponent(query)}`;
  if (data.results.length === 0) {
    if (data.osmError) return <PlacesError error={data.osmError} />;
    return (
      <EmptyState
        title="No restaurants found"
        action={
          <Link href={addHref} className="btn btn-primary">
            Add “{query}”
          </Link>
        }
      >
        Not on OpenStreetMap yet? Add it yourself and start rating.
      </EmptyState>
    );
  }

  return (
    <>
      {data.osmError && <PartialResultsNotice />}
      <PlaceList places={data.results} label={`Results for ${query}`} />
      <Link href={addHref} className="border-line text-muted mt-6 block rounded-xl border border-dashed p-3.5 text-center text-sm no-underline">
        Not the one? Add “{query}” yourself
      </Link>
      <OsmAttribution />
    </>
  );
}
