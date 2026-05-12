import { z } from "zod";

/**
 * Server-side validation for the citas module (agenda).
 *
 * Citas are calendar events; completing one does NOT auto-create a sesion.
 * The optional `servicioId` keeps a soft link to a treatment context.
 */

export const citaStatusEnum = z.enum([
  "pendiente",
  "confirmada",
  "completada",
  "cancelada",
  "ausente",
]);
export type CitaStatus = z.infer<typeof citaStatusEnum>;

export const citaCreateSchema = z
  .object({
    clienteId: z.string().uuid(),
    servicioId: z.string().uuid().nullable().optional(),
    professionalId: z.string().uuid().nullable().default(null),
    professionalLabel: z.string().max(200).default(""),
    title: z.string().max(200).default(""),
    startAt: z.string().min(1, "Inicio requerido"), // ISO datetime
    endAt: z.string().min(1, "Fin requerido"),
    status: citaStatusEnum.default("pendiente"),
    notes: z.string().max(5000).default(""),
  })
  .strict()
  .refine(
    (v) => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(),
    {
      message: "La hora de fin debe ser posterior al inicio",
      path: ["endAt"],
    },
  );

export type CitaCreateInput = z.infer<typeof citaCreateSchema>;

/** Same shape as create — separate alias keeps the action signatures
 *  symmetric and lets us diverge later (e.g. partial updates). */
export const citaUpdateSchema = citaCreateSchema;
export type CitaUpdateInput = CitaCreateInput;

/** Inputs to the availability checker — used by the cita dialog to show
 *  a "Disponible / Conflicto" badge + alternative slot suggestions. */
export const checkAvailabilitySchema = z
  .object({
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    professionalId: z.string().uuid().nullable(),
    /** When editing, exclude the cita being edited from the conflict scan. */
    excludeCitaId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((v) => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(), {
    message: "La hora de fin debe ser posterior al inicio",
    path: ["endAt"],
  });

export type CheckAvailabilityInput = z.infer<typeof checkAvailabilitySchema>;
