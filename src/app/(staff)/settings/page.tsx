import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createBillingPortalSessionAction } from "@/actions/billing.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { PLAN_BY_SLUG } from "@/lib/plans";
import { getCurrentSession } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export const metadata: Metadata = { title: "Ajustes" };

const ROLE_LABEL = {
  super_admin: "Super admin",
  profesional: "Profesional",
  asistente: "Asistente",
  clienta: "Clienta",
} as const;

type Status = Database["public"]["Enums"]["subscription_status"];

const STATUS_LABEL: Record<Status, string> = {
  trialing: "En prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  incomplete: "Incompleta",
  incomplete_expired: "Expirada",
  unpaid: "Sin pagar",
};

const STATUS_VARIANT: Record<
  Status,
  "default" | "secondary" | "destructive" | "outline"
> = {
  trialing: "secondary",
  active: "default",
  past_due: "destructive",
  canceled: "outline",
  incomplete: "destructive",
  incomplete_expired: "destructive",
  unpaid: "destructive",
};

export default async function SettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (session.profile.role === "clienta") {
    redirect(dashboardForRole("clienta"));
  }

  const planConfig = session.tenant?.plan
    ? PLAN_BY_SLUG[session.tenant.plan]
    : null;
  const status = session.tenant?.subscription_status ?? null;
  // Asistente sees the plan but can't manage billing — only the profesional
  // who owns the tenant should reach the portal. Super_admin has no tenant.
  const canManageBilling =
    session.profile.role === "profesional" && Boolean(session.tenant);

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

      {planConfig ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Suscripción</CardTitle>
            <CardDescription>
              Plan actual y métodos de pago.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{planConfig.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estado</span>
              {status ? (
                <Badge variant={STATUS_VARIANT[status]}>
                  {STATUS_LABEL[status]}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </CardContent>
          {canManageBilling ? (
            <CardFooter>
              <form action={createBillingPortalSessionAction} className="w-full">
                <Button
                  type="submit"
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  Gestionar suscripción
                </Button>
              </form>
            </CardFooter>
          ) : (
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Solo la profesional dueña del tenant puede gestionar la
                suscripción.
              </p>
            </CardFooter>
          )}
        </Card>
      ) : null}
    </div>
  );
}
