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

export const metadata: Metadata = { title: "Panel global · Super admin" };

export default async function SuperAdminPage() {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (session.profile.role !== "super_admin") {
    redirect(dashboardForRole(session.profile.role));
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Panel global
        </h2>
        <p className="text-sm text-muted-foreground">
          Gestión de tenants, usuarios y métricas a nivel plataforma.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Tenants</CardTitle>
            <CardDescription>Clínicas registradas en SkinDesk.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Próximamente.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Usuarios</CardTitle>
            <CardDescription>Profesionales, asistentes y clientas.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Próximamente.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Salud de la plataforma</CardTitle>
            <CardDescription>Errores, latencia y uso.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Próximamente.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
