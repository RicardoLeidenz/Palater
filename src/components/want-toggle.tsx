"use client";

import { useOptimistic, useTransition } from "react";
import { toggleWant } from "@/app/(app)/want-to-try/actions";

/** "Add to want to try" pill for a restaurant (reference .btn / .btn.saved). */
export function WantRestaurantButton({ restaurantId, saved }: { restaurantId: string; saved: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          // On failure the optimistic state simply snaps back.
          await toggleWant({ restaurantId }).catch(() => null);
        })
      }
      className={`btn ${optimistic ? "btn-saved" : ""}`}
    >
      {optimistic ? "Saved to want to try" : "Add to want to try"}
    </button>
  );
}

/** Small bookmark next to a dish you haven't tried yet. */
export function WantDishButton({ dishId, dishName, saved }: { dishId: string; dishName: string; saved: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? `Remove ${dishName} from want to try` : `Save ${dishName} to want to try`}
      title={optimistic ? "On your want-to-try list" : "Want to try"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleWant({ dishId }).catch(() => null);
        })
      }
      className={`grid size-10 shrink-0 place-items-center rounded-[10px] ${optimistic ? "text-sage" : "text-muted"}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={optimistic ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
    </button>
  );
}
