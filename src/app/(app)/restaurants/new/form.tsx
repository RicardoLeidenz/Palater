"use client";

import dynamic from "next/dynamic";
import { useActionState, useRef, useState } from "react";
import { PlaceList } from "@/components/place-list";
import { addRestaurant, type AddRestaurantState } from "./actions";

const MapPicker = dynamic(() => import("@/components/map-picker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="skeleton h-64 w-full rounded-xl" aria-label="Loading map" />,
});

const CUISINES = [
  "American", "Bakery", "Barbecue", "Burgers", "Café", "Chinese", "French", "Greek", "Indian",
  "Italian", "Japanese", "Korean", "Mediterranean", "Mexican", "Middle Eastern", "Pizza",
  "Seafood", "Spanish", "Steakhouse", "Sushi", "Thai", "Vegetarian", "Vietnamese",
];

export function AddRestaurantForm({
  defaultName,
  defaultCity,
  center,
}: {
  defaultName: string;
  defaultCity: string;
  center: { lat: number; lng: number } | null;
}) {
  const [state, action, pending] = useActionState<AddRestaurantState, FormData>(addRestaurant, { status: "idle" });
  const [values, setValues] = useState({ name: defaultName, address: "", city: defaultCity, cuisine: "" });
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const confirmRef = useRef<HTMLInputElement>(null);

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Only the "add anyway" button confirms; a normal submit re-checks.
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (confirmRef.current) confirmRef.current.value = submitter?.value === "confirm" ? "1" : "";
      }}
      noValidate
    >
      <input type="hidden" name="confirmed" ref={confirmRef} />
      {pin && (
        <>
          <input type="hidden" name="lat" value={pin.lat} />
          <input type="hidden" name="lng" value={pin.lng} />
        </>
      )}

      <Field label="Name" error={fieldErrors.name}>
        <input name="name" value={values.name} onChange={set("name")} required maxLength={120} className="field" autoComplete="off" aria-invalid={!!fieldErrors.name} />
      </Field>
      <Field label="Street address" hint="Optional, but it helps others find it.">
        <input name="address" value={values.address} onChange={set("address")} maxLength={240} className="field" autoComplete="street-address" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <input name="city" value={values.city} onChange={set("city")} maxLength={120} className="field" autoComplete="address-level2" />
        </Field>
        <Field label="Cuisine">
          <input name="cuisine" value={values.cuisine} onChange={set("cuisine")} maxLength={80} list="cuisines" className="field" autoComplete="off" />
          <datalist id="cuisines">
            {CUISINES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="mb-5">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[13px] font-medium">Map pin</span>
          {pin ? (
            <button type="button" className="text-terracotta text-sm" onClick={() => setPin(null)}>
              Remove pin
            </button>
          ) : (
            !showMap && (
              <button type="button" className="text-terracotta text-sm" onClick={() => setShowMap(true)}>
                Add a pin (optional)
              </button>
            )
          )}
        </div>
        {showMap && (
          <>
            <MapPicker center={center} value={pin} onChange={setPin} />
            <p className="text-muted mt-1.5 text-xs">
              {pin ? "Pin placed. Tap elsewhere to move it." : "Tap the map where the restaurant is."}
            </p>
          </>
        )}
      </div>

      {state.status === "duplicates" && (
        <div className="card mb-5" role="alert">
          <h2 className="font-serif text-xl">Is it one of these?</h2>
          <p className="text-muted mb-2 text-sm">We found similar places nearby. Open it instead of adding a duplicate.</p>
          <PlaceList places={state.candidates} label="Possible duplicates" />
          <button type="submit" value="confirm" disabled={pending} className="btn mt-4 w-full">
            No, it&apos;s a different place. Add it.
          </button>
        </div>
      )}

      {state.status === "error" && (
        <p role="alert" className="text-terracotta mb-3 text-sm">
          {state.message}
        </p>
      )}

      {state.status !== "duplicates" && (
        <button type="submit" value="check" disabled={pending} className="btn btn-primary w-full py-3 text-base">
          {pending ? "Checking…" : "Add restaurant"}
        </button>
      )}
    </form>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      {children}
      {error ? (
        <span className="text-terracotta mt-1 block text-xs">{error}</span>
      ) : (
        hint && <span className="text-muted mt-1 block text-xs">{hint}</span>
      )}
    </label>
  );
}
