"use client"

import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react"
import { type Column } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
  className?: string
}

/**
 * Sortable column header with a small dropdown for asc/desc/hide.
 */
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>
  }

  const sorted = column.getIsSorted()
  return (
    <div className={cn("flex items-center", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" className="-ml-3 h-8" />}
        >
          <span>{title}</span>
          {sorted === "desc" ? (
            <ArrowDown />
          ) : sorted === "asc" ? (
            <ArrowUp />
          ) : (
            <ChevronsUpDown className="opacity-60" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp />
            Ascendente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown />
            Descendente
          </DropdownMenuItem>
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOff />
                Ocultar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
