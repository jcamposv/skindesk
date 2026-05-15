import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { RutinaBuilder } from "@/components/rutinas/builder/rutina-builder";
import type {
  BuilderInitial,
  BuilderProducto,
  BuilderStep,
} from "@/components/rutinas/builder/types";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";
import {
  dbEnumToForm,
  RUTINA_MOMENTOS,
  type RutinaMomento,
} from "@/schemas/rutinas.schema";
import {
  PRODUCTO_ABSORPTION_TIMES,
  PRODUCTO_FREQUENCIES,
} from "@/schemas/productos.schema";
import {
  getClienteById,
  getClientesForPicker,
} from "@/services/clientes.service";
import { listProductosForBuilder } from "@/services/productos.service";
import { getRutinaWithSteps } from "@/services/rutinas.service";

export const metadata: Metadata = { title: "Editar rutina" };
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarRutinaPage({ params }: PageProps) {
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

  const { id } = await params;

  // Audit Phase 3: defer catalog (the slowest server-side block — 200
  // productos + bulk `createSignedUrls`) by passing the promise unawaited
  // to the client builder. It suspends on it inside its own boundary.
  const productosPromise = listProductosForBuilder();

  // Parallelize the previous waterfall — rutina + clientes-picker were
  // sequential. The cliente lookup (for the preselected name) still
  // depends on the rutina row, but is cached and tiny so a single extra
  // round-trip after the parallel block is fine.
  const [rutina, clientes] = await Promise.all([
    getRutinaWithSteps(id),
    getClientesForPicker(),
  ]);
  if (!rutina) notFound();

  const clienteForName = rutina.cliente_id
    ? await getClienteById(rutina.cliente_id)
    : null;
  const clientName = clienteForName?.profile.full_name ?? null;

  const initialSteps: BuilderStep[] = rutina.steps.map((s) => ({
    id: s.id,
    producto: toBuilderProducto({
      id: s.producto.id,
      name: s.producto.name,
      brand: s.producto.brand,
      category: s.producto.category,
      main_ingredients: s.producto.main_ingredients,
      application_instruction: s.producto.application_instruction,
      suggested_amount: s.producto.suggested_amount,
      absorption_time: s.producto.absorption_time,
      frequency: s.producto.frequency,
      time_of_day: s.producto.time_of_day,
      photoUrl: s.producto.photoUrl,
    }),
    customInstruction: s.custom_instruction ?? "",
    customAmount: s.custom_amount ?? "",
    // dbEnumToForm narrows nullable text columns into the strict
    // `<value> | ""` union the builder + Zod expect. Replaces the
    // previous unsafe `as` casts.
    customAbsorptionTime: dbEnumToForm(
      s.custom_absorption_time,
      PRODUCTO_ABSORPTION_TIMES,
    ),
    customFrequency: dbEnumToForm(s.custom_frequency, PRODUCTO_FREQUENCIES),
    customTimeOfDay: dbEnumToForm(s.custom_time_of_day, RUTINA_MOMENTOS),
    notes: s.notes ?? "",
  }));

  const initial: BuilderInitial = {
    rutinaId: rutina.id,
    name: rutina.name,
    kind: rutina.kind as BuilderInitial["kind"],
    momento: rutina.momento as RutinaMomento,
    skinType: rutina.skin_type ?? "",
    skinCondition: rutina.skin_condition ?? "",
    mainObjective: rutina.main_objective ?? "",
    generalNotes: rutina.general_notes ?? "",
    tags: rutina.tags ?? [],
    clienteId: rutina.cliente_id ?? "",
    fromTemplateId: rutina.from_template_id ?? "",
    clientMessage: rutina.client_message ?? "",
    steps: initialSteps,
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
