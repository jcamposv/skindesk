"use client";

import { useState } from "react";
import { HelpCircleIcon } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  /** One-line clinical definition shown in the tooltip body. */
  content: string;
  className?: string;
  /** Visual size of the trigger icon. Default 'sm' (size-3). */
  size?: "sm" | "md";
  /** Accessible label for the icon button. Defaults to "Más información". */
  label?: string;
}

/**
 * Tiny `?` icon with a popup explanation for clinical terms — Glogau,
 * Fitzpatrick, biotipo, queloide, etc. Click on mobile (touch-friendly),
 * hover on desktop.
 */
export function InfoTooltip({
  content,
  className,
  size = "sm",
  label = "Más información",
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const iconSize = size === "md" ? "size-4" : "size-3";

  return (
    <TooltipProvider delay={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={label}
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C6E6C]/40",
                className,
              )}
            >
              <HelpCircleIcon className={iconSize} />
            </button>
          }
        />
        <TooltipContent
          side="top"
          align="start"
          className="max-w-[260px] text-[11.5px] leading-snug"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
