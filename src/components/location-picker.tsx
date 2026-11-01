"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCurrentPosition } from "@/app/(app)/location/actions";
import { OFFLINE_MESSAGE } from "@/lib/offline";

const GEO_ERRORS: Record<number, string> = {
  1: "Location access is off for this site. Search by city instead, or allow location in your browser settings.",
  2: "We couldn't work out where you are. Try searching by city.",
  3: "Finding your location took too long. Try again, or search by city.",
};

export function LocationPicker({ defaultCity = "" }: { defaultCity?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = locating || pending;

  function locate() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Your browser can't share its location. Search by city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        startTransition(async () => {
          const err = await saveCurrentPosition(pos.coords.latitude, pos.coords.longitude).catch(() => OFFLINE_MESSAGE);
          if (err) setError(err);
          else router.refresh();
        });
      },
      (e) => {
        setLocating(false);
        setError(GEO_ERRORS[e.code] ?? GEO_ERRORS[2]);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  return (
    <div className="card">
      <button type="button" onClick={locate} disabled={busy} className="btn btn-primary w-full py-3 text-base">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
        {locating ? "Finding you…" : pending ? "Loading restaurants…" : "Use my location"}
      </button>
      {error && (
        <p role="alert" className="text-terracotta mt-3 text-sm">
          {error}
        </p>
      )}

      <div className="text-muted my-4 flex items-center gap-3 text-xs tracking-widest uppercase">
        <span className="bg-line h-px flex-1" /> or <span className="bg-line h-px flex-1" />
      </div>

      <form action="/location" className="flex gap-2">
        <input
          name="city"
          required
          minLength={2}
          defaultValue={defaultCity}
          placeholder="Search by city, e.g. Lisbon"
          aria-label="City"
          autoComplete="address-level2"
          enterKeyHint="search"
          className="field min-w-0 flex-1 rounded-full px-4 py-2.5"
        />
        <button type="submit" className="btn shrink-0">
          Find
        </button>
      </form>
    </div>
  );
}
