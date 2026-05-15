import { listRutinasForCliente } from "@/services/rutinas.service";

import { RutinasAsignadasTab } from "../rutinas-asignadas-tab";

/**
 * Per-tab server component for cliente detail. Fetches only the assigned
 * rutinas (library templates are loaded lazily inside `LibraryPickerDialog`
 * via SWR when the user opens it). Renders inside a `<Suspense>` boundary
 * so it streams independently of the page shell.
 */
export async function RutinasTabServer({
  clienteId,
  clientName,
}: {
  clienteId: string;
  clientName: string;
}) {
  const rutinas = await listRutinasForCliente(clienteId);
  return (
    <RutinasAsignadasTab
      clienteId={clienteId}
      clientName={clientName}
      rutinas={rutinas}
    />
  );
}
