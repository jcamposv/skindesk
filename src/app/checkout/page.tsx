import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { CheckoutForm } from "@/components/forms/checkout-form";
import { AuthHero } from "@/components/shared/auth-hero";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { formatMoney, getCurrency } from "@/lib/currency";
import { ROUTES } from "@/lib/constants";
import {
  isBillingPeriod,
  isPlanSlug,
  PLAN_BY_SLUG,
  type BillingPeriod,
} from "@/lib/plans";
import {
  commonCurrencies,
  getPlanPricing,
  resolvePrice,
} from "@/lib/pricing";
import {
  getPreferredBillingPeriod,
  getPreferredPricingCurrency,
} from "@/lib/pricing-currency";

export const metadata: Metadata = { title: "Continuar al pago" };

interface PageProps {
  searchParams: Promise<{ plan?: string; period?: string }>;
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  if (!isPlanSlug(params.plan)) redirect(ROUTES.home);

  const plan = PLAN_BY_SLUG[params.plan];

  // Period resolution mirrors the landing: explicit ?period= wins,
  // then cookie, then "month". We additionally clamp to what the plan
  // actually supports — if a stale link asks for annual on a plan
  // without annual, downgrade to monthly silently.
  const pricing = await getPlanPricing();
  const requested: BillingPeriod | null = isBillingPeriod(params.period)
    ? params.period
    : null;
  const cookiePeriod = await getPreferredBillingPeriod(
    pricing[plan.slug].annual !== null,
  );
  const period: BillingPeriod =
    requested && (requested === "month" || pricing[plan.slug].annual !== null)
      ? requested
      : cookiePeriod;

  const available = commonCurrencies(pricing, period);
  const currency = await getPreferredPricingCurrency(available);
  const resolved = resolvePrice(pricing, plan.slug, period, currency);

  // resolvePrice returns null only if the plan has no monthly price at
  // all — config issue. Bounce back to landing so the user picks again
  // instead of seeing a half-broken form.
  if (!resolved) redirect(ROUTES.home);

  const formatted = formatMoney(resolved.unitAmount / 100, resolved.currency, {
    maximumFractionDigits: 0,
  });
  // Disambiguates the `$` symbol so the user sees the actual currency
  // (MXN, USD, COP, etc.) before confirming the charge.
  const resolvedCurrency = getCurrency(resolved.currency);
  const periodSuffix = period === "month" ? "/mes" : "/año";

  const heroCopy =
    plan.trialDays > 0
      ? {
          headline: `Estás a un paso de tu plan ${plan.name}.`,
          subline: `${plan.tagline}. Probalo ${plan.trialDays} días gratis — no te cobramos hasta el día ${plan.trialDays + 1}.`,
        }
      : {
          headline: `Estás a un paso de activar ${plan.name}.`,
          subline: `${plan.tagline}. Activa tu suscripción y empieza a usar SkinDesk hoy.`,
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
            ¿Quieres cambiar de plan?
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
                  <span className="flex items-baseline gap-1 text-lg font-medium tabular-nums">
                    {formatted}
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {resolvedCurrency.currencyCode}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {periodSuffix}
                    </span>
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.tagline}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Te cobramos en {resolvedCurrency.currencyName.toLowerCase()}.
                </p>
                {plan.trialDays > 0 ? (
                  <p className="mt-2 text-xs text-accent-foreground">
                    {plan.trialDays} días de prueba gratis. No te cobramos hasta
                    el día {plan.trialDays + 1}.
                  </p>
                ) : null}
              </div>
            </div>
            <CheckoutForm plan={plan.slug} period={period} />
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
