import { CalendarClockIcon } from "lucide-react";

import { Banner, BannerLink } from "@/components/shared/banner";
import { ROUTES } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type Status = Database["public"]["Enums"]["subscription_status"];

interface SubscriptionBannerProps {
  status: Status | null;
  /** True when the user already requested cancellation and the plan is winding down. */
  cancelAtPeriodEnd: boolean;
  /** ISO timestamp — when the trial/plan actually ends. */
  currentPeriodEnd: string | null;
}

const HEALTHY_STATUS = new Set<Status>(["active", "trialing"]);

const COPY: Partial<Record<Status, { headline: string; cta: string }>> = {
  past_due: {
    headline:
      "Tu último pago no se procesó. Actualizá tu método de pago para no perder acceso.",
    cta: "Actualizar pago",
  },
  unpaid: {
    headline: "Tu suscripción está suspendida por falta de pago.",
    cta: "Resolver pago",
  },
  canceled: {
    headline:
      "Tu suscripción fue cancelada. Reactivala para seguir usando SkinDesk.",
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

const DATE_FORMAT = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
});

/**
 * Renders one of three states:
 *  - **null**: healthy + no scheduled cancellation. Nothing rendered.
 *  - **warning**: trial/active winding down (`cancel_at_period_end`).
 *    Honey tone, end-date copy, points the user to /settings to undo.
 *  - **destructive**: past_due / incomplete / canceled / etc. Points to
 *    /settings → Stripe portal.
 *
 * Built on the shared `<Banner>` primitive so layout/spacing stays in
 * sync with any future banner consumer (success messages, system
 * notices, etc.).
 */
export function SubscriptionBanner({
  status,
  cancelAtPeriodEnd,
  currentPeriodEnd,
}: SubscriptionBannerProps) {
  // 1. Cancel-pending notice for trial/active.
  if (status && HEALTHY_STATUS.has(status) && cancelAtPeriodEnd) {
    const dateLabel = currentPeriodEnd
      ? DATE_FORMAT.format(new Date(currentPeriodEnd))
      : null;
    const headline = dateLabel
      ? `Tu plan termina el ${dateLabel}. Reactivalo para mantener acceso.`
      : "Tu plan está programado para cancelarse. Reactivalo para mantener acceso.";

    return (
      <Banner
        tone="warning"
        icon={CalendarClockIcon}
        action={<BannerLink href={ROUTES.settings}>Reactivar plan</BannerLink>}
      >
        {headline}
      </Banner>
    );
  }

  // 2. Healthy + no cancellation scheduled → silent.
  if (!status || HEALTHY_STATUS.has(status)) return null;

  // 3. Unhealthy status → destructive banner.
  const copy = COPY[status] ?? {
    headline: "Tu suscripción tiene un problema. Revisalo desde Ajustes.",
    cta: "Ver detalles",
  };

  return (
    <Banner
      tone="destructive"
      action={<BannerLink href={ROUTES.settings}>{copy.cta}</BannerLink>}
    >
      {copy.headline}
    </Banner>
  );
}
