import Link from "next/link";
import { getWantList } from "@/lib/lists";
import { EmptyState } from "@/components/states";
import { WantList } from "./want-list";

export default async function WantToTryPage() {
  const items = await getWantList();
  const toTry = items.filter((i) => i.status === "want");
  const tried = items.filter((i) => i.status === "visited");

  return (
    <section className="max-w-2xl">
      <div className="eyebrow">Saved for later</div>
      <h1 className="display mt-1.5 mb-6">Want to try</h1>

      {items.length === 0 ? (
        <EmptyState
          title="Your list is empty"
          action={
            <Link href="/" className="btn btn-primary">
              Explore restaurants
            </Link>
          }
        >
          Tap “Add to want to try” on a restaurant, or the bookmark next to a dish, and it will wait for you here.
        </EmptyState>
      ) : (
        <>
          {toTry.length > 0 ? (
            <WantList items={toTry} label="To try" />
          ) : (
            <EmptyState title="All tried!">Everything on your list has been moved to visited.</EmptyState>
          )}
          {tried.length > 0 && (
            <div className="mt-10">
              <h2 className="text-terracotta mb-1 font-serif text-lg italic">Tried from your list</h2>
              <WantList items={tried} label="Tried from your list" />
            </div>
          )}
        </>
      )}
    </section>
  );
}
