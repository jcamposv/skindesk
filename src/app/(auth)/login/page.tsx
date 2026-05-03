import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { LoginErrorToast } from "@/components/auth/login-error-toast";
import { AuthHero } from "@/components/shared/auth-hero";
import { LoginForm } from "@/components/forms/login-form";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <Suspense fallback={null}>
        <LoginErrorToast />
      </Suspense>
      <AuthHero
        headline="Cuida tu piel con datos, no con suposiciones."
        subline="Recomendaciones personalizadas, análisis de productos y rutinas adaptadas a tu tipo de piel — todo en un solo lugar."
      />
      <div className="relative flex flex-col p-6 sm:p-10">
        <header className="flex items-center justify-end gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            ¿No tienes cuenta?
          </span>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={ROUTES.home} />}
          >
            Ver planes
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
                  Bienvenido a SkinDesk
                </span>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                  ¡Bienvenido de vuelta!
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Inicia sesión en tu cuenta de SkinDesk.
                </p>
              </div>
            </div>
            <LoginForm />
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
