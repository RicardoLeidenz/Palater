import { EmptyState } from "@/components/states";

export default function VisitedPage() {
  return (
    <section>
      <h1 className="display mb-6">Visited</h1>
      <EmptyState title="Nowhere yet">
        Restaurants appear here once you&apos;ve rated a dish there.
      </EmptyState>
    </section>
  );
}
