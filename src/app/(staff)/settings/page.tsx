import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createBillingPortalSessionAction } from "@/actions/billing.actions";
import { SubscriptionToggleDialog } from "@/components/billing/cancel-subscription-dialog";
import { PortalReturnRefresh } from "@/components/billing/portal-return-refresh";
import { CurrencySettingsCard } from "@/components/settings/currency-settings-card";
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
import { getTenantConfig } from "@/lib/tenant-config";
import type { Database } from "@/types/database.types";

export const metadata: Metadata = { title: "Ajustes" };

const ROLE_LABEL = {
  super_admin: "Super admin",
  profesional: "Profesional",
  asistente: "Asistente",
  clienta: "Clienta",
} as const;

type Status = Database["public"]["Enums"]["subscription_status"];

const HARD_GATE_STATUSES: ReadonlySet<Status> = new Set<Status>([
  "canceled",
  "unpaid",
  "incomplete_expired",
]);

const DATE_FORMAT = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

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

  // `getTenantConfig` is React.cache'd against the layout's call, so
  // this only costs one round-trip per request.
  const tenantConfig = await getTenantConfig();

  const planConfig = session.tenant?.plan
    ? PLAN_BY_SLUG[session.tenant.plan]
    : null;
  // Only the tenant-owning profesional (or super_admin) edits financial
  // settings. Asistente sees the current value but can't change it.
  const canEditFinancials =
    (session.profile.role === "profesional" && Boolean(session.tenant)) ||
    session.profile.role === "super_admin";
  const status = session.tenant?.subscription_status ?? null;
  const cancelAtPeriodEnd = session.tenant?.cancel_at_period_end ?? false;
  const currentPeriodEnd = session.tenant?.current_period_end ?? null;
  const billingInterval = session.tenant?.billing_interval ?? null;
  const isHardGated = status ? HARD_GATE_STATUSES.has(status) : false;
  // Asistente sees the plan but can't manage billing — only the profesional
  // who owns the tenant should reach the portal. Super_admin has no tenant.
  const canManageBilling =
    session.profile.role === "profesional" && Boolean(session.tenant);

  // Three states share one row: terminating (cancel scheduled / hard-gated)
  // shows "termina/venció el …"; healthy active|trialing shows the next
  // renewal; everything else hides the row.
  const isTerminating = cancelAtPeriodEnd || isHardGated;
  const showRenewal =
    !isTerminating &&
    (status === "active" || status === "trialing") &&
    Boolean(currentPeriodEnd);

  const periodEndLabel =
    currentPeriodEnd && (isTerminating || showRenewal)
      ? DATE_FORMAT.format(new Date(currentPeriodEnd))
      : null;

  const renewalRowLabel = isTerminating
    ? cancelAtPeriodEnd
      ? "Termina el"
      : "Vencimiento"
    : status === "trialing"
      ? "Tu prueba termina el"
      : billingInterval === "year"
        ? "Próxima renovación anual"
        : "Próxima renovación";

  return (
    <div className="grid gap-4">
      {/* Auto-refresh after the user returns from the Stripe Billing
          Portal — closes the gap between Stripe's redirect and the webhook. */}
      <Suspense fallback={null}>
        <PortalReturnRefresh />
      </Suspense>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Ajustes</h2>
        <p className="text-sm text-muted-foreground">
          {isHardGated
            ? "Reactivá tu suscripción para volver a usar SkinDesk."
            : "Gestiona tu cuenta y preferencias."}
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

      <CurrencySettingsCard
        initialCurrency={tenantConfig.currency}
        canEdit={canEditFinancials}
      />

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
              <span className="font-medium">
                {planConfig.name}
                {billingInterval ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({billingInterval === "year" ? "anual" : "mensual"})
                  </span>
                ) : null}
              </span>
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
            {periodEndLabel ? (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{renewalRowLabel}</span>
                <span className="font-medium tabular-nums text-foreground/80">
                  {periodEndLabel}
                </span>
              </div>
            ) : null}
          </CardContent>
          {canManageBilling ? (
            <CardFooter className="flex flex-col gap-3">
              {/*
                Reactivate is the primary action when a cancel is already
                scheduled — surfaces it above "manage" so the path back is
                obvious. Otherwise the manage portal is primary and the
                cancel-dialog is a secondary destructive option.
              */}
              {cancelAtPeriodEnd && status && !HARD_GATE_STATUSES.has(status) ? (
                <SubscriptionToggleDialog
                  variant="reactivate"
                  periodEnd={currentPeriodEnd}
                />
              ) : null}
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
              {/* Cancel only makes sense for healthy subscriptions that
                  aren't already winding down. */}
              {status &&
              !HARD_GATE_STATUSES.has(status) &&
              !cancelAtPeriodEnd ? (
                <SubscriptionToggleDialog
                  variant="cancel"
                  periodEnd={currentPeriodEnd}
                />
              ) : null}
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
