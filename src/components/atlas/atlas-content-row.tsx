import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AtlasContentRowProps {
  /** Section label rendered above the strip. */
  title: ReactNode;
  /** Optional trailing action (e.g. "Ver todos →"). */
  action?: ReactNode;
  /** Each child renders as one card in the strip. The component handles
   *  the horizontal scroll + snap behaviour. */
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal scrollable strip — same pattern as Spotify / Netflix /
 * App Store. Replaces the rigid 3-column grid for the
 * Favoritos / Recientes / Publicado rows.
 *
 * Why a scroll strip is better here than a grid:
 *   - Looks intentional with 1, 3, or 30 entries (no orphan cells)
 *   - Each card stays its natural width — no stretching to fill space
 *   - Mobile-first: the scroll affordance translates 1:1 from desktop
 *
 * Card width is set by the consumer (each child is `shrink-0` with a
 * fixed width). `snap-start` per child + `snap-x snap-mandatory` on the
 * track give the user precise scrolling.
 */
export function AtlasContentRow({
  title,
  action,
  children,
  className,
}: AtlasContentRowProps) {
  return (
    <section className={cn("grid gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {title}
        </h2>
        {action ? <div className="text-xs">{action}</div> : null}
      </div>

      {/* Negative-margin trick: the scrollable strip extends to the
          viewport edges on mobile so cards don't get clipped at the
          first/last edge. The inner `px-4` keeps the visible content
          aligned to the page gutter. */}
      <div className="-mx-4 overflow-x-auto pb-2 sm:mx-0">
        <ul className="atlas-content-row flex w-max snap-x snap-mandatory gap-4 px-4 sm:px-0">
          {/* The children pass-through preserves keys + lets the parent
              decide the card type (entry card today; could be other kinds
              tomorrow). */}
          {children}
        </ul>
      </div>
    </section>
  );
}

interface AtlasContentRowItemProps {
  children: ReactNode;
}

/** Card-width slot inside `<AtlasContentRow>`. ~300px target — wide
 *  enough for a cover + title + description, narrow enough that 3-4
 *  cards are visible on desktop. */
export function AtlasContentRowItem({ children }: AtlasContentRowItemProps) {
  return (
    <li className="w-[280px] shrink-0 snap-start sm:w-[320px]">{children}</li>
  );
}
