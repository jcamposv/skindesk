import { redirect } from "next/navigation";

import { ClientaBottomNav } from "@/components/clienta-bottom-nav";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";

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

  return (
    <div className="relative flex min-h-svh w-full flex-col bg-background">
      {/* Bottom nav is fixed; pad the scroll area so it doesn't hide content.
          Content itself is centred in a comfortable reading column on
          desktop so lines of text don't span the whole viewport. */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:px-6 md:px-8">
        {children}
      </main>
      <ClientaBottomNav />
    </div>
  );
}
