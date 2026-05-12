"use client";

import { useSearchParams } from "next/navigation";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Anchor wrapped in a Button. The href is built from the current URL's
 * search params so the export always matches what the user sees on the
 * page — including filters, sort and date range. We pass `download` so
 * the browser saves the file instead of navigating.
 *
 * Strip pagination params (`page`, `pageSize`) — the export ignores them
 * and returns the full filtered set (capped at 5_000 rows server-side).
 */
export function PagosExportButton() {
  const searchParams = useSearchParams();
  const exportParams = new URLSearchParams(searchParams.toString());
  exportParams.delete("page");
  exportParams.delete("pageSize");
  const qs = exportParams.toString();
  const href = qs ? `/pagos/export.csv?${qs}` : "/pagos/export.csv";

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      render={<a href={href} download />}
    >
      <DownloadIcon className="size-3.5" />
      Exportar CSV
    </Button>
  );
}
