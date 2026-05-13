"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  CalendarIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  PackageIcon,
  RouteIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { NavUser } from "@/components/nav-user";
import { Logo } from "@/components/shared/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ROUTES } from "@/lib/constants";
import type { AppRole } from "@/types/supabase";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

// Per-role nav config. Asistente reuses the profesional layout for now; we
// will filter individual items by `has_asistente_permission` once the
// dependent domain pages exist.
const NAV_BY_ROLE: Record<Exclude<AppRole, "clienta">, NavItem[]> = {
  super_admin: [
    { title: "Panel global", href: ROUTES.superAdmin, icon: ShieldCheckIcon },
    { title: "Atlas dermocosmético", href: ROUTES.atlas, icon: BookOpenIcon },
    { title: "Atlas · Administración", href: ROUTES.atlasAdmin, icon: LibraryIcon },
    { title: "Configuración", href: ROUTES.settings, icon: SettingsIcon },
  ],
  profesional: [
    { title: "Dashboard", href: ROUTES.profesional, icon: LayoutDashboardIcon },
    { title: "Agenda", href: ROUTES.agenda, icon: CalendarIcon },
    { title: "Clientes", href: ROUTES.clientes, icon: UsersIcon },
    { title: "Catálogo de productos", href: ROUTES.productos, icon: PackageIcon },
    { title: "Rutinas", href: ROUTES.rutinas, icon: RouteIcon },
    { title: "Atlas dermocosmético", href: ROUTES.atlas, icon: BookOpenIcon },
    { title: "Pagos", href: ROUTES.pagos, icon: CreditCardIcon },
    { title: "Configuración", href: ROUTES.settings, icon: SettingsIcon },
  ],
  asistente: [
    { title: "Dashboard", href: ROUTES.profesional, icon: LayoutDashboardIcon },
    { title: "Agenda", href: ROUTES.agenda, icon: CalendarIcon },
    { title: "Clientes", href: ROUTES.clientes, icon: UsersIcon },
    { title: "Catálogo de productos", href: ROUTES.productos, icon: PackageIcon },
    { title: "Rutinas", href: ROUTES.rutinas, icon: RouteIcon },
    { title: "Atlas dermocosmético", href: ROUTES.atlas, icon: BookOpenIcon },
    { title: "Pagos", href: ROUTES.pagos, icon: CreditCardIcon },
    { title: "Configuración", href: ROUTES.settings, icon: SettingsIcon },
  ],
};

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  initialUser: User;
  /** Drives nav-item filtering. Clienta has its own mobile layout. */
  role: Exclude<AppRole, "clienta">;
};

export function AppSidebar({ initialUser, role, ...props }: AppSidebarProps) {
  const pathname = usePathname();
  const nav = NAV_BY_ROLE[role];

  // Pick the single nav item whose href is the longest prefix match for
  // the current pathname. Without this, `/profesional/agenda` would mark
  // both "Dashboard" (`/profesional`) and "Agenda" active, because the
  // dashboard href is a prefix of every nested staff route.
  const activeHref = nav
    .filter(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className="flex items-center justify-start group-data-[collapsible=icon]:justify-center">
          <Logo
            variant="white"
            size="md"
            className="h-11 w-auto group-data-[collapsible=icon]:hidden"
          />
          <Logo
            variant="icon-white"
            size="md"
            className="hidden h-8 w-auto group-data-[collapsible=icon]:block"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeHref;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser initialUser={initialUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
