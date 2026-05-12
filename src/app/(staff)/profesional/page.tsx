import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRightIcon,
  CalendarIcon,
  ChevronDownIcon,
  DollarSignIcon,
  ShoppingBagIcon,
  UserIcon,
} from "lucide-react";

import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { PendingTasks } from "@/components/dashboard/pending-tasks";
import { PersonRow } from "@/components/dashboard/person-row";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TipCard } from "@/components/dashboard/tip-card";
import { TreatmentsDonut } from "@/components/dashboard/treatments-donut";
import { DashboardHero } from "@/components/shared/dashboard-hero";
import { StatCard, type StatCardProps } from "@/components/shared/stat-card";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";
import { formatMoney, getCurrencySymbol } from "@/lib/currency";
import { getTenantConfig } from "@/lib/tenant-config";
import { getCitasHoyCount, getProximasCitas } from "@/services/citas.service";
import {
  getActiveClientesCount,
  getMonthlyRevenue,
  getNewClientes,
  getRevenueByMonth,
  getTopTreatments,
} from "@/services/dashboard.service";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const NUMBER_FORMAT = new Intl.NumberFormat("es-AR");

// Widgets that still use seed data — keep until their backing tables ship.
// Each one is tagged so it's obvious during reviews and easy to grep.
//   productosBajos → needs `inventory` table
//   tareas         → needs `tasks` table
const DEMO = {
  productosBajos: 7,
  tasks: [
    { id: "1", label: "Confirmar citas de mañana" },
    { id: "2", label: "Reponer ampollas vitamina C" },
    { id: "3", label: "Capacitación: Microneedling", done: true },
    { id: "4", label: "Enviar promociones de mayo" },
  ],
} as const;

const CLIENT_TONES = ["balsam", "aquatone", "artemis", "dustyRose"] as const;

/**
 * "Próximas citas" timestamp:
 *   · Today  → "Hoy · 22:59"
 *   · Tomorrow → "Mañana · 11:00"
 *   · Otherwise → "vie 15 may · 11:00"
 * Day comparison happens in the tenant TZ so a 23:00 cita in AR doesn't
 * read as "tomorrow" just because the request runs through a UTC server.
 */
function formatCitaWhen(startAt: string, timezone: string, now: Date): string {
  const start = new Date(startAt);
  const timeFmt = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  const startDay = dayKey(start);
  const todayDay = dayKey(now);
  const tomorrowDay = dayKey(new Date(now.getTime() + 86_400_000));
  const time = timeFmt.format(start);

  if (startDay === todayDay) return `Hoy · ${time}`;
  if (startDay === tomorrowDay) return `Mañana · ${time}`;
  const dayFmt = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  });
  return `${dayFmt.format(start)} · ${time}`;
}

export default async function ProfesionalDashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente"
  ) {
    redirect(dashboardForRole(session.profile.role));
  }

  const fullName =
    session.profile.full_name ??
    (session.user.user_metadata?.full_name as string | undefined) ??
    session.user.email?.split("@")[0] ??
    "ahí";

  // All aggregators run in parallel — RLS-scoped to this tenant.
  const [
    activeClientes,
    monthlyRevenue,
    revenueByMonth,
    topTreatments,
    newClientes,
    citasHoy,
    proximasCitas,
    tenantConfig,
  ] = await Promise.all([
    getActiveClientesCount(),
    getMonthlyRevenue(),
    getRevenueByMonth(6),
    getTopTreatments(4),
    getNewClientes(4),
    getCitasHoyCount(),
    getProximasCitas(4),
    getTenantConfig(),
  ]);
  const now = new Date();

  const stats: StatCardProps[] = [
    {
      label: "Citas Hoy",
      value: NUMBER_FORMAT.format(citasHoy),
      icon: CalendarIcon,
      tone: "balsam",
      link: { href: ROUTES.agenda, label: "Ver calendario" },
    },
    {
      label: "Clientes Activos",
      value: NUMBER_FORMAT.format(activeClientes),
      icon: UserIcon,
      tone: "aquatone",
      link: { href: "/profesional/clientes", label: "Ver clientes" },
    },
    {
      label: "Ingresos del Mes",
      value: formatMoney(monthlyRevenue, tenantConfig.currency),
      icon: DollarSignIcon,
      tone: "artemis",
      link: { href: "/profesional/reportes", label: "Ver reportes" },
    },
    {
      // DEMO — waiting on inventory module.
      label: "Productos Bajos",
      value: NUMBER_FORMAT.format(DEMO.productosBajos),
      icon: ShoppingBagIcon,
      tone: "dustyRose",
      link: { href: "/profesional/inventario", label: "Ver inventario" },
    },
  ];

  const hasTreatments = topTreatments.slices.length > 0;
  const hasNewClientes = newClientes.length > 0;
  const hasProximasCitas = proximasCitas.length > 0;

  return (
    <div className="grid gap-8">
      <DashboardHero
        name={fullName}
        subtitle="Acá tenés un resumen del negocio hoy."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardSection
          title="Resumen de Ingresos"
          action={<PeriodSelector value="Últimos 6 meses" />}
          className="lg:col-span-2"
        >
          <RevenueChart
            data={revenueByMonth}
            currencySymbol={getCurrencySymbol(tenantConfig.currency)}
          />
        </DashboardSection>

        <DashboardSection
          title="Próximas citas"
          action={<SectionLink href={ROUTES.agenda} label="Ver agenda" />}
        >
          {hasProximasCitas ? (
            <ul className="flex flex-col gap-4">
              {proximasCitas.map((cita, idx) => (
                <li key={cita.id}>
                  <PersonRow
                    name={cita.clienteName}
                    detail={cita.servicioName ?? cita.title}
                    avatarTone={CLIENT_TONES[idx % CLIENT_TONES.length]}
                    meta={
                      <span className="rounded-full bg-muted px-2 py-1 font-medium text-foreground/80 tabular-nums">
                        {formatCitaWhen(cita.startAt, tenantConfig.timezone, now)}
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint copy="No hay citas próximas. Agendá una desde el calendario." />
          )}
        </DashboardSection>

        <DashboardSection title="Tratamientos más populares">
          {hasTreatments ? (
            <TreatmentsDonut
              data={topTreatments.slices}
              total={topTreatments.total}
            />
          ) : (
            <EmptyHint copy="Sin sesiones registradas todavía. Cargá un servicio y volvé acá." />
          )}
        </DashboardSection>

        <DashboardSection
          title="Clientes nuevos"
          action={
            <SectionLink href="/profesional/clientes" label="Ver todos" />
          }
        >
          {hasNewClientes ? (
            <ul className="flex flex-col gap-3.5">
              {newClientes.map((client, idx) => (
                <li key={client.id}>
                  <PersonRow
                    name={client.name}
                    detail={client.joined}
                    avatarTone={CLIENT_TONES[idx % CLIENT_TONES.length]}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint copy="Todavía no hay clientas registradas." />
          )}
        </DashboardSection>

        <div className="flex flex-col gap-4">
          <DashboardSection
            title="Tareas pendientes"
            action={<DemoBadge href="/profesional/tareas" />}
          >
            {/* DEMO — replace with real `tasks` query when that module lands. */}
            <PendingTasks initialTasks={DEMO.tasks} />
          </DashboardSection>
          <TipCard
            className="flex-1"
            body="Llevá el control de tus tratamientos y mejorá la experiencia de tus clientas cada día."
          />
        </div>
      </div>
    </div>
  );
}

/** Header right-side link with arrow — used by sections backed by real data. */
function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-[#5C6E6C] underline-offset-4 hover:underline"
    >
      {label}
      <ArrowRightIcon className="size-3.5" aria-hidden />
    </Link>
  );
}

/**
 * Subtle "demo data" pill — shown on sections that still render seed
 * content until their backing tables land. Doubles as a link to the
 * (future) feature so the user can imagine where it's going.
 */
function DemoBadge({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:bg-muted"
    >
      Demo
      <ArrowRightIcon className="size-3" aria-hidden />
    </Link>
  );
}

function EmptyHint({ copy }: { copy: string }) {
  return (
    <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-center text-[12px] text-muted-foreground">
      {copy}
    </p>
  );
}

/** Placeholder period selector — non-interactive until reports lands. */
function PeriodSelector({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 hover:bg-muted"
    >
      {value}
      <ChevronDownIcon className="size-3.5" aria-hidden />
    </button>
  );
}
