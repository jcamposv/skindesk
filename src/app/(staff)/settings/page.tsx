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

export const metadata: Metadata = { title: "Ajustes" };

const ROLE_LABEL = {
  super_admin: "Super admin",
  profesional: "Profesional",
  asistente: "Asistente",
  clienta: "Clienta",
} as const;

export default async function SettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (session.profile.role === "clienta") {
    redirect(dashboardForRole("clienta"));
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Ajustes</h2>
        <p className="text-sm text-muted-foreground">
          Gestiona tu cuenta y preferencias.
        </p>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <CardDescription>Información básica de tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Email:</span>{" "}
            <span>{session.profile.email}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Nombre:</span>{" "}
            <span>{session.profile.full_name ?? "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Rol:</span>{" "}
            <span>{ROLE_LABEL[session.profile.role]}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
