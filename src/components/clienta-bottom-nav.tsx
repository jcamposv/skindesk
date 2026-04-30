"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarHeartIcon,
  HomeIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TABS: readonly Tab[] = [
  { href: "/clienta",          label: "Inicio",     icon: HomeIcon },
  { href: "/clienta/agenda",   label: "Agenda",     icon: CalendarHeartIcon },
  { href: "/clienta/rutina",   label: "Rutina",     icon: SparklesIcon },
  { href: "/clienta/perfil",   label: "Perfil",     icon: UserIcon },
];

export function ClientaBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      // pb-[env(safe-area-inset-bottom)] respects the iOS home-indicator gutter
      // when the app is added to the home screen. We reuse the sidebar tokens
      // so this matches the staff sidebar's Balsam palette and stays correct
      // in dark mode automatically.
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar text-sidebar-foreground pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex w-full max-w-2xl items-stretch justify-around">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active =
            pathname === tab.href ||
            (tab.href !== "/clienta" && pathname.startsWith(`${tab.href}/`));
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="flex h-16 flex-col items-center justify-center px-2 py-1 text-sidebar-foreground"
              >
                {/* Inner pill carries the active highlight so the tap target
                    stays the full <Link> while the visual indicator is
                    contained. Artemis (--accent) is the warmest hue in the
                    palette — best perceptual pop against Balsam green. */}
                <span
                  className={cn(
                    "flex w-full max-w-[72px] flex-col items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs transition-colors",
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  <span>{tab.label}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
