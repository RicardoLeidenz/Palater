"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { WantItem } from "@/lib/lists";
import { OFFLINE_MESSAGE } from "@/lib/offline";
import { removeWant, setWantStatus } from "./actions";

export function WantList({ items, label }: { items: WantItem[]; label: string }) {
  return (
    <ul aria-label={label}>
      {items.map((item) => (
        <WantRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function WantRow({ item }: { item: WantItem }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const title = item.dishName ?? item.restaurantName;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn().catch(() => ({ ok: false, error: OFFLINE_MESSAGE }));
      if (!res.ok) setError(res.error ?? "Something went wrong.");
    });

  return (
    <li className={`border-line border-b border-dashed py-4 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-2 size-2.5 shrink-0 rounded-full ${item.status === "want" ? "bg-sage" : "bg-line"}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <Link href={`/r/${item.restaurantId}`} className="block no-underline">
            <h3 className="text-[17px] font-semibold">{title}</h3>
            <p className="text-muted text-sm">
              {item.kind === "dish" ? `Dish at ${item.restaurantName}` : "Restaurant"}
              {item.subtitle ? ` · ${item.subtitle}` : ""}
            </p>
          </Link>
          {item.myScore != null && (
            <p className="text-plum mt-1 text-sm">
              {item.kind === "dish" ? `You rated it ${item.myScore}` : `You've rated dishes here (best ${item.myScore})`}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {item.status === "want" && item.myScore != null && (
              <button type="button" className="chip chip-on" disabled={pending} onClick={() => run(() => setWantStatus(item.id, "visited"))}>
                Move to visited
              </button>
            )}
            {item.status === "visited" && (
              <button type="button" className="chip" disabled={pending} onClick={() => run(() => setWantStatus(item.id, "want"))}>
                Move back to list
              </button>
            )}
            <button
              type="button"
              className="chip"
              disabled={pending}
              aria-label={`Remove ${title} from your list`}
              onClick={() => run(() => removeWant(item.id))}
            >
              Remove
            </button>
          </div>
          {error && (
            <p role="alert" className="text-terracotta mt-1 text-sm">
              {error}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
