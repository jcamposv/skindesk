"use client"

import { flexRender } from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useDataTable } from "../hooks/use-data-table"
import { DataTableToolbar } from "./data-table-toolbar"
import { DataTablePagination } from "./data-table-pagination"
import { DataTableEmpty, DataTableLoading } from "./data-table-states"
import { DataTableRowActions } from "./data-table-actions"
import type { DataTableProps } from "../types"

/**
 * Generic, server-pagination-first DataTable.
 *
 * **Default to `mode="server"`** for any list backed by an API. The component
 * syncs page/pageSize/search/sortBy/sortDir/filter_* into the URL, so the
 * Server Component reading `searchParams` re-renders with fresh data on every
 * change. Pages and bookmarks are stable.
 *
 * Client mode is only for tiny static datasets (≤200 rows).
 */
export function DataTable<TData>({
  columns,
  data,
  mode = "server",
  totalItems,
  defaultPageSize = 20,
  pageSizeOptions,
  onQueryChange,
  searchable = false,
  searchPlaceholder = "Buscar…",
  searchColumns,
  filters = [],
  defaultSort,
  primaryAction,
  secondaryActions = [],
  rowActions,
  loading = false,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  toolbar,
  showPagination = true,
  stickyHeader = false,
  className,
  striped = false,
  onRowClick,
  getRowId,
}: DataTableProps<TData>) {
  const {
    table,
    query,
    pagination,
    isPending,
    setPage,
    setPageSize,
    setSearch,
    setFilter,
    resetFilters,
  } = useDataTable({
    data,
    columns,
    mode,
    totalItems,
    defaultPageSize,
    defaultSort,
    searchColumns,
    onQueryChange,
  })

  const filterValues: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(query.filters)) {
    filterValues[key] = value
  }

  const hasActiveFilters =
    query.search !== "" || Object.keys(query.filters).length > 0

  const renderToolbar = () => {
    if (toolbar === false) return null
    if (toolbar) return toolbar
    return (
      <DataTableToolbar
        searchValue={query.search}
        onSearchChange={searchable ? setSearch : undefined}
        searchPlaceholder={searchPlaceholder}
        filters={filters}
        filterValues={filterValues}
        onFilterChange={setFilter}
        onResetFilters={resetFilters}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />
    )
  }

  const rows = table.getRowModel().rows
  const hasRows = rows.length > 0
  // Total visible columns including the auto-injected actions column.
  const totalCols = columns.length + (rowActions?.length ? 1 : 0)

  return (
    <div className={cn("space-y-3", className)}>
      {renderToolbar()}

      <div
        className={cn(
          "rounded-lg border bg-card transition-opacity",
          isPending && "opacity-60",
        )}
        aria-busy={isPending || loading}
      >
        <Table>
          <TableHeader
            className={cn(stickyHeader && "sticky top-0 z-10 bg-card")}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
                {rowActions?.length ? (
                  <TableHead className="w-12 text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                ) : null}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={totalCols} className="p-0">
                  <DataTableLoading rows={5} columns={totalCols} />
                </TableCell>
              </TableRow>
            ) : hasRows ? (
              rows.map((row, index) => (
                <TableRow
                  key={getRowId ? getRowId(row.original) : row.id}
                  className={cn(
                    onRowClick && "cursor-pointer hover:bg-muted/40",
                    striped && index % 2 === 1 && "bg-muted/20",
                  )}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                  {rowActions?.length ? (
                    <TableCell className="text-right">
                      <DataTableRowActions
                        row={row.original}
                        actions={rowActions}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={totalCols} className="h-48">
                  <DataTableEmpty
                    title={emptyTitle}
                    description={emptyDescription}
                    icon={emptyIcon}
                    action={
                      hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="text-sm text-primary hover:underline"
                        >
                          Limpiar filtros
                        </button>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <DataTablePagination
          pageIndex={pagination.page - 1}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          totalPages={pagination.totalPages}
          pageSizeOptions={pageSizeOptions}
          onPageChange={(page) => setPage(page + 1)}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  )
}
