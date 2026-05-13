import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Map a Supabase / Postgres error to a Spanish user-facing message.
 *
 * Postgres error codes we care about live in `error.code` (5-char SQLSTATE).
 * Supabase auth/storage often sets `message` only — we fall back to a
 * generic phrase when no mapping matches.
 *
 * Keep this list small and intentional — every entry should surface a
 * message the profesional can act on.
 */
export function mapPgError(
  error: PostgrestError | { code?: string; message?: string } | null,
  fallback = "Algo falló al guardar. Reintentá en unos segundos.",
): string {
  if (!error) return fallback;
  const code = error.code ?? "";
  const msg = error.message ?? "";

  // Auth / RLS denials.
  if (code === "42501" || /permission denied/i.test(msg)) {
    return "No tienes permisos para esta acción.";
  }
  if (/row-level security|violates row-level security/i.test(msg)) {
    return "No tienes permisos para modificar este registro.";
  }

  // Unique violation (e.g. duplicate email, duplicate clienta).
  if (code === "23505") {
    if (/email/i.test(msg)) return "Ya existe un registro con ese email.";
    return "Ya existe un registro con esos datos.";
  }

  // Foreign-key violation.
  if (code === "23503") {
    return "Referencia inválida — el registro relacionado no existe.";
  }

  // NOT NULL or check constraint.
  if (code === "23502") {
    return "Faltan datos obligatorios.";
  }
  if (code === "23514") {
    return "Los datos no pasan las validaciones del servidor.";
  }

  // Exclusion constraint — emitted by the citas overlap guard
  // (`citas_no_overlap_per_professional`) when two non-cancelled citas
  // for the same professional would overlap in time.
  if (code === "23P01") {
    return "Conflicto de horario: ya hay otra cita en ese rango para ese profesional.";
  }

  // Connection / network.
  if (/network|fetch failed|econnrefused/i.test(msg)) {
    return "Sin conexión con el servidor. Verificá tu red.";
  }

  return fallback;
}
