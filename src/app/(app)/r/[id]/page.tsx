import { notFound } from "next/navigation";
import { getRestaurantPage, CATEGORIES } from "@/lib/menu";
import { EmptyState } from "@/components/states";
import { ScoreBadge } from "@/components/score-badge";

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
  const groups = CATEGORIES.map((c) => ({ ...c, dishes: menu.filter((d) => d.category === c.key) })).filter(
    (g) => g.dishes.length > 0,
  );

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

      <div className="mt-8 mb-1 flex items-baseline justify-between border-b border-espresso pb-2">
        <h2 className="font-serif text-[26px]">The menu</h2>
      </div>

      {groups.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No dishes yet">
            Be the first to add what&apos;s on the menu here. Dish names are shared with everyone; your
            ratings stay private.
          </EmptyState>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            <div className="text-terracotta mt-6 mb-1 font-serif text-lg italic">{g.label}</div>
            <ul>
              {g.dishes.map((d) => (
                <li key={d.id} className="border-line grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-dashed py-4">
                  <div className="min-w-0">
                    <h3 className="text-[17px] font-semibold">{d.name}</h3>
                    {d.description && <p className="text-muted text-sm">{d.description}</p>}
                  </div>
                  {d.myRating && <ScoreBadge score={d.myRating.score} />}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
