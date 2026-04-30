import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

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

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Hola, {fullName}
        </h2>
        <p className="text-sm text-muted-foreground">
          Bienvenida a tu panel para gestionar agenda, clientas y tratamientos.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Agenda de hoy</CardTitle>
            <CardDescription>Próximas citas confirmadas.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Próximamente.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Clientas activas</CardTitle>
            <CardDescription>Histórico y seguimientos abiertos.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Próximamente.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ingresos del mes</CardTitle>
            <CardDescription>Pagos y tratamientos cobrados.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Próximamente.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
