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

interface AtlasSectionMobileNavProps {
  /** Currently active section, used to highlight the active pill. Optional
   *  so the landing page (`/atlas`) can render the bar with no highlight. */
  active?: AtlasSection;
}

/**
 * Horizontal, scroll-x section pill bar. Mobile-only analogue of
 * `AtlasSectionNav` (desktop sidebar). Server Component — no client JS,
 * just real `<Link>`s so cmd-click / share works.
 */
export function AtlasSectionMobileNav({ active }: AtlasSectionMobileNavProps) {
  return (
    <nav
      aria-label="Secciones del Atlas"
      // Negative margin to extend pill row to the viewport edges on small
      // screens so the user can tell content scrolls.
      className="-mx-4 overflow-x-auto px-4 pb-1"
    >
      <ul className="flex w-max items-center gap-1.5">
        {ATLAS_SECTIONS.map((section) => {
          const Icon = ATLAS_SECTION_ICONS[section];
          const tones = ATLAS_SECTION_TONES[section];
          const isActive = section === active;
          return (
            <li key={section}>
              <Link
                href={`${ROUTES.atlas}/${section}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                  isActive
                    ? "border-transparent bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded",
                    isActive ? "bg-background/15" : tones.bg,
                    isActive ? "text-background" : tones.fg,
                  )}
                >
                  <Icon className="size-2.5" />
                </span>
                {ATLAS_SECTION_LABELS[section]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
