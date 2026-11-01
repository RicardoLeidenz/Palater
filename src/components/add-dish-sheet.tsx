"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { addDish, suggestDishes } from "@/app/(app)/r/[id]/actions";
import { CATEGORIES, type Category, type DishSuggestion } from "@/lib/menu-shared";
import { normalizeName } from "@/lib/similarity";
import { Sheet } from "./sheet";

/**
 * "Rate a dish": type a name, pick an existing dish from the shared menu, or
 * add a new one. Suggestions update as you type to prevent near-duplicates.
 */
export function AddDishSheet({
  restaurantId,
  restaurantName,
  open,
  onClose,
  onPicked,
}: {
  restaurantId: string;
  restaurantName: string;
  open: boolean;
  onClose: () => void;
  onPicked: (dish: DishSuggestion) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="add-dish-title">
      {/* Mounted only while open, so each opening starts with a fresh form. */}
      {open && (
        <AddDishForm restaurantId={restaurantId} restaurantName={restaurantName} onPicked={onPicked} onCancel={onClose} />
      )}
    </Sheet>
  );
}

function AddDishForm({
  restaurantId,
  restaurantName,
  onPicked,
  onCancel,
}: {
  restaurantId: string;
  restaurantName: string;
  onPicked: (dish: DishSuggestion) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [suggestions, setSuggestions] = useState<DishSuggestion[]>([]);
  const [searchedFor, setSearchedFor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const nameId = useId();
  const descId = useId();

  const trimmed = name.trim();
  const searching = trimmed.length >= 2 && searchedFor !== trimmed;

  // Debounced live suggestions from our own DB.
  useEffect(() => {
    if (trimmed.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      suggestDishes(restaurantId, trimmed)
        .then((s) => {
          if (!live) return;
          setSuggestions(s);
          setSearchedFor(trimmed);
        })
        .catch(() => live && setSearchedFor(trimmed));
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [restaurantId, trimmed]);

  const visibleSuggestions = trimmed.length >= 2 ? suggestions : [];
  const exact = visibleSuggestions.find((s) => normalizeName(s.name) === normalizeName(trimmed));

  function add() {
    if (!trimmed) {
      setError("Type the dish name first.");
      return;
    }
    setError(null);
    startSaving(async () => {
      const res = await addDish({ restaurantId, name: trimmed, description, category });
      if (res.ok) onPicked(res.data.dish);
      else setError(res.error);
    });
  }

  return (
    <>
      <div className="eyebrow">{restaurantName}</div>
      <h2 id="add-dish-title" className="mt-1 mb-4 font-serif text-[28px] leading-tight">
        What did you eat?
      </h2>

      <label htmlFor={nameId} className="mb-1.5 block text-[13px] font-medium">
        Dish name
      </label>
      <input
        id={nameId}
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 80))}
        autoFocus
        autoComplete="off"
        autoCapitalize="sentences"
        enterKeyHint="done"
        placeholder="e.g. Duck confit"
        className="field"
        aria-describedby={`${nameId}-hint`}
      />
      <p id={`${nameId}-hint`} className="text-muted mt-1 text-xs" aria-live="polite">
        {searching ? "Checking the menu…" : visibleSuggestions.length > 0 ? "Already on the menu. Tap one to rate it." : " "}
      </p>

      {visibleSuggestions.length > 0 && (
        <ul className="mt-1 mb-3" aria-label="Matching dishes on the menu">
          {visibleSuggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPicked(s)}
                className="border-line flex w-full items-center justify-between gap-3 border-b border-dashed py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{s.name}</span>
                  {s.description && <span className="text-muted block truncate text-sm">{s.description}</span>}
                </span>
                <span className="text-terracotta shrink-0 text-sm font-medium">Rate →</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {trimmed.length >= 1 && !exact && (
        <div className="bg-sand-2/60 mt-3 rounded-2xl p-4">
          <p className="mb-3 text-sm">
            <span className="font-semibold">New to this menu?</span>{" "}
            <span className="text-muted">Dish names are shared with everyone; your rating stays private.</span>
          </p>

          <div className="mb-3">
            <span className="mb-1.5 block text-[13px] font-medium" id={`${nameId}-cat`}>
              Category <span className="text-muted font-normal">(optional)</span>
            </span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${nameId}-cat`}>
              {CATEGORIES.filter((c) => c.key).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={category === c.key}
                  onClick={() => setCategory(category === c.key ? null : c.key)}
                  className={`chip ${category === c.key ? "chip-on" : ""}`}
                >
                  {c.singular}
                </button>
              ))}
            </div>
          </div>

          <label htmlFor={descId} className="mb-1.5 block text-[13px] font-medium">
            Description <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 200))}
            placeholder="Main ingredients, as on the menu"
            className="field mb-1"
            autoComplete="off"
          />

          <p role="alert" className="text-terracotta min-h-[18px] text-sm">
            {error}
          </p>
          <button type="button" onClick={add} disabled={saving || searching} className="btn btn-primary mt-1 w-full">
            {saving ? "Adding…" : `Add “${trimmed}” and rate it`}
          </button>
        </div>
      )}

      <button type="button" className="btn mt-4 w-full" onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}
