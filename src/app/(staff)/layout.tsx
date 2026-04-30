import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { SubscriptionBanner } from "@/components/subscription-banner";
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

  // Super_admin has no tenant/plan, so don't surface the gate. Profesional
  // and asistente use their tenant's cached subscription_status.
  const subscriptionStatus =
    session.profile.role === "super_admin" ? null : session.tenant?.subscription_status ?? null;

  return (
    <SidebarProvider>
      <AppSidebar initialUser={session.user} role={session.profile.role} />
      <SidebarInset>
        <SubscriptionBanner status={subscriptionStatus} />
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
