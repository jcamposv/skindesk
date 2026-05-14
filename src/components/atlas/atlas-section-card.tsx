import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  ATLAS_SECTION_LABELS,
  type AtlasSection,
} from "@/schemas/atlas.schema";

import {
  ATLAS_SECTION_ICONS,
  ATLAS_SECTION_TONES,
} from "./atlas-section-icons";

interface AtlasSectionCardProps {
  section: AtlasSection;
  publishedCount: number;
}

/**
 * Compact horizontal section card. Replaces the previous vertical
 * stack (icon-on-top + multi-line description + count + arrow) with a
 * row layout — same affordances, ~60% less vertical real estate.
 *
 * The description was redundant with the section label, and removing
 * it also removes the dominant source of inconsistent card heights.
 * Now every section card is identical height, which lets us split the
 * 7 cards into a clean 4+3 bento grid with no empty corner.
 */
export function AtlasSectionCard({
  section,
  publishedCount,
}: AtlasSectionCardProps) {
  const Icon = ATLAS_SECTION_ICONS[section];
  const tones = ATLAS_SECTION_TONES[section];
  const empty = publishedCount === 0;

  return (
    <Link
      href={`${ROUTES.atlas}/${section}`}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border bg-card p-3.5 transition-all",
        "hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-sm",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
          tones.bg,
          tones.fg,
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-heading text-sm font-medium leading-tight">
          {ATLAS_SECTION_LABELS[section]}
        </h3>
        <p
          className={cn(
            "text-xs",
            empty ? "text-foreground/70" : "text-muted-foreground",
          )}
        >
          {empty
            ? "Próximamente"
            : `${publishedCount} ${publishedCount === 1 ? "guía" : "guías"}`}
        </p>
      </div>
      <ArrowRightIcon className="size-4 shrink-0 text-foreground/65 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/80" />
    </Link>
  );
}
