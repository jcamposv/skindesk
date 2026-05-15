import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { CameraIcon, FolderOpenIcon, HistoryIcon } from "lucide-react";

import { ClienteCitasWidget } from "@/components/citas/cliente-citas-widget";
import { ClienteDetailHeader } from "@/components/clientes/cliente-detail-header";
import { ClienteDetailTabs } from "@/components/clientes/cliente-detail-tabs";
import {
  TABS,
  type TabKey,
} from "@/components/clientes/cliente-detail-tabs-config";
import { DatosPersonalesForm } from "@/components/clientes/datos-personales-form";
import { EmptyTab } from "@/components/clientes/empty-tab";
import { EvaluacionTab } from "@/components/clientes/evaluacion-tab";
import { ObjetivosTab } from "@/components/clientes/objetivos-tab";
import { PagosTabServer } from "@/components/clientes/tabs/pagos-tab-server";
import { RutinasTabServer } from "@/components/clientes/tabs/rutinas-tab-server";
import { ServiciosTabServer } from "@/components/clientes/tabs/servicios-tab-server";
import { TabSkeleton } from "@/components/clientes/tabs/tab-skeleton";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";
import { getCitasForCliente } from "@/services/citas.service";
import { getClienteById } from "@/services/clientes.service";
import { getEvaluacionForCliente } from "@/services/evaluaciones.service";
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

/**
 * Cliente detail page — split into a "fast critical block" + per-tab
 * Suspense streaming (audit Phase 2).
 *
 *  - Critical block: `cliente`, `evaluacion`, `citas`, `staff` are awaited
 *    in parallel so the header, citas widget, and the active "datos" tab
 *    can render immediately.
 *  - Heavy tabs (Rutinas, Servicios, Pagos) live behind `<Suspense>`
 *    boundaries and stream in independently — the page shell never waits
 *    for `getServiciosForCliente` (heavy photo-URL signing) or
 *    `getPaymentPlansForCliente` to resolve.
 *  - Library rutinas are no longer fetched here at all; the
 *    `LibraryPickerDialog` fetches them lazily via SWR on first open
 *    (`listLibraryTemplatesForPickerAction`).
 */
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

  // Critical-path fetches only — every other tab streams via Suspense.
  const [cliente, evaluacion, staff, citas] = await Promise.all([
    getClienteById(id),
    getEvaluacionForCliente(id),
    getStaffForTenant(session.profile.tenant_id ?? ""),
    getCitasForCliente(id),
  ]);
  if (!cliente) notFound();

  const clientName = cliente.profile.full_name ?? "esta clienta";

  return (
    <div className="grid min-w-0 gap-4">
      <ClienteDetailHeader
        cliente={cliente}
        evaluacion={evaluacion}
        staff={staff}
        currentProfesional={{
          id: session.profile.id,
          full_name: session.profile.full_name ?? "",
        }}
      />
      <ClienteCitasWidget
        upcoming={citas.upcoming}
        recent={citas.recent}
      />
      <ClienteDetailTabs
        initialTab={parseTab(sp.tab)}
        datosSlot={<DatosPersonalesForm cliente={cliente} />}
        evaluacionSlot={
          <EvaluacionTab cliente={cliente} initialEvaluacion={evaluacion} />
        }
        objetivosSlot={
          <ObjetivosTab cliente={cliente} evaluacion={evaluacion} />
        }
        rutinasSlot={
          <Suspense fallback={<TabSkeleton />}>
            <RutinasTabServer
              clienteId={cliente.id}
              clientName={clientName}
            />
          </Suspense>
        }
        pagosSlot={
          <Suspense fallback={<TabSkeleton />}>
            <PagosTabServer clienteId={cliente.id} />
          </Suspense>
        }
        serviciosSlot={
          <Suspense fallback={<TabSkeleton />}>
            <ServiciosTabServer
              cliente={cliente}
              staff={staff}
              currentProfesional={{
                professionalId: session.profile.id,
                professionalLabel: "",
              }}
            />
          </Suspense>
        }
        archivosSlot={
          <EmptyTab
            icon={FolderOpenIcon}
            title="Archivos"
            description="Documentos firmados, consentimientos, recetas y otros archivos clínicos asociados a la clienta."
            preview={[
              "Consentimientos firmados",
              "Recetas y derivaciones",
              "Resultados de laboratorio",
              "Archivos compartidos por la clienta",
            ]}
          />
        }
        historialSlot={
          <EmptyTab
            icon={HistoryIcon}
            title="Historial"
            description="Línea de tiempo cronológica de citas, sesiones, notas, mensajes y cambios — el registro completo del recorrido de tu clienta."
            preview={[
              "Citas, sesiones y no-show",
              "Notas técnicas por evento",
              "Cambios de plan y motivos",
              "Mensajes y recordatorios enviados",
            ]}
          />
        }
        fotosSlot={
          <EmptyTab
            icon={CameraIcon}
            title="Fotos de evolución"
            description="Galería visual antes/después organizada por sesión, con comparador lateral y zoom para mostrarle a tu clienta el progreso real."
            preview={[
              "Galería ordenada por sesión",
              "Comparador antes / después",
              "Vistas frontal, perfil y oblicua",
              "Compartir álbum con la clienta",
            ]}
          />
        }
      />
    </div>
  );
}
