import "server-only";

import { cache } from "react";

import { createClient, getCurrentSession } from "@/lib/supabase/server";

/**
 * Tenant-level configuration loaded from the `tenants` row.
 *
 * Currently exposes the agenda-relevant settings (TZ + business hours),
 * but is the right place to accumulate any per-tenant defaults that today
 * live as hardcoded constants. Wrapped in `React.cache()` so a Server
 * Component that reads it twice in the same request only hits the DB once.
 *
 * Schema fallbacks (`'America/Argentina/Buenos_Aires'`, `09:00`, `20:00`)
 * are the same as the DB column defaults — pinned here so a code path
 * that runs before the session loads still has a sane value.
 */
export interface TenantConfig {
  /** IANA timezone (e.g. `America/Argentina/Buenos_Aires`). */
  timezone: string;
  /** Earliest hour (0-23, float — e.g. 9.5 = 09:30) the agenda accepts. */
  businessHoursStart: number;
  /** Latest hour (0-23, float). Exclusive — events must END at or before this. */
  businessHoursEnd: number;
}

export const DEFAULT_TENANT_CONFIG: TenantConfig = {
  timezone: "America/Argentina/Buenos_Aires",
  businessHoursStart: 9,
  businessHoursEnd: 20,
};

/**
 * Per-request cached fetch of the caller's tenant config. Returns the
 * defaults when the caller has no tenant (super_admin without a tenant,
 * unauthenticated routes that still want a TZ).
 */
export const getTenantConfig = cache(async (): Promise<TenantConfig> => {
  const session = await getCurrentSession();
  if (!session?.profile.tenant_id) return DEFAULT_TENANT_CONFIG;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("timezone, business_hours_start, business_hours_end")
    .eq("id", session.profile.tenant_id)
    .maybeSingle();
  if (error || !data) return DEFAULT_TENANT_CONFIG;

  return {
    timezone: data.timezone ?? DEFAULT_TENANT_CONFIG.timezone,
    businessHoursStart: parseTime(data.business_hours_start) ??
      DEFAULT_TENANT_CONFIG.businessHoursStart,
    businessHoursEnd: parseTime(data.business_hours_end) ??
      DEFAULT_TENANT_CONFIG.businessHoursEnd,
  };
});

/** `"09:30:00"` → `9.5`. Postgres `time` columns serialise as strings. */
function parseTime(raw: string | null): number | null {
  if (!raw) return null;
  const [h, m] = raw.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h + (Number.isFinite(m) ? m / 60 : 0);
}
