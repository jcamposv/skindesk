import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheckIcon,
  BanknoteIcon,
  Building2Icon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { ROUTES, dashboardForRole } from "@/lib/constants";
import { PLAN_BY_SLUG, type PlanSlug } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { createClient, getCurrentSession } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Panel global · Super admin" };

/**
 * Visual tokens per stat. Card backgrounds use the brand palette
 * (sage/aquatone, balsam green, artemis honey, dusty rose) so each card
 * reads as a distinct concern at a glance. The icon chip is always white
 * over the colored card for contrast — the chip itself uses the same brand
 * color for the glyph so the icon "echoes" the card.
 */
const STAT_TONES = {
  balsam: {
    card: "bg-[#5C6E6C] text-white",
    chipText: "text-[#5C6E6C]",
    linkHover: "hover:text-white",
  },
  aquatone: {
    card: "bg-[#A6B7AA] text-white",
    chipText: "text-[#5C6E6C]",
    linkHover: "hover:text-white",
  },
  artemis: {
    card: "bg-[#D2A96A] text-white",
    chipText: "text-[#8A6A38]",
    linkHover: "hover:text-white",
  },
  dustyRose: {
    card: "bg-[#C58F8A] text-white",
    chipText: "text-[#8A4F4A]",
    linkHover: "hover:text-white",
  },
} as const;

type ToneKey = keyof typeof STAT_TONES;

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

  const mrrUsd = (mrrRows.data ?? []).reduce(
    (sum, row) =>
      sum + (PLAN_BY_SLUG[row.plan as PlanSlug]?.monthlyPriceUsd ?? 0),
    0,
  );

  const activeCount = activeSubs.count ?? 0;
  const trialingCount = trialingSubs.count ?? 0;

  const stats: Array<{
    label: string;
    value: string;
    icon: LucideIcon;
    tone: ToneKey;
    description: string;
    meta?: string;
  }> = [
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

  return (
    <div className="grid gap-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Panel global</h2>
        <p className="text-sm text-muted-foreground">
          Gestión de tenants, usuarios y métricas a nivel plataforma.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: ToneKey;
  description: string;
  /** Optional secondary annotation rendered under the headline value. */
  meta?: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  description,
  meta,
}: StatCardProps) {
  const t = STAT_TONES[tone];
  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-2xl p-5 shadow-sm transition-shadow hover:shadow-md",
        t.card,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full bg-white/95",
            t.chipText,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col items-end text-right">
          <p className="text-xs font-medium uppercase tracking-wider opacity-80">
            {label}
          </p>
          <p
            className="mt-1 text-3xl font-semibold leading-none tracking-tight tabular-nums"
            aria-label={`${value} ${label}`}
          >
            {value}
          </p>
          {meta ? (
            <p className="mt-1.5 text-[11px] font-medium tabular-nums opacity-80">
              {meta}
            </p>
          ) : null}
        </div>
      </div>
      <p className="text-xs leading-relaxed opacity-85">{description}</p>
    </div>
  );
}

const NUMBER_FORMAT = new Intl.NumberFormat("es-AR");
const USD_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
