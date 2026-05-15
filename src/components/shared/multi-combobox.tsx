"use client";

import * as React from "react";
import { ChevronsUpDownIcon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiComboboxOption {
  value: string;
  label: string;
}

interface MultiComboboxProps {
  options: MultiComboboxOption[];
  /** Currently selected values (can include free-form custom entries). */
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Allow the user to add free-form entries that aren't in `options`.
   *  When true, an "Agregar: …" row appears for any search term that
   *  doesn't match an existing option. */
  allowCustom?: boolean;
  /** Optional renderer for free-form values that aren't in `options`. */
  customLabel?: (value: string) => string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** When set, caps how many chips render inside the trigger before falling
   *  back to a `+N` summary. Leave `undefined` (default) to let the trigger
   *  grow vertically and wrap chips onto multiple rows — that's the right
   *  behavior for a fields with no horizontal neighbour to crowd. */
  maxVisibleChips?: number;
}

/**
 * Multi-select combobox with chips inside the trigger and an optional
 * "Agregar: foo" row for free-form custom entries. Built from shadcn
 * Popover + Command.
 *
 * Designed for routine tags, product tags, allergy lists, and any other
 * "predefined set + occasional custom additions" use case in the app.
 */
export function MultiCombobox({
  options,
  value,
  onChange,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar o agregar…",
  emptyMessage = "Sin resultados.",
  allowCustom = false,
  customLabel,
  className,
  triggerClassName,
  disabled,
  ariaLabel,
  maxVisibleChips,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const labelByValue = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const o of options) map.set(o.value, o.label);
    return map;
  }, [options]);

  function getLabel(v: string): string {
    return labelByValue.get(v) ?? (customLabel ? customLabel(v) : v);
  }

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  function remove(v: string) {
    onChange(value.filter((x) => x !== v));
  }

  const trimmedSearch = search.trim();
  const matchesExisting = trimmedSearch
    ? options.some(
        (o) =>
          o.label.toLowerCase() === trimmedSearch.toLowerCase() ||
          o.value.toLowerCase() === trimmedSearch.toLowerCase(),
      )
    : false;
  const alreadySelected = trimmedSearch
    ? value.includes(trimmedSearch)
    : false;
  const canAddCustom =
    allowCustom &&
    trimmedSearch.length > 0 &&
    !matchesExisting &&
    !alreadySelected;

  function addCustom() {
    if (!canAddCustom) return;
    onChange([...value, trimmedSearch]);
    setSearch("");
  }

  const visible =
    maxVisibleChips != null ? value.slice(0, maxVisibleChips) : value;
  const overflow = value.length - visible.length;

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
              // `min-h-9` (not fixed) so the trigger grows downward when
              // many chips wrap onto multiple rows. `items-start` keeps the
              // chevron pinned to the top so it doesn't drift downward as
              // more rows appear.
              "min-h-9 h-auto w-full justify-between gap-2 px-2.5 py-1 font-normal items-start",
              value.length === 0 && "text-foreground/55",
              triggerClassName,
            )}
          />
        }
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 py-0.5">
          {value.length === 0 ? (
            <span className="truncate">{placeholder}</span>
          ) : (
            <>
              {visible.map((v) => (
                <span
                  key={v}
                  className="inline-flex max-w-[160px] items-center gap-1 rounded-full bg-[#E7ECEA] py-0.5 pl-2 pr-1 text-xs font-semibold text-[#4F605C]"
                >
                  <span className="truncate">{getLabel(v)}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Quitar ${getLabel(v)}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      remove(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        remove(v);
                      }
                    }}
                    className="grid size-4 place-items-center rounded-full text-[#4F605C]/70 hover:bg-[#5C6E6C]/15 hover:text-[#4F605C]"
                  >
                    <XIcon className="size-3" />
                  </span>
                </span>
              ))}
              {overflow > 0 ? (
                <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-xs font-semibold text-foreground/75 tabular-nums">
                  +{overflow}
                </span>
              ) : null}
            </>
          )}
        </div>
        <ChevronsUpDownIcon className="mt-1 size-4 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-[var(--anchor-width)] p-0", className)}
      >
        <Command shouldFilter={true}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canAddCustom) {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isActive = value.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    data-checked={isActive ? "true" : undefined}
                    onSelect={() => toggle(opt.value)}
                  >
                    <span
                      className={cn(
                        "mr-1 grid size-4 shrink-0 place-items-center rounded-sm border",
                        isActive
                          ? "border-[#5C6E6C] bg-[#5C6E6C] text-white"
                          : "border-foreground/30",
                      )}
                      aria-hidden="true"
                    >
                      {isActive ? (
                        <svg
                          viewBox="0 0 12 12"
                          className="size-3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="2.5,6.5 5,9 9.5,3.5" />
                        </svg>
                      ) : null}
                    </span>
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {canAddCustom ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`__add__${trimmedSearch}`}
                    onSelect={addCustom}
                  >
                    <PlusIcon className="mr-1 size-4 shrink-0 text-[#BB7154]" />
                    <span>
                      Agregar:{" "}
                      <span className="font-semibold">{trimmedSearch}</span>
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
