import { SkeletonContentCard } from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AtlasEntryLoading() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-4 w-32" />
      <header
        aria-hidden="true"
        className="grid gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:flex sm:items-center sm:justify-between"
      >
        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-10 rounded-xl" />
            <div className="grid gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-72" />
            </div>
          </div>
          <Skeleton className="h-4 w-80 max-w-full" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16 rounded-full" />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </header>
      <SkeletonContentCard rows={5} />
      <SkeletonContentCard rows={3} withAside />
      <SkeletonContentCard rows={4} />
    </div>
  );
}
