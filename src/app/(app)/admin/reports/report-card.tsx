"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { OFFLINE_MESSAGE } from "@/lib/offline";
import { dismissReports, hideDish, renameDish, unhideDish } from "./actions";

export type ReportGroup = {
  dishId: string;
  dishName: string;
  hidden: boolean;
  restaurantId: string;
  restaurantName: string;
  firstReported: string;
  reasons: { label: string; count: number }[];
  details: string[];
  count: number;
};

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      try {
        const res = await fn();
        if (!res.ok) setError(res.error ?? "Something went wrong.");
      } catch {
        setError(OFFLINE_MESSAGE);
      }
    });
  return { pending, error, run };
}

export function ReportCard({ group: g }: { group: ReportGroup }) {
  const { pending, error, run } = useAction();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(g.dishName);

  return (
    <li className={`card ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{g.dishName}</h3>
          <Link href={`/r/${g.restaurantId}`} className="text-muted text-sm underline">
            {g.restaurantName}
          </Link>
        </div>
        <span className="bg-terracotta text-paper shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold">
          {g.count} {g.count === 1 ? "report" : "reports"}
        </span>
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Reasons">
        {g.reasons.map((r) => (
          <li key={r.label} className="chip">
            {r.label}
            {r.count > 1 ? ` ×${r.count}` : ""}
          </li>
        ))}
      </ul>
      {g.details.length > 0 && (
        <ul className="text-muted mt-3 space-y-1 text-sm" aria-label="Reporter notes">
          {g.details.map((d, i) => (
            <li key={i} className="break-words">
              “{d}”
            </li>
          ))}
        </ul>
      )}

      {renaming ? (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => renameDish(g.dishId, name));
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            aria-label="Corrected dish name"
            className="field min-w-0 flex-1 py-2"
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={pending}>
            Save
          </button>
          <button type="button" className="btn" onClick={() => setRenaming(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={pending} onClick={() => run(() => dismissReports(g.dishId))}>
            Keep it
          </button>
          <button type="button" className="btn" disabled={pending} onClick={() => setRenaming(true)}>
            Fix the name
          </button>
          <button
            type="button"
            className="btn border-terracotta text-terracotta"
            disabled={pending}
            onClick={() => run(() => hideDish(g.dishId))}
          >
            Hide from menu
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-terracotta mt-2 text-sm">
          {error}
        </p>
      )}
    </li>
  );
}

export function HiddenDishRow({ dishId, name, restaurantName }: { dishId: string; name: string; restaurantName: string }) {
  const { pending, error, run } = useAction();
  return (
    <li className="border-line flex items-center gap-3 border-b border-dashed py-3">
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{name}</span> <span className="text-muted text-sm">· {restaurantName}</span>
        {error && (
          <p role="alert" className="text-terracotta text-sm">
            {error}
          </p>
        )}
      </div>
      <button type="button" className="chip" disabled={pending} onClick={() => run(() => unhideDish(dishId))}>
        Restore
      </button>
    </li>
  );
}
