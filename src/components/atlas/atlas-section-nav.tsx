import Link from "next/link";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import {
  ATLAS_SECTIONS,
  ATLAS_SECTION_LABELS,
  type AtlasSection,
} from "@/schemas/atlas.schema";

import {
  ATLAS_SECTION_ICONS,
  ATLAS_SECTION_TONES,
} from "./atlas-section-icons";

interface AtlasSectionNavProps {
  /** Currently active section, used to highlight the active tab. Optional
   *  so the bare `/atlas` landing renders the nav with no highlight. */
  active?: AtlasSection;
}

/**
 * Vertical section sidebar shared by every reader page. Each item is a
 * `<Link>` so middle-click / cmd-click work, the active state is computed
 * server-side and there's zero client JS.
 */
export function AtlasSectionNav({ active }: AtlasSectionNavProps) {
  return (
    <nav
      aria-label="Secciones del Atlas"
      className="flex flex-col gap-1 rounded-2xl border bg-card p-2"
    >
      {ATLAS_SECTIONS.map((section) => {
        const Icon = ATLAS_SECTION_ICONS[section];
        const tones = ATLAS_SECTION_TONES[section];
        const isActive = section === active;
        return (
          <Link
            key={section}
            href={`${ROUTES.atlas}/${section}`}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                tones.bg,
                tones.fg,
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="truncate">{ATLAS_SECTION_LABELS[section]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
