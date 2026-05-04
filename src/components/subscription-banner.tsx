import Link from "next/link";
import { AlertTriangleIcon, CalendarClockIcon } from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
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
 *  - **notice (honey)**: trial/active winding down (`cancel_at_period_end`).
 *    Soft tone, end-date copy, points the user to /settings to undo it.
 *  - **destructive (copper/red)**: past_due / incomplete / canceled / etc.
 *    Hard tone, points to /settings → Stripe portal.
 *
 * The hard-gate statuses (canceled / unpaid / incomplete_expired) reach
 * here only when the user is already on /settings (the layout redirects
 * everywhere else), so the banner doubles as the explanation on that page.
 */
export function SubscriptionBanner({
  status,
  cancelAtPeriodEnd,
  currentPeriodEnd,
}: SubscriptionBannerProps) {
  // 1. Cancel-pending notice for trial/active. Higher priority than the
  //    "healthy → no banner" branch because we want the user to see it
  //    even though `status` itself is still trialing/active.
  if (status && HEALTHY_STATUS.has(status) && cancelAtPeriodEnd) {
    const dateLabel = currentPeriodEnd
      ? DATE_FORMAT.format(new Date(currentPeriodEnd))
      : null;
    const headline = dateLabel
      ? `Tu plan termina el ${dateLabel}. Reactivalo para mantener acceso.`
      : "Tu plan está programado para cancelarse. Reactivalo para mantener acceso.";

    return (
      <BannerShell
        tone="notice"
        icon={<CalendarClockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
        headline={headline}
        cta="Reactivar plan"
      />
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
    <BannerShell
      tone="destructive"
      icon={<AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
      headline={copy.headline}
      cta={copy.cta}
    />
  );
}

interface BannerShellProps {
  tone: "notice" | "destructive";
  icon: React.ReactNode;
  headline: string;
  cta: string;
}

function BannerShell({ tone, icon, headline, cta }: BannerShellProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between",
        tone === "destructive" &&
          "border-destructive/20 bg-destructive/10 text-destructive",
        tone === "notice" &&
          "border-[#EFD7C7] bg-[#FBF5EA] text-[#8A6A38]",
      )}
    >
      <div className="flex items-start gap-2">
        {icon}
        <p>{headline}</p>
      </div>
      <Link
        href={ROUTES.settings}
        className="self-start font-medium underline-offset-4 hover:underline sm:self-auto"
      >
        {cta} →
      </Link>
    </div>
  );
}
