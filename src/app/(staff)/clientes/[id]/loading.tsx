import {
  SkeletonDetailHeader,
  SkeletonTabs,
} from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClienteDetailLoading() {
  return (
    <div className="grid min-w-0 gap-4">
      <SkeletonDetailHeader />
      <div
        aria-hidden="true"
        className="rounded-2xl border bg-card p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <SkeletonTabs />
    </div>
  );
}
