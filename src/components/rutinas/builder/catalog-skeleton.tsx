import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for the routine builder catalog column while
 * `listProductosForBuilder` (200 productos + bulk `createSignedUrls`)
 * streams in via `<Suspense>`. Matches the catalog's visual rhythm so
 * the swap-in is calm.
 */
export function CatalogSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex h-full flex-col gap-3 p-4"
    >
      <div className="grid gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 rounded-lg border bg-card p-2.5"
          >
            <Skeleton className="size-11 rounded-md" />
            <div className="flex-1 grid gap-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="mt-1 flex gap-1">
                <Skeleton className="h-4 w-12 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
            </div>
            <Skeleton className="size-7 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
