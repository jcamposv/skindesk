import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  BanknoteIcon,
  BanIcon,
  CalendarIcon,
  CircleDashedIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  SmartphoneIcon,
  StickyNoteIcon,
  UserIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import {
  METHOD_LABEL,
  STATUS_LABEL,
  STATUS_VISUAL,
  type PaymentMethod,
  type PaymentStatus,
} from "@/components/clientes/pagos/types";
import { SERVICE_VISUAL } from "@/components/clientes/servicios/service-type-visual";
import { SERVICE_TYPE_LABEL } from "@/components/clientes/servicios/types";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getCurrentSession } from "@/lib/supabase/server";
import { getTenantConfig } from "@/lib/tenant-config";
import {
  getPaymentTransactionById,
  getServicioSessionsProgress,
} from "@/services/pagos.service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const METHOD_ICON: Record<PaymentMethod, LucideIcon> = {
  efectivo: BanknoteIcon,
  transferencia: ArrowLeftRightIcon,
  tarjeta: CreditCardIcon,
  codi: SmartphoneIcon,
  otro: CircleDashedIcon,
};

const DATE_FORMAT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const DATETIME_FORMAT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatPaidAt(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return DATE_FORMAT.format(new Date(Date.UTC(y, m - 1, d)));
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATETIME_FORMAT.format(d);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const tx = await getPaymentTransactionById(id).catch(() => null);
  if (!tx) return { title: "Pago · SkinDesk" };
  return { title: `Pago · ${tx.cliente.fullName}` };
}

export default async function PagoDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    redirect(dashboardForRole(session.profile.role));
  }

  const [tx, tenantConfig] = await Promise.all([
    getPaymentTransactionById(id),
    getTenantConfig(),
  ]);
  if (!tx) notFound();

  const sessions = tx.servicio
    ? await getServicioSessionsProgress(tx.servicio.id)
    : null;

  // Bind the formatter once so the JSX below stays readable. The currency
  // travels through the Server Component as a prop substitute via this
  // closure — no provider needed because nothing inside is interactive.
  // Detail pages show exact values (cents matter on per-tx amounts and
  // plan totals), so we force 2 fraction digits here.
  const fmt = (n: number) =>
    formatMoney(n, tenantConfig.currency, { maximumFractionDigits: 2 });

  const MethodIcon = METHOD_ICON[tx.method];
  const status: PaymentStatus | null = tx.plan?.status ?? null;
  const serviceVisual = tx.servicio
    ? SERVICE_VISUAL[tx.servicio.serviceType]
    : null;
  const ServiceIcon = serviceVisual?.icon ?? null;
  const isVoided = Boolean(tx.voidedAt);

  return (
    <div className="grid min-w-0 gap-4">
      <header className="flex flex-col gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5"
            render={<Link href={ROUTES.pagos} />}
          >
            <ArrowLeftIcon className="size-3.5" />
            Volver a Pagos
          </Button>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Pago registrado
            </p>
            <h1 className="font-heading mt-1 text-2xl font-medium tracking-tight sm:text-3xl">
              {fmt(tx.amount)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPaidAt(tx.paidAt)} · {METHOD_LABEL[tx.method]}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {status ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium",
                  STATUS_VISUAL[status].tone,
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    STATUS_VISUAL[status].dot,
                  )}
                />
                {STATUS_LABEL[status]}
              </span>
            ) : null}
            {isVoided ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-[12px] font-medium text-destructive">
                <BanIcon className="size-3.5" />
                Pago anulado
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {isVoided ? (
        <section
          aria-label="Pago anulado"
          className="grid gap-1 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
        >
          <p className="inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-destructive">
            <BanIcon className="size-3.5" />
            Anulado el {tx.voidedAt ? formatTimestamp(tx.voidedAt) : "—"}
          </p>
          {tx.voidReason ? (
            <p className="text-[13px] text-destructive/90">{tx.voidReason}</p>
          ) : null}
          <p className="text-[11.5px] text-destructive/70">
            Este pago no cuenta en los rollups del plan, pero queda en el
            registro para auditoría.
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Payment info */}
        <section
          aria-labelledby="payment-info"
          className="grid gap-3 rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2"
        >
          <header className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#F4F1EC] text-[#BB7154]">
              <WalletIcon className="size-4" />
            </span>
            <h2
              id="payment-info"
              className="font-heading text-base font-medium tracking-tight"
            >
              Detalle del pago
            </h2>
          </header>

          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <DetailRow label="Monto pagado" value={fmt(tx.amount)} />
            <DetailRow
              label="Fecha de pago"
              value={formatPaidAt(tx.paidAt)}
              icon={CalendarIcon}
            />
            <DetailRow
              label="Método"
              value={METHOD_LABEL[tx.method]}
              icon={MethodIcon}
            />
            <DetailRow label="Concepto" value={tx.concept || "—"} />
            <DetailRow
              label="Registrado por"
              value={tx.registeredBy ?? "Sistema"}
            />
            <DetailRow
              label="Creado"
              value={formatTimestamp(tx.createdAt)}
            />
            <DetailRow
              label="Actualizado"
              value={formatTimestamp(tx.updatedAt)}
            />
          </dl>

          {tx.notes ? (
            <div className="mt-2 rounded-xl border border-dashed bg-muted/30 p-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <StickyNoteIcon className="size-3.5" />
                Notas
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">
                {tx.notes}
              </p>
            </div>
          ) : null}
        </section>

        {/* Cliente card */}
        <section
          aria-labelledby="cliente-info"
          className="grid gap-3 rounded-2xl border bg-card p-5 shadow-sm"
        >
          <header className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#F6E0D6] text-[#8C4A30]">
              <UserIcon className="size-4" />
            </span>
            <h2
              id="cliente-info"
              className="font-heading text-base font-medium tracking-tight"
            >
              Clienta
            </h2>
          </header>
          <p className="text-[15px] font-medium text-foreground">
            {tx.cliente.fullName}
          </p>
          {tx.cliente.id ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              render={<Link href={`${ROUTES.clientes}/${tx.cliente.id}`} />}
            >
              Ver perfil de la clienta
              <ExternalLinkIcon className="size-3.5" />
            </Button>
          ) : null}
        </section>
      </div>

      {/* Servicio + plan progress */}
      {tx.servicio && tx.plan ? (
        <section
          aria-labelledby="servicio-info"
          className="grid gap-4 rounded-2xl border bg-card p-5 shadow-sm"
        >
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {serviceVisual && ServiceIcon ? (
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    serviceVisual.iconBg,
                    serviceVisual.iconColor,
                  )}
                >
                  <ServiceIcon className="size-5" />
                </span>
              ) : null}
              <div className="min-w-0">
                <p
                  id="servicio-info"
                  className="font-heading text-base font-medium tracking-tight"
                >
                  {tx.servicio.name}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {SERVICE_TYPE_LABEL[tx.servicio.serviceType]}
                  {sessions && sessions.total > 0
                    ? ` · ${sessions.completed} / ${sessions.total} ${sessions.total === 1 ? "sesión" : "sesiones"}`
                    : ""}
                  {tx.sesion
                    ? ` · Asociado a sesión ${tx.sesion.sessionNumber}`
                    : ""}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              render={
                <Link
                  href={`${ROUTES.clientes}/${tx.cliente.id}?tab=servicios`}
                />
              }
            >
              Ver servicio
              <ExternalLinkIcon className="size-3.5" />
            </Button>
          </header>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-dashed bg-card/40 px-4 py-3 sm:grid-cols-4">
            <MoneyTile
              label="Total del paquete"
              value={fmt(tx.plan.totalAmount)}
            />
            <MoneyTile
              label="Pagado acumulado"
              value={fmt(tx.plan.paidAmount)}
              tone="text-[#4F605C]"
            />
            <MoneyTile
              label="Saldo restante"
              value={fmt(tx.plan.balance)}
              tone={
                tx.plan.balance > 0
                  ? "text-[#8C4A30] font-semibold"
                  : "text-[#4F605C]"
              }
            />
            <MoneyTile
              label="Este pago"
              value={fmt(tx.amount)}
              tone="text-foreground font-semibold"
            />
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed bg-card/60 p-5 text-center">
          <p className="text-[13px] text-muted-foreground">
            Este pago no está asociado a un servicio. Se registra como pago
            general de la clienta.
          </p>
        </section>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="inline-flex items-center gap-1.5 text-[13.5px] text-foreground/90">
        {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
        {value}
      </dd>
    </div>
  );
}

function MoneyTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="grid gap-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
        {label}
      </p>
      <p
        className={cn(
          "truncate tabular-nums text-[14px] leading-tight",
          tone ?? "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
