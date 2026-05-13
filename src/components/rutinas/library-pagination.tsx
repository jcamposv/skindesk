"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DataTablePagination } from "@/components/data-table";

interface LibraryPaginationProps {
  /** 1-based page from the server's URL parsing. */
  page: number;
  pageSize: number;
  totalItems: number;
}

/**
 * URL-synced wrapper around the shared `DataTablePagination` control. The
 * Server Component reads `page` / `pageSize` from `searchParams`; this
 * component updates the URL, Next re-renders the page, and the server
 * fetches the next slice. Mirrors `ProductosPagination` so both list
 * surfaces share the exact same query-string conventions.
 */
export function LibraryPagination({
  page,
  pageSize,
  totalItems,
}: LibraryPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  function update(patch: { page?: number; pageSize?: number }) {
    const next = new URLSearchParams(searchParams.toString());

    if (patch.pageSize !== undefined) {
      if (patch.pageSize === 24) next.delete("pageSize");
      else next.set("pageSize", String(patch.pageSize));
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
      pageSizeOptions={[12, 24, 48, 96]}
    />
  );
}
