import { redirect } from "next/navigation";

import { ClientaBottomNav } from "@/components/clienta-bottom-nav";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";
import { getTenantConfig } from "@/lib/tenant-config";

export default async function ClientaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (session.profile.role !== "clienta") {
    redirect(dashboardForRole(session.profile.role));
  }

  // Same provider the staff layout mounts, so any clienta-facing
  // financial widget (current balance, plan progress, future invoices)
  // reads the correct currency from her own tenant. `getTenantConfig`
  // is request-cached, so this read is free against the rest of the
  // page tree.
  const tenantConfig = await getTenantConfig();

  return (
    <div className="relative flex min-h-svh w-full flex-col bg-background">
      <CurrencyProvider currency={tenantConfig.currency}>
        {/* Bottom nav is fixed; pad the scroll area so it doesn't hide content.
            Content itself is centred in a comfortable reading column on
            desktop so lines of text don't span the whole viewport. */}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:px-6 md:px-8">
          {children}
        </main>
        <ClientaBottomNav />
      </CurrencyProvider>
    </div>
  );
}
