import { SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface TipCardProps {
  title?: string;
  body: string;
  className?: string;
}

/**
 * Subtle promotional card used as a contextual hint inside dashboards.
 * Server Component — no JS needed for the visual.
 */
export function TipCard({ title = "Tip SkinDesk", body, className }: TipCardProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-[#EFD7C7] bg-[#FBF5EA] p-4",
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[#D2A96A] shadow-sm">
        <SparklesIcon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-tight">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </div>
  );
}
