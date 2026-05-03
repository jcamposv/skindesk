import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DashboardSectionProps {
  title: string;
  /**
   * Right-aligned slot in the header — typically a "Ver todas →" link or a
   * period selector. Accepts any ReactNode so each consumer ships its own
   * affordance without us baking it in.
   */
  action?: ReactNode;
  className?: string;
  /** Body content. Charts, lists, anything. */
  children: ReactNode;
}

/**
 * Reusable card wrapper for every dashboard widget — title left, optional
 * action right, body below. Server Component on purpose: pure layout.
 *
 * Why props instead of compound components: title and action are atomic
 * data slots, not heterogeneous structures. The compound pattern is reserved
 * for genuinely complex parents (Dialog, DropdownMenu) where slot order /
 * orchestration matters. For a section card, this API is enough flexibility
 * with less ceremony.
 */
export function DashboardSection({
  title,
  action,
  className,
  children,
}: DashboardSectionProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {action ? (
          <div className="flex shrink-0 items-center text-sm">{action}</div>
        ) : null}
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}
