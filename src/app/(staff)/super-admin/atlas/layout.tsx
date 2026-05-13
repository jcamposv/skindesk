import { redirect } from "next/navigation";

import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";

/**
 * Atlas CMS gate. Only super_admin may enter — RLS enforces this at the
 * DB too, but the layout-level redirect saves a wasted Supabase round-trip
 * and shows a friendly bounce to the user's correct dashboard.
 */
export default async function AtlasAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (session.profile.role !== "super_admin") {
    redirect(dashboardForRole(session.profile.role));
  }
  return <>{children}</>;
}
