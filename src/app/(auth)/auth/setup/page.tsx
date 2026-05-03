import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupPasswordForm } from "@/components/forms/setup-password-form";
import { AuthShell } from "@/components/shared/auth-shell";
import { ROUTES } from "@/lib/constants";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Crear contraseña" };

/**
 * Reached after the welcome magic link or a password recovery link. The
 * Supabase callback already exchanged the code, so by the time this Server
 * Component renders the user has a session — we use the form to require a
 * password before letting her into the dashboard. No skip: profesionales
 * land here once and only once during onboarding.
 */
export default async function AuthSetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);

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
