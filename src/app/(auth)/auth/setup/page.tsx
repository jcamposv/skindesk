import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupPasswordForm } from "@/components/forms/setup-password-form";
import { AuthShell } from "@/components/shared/auth-shell";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession, isRecoveryFresh } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Crear contraseña" };

/**
 * Reached after the welcome magic link or a password recovery link. The
 * Supabase callback already exchanged the code, so by the time this Server
 * Component renders the user has a session — we use the form to require a
 * password before letting her into the dashboard. No skip: profesionales
 * land here once and only once during onboarding.
 *
 * Two legitimate entry conditions; everything else is bounced to the role
 * dashboard so an already-set-up user can't navigate here directly and
 * silently change her password (a session-hijack amplification vector — the
 * attacker would otherwise lock the legit user out without knowing the
 * current password).
 *
 *   - profile.password_set === false  → first-time setup (invite/welcome)
 *   - profile.password_set === true   → only allowed when the JWT `amr`
 *     shows a recovery method consumed within the last 15 min. This is
 *     signed by Supabase; can't be forged by an authenticated session.
 */
export default async function AuthSetupPage() {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);

  if (session.profile.password_set) {
    const inRecovery = await isRecoveryFresh();
    if (!inRecovery) redirect(dashboardForRole(session.profile.role));
  }

  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Último paso
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Creá tu contraseña
          </h1>
          <p className="text-sm text-muted-foreground">
            Para terminar tu activación elegí una contraseña — la vas a usar
            para iniciar sesión rápidamente sin esperar el magic link cada
            vez.
          </p>
        </div>

        <SetupPasswordForm />
      </div>
    </AuthShell>
  );
}
