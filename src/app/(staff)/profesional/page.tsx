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
const USD_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Widgets that still use seed data — keep until their backing tables ship.
// Each one is tagged so it's obvious during reviews and easy to grep.
//   citasHoy / próximas citas → needs `citas` table (agenda module)
//   productosBajos            → needs `inventory` table
//   tareas                    → needs `tasks` table
const DEMO = {
  citasHoy: 8,
  productosBajos: 7,
  upcoming: [
    {
      id: "1",
      name: "María Gómez",
      service: "Limpieza Facial Profunda",
      time: "09:00",
      tone: "balsam" as const,
    },
    {
      id: "2",
      name: "Sofía Hernández",
      service: "Hidratación con Dermapen",
      time: "11:30",
      tone: "aquatone" as const,
    },
    {
      id: "3",
      name: "Paula Torres",
      service: "Radiofrecuencia Facial",
      time: "01:00 PM",
      tone: "artemis" as const,
    },
    {
      id: "4",
      name: "Daniela Ruiz",
      service: "Peeling Químico",
      time: "03:30 PM",
      tone: "dustyRose" as const,
    },
  ],
  tasks: [
    { id: "1", label: "Confirmar citas de mañana" },
    { id: "2", label: "Reponer ampollas vitamina C" },
    { id: "3", label: "Capacitación: Microneedling", done: true },
    { id: "4", label: "Enviar promociones de mayo" },
  ],
} as const;

const CLIENT_TONES = ["balsam", "aquatone", "artemis", "dustyRose"] as const;

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

  // All five aggregators run in parallel — RLS-scoped to this tenant.
  const [
    activeClientes,
    monthlyRevenue,
    revenueByMonth,
    topTreatments,
    newClientes,
  ] = await Promise.all([
    getActiveClientesCount(),
    getMonthlyRevenue(),
    getRevenueByMonth(6),
    getTopTreatments(4),
    getNewClientes(4),
  ]);

  const stats: StatCardProps[] = [
    {
      // DEMO — waiting on agenda module.
      label: "Citas Hoy",
      value: NUMBER_FORMAT.format(DEMO.citasHoy),
      icon: CalendarIcon,
      tone: "balsam",
      link: { href: "/profesional/agenda", label: "Ver calendario" },
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
      value: USD_FORMAT.format(monthlyRevenue),
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
          <RevenueChart data={revenueByMonth} />
        </DashboardSection>

        <DashboardSection
          title="Próximas citas"
          action={<DemoBadge href="/profesional/agenda" />}
        >
          {/* DEMO — replace with real `citas` query when agenda lands. */}
          <ul className="flex flex-col gap-4">
            {DEMO.upcoming.map((appt) => (
              <li key={appt.id}>
                <PersonRow
                  name={appt.name}
                  detail={appt.service}
                  avatarTone={appt.tone}
                  meta={
                    <span className="rounded-full bg-muted px-2 py-1 font-medium text-foreground/80 tabular-nums">
                      {appt.time}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
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
