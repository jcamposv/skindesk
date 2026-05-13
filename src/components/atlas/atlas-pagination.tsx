"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DataTablePagination } from "@/components/data-table";

interface AtlasPaginationProps {
  /** 1-based page resolved from `searchParams`. */
  page: number;
  pageSize: number;
  totalItems: number;
  /** Default pageSize value that should drop from the URL when selected
   *  (keeps the canonical URL clean). */
  defaultPageSize?: number;
  /** Pre-selectable page sizes shown in the toolbar. */
  pageSizeOptions?: readonly number[];
}

/**
 * URL-synced pagination for Atlas list surfaces (`/atlas/[section]` and
 * `/super-admin/atlas`). Same pattern as `ProductosPagination` — the
 * Server Component reads `page` / `pageSize` from `searchParams`, this
 * component writes the URL back, Next re-renders.
 *
 * Other query params (`search`, `section`, `status`, `tag`) ride along
 * untouched because we copy the full `searchParams` before patching.
 */
export function AtlasPagination({
  page,
  pageSize,
  totalItems,
  defaultPageSize = 24,
  pageSizeOptions = [12, 24, 48, 96],
}: AtlasPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  function update(patch: { page?: number; pageSize?: number }) {
    const next = new URLSearchParams(searchParams.toString());

    if (patch.pageSize !== undefined) {
      if (patch.pageSize === defaultPageSize) next.delete("pageSize");
      else next.set("pageSize", String(patch.pageSize));
      // Reset page index whenever pageSize changes — otherwise the user
      // can land on an out-of-range slice.
      next.delete("page");
    }

    if (patch.page !== undefined) {
      if (patch.page <= 1) next.delete("page");
      else next.set("page", String(patch.page));
    }

    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `?${qs}` : "?", { scroll: false });
    });
  }

  return (
    <DataTablePagination
      pageIndex={page - 1}
      pageSize={pageSize}
      totalItems={totalItems}
      totalPages={totalPages}
      onPageChange={(idx) => update({ page: idx + 1 })}
      onPageSizeChange={(size) => update({ pageSize: size })}
      pageSizeOptions={[...pageSizeOptions]}
    />
  );
}
