"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** When provided, shows a clear button so the field can be reset to "". */
  clearable?: boolean;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** `aria-label` for the trigger when there's no visible label. */
  ariaLabel?: string;
}

/**
 * Single-select combobox built from shadcn Popover + Command.
 * Use for short enums (≤ ~50 options) where a Select is too tall and a
 * Combobox with search wins.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  emptyMessage = "Sin resultados.",
  clearable = false,
  className,
  triggerClassName,
  disabled,
  ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-expanded={open}
            className={cn(
              "h-9 w-full justify-between gap-2 px-3 font-normal",
              !selected && "text-foreground/55",
              triggerClassName,
            )}
          />
        }
      >
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {clearable && selected ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpiar"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }
              }}
              className="grid size-5 place-items-center rounded-full text-foreground/55 hover:bg-foreground/10 hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </span>
          ) : null}
          <ChevronsUpDownIcon className="size-4 opacity-60" />
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-[var(--anchor-width)] p-0", className)}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isActive = opt.value === value;
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    data-checked={isActive ? "true" : undefined}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-1 size-4 shrink-0",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
