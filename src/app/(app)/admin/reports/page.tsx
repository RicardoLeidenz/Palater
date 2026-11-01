import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REPORT_REASONS } from "@/lib/moderation-shared";
import { EmptyState } from "@/components/states";
import { HiddenDishRow, ReportCard, type ReportGroup } from "./report-card";

export const metadata = { title: "Reports · Palater" };

type Row = {
  id: string;
  reason: string;
  details: string | null;
  created_at: string;
  dish: { id: string; name: string; hidden: boolean; restaurant: { id: string; name: string; city: string | null } } | null;
};

export default async function ReportsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [{ data: reports, error }, { data: hidden, error: hiddenError }] = await Promise.all([
    supabase
      .from("dish_reports")
      .select("id, reason, details, created_at, dish:dishes(id, name, hidden, restaurant:restaurants(id, name, city))")
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    supabase
      .from("dishes")
      .select("id, name, restaurant:restaurants(id, name)")
      .eq("hidden", true)
      .order("name")
      .limit(50),
  ]);
  if (error) throw error;
  if (hiddenError) throw hiddenError;

  const label = new Map<string, string>(REPORT_REASONS.map((r) => [r.key, r.label]));
  const groups = new Map<string, ReportGroup>();
  for (const r of reports as unknown as Row[]) {
    if (!r.dish) continue;
    const g = groups.get(r.dish.id) ?? {
      dishId: r.dish.id,
      dishName: r.dish.name,
      hidden: r.dish.hidden,
      restaurantId: r.dish.restaurant.id,
      restaurantName: [r.dish.restaurant.name, r.dish.restaurant.city].filter(Boolean).join(", "),
      firstReported: r.created_at,
      reasons: [],
      details: [],
      count: 0,
    };
    g.count++;
    const reason = label.get(r.reason) ?? r.reason;
    const existing = g.reasons.find((x) => x.label === reason);
    if (existing) existing.count++;
    else g.reasons.push({ label: reason, count: 1 });
    if (r.details) g.details.push(r.details);
    groups.set(r.dish.id, g);
  }
  // Most-reported first.
  const queue = [...groups.values()].sort((a, b) => b.count - a.count || a.firstReported.localeCompare(b.firstReported));

  return (
    <section className="max-w-2xl">
      <div className="eyebrow">Admin</div>
      <h1 className="display mt-1.5 mb-2">Reported dishes</h1>
      <p className="text-muted mb-6 text-sm">
        Reports only cover shared dish names. Nobody, including admins, can see anyone&apos;s ratings, comments or
        photos.
      </p>

      {queue.length === 0 ? (
        <EmptyState title="All clear">No open reports right now.</EmptyState>
      ) : (
        <ul aria-label="Open reports" className="flex flex-col gap-4">
          {queue.map((g) => (
            <ReportCard key={g.dishId} group={g} />
          ))}
        </ul>
      )}

      <h2 className="text-terracotta mt-10 mb-1 font-serif text-lg italic">Hidden from menus</h2>
      {hidden.length === 0 ? (
        <p className="text-muted text-sm">No hidden dishes.</p>
      ) : (
        <ul aria-label="Hidden dishes">
          {(hidden as unknown as { id: string; name: string; restaurant: { id: string; name: string } }[]).map((d) => (
            <HiddenDishRow key={d.id} dishId={d.id} name={d.name} restaurantName={d.restaurant.name} />
          ))}
        </ul>
      )}

      <p className="mt-10 text-sm">
        <Link href="/profile" className="text-terracotta">
          ← Back to profile
        </Link>
      </p>
    </section>
  );
}
