import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";

import { ROUTES } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type Status = Database["public"]["Enums"]["subscription_status"];

interface SubscriptionBannerProps {
  status: Status | null;
}

const HEALTHY_STATUS = new Set<Status>(["active", "trialing"]);

const COPY: Partial<Record<Status, { headline: string; cta: string }>> = {
  past_due: {
    headline: "Tu último pago no se procesó. Actualizá tu método de pago para no perder acceso.",
    cta: "Actualizar pago",
  },
  unpaid: {
    headline: "Tu suscripción está suspendida por falta de pago.",
    cta: "Resolver pago",
  },
  canceled: {
    headline: "Tu suscripción fue cancelada. Reactivala para seguir usando SkinDesk.",
    cta: "Reactivar plan",
  },
  incomplete: {
    headline: "Tu pago aún no se completó.",
    cta: "Completar pago",
  },
  incomplete_expired: {
    headline: "Tu intento de pago expiró.",
    cta: "Volver a intentar",
  },
};

/**
 * Renders nothing when the subscription is healthy (active / trialing) or
 * when there's no subscription row to gate against (super_admin). Otherwise
 * paints a strip above the dashboard header pointing the user to /settings
 * where they can reach the Stripe Billing Portal.
 */
export function SubscriptionBanner({ status }: SubscriptionBannerProps) {
  if (!status || HEALTHY_STATUS.has(status)) return null;
  const copy = COPY[status] ?? {
    headline: "Tu suscripción tiene un problema. Revisalo desde Ajustes.",
    cta: "Ver detalles",
  };

  return (
    <div className="flex flex-col gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{copy.headline}</p>
      </div>
      <Link
        href={ROUTES.settings}
        className="self-start font-medium underline-offset-4 hover:underline sm:self-auto"
      >
        {copy.cta} →
      </Link>
    </div>
  );
}
