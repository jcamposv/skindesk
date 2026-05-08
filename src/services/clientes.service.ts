import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { ClienteStatus } from "@/schemas/clientes.schema";

type DB = SupabaseClient<Database>;

/**
 * Shape returned by the list view. We co-locate the profile fields under
 * `profile` so the table cell can render avatar + name + email + phone
 * directly from the row.
 */
export type ClienteListRow = {
  id: string;
  status: ClienteStatus;
  birth_date: string | null;
  services_active: unknown;
  last_appointment_at: string | null;
  next_appointment_at: string | null;
  created_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    phone: string | null;
    avatar_url: string | null;
  };
};

export type ClienteDetail = ClienteListRow & {
  address: string | null;
  occupation: string | null;
  civil_status: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  referral_source: string | null;
  notes: string | null;
  tenant_id: string;
  updated_at: string;
};

/** Server-paginated list. RLS scopes rows to caller's tenant. */
export async function listClientes(
  supabase: DB,
  options: {
    page: number;
    pageSize: number;
    search?: string;
    status?: ClienteStatus | null;
  },
): Promise<{ rows: ClienteListRow[]; total: number }> {
  const { page, pageSize, search, status } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("clientes")
    .select(
      `id, status, birth_date, services_active, last_appointment_at, next_appointment_at, created_at,
       profile:profiles!inner(id, full_name, email, phone, avatar_url)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) {
    query = query.eq("status", status);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    // `!inner` above lets us filter the parent rows by foreign-table columns.
    // Searching across name, email and phone covers the three things a
    // profesional types from memory.
    query = query.or(
      `full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
      { foreignTable: "profiles" },
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as unknown as ClienteListRow[],
    total: count ?? 0,
  };
}

/** Fetch one cliente by id. RLS handles authorization. */
export async function getClienteById(
  supabase: DB,
  id: string,
): Promise<ClienteDetail | null> {
  const { data, error } = await supabase
    .from("clientes")
    .select(
      `id, status, birth_date, services_active, last_appointment_at, next_appointment_at, created_at, updated_at,
       address, occupation, civil_status, emergency_contact_name, emergency_contact_phone, referral_source, notes, tenant_id,
       profile:profiles!inner(id, full_name, email, phone, avatar_url)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as unknown as ClienteDetail | null;
}

/**
 * Aggregate counts per status for the filter chips on the list page.
 * One round-trip; RLS scopes the rows.
 */
export async function getClienteStatusCounts(
  supabase: DB,
): Promise<Record<ClienteStatus, number> & { total: number }> {
  const { data, error } = await supabase
    .from("clientes")
    .select("status");

  if (error) throw new Error(error.message);

  const counts: Record<ClienteStatus, number> = {
    nueva: 0,
    seguimiento: 0,
    activa: 0,
    inactiva: 0,
  };
  for (const row of data ?? []) counts[row.status as ClienteStatus]++;
  return { ...counts, total: (data ?? []).length };
}
