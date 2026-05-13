"use client";

interface UrlSelectFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  /** Show the "Todos" sentinel option that clears the filter. Default `true`. */
  allowClear?: boolean;
}

/** Labelled `<select>` with the SkinDesk toolbar styling. Pure UI — the
 *  URL writeback is the caller's responsibility (typically via
 *  `useUrlFilters().update({ filter_x: value })`). */
export function UrlSelectFilter({
  label,
  value,
  onChange,
  options,
  allowClear = true,
}: UrlSelectFilterProps) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/30"
      >
        {allowClear ? <option value="">Todos</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
