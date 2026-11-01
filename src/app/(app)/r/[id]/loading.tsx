import { Skeleton } from "@/components/states";

/** Mirrors the restaurant page: hero, actions, then menu rows. */
export default function Loading() {
  return (
    <div className="grid gap-8 min-[860px]:grid-cols-[minmax(0,1fr)_300px]" aria-busy="true" aria-label="Loading restaurant">
      <section>
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="mb-3 h-12 w-3/4" />
        <Skeleton className="mb-6 h-4 w-1/2" />
        <div className="mb-8 flex gap-2.5">
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-44 rounded-full" />
        </div>
        <Skeleton className="mb-6 h-8 w-40" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="border-line flex items-center gap-4 border-b border-dashed py-4">
            <div className="flex-1">
              <Skeleton className="mb-2 h-4 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-12 w-[52px] rounded-[10px]" />
          </div>
        ))}
      </section>
      <div className="flex flex-col gap-5">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}
