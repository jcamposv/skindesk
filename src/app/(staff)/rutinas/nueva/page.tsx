import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RutinaBuilder } from "@/components/rutinas/builder/rutina-builder";
import type { BuilderInitial } from "@/components/rutinas/builder/types";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";
import {
  RUTINA_FORM_DEFAULTS,
  type RutinaMomento,
} from "@/schemas/rutinas.schema";
import { getClienteById, getClientesForPicker } from "@/services/clientes.service";
import { listProductosForBuilder } from "@/services/productos.service";

export const metadata: Metadata = { title: "Nueva rutina" };
interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.trim() ? v.trim() : undefined;
}

export default async function NuevaRutinaPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    redirect(dashboardForRole(session.profile.role));
  }
  if (session.profile.role === "super_admin" || !session.profile.tenant_id) {
    redirect(ROUTES.superAdmin);
  }

  const sp = await searchParams;
  // When launched from the cliente detail page (`?cliente=<id>`), the
  // builder pre-selects the clienta and flips kind to "assignment".
  const clienteId = asString(sp.cliente);

  // Kick off the catalog fetch but DON'T await it — pass the promise to
  // the client builder, which suspends on it inside its own `<Suspense>`
  // (audit Phase 3). The catalog query is the slowest server-side block
  // in the app (~300–800 ms with photo signing); removing it from the
  // critical path lets the builder shell render immediately.
  const productosPromise = listProductosForBuilder();

  // Two awaited fetches in parallel — both are small and feed the
  // immediate UI: the cliente picker (header combobox) and the cliente
  // name (pre-selected when ?cliente=<id>).
  const [clientes, clienteForName] = await Promise.all([
    getClientesForPicker(),
    clienteId ? getClienteById(clienteId) : Promise.resolve(null),
  ]);
  const clientName = clienteForName?.profile.full_name ?? null;

  const initial: BuilderInitial = {
    ...RUTINA_FORM_DEFAULTS,
    rutinaId: null,
    name: "",
    kind: clienteId ? ("assignment" as const) : ("template" as const),
    momento: "both" as RutinaMomento,
    skinType: "",
    skinCondition: "",
    mainObjective: "",
    generalNotes: "",
    tags: [],
    clienteId: clienteId ?? "",
    fromTemplateId: "",
    clientMessage: "",
    steps: [],
  };

  return (
    <RutinaBuilder
      initial={initial}
      productosPromise={productosPromise}
      clientes={clientes}
      clientName={clientName}
    />
  );
}
