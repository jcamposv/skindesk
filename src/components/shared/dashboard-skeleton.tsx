import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Composable skeleton primitives shared by every `loading.tsx` under
 * `(staff)/`. Each piece mirrors the visual rhythm of a real page so the
 * shell-to-content swap is calm (no layout shift, no jarring jump). Use
 * these directly from `loading.tsx` files — keep each `loading.tsx` to a
 * thin composition.
 *
 * Why: with `force-dynamic` pages and no streaming, Next blocks the route
 * transition until the RSC resolves. A `loading.tsx` sibling turns that
 * blocked second into an immediate shell, which is the single largest
 * perceived-perf win in the dashboard (see audit Phase 1).
 */

interface SkeletonHeroProps {
  /** Reserve space for a primary CTA on the right. */
  withButton?: boolean;
  /** Skips the badge chip above the title — set for pages without one. */
  noBadge?: boolean;
}

/** Page header: badge chip, title, subtitle, optional CTA on the right. */
export function SkeletonHero({ withButton, noBadge }: SkeletonHeroProps) {
  return (
    <header
      className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      aria-hidden="true"
    >
      <div className="grid gap-3">
        {noBadge ? null : <Skeleton className="h-5 w-32 rounded-full" />}
        <Skeleton className="h-8 w-48 sm:h-9 sm:w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      {withButton ? <Skeleton className="h-10 w-36 rounded-md" /> : null}
    </header>
  );
}

interface SkeletonStatStripProps {
  count?: number;
  /** Highlight the first card the way `StatStrip` does. */
  highlightFirst?: boolean;
}

/** Stat strip — N cards in a row, matches `<StatStrip>` rhythm. */
export function SkeletonStatStrip({
  count = 4,
  highlightFirst,
}: SkeletonStatStripProps) {
  return (
    <section
      aria-hidden="true"
      className={cn(
        "grid grid-cols-2 gap-3",
        count === 5 ? "sm:grid-cols-5" : "sm:grid-cols-4",
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "grid gap-2 rounded-xl border bg-card p-3.5",
            highlightFirst && i === 0 && "border-[#5C6E6C]/15 bg-[#F4F1EC]",
          )}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="size-4 rounded-full" />
          </div>
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </section>
  );
}

/** Toolbar row — search + filter chips, used by list pages. */
export function SkeletonToolbar() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3"
    >
      <Skeleton className="h-9 w-56 rounded-md" />
      <Skeleton className="h-9 w-24 rounded-md" />
      <Skeleton className="h-9 w-24 rounded-md" />
      <Skeleton className="ml-auto h-9 w-32 rounded-md" />
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

/** Generic table skeleton — header row + N body rows. */
export function SkeletonTable({ rows = 6, columns = 5 }: SkeletonTableProps) {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="grid gap-3">
        <div
          className="grid gap-3 border-b pb-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-3 py-2"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn(
                  "h-4",
                  c === 0 ? "w-3/4" : c === columns - 1 ? "w-1/3" : "w-2/3",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface SkeletonCardGridProps {
  count?: number;
  /** Card aspect — "compact" for routine cards, "tall" for product grid. */
  variant?: "compact" | "tall";
}

/** Card grid — for library/catalog routes. */
export function SkeletonCardGrid({
  count = 8,
  variant = "compact",
}: SkeletonCardGridProps) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm"
        >
          {variant === "tall" ? (
            <Skeleton className="aspect-[3/2] w-full rounded-xl" />
          ) : (
            <Skeleton className="h-8 w-20 rounded-md" />
          )}
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="mt-1 flex items-center gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Header card for the cliente detail page — avatar, name, chips, CTA. */
export function SkeletonDetailHeader() {
  return (
    <header
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between border-b bg-[#FBF6F0]/70 px-3 py-1.5 sm:px-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="size-7 rounded-md" />
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] lg:items-center lg:gap-5">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="grid gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="hidden gap-2 lg:flex">
          <Skeleton className="h-14 w-28 rounded-xl" />
          <Skeleton className="h-14 w-28 rounded-xl" />
          <Skeleton className="h-14 w-32 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md justify-self-end" />
      </div>
    </header>
  );
}

/** Tab strip + content panel placeholder. */
export function SkeletonTabs() {
  return (
    <div aria-hidden="true" className="grid gap-3">
      <div className="flex gap-2 border-b">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="grid gap-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-3 h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Calendar shell — month-grid placeholder. */
export function SkeletonCalendar() {
  return (
    <div
      aria-hidden="true"
      className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-1">
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-16 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-5 w-full" />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

interface SkeletonContentCardProps {
  /** Approximate rows of text content (titles + body lines). */
  rows?: number;
  /** Reserve a tall block (~aside image or summary widget) on the right. */
  withAside?: boolean;
}

/** Generic content card — title + body lines + optional aside. Use for
 *  settings sections, atlas detail blocks, etc. */
export function SkeletonContentCard({
  rows = 3,
  withAside,
}: SkeletonContentCardProps) {
  return (
    <div
      aria-hidden="true"
      className="grid gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:grid-cols-[1fr_auto]"
    >
      <div className="grid gap-3">
        <Skeleton className="h-5 w-1/3" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn("h-4", i % 2 === 0 ? "w-3/4" : "w-2/3")}
          />
        ))}
      </div>
      {withAside ? (
        <Skeleton className="hidden h-28 w-40 rounded-xl sm:block" />
      ) : null}
    </div>
  );
}

/** Chart container placeholder — title + a tall plot area. */
export function SkeletonChart({ height = 240 }: { height?: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid gap-3 rounded-2xl border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-7 w-24 rounded-md" />
      </div>
      <Skeleton className="w-full rounded-xl" style={{ height }} />
    </div>
  );
}

/** Form field stack — labels + inputs, for settings/admin forms. */
export function SkeletonForm({ fields = 5 }: { fields?: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid gap-4 rounded-2xl border bg-card p-5 shadow-sm"
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Skeleton className="h-10 w-24 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  );
}

/** Builder shell — 3 columns (catalog, steps, preview) on lg+. */
export function SkeletonBuilder() {
  return (
    <div
      aria-hidden="true"
      className="grid min-h-[60vh] gap-4 lg:grid-cols-[280px_1fr_300px]"
    >
      {/* Catalog column */}
      <div className="hidden flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm lg:flex">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-full rounded-md" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg p-2">
            <Skeleton className="size-10 rounded-md" />
            <div className="flex-1 grid gap-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="size-7 rounded-full" />
          </div>
        ))}
      </div>

      {/* Steps column */}
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        </div>
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-xl border bg-card p-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-md" />
              <div className="flex-1 grid gap-1.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="size-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Preview column */}
      <div className="hidden lg:block">
        <Skeleton className="h-[560px] w-full rounded-3xl" />
      </div>
    </div>
  );
}
