import { getSearchLocation } from "@/lib/location";
import { AddRestaurantForm } from "./form";

export default async function NewRestaurantPage({ searchParams }: PageProps<"/restaurants/new">) {
  const { name } = await searchParams;
  const location = await getSearchLocation();
  return (
    <section className="max-w-xl">
      <div className="eyebrow">Add a restaurant</div>
      <h1 className="display mt-1.5 mb-3">Not on the map?</h1>
      <p className="text-muted mb-6">
        Add it yourself. Restaurants are shared, so other people can find and rate it too.
      </p>
      <AddRestaurantForm
        defaultName={typeof name === "string" ? name.slice(0, 120) : ""}
        defaultCity={location && location.label !== "your location" ? location.label.split(",")[0] : ""}
        center={location ?? null}
      />
    </section>
  );
}
