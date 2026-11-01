"use client";

import { useState } from "react";
import { AddDishSheet } from "@/components/add-dish-sheet";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { RatingSheet, type RateTarget } from "@/components/rating-sheet";
import { ScoreBadge } from "@/components/score-badge";
import { EmptyState } from "@/components/states";
import { CATEGORIES, type DishSuggestion, type MenuDish } from "@/lib/menu-shared";

type Filter = "all" | "rated" | "top";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "rated", label: "Rated by me" },
  { key: "top", label: "My top rated" },
];

export function RestaurantMenu({
  restaurantId,
  restaurantName,
  dishes,
}: {
  restaurantId: string;
  restaurantName: string;
  dishes: MenuDish[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [rating, setRating] = useState<RateTarget | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<MenuDish | null>(null);

  const rated = dishes.filter((d) => d.myRating);
  const visible = filter === "all" ? dishes : rated;

  function openRating(d: Pick<MenuDish, "id" | "name">) {
    const known = dishes.find((x) => x.id === d.id);
    setRating({ id: d.id, name: d.name, myRating: known?.myRating ?? null, myPhoto: known?.myPhoto ?? null });
  }

  function picked(d: DishSuggestion) {
    setAdding(false);
    openRating(d);
  }

  return (
    <>
      <div className="mt-5 mb-8 flex flex-wrap gap-2.5">
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          Rate a dish
        </button>
      </div>

      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3 border-b border-espresso pb-2">
        <h2 className="font-serif text-[26px]">The menu</h2>
        {dishes.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter the menu">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`chip ${filter === f.key ? "chip-on" : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {dishes.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No dishes yet"
            action={
              <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                Add the first dish
              </button>
            }
          >
            Add what&apos;s on the menu here. Dish names are shared with everyone; your ratings stay private.
          </EmptyState>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Nothing rated here yet">Tap a dish on the menu to give it a score.</EmptyState>
        </div>
      ) : filter === "top" ? (
        <DishList
          dishes={[...visible].sort((a, b) => b.myRating!.score - a.myRating!.score || a.name.localeCompare(b.name))}
          onRate={openRating}
          onView={setViewing}
        />
      ) : (
        CATEGORIES.map((c) => ({ ...c, items: visible.filter((d) => d.category === c.key) }))
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.label}>
              <div className="text-terracotta mt-6 mb-1 font-serif text-lg italic">{g.label}</div>
              <DishList dishes={g.items} onRate={openRating} onView={setViewing} />
            </div>
          ))
      )}

      {dishes.length > 0 && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="border-line text-muted mt-5 w-full rounded-xl border border-dashed p-3.5 text-sm"
        >
          Can&apos;t find a dish? Add it to the menu
        </button>
      )}

      <AddDishSheet
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        open={adding}
        onClose={() => setAdding(false)}
        onPicked={picked}
      />
      <PhotoLightbox
        photo={viewing?.myPhoto ?? null}
        alt={viewing ? `Your photo of ${viewing.name}` : ""}
        onClose={() => setViewing(null)}
      />
      <RatingSheet dish={rating} restaurantName={restaurantName} open={rating !== null} onClose={() => setRating(null)} />
    </>
  );
}

function DishList({
  dishes,
  onRate,
  onView,
}: {
  dishes: MenuDish[];
  onRate: (d: MenuDish) => void;
  onView: (d: MenuDish) => void;
}) {
  return (
    <ul>
      {dishes.map((d) => (
        <li
          key={d.id}
          className="border-line flex items-center gap-3 border-b border-dashed py-4"
        >
          {/* Only dishes you photographed get a thumbnail; no placeholder otherwise. */}
          {d.myPhoto && (
            <button
              type="button"
              onClick={() => onView(d)}
              aria-label={`View your photo of ${d.name}`}
              className="shrink-0 self-start rounded-xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.myPhoto.thumbUrl} alt="" width={48} height={48} className="size-12 rounded-xl object-cover" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-semibold">
              {d.name}
              {d.hidden && <span className="text-muted ml-2 text-xs font-normal">· removed from shared menu</span>}
            </h3>
            {d.description && <p className="text-muted text-sm">{d.description}</p>}
            {d.myRating?.note && (
              <p className="text-plum mt-1 font-serif text-[15px] italic break-words">“{d.myRating.note}”</p>
            )}
          </div>
          {d.myRating ? (
            <button
              type="button"
              onClick={() => onRate(d)}
              aria-label={`Your score for ${d.name}: ${d.myRating.score}. Rate again`}
              className="shrink-0 rounded-[10px]"
            >
              <ScoreBadge score={d.myRating.score} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onRate(d)}
              aria-label={`Rate ${d.name}`}
              className="border-terracotta text-terracotta shrink-0 rounded-[10px] border border-dashed px-3 py-2.5 text-[13px] font-medium"
            >
              Rate
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
