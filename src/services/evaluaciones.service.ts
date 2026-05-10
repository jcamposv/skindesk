import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import {
  emptyEvaluacion,
  type AnamnesisData,
  type DatosData,
  type DiagnosticoData,
  type Evaluacion,
  type EvaluacionStatus,
  type HabitosData,
  type PlanData,
} from "@/types/evaluacion";

type DB = SupabaseClient<Database>;

/**
 * Read the single evaluación for a clienta. Returns null when nothing has
 * been persisted yet (the row is created lazily by the upsert action on
 * the first autosave). RLS scopes the query to the caller's tenant.
 *
 * Wrapped in React.cache so the cliente detail page can call this and the
 * header chip + tab body share the same DB round-trip per request.
 */
export const getEvaluacionForCliente = cache(
  async (clienteId: string): Promise<Evaluacion | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("evaluaciones")
      .select(
        `id, cliente_id, tenant_id, created_by, last_editor_id, version,
         fecha, status, ultimo_step,
         datos, anamnesis, habitos, diagnostico, plan,
         consentimiento_aceptado, firma_data_url, firmante_nombre, firma_signed_at,
         created_at, updated_at,
         cliente:clientes!inner(profile:profiles!inner(full_name)),
         autor:profiles!evaluaciones_created_by_fkey(full_name)`,
      )
      .eq("cliente_id", clienteId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    return rowToEvaluacion(data as unknown as EvaluacionRowWithCliente);
  },
);

/**
 * Map the DB row to the app-level `Evaluacion` shape. Each JSONB section
 * starts from `emptyEvaluacion(...)` so missing keys default safely (the
 * frontend forms expect every nested field to exist).
 */
interface EvaluacionRowWithCliente {
  id: string;
  cliente_id: string;
  tenant_id: string;
  created_by: string;
  last_editor_id: string;
  version: number;
  fecha: string;
  status: EvaluacionStatus;
  ultimo_step: number;
  datos: Record<string, unknown> | null;
  anamnesis: Record<string, unknown> | null;
  habitos: Record<string, unknown> | null;
  diagnostico: Record<string, unknown> | null;
  plan: Record<string, unknown> | null;
  consentimiento_aceptado: boolean;
  firma_data_url: string | null;
  firmante_nombre: string | null;
  firma_signed_at: string | null;
  created_at: string;
  updated_at: string;
  cliente?: { profile?: { full_name: string | null } | null } | null;
  /** Joined `profiles` row matching `created_by`. Drives the displayed
   *  `profesionalNombre` so a profesional renaming herself reflects in
   *  every evaluación she authored, no drift. */
  autor?: { full_name: string | null } | null;
}

export function rowToEvaluacion(row: EvaluacionRowWithCliente): Evaluacion {
  const clienteNombre = row.cliente?.profile?.full_name ?? "Sin nombre";
  const profesionalNombre = row.autor?.full_name ?? "Profesional";
  const empty = emptyEvaluacion(
    row.cliente_id,
    clienteNombre,
    profesionalNombre,
  );
  return {
    id: row.id,
    clienteId: row.cliente_id,
    clienteNombre,
    profesionalNombre,
    fecha: row.fecha,
    status: row.status,
    ultimoStep: row.ultimo_step,
    version: row.version,
    datos: { ...empty.datos, ...((row.datos ?? {}) as Partial<DatosData>) },
    anamnesis: {
      ...empty.anamnesis,
      ...((row.anamnesis ?? {}) as Partial<AnamnesisData>),
    },
    habitos: {
      ...empty.habitos,
      ...((row.habitos ?? {}) as Partial<HabitosData>),
    },
    diagnostico: {
      ...empty.diagnostico,
      ...((row.diagnostico ?? {}) as Partial<DiagnosticoData>),
    },
    plan: { ...empty.plan, ...((row.plan ?? {}) as Partial<PlanData>) },
    consentimientoAceptado: row.consentimiento_aceptado,
    firmaDataUrl: row.firma_data_url ?? undefined,
    firmanteNombre: row.firmante_nombre ?? undefined,
    firmaSignedAt: row.firma_signed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type { DB as EvaluacionesDB };
