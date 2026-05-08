"use client"

import { FileX2, Loader2, SearchX } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface DataTableEmptyProps {
  title?: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
  className?: string
}

export function DataTableEmpty({
  title = "Sin resultados",
  description = "No hay datos que mostrar todavía.",
  icon: Icon = FileX2,
  action,
  className,
}: DataTableEmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className,
      )}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function DataTableNoResults({
  onClearFilters,
  className,
}: {
  onClearFilters?: () => void
  className?: string
}) {
  return (
    <DataTableEmpty
      title="Sin coincidencias"
      description="Ajusta tu búsqueda o filtros para encontrar lo que buscas."
      icon={SearchX}
      action={
        onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-sm text-primary hover:underline"
          >
            Limpiar filtros
          </button>
        )
      }
      className={className}
    />
  )
}

export function DataTableLoading({
  rows = 5,
  columns = 4,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div className="w-full">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              className="h-4 flex-1"
              style={{ animationDelay: `${(rowIndex * columns + colIndex) * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function DataTableSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
