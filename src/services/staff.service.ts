import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export interface StaffMember {
  id: string;
  fullName: string;
  role: "profesional" | "asistente";
}

/**
 * Lists the staff (profesional + asistentes) of a tenant. Used to populate
 * the "Profesional responsable" dropdown across the cliente surfaces —
 * services, sessions, future modules.
 *
 * RLS scopes results to the caller's tenant (profiles policy). Wrapped in
 * `React.cache()` so multiple Server Components in the same request share
 * a single round-trip.
 *
 * Profiles without a `full_name` are skipped — they wouldn't render as a
 * useful dropdown entry. Sorted alphabetically.
 */
export const getStaffForTenant = cache(
  async (tenantId: string): Promise<StaffMember[]> => {
    if (!tenantId) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("tenant_id", tenantId)
      .in("role", ["profesional", "asistente"])
      .order("full_name", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((p): p is { id: string; full_name: string; role: "profesional" | "asistente" } =>
        Boolean(p.full_name),
      )
      .map((p) => ({
        id: p.id,
        fullName: p.full_name,
        role: p.role,
      }));
  },
);
