import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockIcon, SparklesIcon, UsersIcon } from "lucide-react";

import { AddClientaSheet } from "@/components/clientes/add-cliente-sheet";
import { ClientesTable } from "@/components/clientes/clientes-table";
import { ClienteStatusBadge } from "@/components/clientes/cliente-status-badge";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import {
  CLIENTE_STATUSES,
  type ClienteStatus,
} from "@/schemas/clientes.schema";
import {
  getClienteStatusCounts,
  listClientes,
} from "@/services/clientes.service";

export const metadata: Metadata = {
  title: "Clientes",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseInteger(
  raw: string | string[] | undefined,
  fallback: number,
): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseString(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.trim() ? v.trim() : undefined;
}

function parseStatus(
  raw: string | string[] | undefined,
): ClienteStatus | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return undefined;
  return (CLIENTE_STATUSES as readonly string[]).includes(v)
    ? (v as ClienteStatus)
    : undefined;
}

export default async function ClientesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);

  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    redirect(dashboardForRole(session.profile.role));
  }

  // Asistente needs `clientas:view` to see the list.
  if (session.profile.role === "asistente") {
    const perms = (session.profile.permissions ?? {}) as Record<
      string,
      string | null
    >;
    if (perms.clientas !== "view" && perms.clientas !== "edit") {
      return <NoPermissionState />;
    }
  }

  const sp = await searchParams;
  const page = parseInteger(sp.page, 1);
  const pageSize = parseInteger(sp.pageSize, 20);
  const search = parseString(sp.search);
  const status = parseStatus(sp.filter_status);

  const supabase = await createClient();
  const [list, counts] = await Promise.all([
    listClientes(supabase, { page, pageSize, search, status }),
    getClienteStatusCounts(supabase),
  ]);

  const canCreate =
    session.profile.role === "profesional" ||
    (session.profile.role === "asistente" &&
      ((session.profile.permissions ?? {}) as Record<string, string | null>)
        .clientas === "edit");

  const firstName = (session.profile.full_name ?? "").split(" ")[0] || "tu equipo";

  return (
    <div className="grid gap-6">
      {/* Hero header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6E0D6] px-2.5 py-1 text-xs font-medium text-[#8C4A30]">
            <SparklesIcon className="size-3" />
            Centro de gestión
          </span>
          <h1 className="font-heading mt-3 text-2xl font-medium tracking-tight sm:text-3xl">
            Clientes
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Toda la información de tus clientas centralizada — fichas, rutinas,
            citas y evolución. Empieza agregando una nueva, {firstName}.
          </p>
        </div>
        {canCreate ? <AddClientaSheet /> : null}
      </header>

      {/* Stats strip */}
      <section
        aria-label="Resumen de clientas"
        className="grid grid-cols-2 gap-3 sm:grid-cols-5"
      >
        <StatChip
          label="Total"
          value={counts.total}
          tone="neutral"
          highlight
        />
        {CLIENTE_STATUSES.map((s) => (
          <StatChip
            key={s}
            label={statusLabel(s)}
            value={counts[s]}
            statusBadge={s}
          />
        ))}
      </section>

      {/* Table card */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <ClientesTable rows={list.rows} total={list.total} />
      </div>
    </div>
  );
}

function statusLabel(s: ClienteStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface StatChipProps {
  label: string;
  value: number;
  statusBadge?: ClienteStatus;
  tone?: "neutral";
  highlight?: boolean;
}

function StatChip({ label, value, statusBadge, highlight }: StatChipProps) {
  return (
    <div
      className={`group flex flex-col gap-2 rounded-xl border bg-card p-3.5 transition-colors ${
        highlight
          ? "border-[#5C6E6C]/15 bg-[#F4F1EC]"
          : "hover:border-foreground/15"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {statusBadge ? (
          <ClienteStatusBadge status={statusBadge} size="sm" />
        ) : (
          <UsersIcon className="size-3.5 text-muted-foreground" />
        )}
      </div>
      <div className="font-heading text-2xl font-medium tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

function NoPermissionState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="rounded-full bg-muted p-4">
        <LockIcon className="size-6 text-muted-foreground" />
      </div>
      <h2 className="font-heading mt-4 text-xl font-medium">
        Acceso restringido
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Tu cuenta no tiene permisos para ver esta sección. Pedile a tu
        cosmetóloga que active el permiso de “Clientas”.
      </p>
    </div>
  );
}
