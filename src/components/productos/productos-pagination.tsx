"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DataTablePagination } from "@/components/data-table";

interface ProductosPaginationProps {
  /** 1-based page from the server's URL parsing. */
  page: number;
  pageSize: number;
  totalItems: number;
}

/**
 * URL-synced wrapper around the shared `DataTablePagination` control. The
 * Server Component reads `page` / `pageSize` from `searchParams`; this
 * component updates the URL, Next re-renders the page, and the server
 * fetches the next slice.
 *
 * Same pattern (and same query-string keys) used by the Clientes table —
 * just bolted onto a card grid instead of a real table.
 */
export function ProductosPagination({
  page,
  pageSize,
  totalItems,
}: ProductosPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  function update(patch: { page?: number; pageSize?: number }) {
    const next = new URLSearchParams(searchParams.toString());

    if (patch.pageSize !== undefined) {
      // pageSize=24 is the page's default — keep the URL clean by omitting
      // it. Also reset to page 1 so changing page size doesn't land us on
      // an out-of-range slice.
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
      // DataTablePagination uses 0-based `pageIndex`; convert to 1-based
      // for the URL.
      onPageChange={(idx) => update({ page: idx + 1 })}
      onPageSizeChange={(size) => update({ pageSize: size })}
      pageSizeOptions={[12, 24, 48, 96]}
    />
  );
}
