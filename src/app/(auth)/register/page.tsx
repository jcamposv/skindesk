import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { AuthHero } from "@/components/shared/auth-hero";
import { RegisterForm } from "@/components/forms/register-form";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <AuthHero
        headline="Empieza tu rutina personalizada."
        subline="Crea tu cuenta y descubre los productos y rutinas ideales para tu piel, basados en evidencia y dermatología."
      />
      <div className="relative flex flex-col p-6 sm:p-10">
        <header className="flex items-center justify-end gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            ¿Ya tienes cuenta?
          </span>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={ROUTES.login} />}
          >
            Iniciar sesión
          </Button>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center gap-4 lg:items-start">
              <div className="lg:hidden">
                <Logo size="md" />
              </div>
              <div className="text-center lg:text-left">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive ring-1 ring-destructive/20">
                  <Sparkles className="size-3" aria-hidden />
                  Únete a SkinDesk
                </span>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                  Crea tu cuenta
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Empieza tu rutina personalizada en SkinDesk.
                </p>
              </div>
            </div>
            <RegisterForm />
          </div>
        </div>

        <footer className="text-center text-xs text-muted-foreground">
          Al continuar aceptas nuestros{" "}
          <Link
            href="#"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Términos
          </Link>{" "}
          y{" "}
          <Link
            href="#"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Política de privacidad
          </Link>
          .
        </footer>
      </div>
    </div>
  );
}
