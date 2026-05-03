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

export const metadata: Metadata = { title: "Dashboard" };

const NUMBER_FORMAT = new Intl.NumberFormat("es-AR");
const USD_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// MOCK DATA — wire to real queries when each domain ships:
//   citasHoy / próximas citas → `citas` table
//   clientesActivos / nuevos  → `profiles` + `last_visit_at`
//   ingresos / revenueSeries  → `invoices` aggregated by month
//   productosBajos            → `inventory` with stock thresholds
//   tratamientos              → `tratamientos` joined with `citas`
const MOCK = {
  citasHoy: 8,
  clientesActivos: 156,
  ingresosMes: 24680,
  productosBajos: 7,
  revenue: [
    { month: "Ene", amount: 18200 },
    { month: "Feb", amount: 16100 },
    { month: "Mar", amount: 19400 },
    { month: "Abr", amount: 17800 },
    { month: "May", amount: 30100 },
    { month: "Jun", amount: 24680 },
  ],
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
  treatments: {
    total: 112,
    slices: [
      { name: "Limpieza Facial Profunda", value: 45 },
      { name: "Hidratación con Dermapen", value: 33 },
      { name: "Radiofrecuencia Facial", value: 20 },
      { name: "Peeling Químico", value: 14 },
    ],
  },
  newClients: [
    { id: "1", name: "Ana Martínez", visits: 12, tone: "balsam" as const },
    { id: "2", name: "Lucía Ramírez", visits: 10, tone: "aquatone" as const },
    { id: "3", name: "Jenny García", visits: 9, tone: "artemis" as const },
    { id: "4", name: "Valeria Pérez", visits: 5, tone: "dustyRose" as const },
  ],
  tasks: [
    { id: "1", label: "Confirmar citas de mañana" },
    { id: "2", label: "Reponer ampollas vitamina C" },
    { id: "3", label: "Capacitación: Microneedling", done: true },
    { id: "4", label: "Enviar promociones de mayo" },
  ],
} as const;

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

  const stats: StatCardProps[] = [
    {
      label: "Citas Hoy",
      value: NUMBER_FORMAT.format(MOCK.citasHoy),
      icon: CalendarIcon,
      tone: "balsam",
      link: { href: "/profesional/agenda", label: "Ver calendario" },
    },
    {
      label: "Clientes Activos",
      value: NUMBER_FORMAT.format(MOCK.clientesActivos),
      icon: UserIcon,
      tone: "aquatone",
      link: { href: "/profesional/clientes", label: "Ver clientes" },
    },
    {
      label: "Ingresos del Mes",
      value: USD_FORMAT.format(MOCK.ingresosMes),
      icon: DollarSignIcon,
      tone: "artemis",
      link: { href: "/profesional/reportes", label: "Ver reportes" },
    },
    {
      label: "Productos Bajos",
      value: NUMBER_FORMAT.format(MOCK.productosBajos),
      icon: ShoppingBagIcon,
      tone: "dustyRose",
      link: { href: "/profesional/inventario", label: "Ver inventario" },
    },
  ];

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
          action={<PeriodSelector value="Este mes" />}
          className="lg:col-span-2"
        >
          <RevenueChart data={MOCK.revenue} />
        </DashboardSection>

        <DashboardSection
          title="Próximas citas"
          action={<SectionLink href="/profesional/agenda" label="Ver calendario" />}
        >
          <ul className="flex flex-col gap-4">
            {MOCK.upcoming.map((appt) => (
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
          <TreatmentsDonut
            data={MOCK.treatments.slices}
            total={MOCK.treatments.total}
          />
        </DashboardSection>

        <DashboardSection
          title="Clientes nuevos"
          action={<SectionLink href="/profesional/clientes" label="Ver todos" />}
        >
          <ul className="flex flex-col gap-3.5">
            {MOCK.newClients.map((client) => (
              <li key={client.id}>
                <PersonRow
                  name={client.name}
                  detail={`${client.visits} ${(client.visits as number) === 1 ? "visita" : "visitas"}`}
                  avatarTone={client.tone}
                />
              </li>
            ))}
          </ul>
        </DashboardSection>

        <div className="flex flex-col gap-4">
          <DashboardSection
            title="Tareas pendientes"
            action={<SectionLink href="/profesional/tareas" label="Ver todas" />}
          >
            <PendingTasks initialTasks={MOCK.tasks} />
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

/** Header right-side link with arrow — used by every list section. */
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
 * Placeholder period selector. Real one will use a Select primitive once
 * we wire the chart to a server action that re-fetches by range.
 */
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
