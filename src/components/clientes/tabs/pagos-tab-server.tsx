import {
  getPaymentPlansForCliente,
  type PaymentPlanSummary,
} from "@/services/pagos.service";
import { getServiciosForCliente } from "@/services/servicios.service";

import { PagosTab } from "../pagos/pagos-tab";

/**
 * Per-tab server component for cliente detail · Pagos. Two fetches:
 *  · `getServiciosForCliente` — already React.cache'd, so if the Servicios
 *    tab also streams it's a single round-trip per request.
 *  · `getPaymentPlansForCliente` — plan summaries (Map keyed by servicioId).
 *
 * Maps survive Server Component boundaries but not Server → Client, so we
 * serialize to a plain object the way the page used to.
 */
export async function PagosTabServer({ clienteId }: { clienteId: string }) {
  const [services, paymentPlans] = await Promise.all([
    getServiciosForCliente(clienteId),
    getPaymentPlansForCliente(clienteId),
  ]);
  const initialPlans = Object.fromEntries(paymentPlans) as Record<
    string,
    PaymentPlanSummary
  >;
  return <PagosTab services={services} initialPlans={initialPlans} />;
}
