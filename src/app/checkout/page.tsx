import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/forms/checkout-form";
import { Logo } from "@/components/shared/logo";
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

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href={ROUTES.home}>
          <Logo size="sm" />
        </Link>
        <Link
          href={ROUTES.home}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver
        </Link>
      </header>

      <section className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Plan elegido
        </p>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {plan.name}
          </h1>
          <span className="text-lg font-medium">
            {USD.format(plan.monthlyPriceUsd)}
            <span className="text-sm text-muted-foreground">/mes</span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{plan.tagline}</p>
        {plan.trialDays > 0 ? (
          <p className="text-xs text-accent-foreground">
            {plan.trialDays} días de prueba gratis. No te cobramos hasta el día{" "}
            {plan.trialDays + 1}.
          </p>
        ) : null}
      </section>

      <CheckoutForm plan={plan.slug} />
    </main>
  );
}
