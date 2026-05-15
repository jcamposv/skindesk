import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatStripItem {
  /** UPPERCASE eyebrow label e.g. "Productos en catálogo". */
  label: string;
  /** The number / metric — rendered with tabular-nums. */
  value: number | string;
  /** Lucide icon component. Each strip can pass its own icon per slot. */
  icon: LucideIcon;
  /** Tailwind classes for the circular icon background — by convention
   *  one of the brand pastels (sage / honey / rose / copper / aquatone). */
  colorClass: string;
}

interface StatStripProps {
  /** Strip items, rendered in order. Mobile stacks 2-col, lg+ 4-col. */
  items: StatStripItem[];
  /** Accessible label for the strip region. */
  ariaLabel: string;
  className?: string;
}

/**
 * Compact stat strip used on every list page (productos, rutinas, …).
 * Extracted to keep the same density / scale / readability everywhere —
 * tweaking padding or font sizes here ripples through the app.
 *
 * Implementation notes (per `make-interfaces-feel-better`):
 *   · `Card size="sm"` + explicit `py-2 px-3` for tighter density.
 *   · 32px circle icon + 16px glyph → optical center matches the heading.
 *   · Label uses `text-foreground/75` to stay readable in clinical use.
 *   · `tabular-nums` on the value so the strip doesn't jitter on updates.
 */
export function StatStrip({ items, ariaLabel, className }: StatStripProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {items.map(({ label, value, icon: Icon, colorClass }) => (
        <Card
          key={label}
          size="sm"
          className="flex flex-row items-center gap-2.5 px-3 py-2"
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              colorClass,
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/75">
              {label}
            </p>
            <p className="font-heading text-lg font-semibold tabular-nums text-foreground">
              {value}
            </p>
          </div>
        </Card>
      ))}
    </section>
  );
}
