"use client";

import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

interface UrlSearchBoxProps {
  /** Local draft, controlled by `useUrlFilters().searchDraft`. */
  value: string;
  /** Setter from `useUrlFilters().setSearchDraft`. */
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Search input with a leading icon. The debounced URL sync lives in
 *  `useUrlFilters`; this component is purely visual. */
export function UrlSearchBox({
  value,
  onChange,
  placeholder = "Buscar…",
}: UrlSearchBoxProps) {
  return (
    <label className="relative block">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 pl-9"
      />
    </label>
  );
}
