import { z } from "zod";

import type {
  AnamnesisData,
  DatosData,
  DiagnosticoData,
  HabitosData,
  PlanData,
} from "@/types/evaluacion";

/**
 * Loose validation for the evaluation patch payloads. Each section is
 * accepted as an arbitrary object (the React form already shape-validates
 * with the strongly typed `EvaluacionFormValues`); we only enforce that the
 * server receives **objects** for sections and a well-formed pin array for
 * the facial map. The actual UPDATE goes straight into the JSONB columns,
 * so we don't need to model every nested key here.
 */

// `passthrough()` accepts any object shape and emits `{}` as the inferred
// type — assignable from the concrete `*Data` interfaces used on the
// client without forcing an index signature on them.
const sectionObject = z.object({}).passthrough();

const mapaFacialPinSchema = z.object({
  id: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  code: z.string().min(1),
  note: z.string().optional(),
});

const diagnosticoSchema = sectionObject.and(
  z.object({
    mapaFacial: z.array(mapaFacialPinSchema).optional(),
  }),
);

export const evaluacionPatchSchema = z
  .object({
    datos: sectionObject.optional(),
    anamnesis: sectionObject.optional(),
    habitos: sectionObject.optional(),
    diagnostico: diagnosticoSchema.optional(),
    plan: sectionObject.optional(),
  })
  .strict();

/**
 * Shape sent over the wire. Concrete app-level interfaces are accepted via
 * structural compatibility — Zod runtime treats them as objects, TS treats
 * them as the typed sections.
 */
export interface EvaluacionPatchInput {
  datos?: DatosData;
  anamnesis?: AnamnesisData;
  habitos?: HabitosData;
  diagnostico?: DiagnosticoData;
  plan?: PlanData;
}
