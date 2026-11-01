import { OsmUnavailableError } from "@/lib/osm/client";
import { RateLimitError } from "@/lib/rate-limit";
import { ErrorState } from "./states";

/** Renders known search failures; rethrows anything unexpected to the error boundary. */
export function PlacesError({ error }: { error: unknown }) {
  if (error instanceof RateLimitError || error instanceof OsmUnavailableError) {
    return (
      <div className="mt-4">
        <ErrorState title="Search is taking a breather">{error.message}</ErrorState>
      </div>
    );
  }
  throw error;
}

export function PartialResultsNotice() {
  return (
    <p role="status" className="bg-sand-2 text-muted my-3 rounded-xl px-4 py-2.5 text-sm">
      OpenStreetMap isn&apos;t responding, so you&apos;re only seeing places already saved in Palater.
    </p>
  );
}
