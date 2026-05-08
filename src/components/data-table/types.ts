import type { ColumnDef, SortingState } from "@tanstack/react-table"
import type { LucideIcon } from "lucide-react"

// =============================================================================
// Core Types
// =============================================================================

export type PaginationMode = "client" | "server"

export interface TableQuery {
  page: number
  pageSize: number
  search: string
  sortBy: string | null
  sortDir: "asc" | "desc" | null
  filters: Record<string, string | string[]>
}

export interface PaginationInfo {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

// =============================================================================
// Filter Types
// =============================================================================

export type FilterType = "select" | "multi-select"

export interface FilterOption {
  label: string
  value: string
  icon?: LucideIcon
}

export interface FilterConfig {
  id: string
  label: string
  type: FilterType
  options?: FilterOption[]
  placeholder?: string
}

// =============================================================================
// Action Types
// =============================================================================

export interface ActionConfig {
  id: string
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost"
  disabled?: boolean
}

export interface RowAction<TData> {
  id: string
  label: string
  icon?: LucideIcon
  onClick: (row: TData) => void
  variant?: "default" | "destructive"
  disabled?: boolean | ((row: TData) => boolean)
  hidden?: boolean | ((row: TData) => boolean)
}

// =============================================================================
// DataTable Props
// =============================================================================

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]

  // Pagination
  mode?: PaginationMode
  totalItems?: number
  defaultPageSize?: number
  pageSizeOptions?: number[]

  // Server-side callback (optional — page reading searchParams already
  // re-renders on URL change, so most server-mode pages don't need this).
  onQueryChange?: (query: TableQuery) => void

  // Search
  searchable?: boolean
  searchPlaceholder?: string
  searchColumns?: (keyof TData)[]

  // Filters
  filters?: FilterConfig[]

  // Sorting
  sortable?: boolean
  defaultSort?: SortingState

  // Actions
  primaryAction?: ActionConfig
  secondaryActions?: ActionConfig[]
  rowActions?: RowAction<TData>[]

  // States
  loading?: boolean
  error?: string
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: LucideIcon

  // Layout
  toolbar?: React.ReactNode | false
  showPagination?: boolean
  stickyHeader?: boolean

  // Styling
  className?: string
  striped?: boolean

  // Row customization
  onRowClick?: (row: TData) => void
  getRowId?: (row: TData) => string
}

// =============================================================================
// Hook Types
// =============================================================================

export interface UseDataTableOptions<TData> {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  mode: PaginationMode
  totalItems?: number
  defaultPageSize?: number
  defaultSort?: SortingState
  searchColumns?: (keyof TData)[]
  onQueryChange?: (query: TableQuery) => void
}

export interface UseTableUrlStateOptions {
  enabled?: boolean
  defaultPageSize?: number
}

// =============================================================================
// Component Props
// =============================================================================

export interface DataTableSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export interface DataTableFilterProps {
  config: FilterConfig
  value: string | string[] | undefined
  onChange: (value: string | string[] | null) => void
}

export interface DataTablePaginationProps {
  pageIndex: number
  pageSize: number
  totalItems: number
  totalPages: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}
