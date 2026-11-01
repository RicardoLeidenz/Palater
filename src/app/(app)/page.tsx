import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getSearchLocation, type SearchLocation } from "@/lib/location";
import { placesNear } from "@/lib/restaurants";
import { LocationPicker } from "@/components/location-picker";
import { OsmAttribution, PlaceList, PlaceListSkeleton } from "@/components/place-list";
import { PlacesError, PartialResultsNotice } from "@/components/places-error";
import { EmptyState } from "@/components/states";
import { forgetLocation } from "./location/actions";
import { Sidebar, SidebarSkeleton } from "@/components/sidebar";

export default async function ExplorePage() {
  const [user, location] = await Promise.all([getCurrentUser(), getSearchLocation()]);

  return (
    <div className="grid gap-8 min-[860px]:grid-cols-[minmax(0,1fr)_300px]">
      <section>
        <div className="eyebrow">{location ? `Near ${location.label}` : "Explore"}</div>
        <h1 className="display mt-1.5 mb-6">
          Hungry, <em className="text-plum">{user.name.split(" ")[0]}</em>?
        </h1>

        {location ? (
          <>
            <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-espresso pb-2">
              <h2 className="font-serif text-[26px]">Around you</h2>
              <div className="flex gap-3 text-sm">
                <Link href="/location" className="text-terracotta">
                  Change
                </Link>
                <form action={forgetLocation}>
                  <button type="submit" className="text-muted">
                    Forget
                  </button>
                </form>
              </div>
            </div>
            <Suspense fallback={<PlaceListSkeleton />}>
              <Nearby userId={user.id} location={location} />
            </Suspense>
          </>
        ) : (
          <>
            <p className="text-muted mb-5">Find restaurants around you, or pick a city to browse.</p>
            <LocationPicker />
          </>
        )}

        <Link
          href="/restaurants/new"
          className="border-line text-muted mt-6 block rounded-xl border border-dashed p-3.5 text-center text-sm no-underline"
        >
          Can&apos;t find a place? Add it yourself
        </Link>
      </section>
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
    </div>
  );
}

async function Nearby({ userId, location }: { userId: string; location: SearchLocation }) {
  let data: Awaited<ReturnType<typeof placesNear>>;
  try {
    data = await placesNear(userId, location);
  } catch (e) {
    return <PlacesError error={e} />;
  }

  if (data.results.length === 0) {
    return (
      <div className="mt-4">
        {data.osmError ? (
          <PlacesError error={data.osmError} />
        ) : (
          <EmptyState title="Nothing nearby">
            We couldn&apos;t find restaurants within 1.5 km. Try searching by name or another city.
          </EmptyState>
        )}
      </div>
    );
  }

  return (
    <>
      {data.osmError && <PartialResultsNotice />}
      <PlaceList places={data.results} label={`Restaurants near ${location.label}`} />
      <OsmAttribution />
    </>
  );
}
