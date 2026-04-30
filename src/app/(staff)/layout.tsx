import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  // Bounce clientas out of staff routes — they belong on /clienta.
  if (session.profile.role === "clienta") {
    redirect(dashboardForRole("clienta"));
  }

  return (
    <SidebarProvider>
      <AppSidebar initialUser={session.user} role={session.profile.role} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <h1 className="text-sm font-medium text-muted-foreground">SkinDesk</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
