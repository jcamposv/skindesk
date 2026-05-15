import { getServiciosForCliente } from "@/services/servicios.service";
import type { ClienteDetail } from "@/services/clientes.service";
import type { StaffMember } from "@/services/staff.service";
import type { ProfesionalValue } from "@/components/clientes/servicios/profesional-select";

import { ServiciosTab } from "../servicios/servicios-tab";

/**
 * Per-tab server component for cliente detail · Servicios. Fetches the
 * tenant's services for this clienta (heavy: `getServiciosForCliente`
 * signs every before/after photo URL). Wrapped in `<Suspense>` so the
 * page shell can render without waiting for storage signing.
 *
 * `cliente` and `staff` come from the page (already fetched for the header
 * + NuevaCita CTA), so we don't refetch them here.
 */
export async function ServiciosTabServer({
  cliente,
  staff,
  currentProfesional,
}: {
  cliente: ClienteDetail;
  staff: StaffMember[];
  currentProfesional: ProfesionalValue;
}) {
  const servicios = await getServiciosForCliente(cliente.id);
  return (
    <ServiciosTab
      cliente={cliente}
      initialServices={servicios}
      staff={staff}
      currentProfesional={currentProfesional}
    />
  );
}
