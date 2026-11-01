import Link from "next/link";
import { getStats, getWantList } from "@/lib/lists";

/** "Your palate" + "Want to try" cards from the reference sidebar. */
export async function Sidebar() {
  const [stats, wants] = await Promise.all([getStats(), getWantList()]);
  const toTry = wants.filter((w) => w.status === "want").slice(0, 4);

  return (
    <aside className="flex flex-col gap-5" aria-label="Your palate">
      <div className="card">
        <h2 className="mb-3 font-serif text-xl">Your palate</h2>
        <Stat label="Restaurants visited" value={stats.restaurantsVisited} />
        <Stat label="Dishes rated" value={stats.dishesRated} />
        <Stat label="Average score" value={stats.avgScore ?? "–"} />
      </div>
      <div className="card">
        <h2 className="mb-2 font-serif text-xl">Want to try</h2>
        {toTry.length === 0 ? (
          <p className="text-muted text-sm">Save restaurants or dishes and they&apos;ll show up here.</p>
        ) : (
          <ul>
            {toTry.map((w) => (
              <li key={w.id} className="border-sand-2 border-b last:border-0">
                <Link href={`/r/${w.restaurantId}`} className="flex items-center gap-3 py-2.5 no-underline">
                  <span className="bg-sage size-2.5 shrink-0 rounded-full" aria-hidden="true" />
                  <span className="min-w-0 text-sm">
                    <span className="block truncate">{w.dishName ? `${w.dishName} at ${w.restaurantName}` : w.restaurantName}</span>
                    <small className="text-muted block truncate text-xs">
                      {w.kind === "dish" ? "Dish" : "Restaurant"}
                      {w.subtitle ? ` · ${w.subtitle}` : ""}
                    </small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/want-to-try" className="text-terracotta mt-2 inline-block text-sm">
          See your list →
        </Link>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-sand-2 flex items-baseline justify-between border-b py-1.5 text-sm last:border-0">
      <span>{label}</span>
      <b className="text-plum font-serif text-lg">{value}</b>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <div className="skeleton h-40 rounded-2xl" />
      <div className="skeleton h-48 rounded-2xl" />
    </div>
  );
}
