"use client"

import type { ActionConfig, FilterConfig } from "../types"
import { DataTableSearch } from "./data-table-search"
import { DataTableFilters } from "./data-table-filter"
import { DataTableActions } from "./data-table-actions"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface DataTableToolbarProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: FilterConfig[]
  filterValues?: Record<string, string | string[]>
  onFilterChange?: (id: string, value: string | string[] | null) => void
  onResetFilters?: () => void
  primaryAction?: ActionConfig
  secondaryActions?: ActionConfig[]
}

/**
 * Toolbar layout: [search] [filters] [reset?] · spacer · [secondary] [primary]
 */
export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters = [],
  filterValues = {},
  onFilterChange,
  onResetFilters,
  primaryAction,
  secondaryActions = [],
}: DataTableToolbarProps) {
  const hasSearch = !!onSearchChange
  const hasFilters = filters.length > 0
  const hasActions = primaryAction || secondaryActions.length > 0
  const hasActiveFilters =
    !!searchValue || Object.keys(filterValues).length > 0

  if (!hasSearch && !hasFilters && !hasActions) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {hasSearch && (
          <DataTableSearch
            value={searchValue ?? ""}
            onChange={onSearchChange!}
            placeholder={searchPlaceholder}
          />
        )}
        {hasFilters && (
          <DataTableFilters
            filters={filters}
            values={filterValues}
            onChange={onFilterChange!}
          />
        )}
        {hasActiveFilters && onResetFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-9 gap-1.5 text-muted-foreground"
          >
            Limpiar
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {hasActions && (
        <DataTableActions
          primaryAction={primaryAction}
          secondaryActions={secondaryActions}
        />
      )}
    </div>
  )
}
