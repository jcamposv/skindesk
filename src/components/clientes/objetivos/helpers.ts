import type { PlanData, PlanSesion } from "@/types/evaluacion";

/** Creates a fresh session row with a stable id and a sensible default
 *  name. `index` is just used to seed the visible label — order in the
 *  array is the canonical position. */
export function makeSesion(index: number): PlanSesion {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${index}`,
    nombre: `Sesión ${index + 1}`,
    fecha: null,
    descripcion: "",
    completada: false,
  };
}

/** Always return an array — legacy plans pre-date `sesiones` so the field
 *  is optional/undefined on JSONB rows persisted before v2. */
export function sesionesOf(plan: PlanData): PlanSesion[] {
  return Array.isArray(plan.sesiones) ? plan.sesiones : [];
}

/** True when the user has put *anything* into the plan — drives the
 *  "Crear plan" vs "Editar plan" CTA copy. */
export function planHasContent(plan: PlanData): boolean {
  return (
    Boolean(plan.nombrePlan) ||
    Boolean(plan.objetivoPrincipal) ||
    plan.tratamientos.length > 0 ||
    Boolean(plan.numeroSesiones) ||
    Boolean(plan.frecuencia) ||
    Boolean(plan.notasClinicas) ||
    sesionesOf(plan).length > 0
  );
}

export function romanize(n: number): string {
  const map = ["", "I", "II", "III", "IV", "V", "VI"];
  return map[n] ?? String(n);
}
