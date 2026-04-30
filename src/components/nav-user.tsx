"use client";

import { useEffect, useState } from "react";
import {
  ChevronsUpDownIcon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSignOut } from "@/hooks/use-sign-out";
import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

function initials(value: string): string {
  return value
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface NavUserProps {
  initialUser: User;
}

export function NavUser({ initialUser }: NavUserProps) {
  const { isMobile } = useSidebar();
  const { signOut, signingOut } = useSignOut();
  // Server-resolved user is the source of truth on first paint, so no skeleton.
  // We subscribe to auth changes only to react when the user signs out from
  // another tab; the layout-level redirect handles the no-user case after that.
  const [user, setUser] = useState<User>(initialUser);

  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) setUser(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Usuario";
  const email = user.email ?? "";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="aria-expanded:bg-sidebar-accent"
              />
            }
          >
            <Avatar className="size-8">
              <AvatarFallback>{initials(fullName)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{fullName}</span>
              <span className="truncate text-xs">{email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8">
                    <AvatarFallback>{initials(fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{fullName}</span>
                    <span className="truncate text-xs">{email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href={ROUTES.settings} />}>
                <SettingsIcon />
                Ajustes
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={signingOut} onClick={signOut}>
              <LogOutIcon />
              {signingOut ? "Cerrando…" : "Cerrar sesión"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
