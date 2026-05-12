import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  BadgeCheckIcon,
  BanknoteIcon,
  Building2Icon,
  UsersIcon,
} from "lucide-react";

import { DashboardHero } from "@/components/shared/dashboard-hero";
import { StatCard, type StatCardProps } from "@/components/shared/stat-card";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { PLAN_BY_SLUG, type PlanSlug } from "@/lib/plans";
import { createClient, getCurrentSession } from "@/lib/supabase/server";

export default async function SuperAdminPage() {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (session.profile.role !== "super_admin") {
    redirect(dashboardForRole(session.profile.role));
  }

  // All counts hit the same Postgres connection and are fully independent —
  // `Promise.all` parallelises them so the page renders in one round-trip
  // instead of N sequential ones. The MRR query pulls only the `plan`
  // column from active subscriptions; aggregation happens in JS against
  // the hardcoded plan catalog (low row count, no new DB schema needed).
  const supabase = await createClient();
  const [tenants, clientas, activeSubs, trialingSubs, mrrRows] = await Promise.all([
    supabase.from("tenants").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "clienta"),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "trialing"),
    supabase
      .from("subscriptions")
      .select("plan")
      .eq("status", "active"),
  ]);

  // MRR is a list-price approximation across active subscriptions. We
  // use the per-plan USD fallback in cents (mirrors what Stripe charges
  // by default) instead of pulling live prices here — saving N Stripe
  // round-trips for a stat that's intentionally rough. A real "MRR
  // realised" number would aggregate Stripe Invoices.
  const mrrUsd = (mrrRows.data ?? []).reduce(
    (sum, row) =>
      sum +
      (PLAN_BY_SLUG[row.plan as PlanSlug]?.usdFallbackCents.month ?? 0) / 100,
    0,
  );

  const activeCount = activeSubs.count ?? 0;
  const trialingCount = trialingSubs.count ?? 0;

  const stats: StatCardProps[] = [
    {
      label: "Tenants",
      value: NUMBER_FORMAT.format(tenants.count ?? 0),
      icon: Building2Icon,
      tone: "balsam",
      description: "Clínicas registradas",
    },
    {
      label: "MRR",
      value: USD_FORMAT.format(mrrUsd),
      icon: BanknoteIcon,
      tone: "aquatone",
      description: "Revenue mensual recurrente",
    },
    {
      label: "Clientas",
      value: NUMBER_FORMAT.format(clientas.count ?? 0),
      icon: UsersIcon,
      tone: "dustyRose",
      description: "Cuentas de paciente",
    },
    {
      label: "Suscripciones activas",
      value: NUMBER_FORMAT.format(activeCount),
      icon: BadgeCheckIcon,
      tone: "artemis",
      description: "Tenants pagando",
      // Inline trial count under the headline — pipeline signal without
      // adding a fifth card. Hide entirely when there are no trials so the
      // card stays calm.
      meta:
        trialingCount > 0
          ? `+${NUMBER_FORMAT.format(trialingCount)} en trial`
          : undefined,
    },
  ];

  const fullName =
    session.profile.full_name ??
    (session.user.user_metadata?.full_name as string | undefined) ??
    session.user.email?.split("@")[0] ??
    "ahí";

  return (
    <div className="grid gap-8">
      <DashboardHero
        name={fullName}
        subtitle="Acá tenés un resumen de la plataforma hoy."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  );
}

const NUMBER_FORMAT = new Intl.NumberFormat("es-AR");
const USD_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
