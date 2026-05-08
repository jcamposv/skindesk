import { z } from "zod";

/** Mirror of the Postgres enum `public.cliente_status`. */
export const CLIENTE_STATUSES = [
  "nueva",
  "seguimiento",
  "activa",
  "inactiva",
] as const;
export type ClienteStatus = (typeof CLIENTE_STATUSES)[number];

export const CLIENTE_STATUS_LABELS: Record<ClienteStatus, string> = {
  nueva: "Nueva",
  seguimiento: "Seguimiento",
  activa: "Activa",
  inactiva: "Inactiva",
};

const PHONE_RE = /^[+\d\s()\-.]+$/;

/**
 * Optional text field — accepts empty strings (RHF default) and validates
 * length only when non-empty. We strip empty strings to `null` in the server
 * action layer; keeping schema input/output types identical avoids the
 * `Resolver<TFieldValues>` mismatch RHF + Zod's `.transform()` produces.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .or(z.literal(""));

const optionalPhone = z
  .string()
  .trim()
  .max(40, "Máximo 40 caracteres")
  .refine((v) => v === "" || (v.length >= 6 && PHONE_RE.test(v)), {
    message: "Teléfono inválido",
  })
  .optional()
  .or(z.literal(""));

const optionalBirthDate = z
  .string()
  .trim()
  .refine(
    (v) => {
      if (v === "" || v === undefined) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const now = new Date();
      return d.getFullYear() >= 1900 && d <= now;
    },
    { message: "Fecha inválida" },
  )
  .optional()
  .or(z.literal(""));

/**
 * Form payload for "Agregar clienta". Server action splits across profiles
 * (auth row) and clientes (domain row) and converts empty strings to nulls.
 */
export const createClientaSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Nombre muy corto")
    .max(120, "Máximo 120 caracteres"),
  email: z.string().trim().email("Email inválido"),
  phone: optionalPhone,
  birthDate: optionalBirthDate,
  address: optionalText(240),
  occupation: optionalText(120),
  civilStatus: optionalText(60),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalPhone,
  referralSource: optionalText(160),
});

export type CreateClientaInput = z.infer<typeof createClientaSchema>;

/**
 * Update payload for the "Datos personales" tab. Same as create minus email
 * (re-invite flow lands in Phase 2) plus status / notes.
 */
export const updateClientaSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Nombre muy corto")
    .max(120, "Máximo 120 caracteres"),
  phone: optionalPhone,
  birthDate: optionalBirthDate,
  address: optionalText(240),
  occupation: optionalText(120),
  civilStatus: optionalText(60),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalPhone,
  referralSource: optionalText(160),
  status: z.enum(CLIENTE_STATUSES),
  notes: optionalText(2000),
});

export type UpdateClientaInput = z.infer<typeof updateClientaSchema>;

/** Coerce empty string to null — used by server actions when persisting. */
export function blankToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}
