import { EmptyState } from "@/components/states";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  return (
    <section>
      <div className="eyebrow">Search</div>
      <h1 className="display mt-1.5 mb-6">{typeof q === "string" && q ? q : "Find a restaurant"}</h1>
      <EmptyState title="Search is coming in phase 3">
        Restaurant search with OpenStreetMap lands in the next phases.
      </EmptyState>
    </section>
  );
}
