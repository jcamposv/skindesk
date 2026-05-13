import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import { AuthShell } from "@/components/shared/auth-shell";

export const metadata: Metadata = { title: "Configurar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Recuperar acceso
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Configura tu contraseña
          </h1>
          <p className="text-sm text-muted-foreground">
            Te enviamos un enlace al email. Sirve para crear tu primera
            contraseña (si activaste por magic link) o para restablecer una
            que olvidaste.
          </p>
        </div>

        <ForgotPasswordForm />
      </div>
    </AuthShell>
  );
}
