import { SkeletonBuilder } from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditarRutinaLoading() {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4">
      <div
        aria-hidden="true"
        className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="grid gap-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-64" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <SkeletonBuilder />
    </div>
  );
}
