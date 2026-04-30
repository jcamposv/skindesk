import { redirect } from "next/navigation";

import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";

/**
 * `/dashboard` is the canonical post-login URL but renders nothing — it just
 * routes the user to their role-specific home (super-admin, profesional,
 * clienta). Keeping a single redirect target means the auth callback and
 * sign-in action don't need to know about roles.
 */
export default async function DashboardRouterPage() {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  redirect(dashboardForRole(session.profile.role));
}
