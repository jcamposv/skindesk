import { headers } from "next/headers";
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
import type { Database } from "@/types/database.types";

type SubStatus = Database["public"]["Enums"]["subscription_status"];

// Definitive states the user can't recover from without action — block
// every non-/settings route and force a stop on the billing portal. Soft
// states (past_due, incomplete, trialing/active + cancel_at_period_end)
// stay accessible with a banner so the user can keep working while Stripe
// retries / before the period ends.
const HARD_GATE_STATUSES: ReadonlySet<SubStatus> = new Set<SubStatus>([
  "canceled",
  "unpaid",
  "incomplete_expired",
]);

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
    session.profile.role === "super_admin"
      ? null
      : session.tenant?.subscription_status ?? null;
  const cancelAtPeriodEnd =
    session.profile.role === "super_admin"
      ? false
      : session.tenant?.cancel_at_period_end ?? false;
  const currentPeriodEnd =
    session.profile.role === "super_admin"
      ? null
      : session.tenant?.current_period_end ?? null;

  // Hard-gate: definitive unhealthy states bounce to /settings (where the
  // banner explains the situation and the portal button lives). The
  // pathname comes from the x-pathname header we inject in middleware.
  if (subscriptionStatus && HARD_GATE_STATUSES.has(subscriptionStatus)) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!pathname.startsWith(ROUTES.settings)) {
      redirect(ROUTES.settings);
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar initialUser={session.user} role={session.profile.role} />
      <SidebarInset>
        <SubscriptionBanner
          status={subscriptionStatus}
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          currentPeriodEnd={currentPeriodEnd}
        />
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
