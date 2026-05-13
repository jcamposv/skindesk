import Link from "next/link";
import { redirect } from "next/navigation";
import { InfoIcon } from "lucide-react";

import { CurrencyToggle } from "@/components/marketing/currency-toggle";
import { LandingHero } from "@/components/marketing/landing-hero";
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
      {/* Dark band — header + canceled notice + hero share one continuous
       *  background so the nav reads as part of the hero, not a stitched
       *  patch. mb-* gives the plans section breathing room below. The
       *  radial blurs live here (not inside the hero) so they bleed across
       *  the whole band with no seam between header and hero. */}
      <div className="relative isolate mb-16 overflow-hidden bg-[#4A5A55] text-white md:mb-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-20 -z-0 size-[520px] rounded-full bg-[#5C6E6C]/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 bottom-0 -z-0 size-[420px] rounded-full bg-[#D2A96A]/20 blur-3xl"
        />
        <header className="relative z-10 flex items-center justify-between px-6 py-4 md:px-10">
          <Logo size="md" variant="white" />
          <div className="flex items-center gap-2">
            <CurrencyToggle
              currentCurrency={currency}
              available={availableCurrencies}
            />
            <Button
              variant="outline"
              render={<Link href={ROUTES.login} />}
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Iniciar sesión
            </Button>
          </div>
        </header>

        {showCanceledNotice ? (
          <div className="relative z-10 border-y border-white/15 bg-white/5">
            <div className="flex items-start gap-3 px-6 py-3 md:px-10">
              <InfoIcon
                className="mt-0.5 size-4 shrink-0 text-white/70"
                aria-hidden
              />
              <p className="text-sm text-white/80">
                <span className="font-medium text-white">
                  Cancelaste el pago.
                </span>{" "}
                No te cobramos nada. Si fue sin querer, elegí tu plan abajo y
                vuelve a intentar — tu información no se perdió.
              </p>
            </div>
          </div>
        ) : null}

        <LandingHero />
      </div>

      <section
        id="planes"
        className="flex w-full flex-col items-center gap-10 px-6 pb-20 md:px-10"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-foreground ring-1 ring-accent/30">
            Elige tu plan
          </span>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Empieza con el plan que necesitas
          </h2>
          <p className="max-w-2xl text-balance text-muted-foreground">
            Sin permanencia. Cambia o cancela cuando quieras.
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
