"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DataTableSearchProps } from "../types"

const DEBOUNCE_MS = 300

/**
 * Debounced search input. We hold local state, and only push to the parent
 * after 300ms of inactivity to avoid hammering the backend on every keystroke.
 */
export function DataTableSearch({
  value,
  onChange,
  placeholder = "Buscar…",
  className,
}: DataTableSearchProps) {
  const [localValue, setLocalValue] = useState(value)
  // React-recommended pattern for syncing external value into local state
  // without an effect: compare during render. See react.dev "you might not
  // need an effect" → "adjusting state when a prop changes".
  const [prevExternalValue, setPrevExternalValue] = useState(value)
  if (value !== prevExternalValue) {
    setPrevExternalValue(value)
    setLocalValue(value)
  }

  // Keep latest onChange in a ref so the debounce effect doesn't re-fire when
  // the parent passes a new function each render.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  // Debounce the propagation upwards.
  useEffect(() => {
    if (localValue === value) return
    const timer = setTimeout(() => {
      onChangeRef.current(localValue)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [localValue, value])

  const handleClear = useCallback(() => {
    setLocalValue("")
    onChangeRef.current("")
  }, [])

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9 h-9 w-[220px] lg:w-[300px] bg-muted/50 border-0"
      />
      {localValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute right-1.5 top-1/2 -translate-y-1/2"
          onClick={handleClear}
        >
          <X />
          <span className="sr-only">Limpiar búsqueda</span>
        </Button>
      )}
    </div>
  )
}
