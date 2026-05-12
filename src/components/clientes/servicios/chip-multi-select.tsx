"use client";

import { Chip, type ChipTone } from "@/components/ui/chip";

interface ChipMultiSelectProps {
  label?: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  tone?: ChipTone;
  hint?: string;
}

/**
 * Thin wrapper around `<Chip>` so a screen can spit out a labelled chip-group
 * without re-implementing toggle logic per field. Matches the existing
 * evaluaciones aesthetic (sage chips on cream background).
 */
export function ChipMultiSelect({
  label,
  options,
  value,
  onChange,
  tone = "sage",
  hint,
}: ChipMultiSelectProps) {
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }

  return (
    <div className="grid gap-2">
      {label ? (
        <label className="text-[12px] font-medium text-muted-foreground">
          {label}
        </label>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <Chip
            key={opt}
            tone={tone}
            size="sm"
            pressed={value.includes(opt)}
            onPressedChange={() => toggle(opt)}
          >
            {opt}
          </Chip>
        ))}
      </div>
      {hint ? (
        <p className="text-[10.5px] text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  );
}
