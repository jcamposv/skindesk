import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import { Logo } from "@/components/shared/logo";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Configurar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href={ROUTES.home}>
          <Logo size="sm" />
        </Link>
        <Link
          href={ROUTES.login}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Iniciar sesión
        </Link>
      </header>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Configurá tu contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Te enviamos un enlace al email. Sirve para crear tu primera
          contraseña (si activaste por magic link) o para restablecer una
          que olvidaste.
        </p>
      </div>

      <ForgotPasswordForm />
    </main>
  );
}
