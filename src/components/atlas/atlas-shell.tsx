import type { ReactNode } from "react";

import { AtlasSectionNav } from "./atlas-section-nav";
import { AtlasSectionMobileNav } from "./atlas-section-mobile-nav";
import type { AtlasSection } from "@/schemas/atlas.schema";

interface AtlasShellProps {
  /** Currently active section — drives the highlight in both desktop and
   *  mobile navs. Optional because the landing page (`/atlas`) has no
   *  active section. */
  activeSection?: AtlasSection;
  children: ReactNode;
}

/**
 * Two-column reader layout: section sidebar on the left (desktop) +
 * scrollable section tabs on top (mobile). Hosts every page under
 * `/atlas/...` except the bare landing.
 *
 * Why this lives as a shared component instead of an `app/atlas/layout.tsx`:
 * the layout level can't see `searchParams` or page-resolved props (section
 * name is in the URL), so highlighting and active state would need
 * `usePathname` client-side. Pulling the active section in at the page
 * level keeps both navs Server Components — no client JS.
 */
export function AtlasShell({ activeSection, children }: AtlasShellProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Desktop sidebar — sticks against the page top via lg:sticky so
          scrolling a long entry still keeps the nav in view. */}
      <aside className="hidden lg:block">
        <div className="lg:sticky lg:top-4">
          <AtlasSectionNav active={activeSection} />
        </div>
      </aside>

      <div className="grid gap-6">
        {/* Mobile-only tabs: scroll-x so all 7 sections stay reachable
            without consuming vertical room. */}
        <div className="lg:hidden">
          <AtlasSectionMobileNav active={activeSection} />
        </div>
        {children}
      </div>
    </div>
  );
}
