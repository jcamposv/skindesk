import { Skeleton } from "@/components/ui/skeleton";

/**
 * Tab-scoped loading state for cliente detail. Used as the `<Suspense>`
 * fallback while each per-tab server component fetches its data.
 *
 * Per `react-best-practices` (`async-suspense-boundaries`): streaming each
 * tab independently lets the page shell + active tab render fast, while
 * heavier tabs (servicios with photo signing, pagos with plan summaries)
 * resolve in the background.
 */
export function TabSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <div className="grid gap-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="grid gap-3">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
              key={i}
              className={i % 2 === 0 ? "h-4 w-3/4" : "h-4 w-2/3"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
