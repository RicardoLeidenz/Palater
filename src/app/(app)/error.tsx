"use client";

import { ErrorState } from "@/components/states";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="This page didn't load"
      action={
        <button type="button" className="btn" onClick={reset}>
          Try again
        </button>
      }
    >
      Check your connection. If it keeps happening, try again in a few minutes.
    </ErrorState>
  );
}
