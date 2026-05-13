import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RutinaBuilder } from "@/components/rutinas/builder/rutina-builder";
import type {
  BuilderInitial,
  BuilderProducto,
} from "@/components/rutinas/builder/types";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";
import {
  RUTINA_FORM_DEFAULTS,
  type RutinaMomento,
} from "@/schemas/rutinas.schema";
import { getClienteById, getClientesForPicker } from "@/services/clientes.service";
import { listProductosForBuilder } from "@/services/productos.service";

export const metadata: Metadata = { title: "Nueva rutina" };
export const dynamic = "force-dynamic";

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
  let clientName: string | null = null;
  if (clienteId) {
    const cliente = await getClienteById(clienteId);
    clientName = cliente?.profile.full_name ?? null;
  }

  const [catalog, clientes] = await Promise.all([
    listProductosForBuilder(),
    getClientesForPicker(),
  ]);
  const productosRows = catalog.items;
  const catalogCappedAt = catalog.isCapped ? catalog.totalMatching : null;

  const productos = productosRows.map(toBuilderProducto);

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
      productos={productos}
      clientes={clientes}
      clientName={clientName}
      catalogCappedAt={catalogCappedAt}
    />
  );
}

function toBuilderProducto(p: {
  id: string;
  name: string;
  brand: string | null;
  category: BuilderProducto["category"];
  main_ingredients: string[];
  application_instruction: string | null;
  suggested_amount: string | null;
  absorption_time: string | null;
  frequency: string | null;
  time_of_day: BuilderProducto["timeOfDay"];
  photoUrl: string | null;
}): BuilderProducto {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    photoUrl: p.photoUrl,
    mainIngredients: p.main_ingredients ?? [],
    applicationInstruction: p.application_instruction,
    suggestedAmount: p.suggested_amount,
    absorptionTime: p.absorption_time,
    frequency: p.frequency,
    timeOfDay: p.time_of_day,
  };
}
