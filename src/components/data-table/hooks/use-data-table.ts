"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from "@tanstack/react-table"
import { useTableUrlState } from "./use-table-url-state"
import type {
  PaginationInfo,
  TableQuery,
  UseDataTableOptions,
} from "../types"
import type { Table } from "@tanstack/react-table"

interface UseDataTableReturn<TData> {
  table: Table<TData>
  query: TableQuery
  pagination: PaginationInfo
  /** True while a server-mode URL transition is pending. */
  isPending: boolean
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setSearch: (search: string) => void
  setSorting: (sorting: SortingState) => void
  setFilters: (filters: ColumnFiltersState) => void
  setFilter: (id: string, value: string | string[] | null) => void
  resetFilters: () => void
}

/**
 * DataTable behavioral hook — works in client or server pagination modes.
 *
 * Server mode: state lives in the URL via `useTableUrlState`. The page is a
 * Server Component that reads `searchParams`, so there's no `onQueryChange`
 * required for the basic case — Next.js re-renders on URL change.
 */
export function useDataTable<TData>(
  options: UseDataTableOptions<TData>,
): UseDataTableReturn<TData> {
  const {
    data,
    columns,
    mode = "client",
    totalItems,
    defaultPageSize = 12,
    defaultSort = [],
    searchColumns = [],
    onQueryChange,
  } = options

  const isServerMode = mode === "server"

  const {
    query: urlQuery,
    setQuery: setUrlQuery,
    isPending,
  } = useTableUrlState({
    enabled: isServerMode,
    defaultPageSize,
  })

  const [clientPagination, setClientPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  })
  const [clientSearch, setClientSearch] = useState("")
  const [clientSorting, setClientSorting] = useState<SortingState>(defaultSort)
  const [clientFilters, setClientFilters] = useState<ColumnFiltersState>([])

  const query = useMemo<TableQuery>(() => {
    if (isServerMode) return urlQuery

    return {
      page: clientPagination.pageIndex + 1,
      pageSize: clientPagination.pageSize,
      search: clientSearch,
      sortBy: clientSorting[0]?.id ?? null,
      sortDir: clientSorting[0]?.desc ? "desc" : clientSorting[0] ? "asc" : null,
      filters: clientFilters.reduce<Record<string, string | string[]>>(
        (acc, filter) => {
          acc[filter.id] = filter.value as string | string[]
          return acc
        },
        {},
      ),
    }
  }, [
    isServerMode,
    urlQuery,
    clientPagination,
    clientSearch,
    clientSorting,
    clientFilters,
  ])

  useEffect(() => {
    if (isServerMode && onQueryChange) onQueryChange(query)
  }, [isServerMode, query, onQueryChange])

  const globalFilter = useMemo(() => {
    if (isServerMode || !clientSearch) return undefined
    return clientSearch
  }, [isServerMode, clientSearch])

  const globalFilterFn = useCallback(
    (
      row: { getValue: (columnId: string) => unknown },
      _columnId: string,
      filterValue: string,
    ) => {
      if (!filterValue || searchColumns.length === 0) return true
      const search = filterValue.toLowerCase()
      return searchColumns.some((col) => {
        const value = row.getValue(col as string)
        if (value == null) return false
        return String(value).toLowerCase().includes(search)
      })
    },
    [searchColumns],
  )

  // TanStack Table returns memoized helpers internally and is not React
  // Compiler-friendly; the warning is expected.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(isServerMode
      ? {
          manualPagination: true,
          manualSorting: true,
          manualFiltering: true,
          pageCount: totalItems
            ? Math.max(1, Math.ceil(totalItems / query.pageSize))
            : -1,
          state: {
            pagination: {
              pageIndex: query.page - 1,
              pageSize: query.pageSize,
            },
            sorting: query.sortBy
              ? [{ id: query.sortBy, desc: query.sortDir === "desc" }]
              : [],
          },
        }
      : {
          getPaginationRowModel: getPaginationRowModel(),
          getSortedRowModel: getSortedRowModel(),
          getFilteredRowModel: getFilteredRowModel(),
          state: {
            pagination: clientPagination,
            sorting: clientSorting,
            columnFilters: clientFilters,
            globalFilter,
          },
          onPaginationChange: setClientPagination,
          onSortingChange: setClientSorting,
          onColumnFiltersChange: setClientFilters,
          globalFilterFn,
        }),
  })

  const pagination = useMemo<PaginationInfo>(() => {
    const total = isServerMode
      ? totalItems ?? 0
      : table.getFilteredRowModel().rows.length
    const pages = Math.max(1, Math.ceil(total / query.pageSize) || 1)
    return {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: total,
      totalPages: pages,
    }
  }, [isServerMode, totalItems, table, query.page, query.pageSize])

  const setPage = useCallback(
    (page: number) => {
      if (isServerMode) setUrlQuery({ page })
      else setClientPagination((prev) => ({ ...prev, pageIndex: page - 1 }))
    },
    [isServerMode, setUrlQuery],
  )

  const setPageSize = useCallback(
    (size: number) => {
      if (isServerMode) setUrlQuery({ pageSize: size, page: 1 })
      else setClientPagination({ pageIndex: 0, pageSize: size })
    },
    [isServerMode, setUrlQuery],
  )

  const setSearch = useCallback(
    (search: string) => {
      if (isServerMode) setUrlQuery({ search })
      else {
        setClientSearch(search)
        setClientPagination((prev) => ({ ...prev, pageIndex: 0 }))
      }
    },
    [isServerMode, setUrlQuery],
  )

  const setSorting = useCallback(
    (sorting: SortingState) => {
      if (isServerMode) {
        const sort = sorting[0]
        setUrlQuery({
          sortBy: sort?.id ?? null,
          sortDir: sort?.desc ? "desc" : sort ? "asc" : null,
        })
      } else {
        setClientSorting(sorting)
      }
    },
    [isServerMode, setUrlQuery],
  )

  const setFilters = useCallback(
    (filters: ColumnFiltersState) => {
      if (isServerMode) {
        const filterObj = filters.reduce<Record<string, string | string[]>>(
          (acc, f) => {
            acc[f.id] = f.value as string | string[]
            return acc
          },
          {},
        )
        setUrlQuery({ filters: filterObj })
      } else {
        setClientFilters(filters)
        setClientPagination((prev) => ({ ...prev, pageIndex: 0 }))
      }
    },
    [isServerMode, setUrlQuery],
  )

  const setFilter = useCallback(
    (id: string, value: string | string[] | null) => {
      if (isServerMode) {
        const newFilters = { ...query.filters }
        if (
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0)
        ) {
          delete newFilters[id]
        } else {
          newFilters[id] = value
        }
        setUrlQuery({ filters: newFilters })
      } else {
        setClientFilters((prev) => {
          const existing = prev.filter((f) => f.id !== id)
          if (
            value === null ||
            value === "" ||
            (Array.isArray(value) && value.length === 0)
          ) {
            return existing
          }
          return [...existing, { id, value }]
        })
        setClientPagination((prev) => ({ ...prev, pageIndex: 0 }))
      }
    },
    [isServerMode, query.filters, setUrlQuery],
  )

  const resetFilters = useCallback(() => {
    if (isServerMode) setUrlQuery({ filters: {}, search: "" })
    else {
      setClientFilters([])
      setClientSearch("")
      setClientPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }
  }, [isServerMode, setUrlQuery])

  return {
    table,
    query,
    pagination,
    isPending,
    setPage,
    setPageSize,
    setSearch,
    setSorting,
    setFilters,
    setFilter,
    resetFilters,
  }
}
