import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CalendarIcon,
  DollarSignIcon,
  ShoppingBagIcon,
  UserIcon,
} from "lucide-react";

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

// MOCK DATA — wire to real queries when the corresponding domains ship
// (agenda → citas table; clientes activos → profiles + last_visit_at;
// ingresos del mes → invoices/transactions; productos bajos → inventory
// table with stock thresholds).
const MOCK = {
  citasHoy: 8,
  clientesActivos: 156,
  ingresosMes: 24680,
  productosBajos: 7,
} as const;

export default async function ProfesionalDashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  // Profesional and asistente share this dashboard. Anyone else gets
  // routed to their own.
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
    </div>
  );
}
