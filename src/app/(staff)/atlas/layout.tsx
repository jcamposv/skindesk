import { redirect } from "next/navigation";

import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";

/**
 * Hard gate for every Atlas reader route. Allowed roles:
 *   · super_admin
 *   · profesional
 *   · asistente
 *
 * Clienta is already bounced by the parent `(staff)` layout, but we keep
 * this gate as defence in depth — there is no `tenant_id` scoping on Atlas
 * content, so the only thing standing between a clienta and the data is the
 * role check + the RLS policies on `atlas_entries`.
 */
export default async function AtlasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);

  const allowed: ReadonlyArray<typeof session.profile.role> = [
    "super_admin",
    "profesional",
    "asistente",
  ];
  if (!allowed.includes(session.profile.role)) {
    redirect(dashboardForRole(session.profile.role));
  }

  return <>{children}</>;
}
