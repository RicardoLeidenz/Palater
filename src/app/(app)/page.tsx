import { EmptyState } from "@/components/states";
import { getCurrentUser } from "@/lib/auth";

export default async function ExplorePage() {
  const user = await getCurrentUser();
  return (
    <section>
      <div className="eyebrow">Explore</div>
      <h1 className="display mt-1.5 mb-6">
        Hungry, <em className="text-plum">{user.name.split(" ")[0]}</em>?
      </h1>
      <EmptyState title="No restaurants yet">
        Search for a restaurant above to find it and start rating its dishes.
      </EmptyState>
    </section>
  );
}
