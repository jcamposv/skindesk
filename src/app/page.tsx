import Link from "next/link";
import { redirect } from "next/navigation";
import { InfoIcon } from "lucide-react";

import { CurrencyToggle } from "@/components/marketing/currency-toggle";
import { PeriodToggle } from "@/components/marketing/period-toggle";
import { PlanCard } from "@/components/marketing/plan-card";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { PLANS } from "@/lib/plans";
import {
  commonCurrencies,
  getPlanPricing,
  pricingSupportsAnnual,
  resolvePrice,
} from "@/lib/pricing";
import {
  getPreferredBillingPeriod,
  getPreferredPricingCurrency,
} from "@/lib/pricing-currency";
import { getCurrentSession } from "@/lib/supabase/server";

interface PageProps {
  searchParams: Promise<{ canceled?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  // Authed users skip the landing entirely — they belong on their dashboard.
  const session = await getCurrentSession();
  if (session) redirect(dashboardForRole(session.profile.role));

  const { canceled } = await searchParams;
  const showCanceledNotice = canceled === "1";

  // Pricing is the slow path here (Stripe API call on cache miss).
  // Everything else is in-memory or cookie reads, so awaiting it first
  // doesn't block anything we can parallelise.
  const pricing = await getPlanPricing();
  const supportsAnnual = pricingSupportsAnnual(pricing);
  const period = await getPreferredBillingPeriod(supportsAnnual);
  const availableCurrencies = commonCurrencies(pricing, period);
  const currency = await getPreferredPricingCurrency(availableCurrencies);

  // Build the savings label for the annual toggle (computed from the
  // highlighted plan so the number is meaningful, not averaged). When
  // either price is missing or annual isn't even offered, no label.
  const annualHint = supportsAnnual ? buildSavingsHint() : undefined;

  function buildSavingsHint(): string | undefined {
    const highlight = PLANS.find((p) => p.highlight) ?? PLANS[0];
    const monthly = resolvePrice(pricing, highlight.slug, "month", currency);
    const annual = resolvePrice(pricing, highlight.slug, "year", currency);
    if (!monthly || !annual) return undefined;
    const monthlyCost12 = monthly.unitAmount * 12;
    if (monthlyCost12 <= 0) return undefined;
    const savingsPct = Math.round(
      ((monthlyCost12 - annual.unitAmount) / monthlyCost12) * 100,
    );
    if (savingsPct <= 0) return undefined;
    return `−${savingsPct}%`;
  }

  return (
    <main className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <Logo size="md" />
        <div className="flex items-center gap-2">
          <CurrencyToggle
            currentCurrency={currency}
            available={availableCurrencies}
          />
          <Button
            variant="ghost"
            render={<Link href={ROUTES.login} />}
            className="hidden sm:inline-flex"
          >
            Iniciar sesión
          </Button>
          <Button
            variant="outline"
            render={<Link href={ROUTES.login} />}
            className="sm:hidden"
          >
            Entrar
          </Button>
        </div>
      </header>

      {showCanceledNotice ? (
        <div className="border-b border-border/60 bg-muted/40">
          <div className="mx-auto flex w-full max-w-6xl items-start gap-3 px-6 py-3 md:px-10">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Cancelaste el pago.
              </span>{" "}
              No te cobramos nada. Si fue sin querer, elegí tu plan abajo y
              volvé a intentar — tu información no se perdió.
            </p>
          </div>
        </div>
      ) : null}

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-10 px-6 pt-10 pb-20 md:pt-20">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-foreground ring-1 ring-accent/30">
            Software para cosmetología y estética
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Gestiona tu clínica de piel con el plan que necesitas
          </h1>
          <p className="max-w-2xl text-balance text-muted-foreground">
            Agenda, fichas de clientas, catálogo y reportes — todo en un solo
            lugar. Empieza con 14 días de prueba; sin permanencia, cancela
            cuando quieras.
          </p>
        </div>

        {supportsAnnual ? (
          <PeriodToggle current={period} annualHint={annualHint} />
        ) : null}

        <div className="grid w-full gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const resolved = resolvePrice(pricing, plan.slug, period, currency);
            if (!resolved) return null;
            return (
              <PlanCard
                key={plan.slug}
                plan={plan}
                price={{
                  unitAmount: resolved.unitAmount,
                  currency: resolved.currency,
                  period,
                }}
              />
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ¿Eres clienta de una profesional? Te llegará una invitación por email.
          Las clientas no se registran solas.
        </p>
      </section>
    </main>
  );
}
