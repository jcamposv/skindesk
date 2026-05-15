import { SkeletonContentCard } from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function PagoDetailLoading() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-4 w-32" />
      <header
        aria-hidden="true"
        className="grid gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center"
      >
        <div className="grid gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid justify-items-end gap-2">
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </header>
      <SkeletonContentCard rows={4} withAside />
      <SkeletonContentCard rows={3} />
    </div>
  );
}
