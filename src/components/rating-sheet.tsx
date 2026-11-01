"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { deleteRating, getRatingHistory, rateDish } from "@/app/(app)/r/[id]/actions";
import { NOTE_MAX, type MyRating, type RatingEntry } from "@/lib/menu-shared";
import { Sheet } from "./sheet";

export type RateTarget = { id: string; name: string; myRating: MyRating | null };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function RatingSheet({
  dish,
  restaurantName,
  open,
  onClose,
}: {
  dish: RateTarget | null;
  restaurantName: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="rating-sheet-title">
      {/* Remount per dish so form state starts fresh. */}
      {dish && <RatingForm key={dish.id} dish={dish} restaurantName={restaurantName} onDone={onClose} />}
    </Sheet>
  );
}

function RatingForm({ dish, restaurantName, onDone }: { dish: RateTarget; restaurantName: string; onDone: () => void }) {
  // Re-rating starts from your last score and comment, so small changes are quick.
  const [score, setScore] = useState<number | null>(dish.myRating?.score ?? null);
  const [note, setNote] = useState(dish.myRating?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const noteId = useId();

  function save() {
    if (!score) {
      setError("Pick a score first.");
      return;
    }
    setError(null);
    startSaving(async () => {
      const res = await rateDish({ dishId: dish.id, score, note });
      if (res.ok) onDone();
      else setError(res.error);
    });
  }

  return (
    <>
      <div className="eyebrow">{restaurantName}</div>
      <h2 id="rating-sheet-title" className="mt-1 mb-4 font-serif text-[28px] leading-tight">
        {dish.name}
      </h2>

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium">Your score</legend>
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10" role="group" aria-label="Score from 1 to 10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={score === n}
              onClick={() => {
                setScore(n);
                setError(null);
              }}
              className={`aspect-square rounded-[10px] border font-serif text-lg ${
                score === n ? "bg-plum border-plum text-sand" : "border-line bg-sand text-espresso"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="text-muted mt-1.5 mb-5 flex justify-between text-xs">
          <span>Wouldn&apos;t order again</span>
          <span>Unforgettable</span>
        </div>
      </fieldset>

      <label htmlFor={noteId} className="mb-1.5 block text-[13px] font-medium">
        Why this score? <span className="text-muted font-normal">(optional)</span>
      </label>
      <textarea
        id={noteId}
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
        maxLength={NOTE_MAX}
        rows={3}
        placeholder="Crispy skin, the cherry jus made it."
        className="field resize-y"
      />
      <div className={`mt-1 text-right text-xs ${note.length > NOTE_MAX - 20 ? "text-terracotta" : "text-muted"}`}>
        {note.length}/{NOTE_MAX}
      </div>

      <p className="text-muted mt-2 mb-4 flex items-center gap-1.5 text-xs">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        Only you can see your scores and comments.
      </p>

      <p role="alert" className="text-terracotta min-h-[18px] text-sm">
        {error}
      </p>
      <div className="mt-1 flex gap-2.5">
        <button type="button" className="btn flex-1" onClick={onDone}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary flex-1" onClick={save} disabled={saving}>
          {saving ? "Saving…" : dish.myRating ? "Save new rating" : "Save rating"}
        </button>
      </div>

      {dish.myRating && <History dishId={dish.id} />}
    </>
  );
}

function History({ dishId }: { dishId: string }) {
  const [entries, setEntries] = useState<RatingEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [, startDeleting] = useTransition();

  useEffect(() => {
    let live = true;
    getRatingHistory(dishId)
      .then((h) => live && setEntries(h))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [dishId]);

  function remove(id: string) {
    if (!confirm("Delete this rating from your history?")) return;
    setEntries((e) => e?.filter((x) => x.id !== id) ?? null);
    startDeleting(async () => {
      const res = await deleteRating(id);
      if (!res.ok) setFailed(true);
    });
  }

  return (
    <section className="border-line mt-6 border-t border-dashed pt-4" aria-label="Your rating history">
      <h3 className="mb-2 font-serif text-lg">Your history</h3>
      {failed && <p className="text-terracotta text-sm">Couldn&apos;t load your history.</p>}
      {!entries && !failed && <div className="skeleton h-10 w-full" aria-label="Loading history" />}
      {entries?.length === 0 && <p className="text-muted text-sm">No ratings yet.</p>}
      <ul>
        {entries?.map((e, i) => (
          <li key={e.id} className="flex items-start gap-3 border-b border-sand-2 py-2 last:border-0">
            <span className="font-serif text-lg font-semibold text-plum w-7 shrink-0 text-center">{e.score}</span>
            <div className="min-w-0 flex-1 text-sm">
              <div className="text-muted">
                {fmtDate(e.createdAt)}
                {i === 0 && " · latest"}
              </div>
              {e.note && <p className="break-words">{e.note}</p>}
            </div>
            <button
              type="button"
              onClick={() => remove(e.id)}
              className="text-muted shrink-0 text-xs underline"
              aria-label={`Delete rating of ${e.score} from ${fmtDate(e.createdAt)}`}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
