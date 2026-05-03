"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  SettingsIcon,
  ShieldCheckIcon,
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
    { title: "Ajustes", href: ROUTES.settings, icon: SettingsIcon },
  ],
  profesional: [
    { title: "Dashboard", href: ROUTES.profesional, icon: LayoutDashboardIcon },
    { title: "Ajustes", href: ROUTES.settings, icon: SettingsIcon },
  ],
  asistente: [
    { title: "Dashboard", href: ROUTES.profesional, icon: LayoutDashboardIcon },
    { title: "Ajustes", href: ROUTES.settings, icon: SettingsIcon },
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
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
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
