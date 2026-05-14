"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * URL-driven sortable header.
 *
 * The DataTable's `useDataTable` hook exposes a `setSorting` callback but
 * doesn't wire it to TanStack's `onSortingChange` in server mode, so
 * `column.toggleSorting()` from `DataTableColumnHeader` is a no-op. Until
 * that's fixed at the DataTable layer, sort writes go straight to the URL
 * from here. Three states cycle on click: unset → asc → desc → unset.
 */
export function SortableHeader({
  sortKey,
  label,
  align = "start",
}: {
  sortKey: string;
  label: string;
  align?: "start" | "end";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeKey = searchParams.get("sortBy");
  const activeDir = searchParams.get("sortDir");
  const isActive = activeKey === sortKey;
  const direction: "asc" | "desc" | null = isActive
    ? (activeDir as "asc" | "desc" | null) ?? null
    : null;

  function handleClick() {
    const next: { key: string | null; dir: "asc" | "desc" | null } = (() => {
      if (!isActive) return { key: sortKey, dir: "desc" };
      if (direction === "desc") return { key: sortKey, dir: "asc" };
      return { key: null, dir: null };
    })();

    const params = new URLSearchParams(searchParams.toString());
    if (next.key && next.dir) {
      params.set("sortBy", next.key);
      params.set("sortDir", next.dir);
    } else {
      params.delete("sortBy");
      params.delete("sortDir");
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  const Icon =
    direction === "asc"
      ? ArrowUpIcon
      : direction === "desc"
        ? ArrowDownIcon
        : ChevronsUpDownIcon;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        direction === "asc"
          ? `Ordenado por ${label} ascendente`
          : direction === "desc"
            ? `Ordenado por ${label} descendente`
            : `Ordenar por ${label}`
      }
      className={cn(
        "group inline-flex items-center gap-1 text-sm font-medium text-foreground transition-colors hover:text-foreground/70",
        align === "end" && "justify-end",
        isPending && "opacity-70",
      )}
    >
      {label}
      <Icon
        className={cn(
          "size-3.5 transition-opacity",
          isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70",
        )}
      />
    </button>
  );
}
