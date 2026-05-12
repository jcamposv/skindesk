"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRangeIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Page-level date-range filter. Writes `dateFrom` / `dateTo` to the URL
 * (independent of the DataTable's `filter_*` namespace because PR-level
 * date pickers aren't part of the DataTable's select-only filter config).
 *
 * Changing either bound resets `page` to 1 so the user lands on results,
 * not an empty far page.
 */
export function PagosDateRange({
  initialFrom,
  initialTo,
}: {
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setRange(next: { from?: string; to?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.from !== undefined) {
      if (next.from === "") params.delete("dateFrom");
      else params.set("dateFrom", next.from);
    }
    if (next.to !== undefined) {
      if (next.to === "") params.delete("dateTo");
      else params.set("dateTo", next.to);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  const hasRange = initialFrom || initialTo;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[12.5px] transition-opacity",
        isPending && "opacity-60",
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <CalendarRangeIcon className="size-4" />
        Rango de fechas
      </span>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          aria-label="Desde"
          value={initialFrom}
          max={initialTo || undefined}
          onChange={(e) => setRange({ from: e.target.value })}
          className="h-8 w-[140px] text-[12.5px]"
        />
        <span className="text-muted-foreground">→</span>
        <Input
          type="date"
          aria-label="Hasta"
          value={initialTo}
          min={initialFrom || undefined}
          onChange={(e) => setRange({ to: e.target.value })}
          className="h-8 w-[140px] text-[12.5px]"
        />
      </div>
      {hasRange ? (
        <button
          type="button"
          onClick={() => setRange({ from: "", to: "" })}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-3.5" />
          Limpiar
        </button>
      ) : null}
    </div>
  );
}
