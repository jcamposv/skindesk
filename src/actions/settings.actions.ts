"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants";
import { currencyCodeSchema } from "@/lib/currency";
import { mapPgError } from "@/lib/supabase/errors";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import type { ActionState } from "@/types/supabase";

/**
 * Update the tenant's display currency.
 *
 * Only the tenant-owning profesional (and super_admin for support
 * intervention) can change this — it controls every money render across
 * the app, including the asistente's view. Asistente can read the
 * setting via the layout, but not flip it.
 *
 * The DB has a CHECK constraint pinning the allowed set, so even if the
 * Zod parse is bypassed the row insert will fail with `23514`.
 * `revalidatePath` on every staff route the currency reaches:
 * profesional dashboard (income), pagos list + detail, settings itself,
 * and each cliente detail (the per-cliente plan-de-pagos tab).
 */
export async function updateTenantCurrencyAction(
  rawCurrency: string,
): Promise<ActionState<{ currency: string }>> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "No autenticado." };
  }
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "super_admin"
  ) {
    return { success: false, message: "No tenés permisos." };
  }
  if (!session.profile.tenant_id) {
    return {
      success: false,
      message: "Tu cuenta no tiene un negocio asociado.",
    };
  }

  const parsed = currencyCodeSchema.safeParse(rawCurrency);
  if (!parsed.success) {
    return {
      success: false,
      message: "Moneda no soportada.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ currency: parsed.data })
    .eq("id", session.profile.tenant_id);

  if (error) {
    return { success: false, message: mapPgError(error) };
  }

  // Currency reaches every staff screen with a money value. Bust the
  // request cache for each so the next navigation reads the fresh code
  // without a hard reload.
  revalidatePath(ROUTES.settings);
  revalidatePath(ROUTES.profesional);
  revalidatePath(ROUTES.pagos);
  revalidatePath(`${ROUTES.pagos}/[id]`, "page");
  revalidatePath(`${ROUTES.clientes}/[id]`, "page");

  return { success: true, data: { currency: parsed.data } };
}
