"use client"

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DataTablePaginationProps } from "../types"

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export function DataTablePagination({
  pageIndex,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: DataTablePaginationProps) {
  const startItem = totalItems === 0 ? 0 : pageIndex * pageSize + 1
  const endItem = Math.min((pageIndex + 1) * pageSize, totalItems)
  const canGoPrevious = pageIndex > 0
  const canGoNext = pageIndex < totalPages - 1

  return (
    <div className="flex flex-col-reverse items-stretch justify-between gap-3 px-2 py-3 sm:flex-row sm:items-center">
      <div className="text-sm text-muted-foreground">
        {totalItems > 0 ? (
          <>
            Mostrando <span className="font-medium">{startItem}</span>–
            <span className="font-medium">{endItem}</span> de{" "}
            <span className="font-medium">{totalItems}</span>
          </>
        ) : (
          "Sin resultados"
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Filas</p>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm font-medium tabular-nums">
          Página {pageIndex + 1} de {totalPages || 1}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(0)}
            disabled={!canGoPrevious}
          >
            <ChevronsLeft />
            <span className="sr-only">Primera página</span>
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={!canGoPrevious}
          >
            <ChevronLeft />
            <span className="sr-only">Página anterior</span>
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={!canGoNext}
          >
            <ChevronRight />
            <span className="sr-only">Página siguiente</span>
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={!canGoNext}
          >
            <ChevronsRight />
            <span className="sr-only">Última página</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
