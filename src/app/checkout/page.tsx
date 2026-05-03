import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { CheckoutForm } from "@/components/forms/checkout-form";
import { AuthHero } from "@/components/shared/auth-hero";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { isPlanSlug, PLAN_BY_SLUG } from "@/lib/plans";

export const metadata: Metadata = { title: "Continuar al pago" };

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface PageProps {
  searchParams: Promise<{ plan?: string }>;
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  if (!isPlanSlug(params.plan)) redirect(ROUTES.home);

  const plan = PLAN_BY_SLUG[params.plan];

  const heroCopy =
    plan.trialDays > 0
      ? {
          headline: `Estás a un paso de tu plan ${plan.name}.`,
          subline: `${plan.tagline}. Probalo ${plan.trialDays} días gratis — no te cobramos hasta el día ${plan.trialDays + 1}.`,
        }
      : {
          headline: `Estás a un paso de activar ${plan.name}.`,
          subline: `${plan.tagline}. Activá tu suscripción y empezá a usar SkinDesk hoy.`,
        };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <AuthHero
        headline={heroCopy.headline}
        subline={heroCopy.subline}
        imageSrc="/checkout-hero.jpg"
        imageAlt={`Plan ${plan.name} de SkinDesk`}
        imagePosition="center 18%"
      />
      <div className="relative flex flex-col p-6 sm:p-10">
        <header className="flex items-center justify-end gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            ¿Querés cambiar de plan?
          </span>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={ROUTES.home} />}
          >
            ← Ver planes
          </Button>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center gap-4 lg:items-start">
              <div className="lg:hidden">
                <Logo size="md" />
              </div>
              <div className="w-full text-center lg:text-left">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive ring-1 ring-destructive/20">
                  <Sparkles className="size-3" aria-hidden />
                  Plan elegido
                </span>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {plan.name}
                  </h1>
                  <span className="text-lg font-medium">
                    {USD.format(plan.monthlyPriceUsd)}
                    <span className="text-sm text-muted-foreground">/mes</span>
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.tagline}
                </p>
                {plan.trialDays > 0 ? (
                  <p className="mt-2 text-xs text-accent-foreground">
                    {plan.trialDays} días de prueba gratis. No te cobramos hasta
                    el día {plan.trialDays + 1}.
                  </p>
                ) : null}
              </div>
            </div>
            <CheckoutForm plan={plan.slug} />
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
