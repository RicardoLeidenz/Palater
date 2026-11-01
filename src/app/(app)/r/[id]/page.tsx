import { notFound } from "next/navigation";
import { getRestaurantPage } from "@/lib/menu";
import { RestaurantMenu } from "./menu";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return {};
  const page = await getRestaurantPage(id);
  return { title: page ? `${page.restaurant.name} · Palater` : "Palater" };
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function RestaurantPage({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const page = await getRestaurantPage(id);
  if (!page) notFound();
  const { restaurant: r, menu, visitCount, lastVisit } = page;

  const eyebrow = [r.cuisine, r.city].filter(Boolean).join(" · ") || "Restaurant";

  return (
    <section className="max-w-2xl">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="display mt-1.5 mb-2.5 break-words">{r.name}</h1>
      <div className="text-muted flex flex-wrap gap-x-[18px] gap-y-2 text-sm">
        {r.address && <span>{[r.address, r.city].filter(Boolean).join(", ")}</span>}
        {visitCount > 0 ? (
          <>
            <span>
              Visited {visitCount} {visitCount === 1 ? "time" : "times"}
            </span>
            {lastVisit && <span>Last visit {fmtDate(lastVisit)}</span>}
          </>
        ) : (
          <span>Not visited yet</span>
        )}
        {r.source === "osm" && r.osm_type && (
          <a
            href={`https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            View on OpenStreetMap
          </a>
        )}
      </div>

      <RestaurantMenu restaurantId={r.id} restaurantName={r.name} dishes={menu} />
    </section>
  );
}
