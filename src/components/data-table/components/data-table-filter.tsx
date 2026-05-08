"use client"

import { Check, ChevronDown, Filter as FilterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type {
  DataTableFilterProps,
  FilterConfig,
  FilterOption,
} from "../types"

export function DataTableFilter({
  config,
  value,
  onChange,
}: DataTableFilterProps) {
  const { label, options = [], type } = config

  const isActive =
    !!value && (Array.isArray(value) ? value.length > 0 : value !== "")

  const displayLabel = (() => {
    if (!isActive) return label
    if (type === "multi-select" && Array.isArray(value)) {
      if (value.length === 1) {
        const opt = options.find((o) => o.value === value[0])
        return opt?.label ?? value[0]
      }
      return `${label} · ${value.length}`
    }
    const opt = options.find((o) => o.value === value)
    return opt?.label ?? String(value)
  })()

  const isSelected = (optionValue: string) => {
    if (Array.isArray(value)) return value.includes(optionValue)
    return value === optionValue
  }

  const handleSelect = (optionValue: string) => {
    if (type === "multi-select") {
      const current = Array.isArray(value) ? value : []
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue]
      onChange(next.length > 0 ? next : null)
    } else {
      onChange(value === optionValue ? null : optionValue)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 rounded-full border-dashed gap-1.5",
              isActive && "border-primary/50 bg-primary/5 text-primary",
            )}
          />
        }
      >
        <FilterIcon className="size-3.5" />
        <span className="max-w-[160px] truncate">{displayLabel}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        {options.map((option: FilterOption) => (
          <DropdownMenuItem
            key={option.value}
            onClick={(e) => {
              e.preventDefault()
              handleSelect(option.value)
            }}
            closeOnClick={false}
            className="gap-2"
          >
            <div
              className={cn(
                "flex size-4 items-center justify-center rounded-sm border",
                isSelected(option.value)
                  ? "bg-primary border-primary text-primary-foreground"
                  : "opacity-50",
              )}
            >
              {isSelected(option.value) && <Check className="size-3" />}
            </div>
            {option.icon && (
              <option.icon className="size-4 text-muted-foreground" />
            )}
            <span className="flex-1 truncate">{option.label}</span>
          </DropdownMenuItem>
        ))}
        {isActive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onChange(null)}
              className="justify-center"
            >
              Limpiar filtro
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DataTableFilters({
  filters,
  values,
  onChange,
}: {
  filters: FilterConfig[]
  values: Record<string, string | string[]>
  onChange: (id: string, value: string | string[] | null) => void
}) {
  if (filters.length === 0) return null
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((config) => (
        <DataTableFilter
          key={config.id}
          config={config}
          value={values[config.id]}
          onChange={(val) => onChange(config.id, val)}
        />
      ))}
    </div>
  )
}
