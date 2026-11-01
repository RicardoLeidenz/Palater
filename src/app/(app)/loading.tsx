import { Skeleton } from "@/components/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-3 h-3 w-28" />
      <Skeleton className="mb-6 h-12 w-2/3" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="mb-3 h-16 w-full" />
      ))}
    </div>
  );
}
