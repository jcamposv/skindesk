import {
  SkeletonCardGrid,
  SkeletonToolbar,
} from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AtlasSectionLoading() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-4 w-16" />
      <header className="flex items-center gap-3" aria-hidden="true">
        <Skeleton className="size-12 rounded-xl" />
        <div className="grid gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
      </header>
      <SkeletonToolbar />
      <div aria-hidden="true" className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <SkeletonCardGrid count={9} variant="compact" />
    </div>
  );
}
