import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ClienteDetailHeader } from "@/components/clientes/cliente-detail-header";
import { ClienteDetailTabs } from "@/components/clientes/cliente-detail-tabs";
import {
  TABS,
  type TabKey,
} from "@/components/clientes/cliente-detail-tabs-config";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";
import { getClienteById } from "@/services/clientes.service";
import { getEvaluacionForCliente } from "@/services/evaluaciones.service";
import { getServiciosForCliente } from "@/services/servicios.service";
import { getStaffForTenant } from "@/services/staff.service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  // `getClienteById` is wrapped in React.cache() — this call and the page
  // body call below share a single DB round-trip per request.
  const cliente = await getClienteById(id).catch(() => null);
  const name = cliente?.profile.full_name ?? "Clienta";
  return { title: `${name} · Clientes` };
}

function parseTab(
  raw: string | string[] | undefined,
): TabKey | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return undefined;
  const match = TABS.find((t) => t.key === v);
  return match?.key;
}

export default async function ClienteDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);

  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    redirect(dashboardForRole(session.profile.role));
  }

  // Both queries are independent — `getEvaluacionForCliente` only needs
  // the URL id (which equals cliente.id when the cliente exists; RLS will
  // return null otherwise). Promise.all saves ~50ms vs awaiting in series.
  const [cliente, evaluacion, servicios, staff] = await Promise.all([
    getClienteById(id),
    getEvaluacionForCliente(id),
    getServiciosForCliente(id),
    getStaffForTenant(session.profile.tenant_id ?? ""),
  ]);
  if (!cliente) notFound();

  return (
    <div className="grid min-w-0 gap-4">
      <ClienteDetailHeader cliente={cliente} evaluacion={evaluacion} />
      <ClienteDetailTabs
        cliente={cliente}
        evaluacion={evaluacion}
        servicios={servicios}
        staff={staff}
        currentProfesional={{
          professionalId: session.profile.id,
          professionalLabel: "",
        }}
        initialTab={parseTab(sp.tab)}
      />
    </div>
  );
}
