import {
  SkeletonCardGrid,
  SkeletonHero,
} from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AtlasLoading() {
  return (
    <div className="grid gap-7">
      <SkeletonHero />
      <section aria-hidden="true" className="grid gap-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </section>
      <SkeletonCardGrid count={6} variant="compact" />
    </div>
  );
}
