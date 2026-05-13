"use client";

import { LayoutGridIcon, ListIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list";

interface UrlViewToggleProps {
  view: ViewMode;
  /** Called with the new view. The caller is responsible for writing it
   *  to the URL (typically `update({ view: next === "grid" ? null : next })`
   *  so "grid" — the default — keeps the URL clean). */
  onChange: (view: ViewMode) => void;
}

/** Grid / List view toggle. The default mode lives on `grid`; URL should
 *  drop the `?view` param when grid is active so links stay clean. */
export function UrlViewToggle({ view, onChange }: UrlViewToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Modo de vista"
      className="inline-flex items-center self-center rounded-md border bg-background p-0.5"
    >
      <ToggleButton
        active={view === "grid"}
        label="Grilla"
        icon={LayoutGridIcon}
        onSelect={() => onChange("grid")}
      />
      <ToggleButton
        active={view === "list"}
        label="Lista"
        icon={ListIcon}
        onSelect={() => onChange("list")}
      />
    </div>
  );
}

interface ToggleButtonProps {
  active: boolean;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

function ToggleButton({
  active,
  label,
  icon: Icon,
  onSelect,
}: ToggleButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "ghost"}
      onClick={onSelect}
      className={cn("h-8 gap-1.5 px-2.5", active ? "" : "text-muted-foreground")}
      aria-pressed={active}
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
