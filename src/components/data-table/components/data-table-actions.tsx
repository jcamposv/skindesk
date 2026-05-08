"use client"

import { MoreHorizontal, Plus, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ActionConfig, RowAction } from "../types"

interface DataTableActionsProps {
  primaryAction?: ActionConfig
  secondaryActions?: ActionConfig[]
}

/**
 * Toolbar actions: a primary CTA (e.g. "Invitar usuario") + a Settings dropdown
 * for secondary actions. Both optional.
 */
export function DataTableActions({
  primaryAction,
  secondaryActions = [],
}: DataTableActionsProps) {
  const hasSecondary = secondaryActions.length > 0
  return (
    <div className="flex items-center gap-2">
      {hasSecondary && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon-sm" />}
          >
            <Settings2 />
            <span className="sr-only">Más acciones</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {secondaryActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                onClick={() => action.onClick()}
                disabled={action.disabled}
                variant={action.variant === "destructive" ? "destructive" : undefined}
              >
                {action.icon && <action.icon />}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {primaryAction && (
        <Button
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
          variant={primaryAction.variant ?? "default"}
          size="sm"
          className="h-9 gap-1.5"
        >
          {primaryAction.icon ? <primaryAction.icon /> : <Plus />}
          {primaryAction.label}
        </Button>
      )}
    </div>
  )
}

interface DataTableRowActionsProps<TData> {
  row: TData
  actions: RowAction<TData>[]
}

/**
 * Row-level kebab menu. Filters out hidden actions and resolves disabled per
 * row. Components needing custom UX (e.g. an action that opens a Dialog) should
 * keep their own cell renderer instead of using this generic menu.
 */
export function DataTableRowActions<TData>({
  row,
  actions,
}: DataTableRowActionsProps<TData>) {
  const visible = actions.filter((a) =>
    typeof a.hidden === "function" ? !a.hidden(row) : !a.hidden,
  )
  if (visible.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <MoreHorizontal />
        <span className="sr-only">Acciones</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {visible.map((action, i) => {
          const isDisabled =
            typeof action.disabled === "function"
              ? action.disabled(row)
              : action.disabled
          const isDestructive = action.variant === "destructive"
          return (
            <div key={action.id}>
              {i > 0 && isDestructive && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={() => action.onClick(row)}
                disabled={isDisabled}
                variant={isDestructive ? "destructive" : undefined}
              >
                {action.icon && <action.icon />}
                {action.label}
              </DropdownMenuItem>
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
