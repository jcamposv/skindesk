import { SkeletonContentCard } from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function SharedRutinaLoading() {
  return (
    <div className="grid gap-5">
      <header
        aria-hidden="true"
        className="grid gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:flex sm:items-center sm:justify-between"
      >
        <div className="grid gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-40 rounded-md" />
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3">
          <SkeletonContentCard rows={4} />
          <SkeletonContentCard rows={3} />
          <SkeletonContentCard rows={5} />
        </div>
        <Skeleton className="h-[560px] w-full rounded-3xl" />
      </div>
    </div>
  );
}
