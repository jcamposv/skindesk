import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AgendaCalendar } from "@/components/citas/agenda-calendar";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";
import { getCitasInRange } from "@/services/citas.service";
import { getClientesForPicker } from "@/services/clientes.service";
import { getStaffForTenant } from "@/services/staff.service";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente"
  ) {
    redirect(dashboardForRole(session.profile.role));
  }

  // Pre-fetch a generous window (±35d around today) so MONTH view always has
  // events on first paint. The calendar can re-fetch via a route-level
  // searchParam later if we need stricter bounds.
  const now = new Date();
  const from = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000);

  const [initialCitas, clientes, staff] = await Promise.all([
    getCitasInRange(from.toISOString(), to.toISOString()),
    getClientesForPicker(),
    session.profile.tenant_id
      ? getStaffForTenant(session.profile.tenant_id)
      : Promise.resolve([]),
  ]);

  return (
    <AgendaCalendar
      initialCitas={initialCitas}
      clientes={clientes}
      staff={staff}
      currentProfesional={{
        id: session.profile.id,
        full_name: session.profile.full_name ?? "",
      }}
    />
  );
}
