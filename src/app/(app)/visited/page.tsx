import Link from "next/link";
import { getVisited } from "@/lib/lists";
import { ScoreBadge } from "@/components/score-badge";
import { EmptyState } from "@/components/states";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function VisitedPage() {
  const visited = await getVisited();

  return (
    <section className="max-w-2xl">
      <div className="eyebrow">Your history</div>
      <h1 className="display mt-1.5 mb-6">Visited</h1>

      {visited.length === 0 ? (
        <EmptyState
          title="Nowhere yet"
          action={
            <Link href="/" className="btn btn-primary">
              Find a restaurant
            </Link>
          }
        >
          Restaurants show up here once you&apos;ve rated a dish there.
        </EmptyState>
      ) : (
        <ul aria-label="Restaurants you've visited">
          {visited.map((r) => (
            <li key={r.id} className="border-line border-b border-dashed">
              <Link href={`/r/${r.id}`} className="flex items-center gap-4 py-4 no-underline">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[17px] font-semibold">{r.name}</h2>
                  <p className="text-muted truncate text-sm">
                    {[r.cuisine, r.city].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-muted mt-0.5 text-xs">
                    {r.dishesRated} {r.dishesRated === 1 ? "dish" : "dishes"} rated · avg {r.avgScore.toFixed(1)} ·{" "}
                    {r.visitDays} {r.visitDays === 1 ? "visit" : "visits"} · last {fmtDate(r.lastVisit)}
                  </p>
                </div>
                <ScoreBadge score={r.bestScore} label="Best" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
