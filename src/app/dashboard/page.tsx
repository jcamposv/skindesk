import { redirect } from "next/navigation";

import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";

/**
 * `/dashboard` is the canonical post-login URL and the central routing
 * gate. Both the PKCE callback (server-side) and the implicit-flow client
 * island redirect here after establishing a session, so any gating that
 * applies "after sign-in, before dashboard" lives in one place:
 *
 *   - no session         → /login
 *   - !password_set      → /auth/setup
 *   - otherwise          → role-specific dashboard
 */
export default async function DashboardRouterPage() {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (!session.profile.password_set) redirect(ROUTES.authSetup);
  redirect(dashboardForRole(session.profile.role));
}
