import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client for Server Components, Server Actions and Route Handlers.
 * Cookies are wired through next/headers; writes are best-effort because
 * Server Components cannot mutate cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component — ignore.
            // Refresh is handled by middleware.
          }
        },
      },
    },
  );
}

/**
 * Per-request memoised `auth.getUser()`. Layout, page and any nested Server
 * Component can call this freely; React `cache()` deduplicates the network
 * round-trip so /dashboard does ONE Supabase call instead of one per file.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Per-request memoised `auth.getUser()` + `profiles` row + the user's
 * `tenants` row when applicable. Single helper, three round-trips per
 * request, deduped across every Server Component that needs auth context.
 *
 * `tenant` is null for super_admin (no tenant) and for any profile whose
 * tenant FK isn't set yet.
 */
export const getCurrentSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, role, tenant_id, full_name, email, phone, avatar_url, permissions, password_set",
    )
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  // Tenant is only relevant for non-super_admin users. The trigger keeps
  // `tenants.plan` and `tenants.subscription_status` in sync with the
  // `subscriptions` row, so reading from `tenants` is enough for layout
  // gates.
  let tenant: {
    id: string;
    name: string;
    plan: Database["public"]["Enums"]["plan_slug"] | null;
    subscription_status:
      | Database["public"]["Enums"]["subscription_status"]
      | null;
  } | null = null;
  if (profile.tenant_id) {
    const { data } = await supabase
      .from("tenants")
      .select("id, name, plan, subscription_status")
      .eq("id", profile.tenant_id)
      .single();
    tenant = data;
  }

  return { user, profile, tenant };
});
