/**
 * Plan catalog for the profesional self-signup flow.
 *
 * Metadata (slug, name, copy, features, limits, trial) lives here.
 * Prices live in Stripe — fetched via `getPlanPricing()` in `lib/pricing.ts`,
 * which reads `currency_options` on each Price for multi-currency support.
 *
 * Stripe Price IDs (monthly + optional annual) come from env vars so dev/prod
 * can swap without code changes. Annual is opt-in: if the env var is missing
 * or blank, the landing hides the mensual↔anual toggle entirely.
 *
 * `usdFallbackCents` is the marketing-only safety net used when the Stripe
 * fetch fails (network blip, key missing in preview). It's intentionally in
 * cents/USD to match Stripe's `unit_amount` semantics — never edit by hand
 * to override the catalog; edit Stripe.
 */

export type PlanSlug = "basico" | "pro" | "clinica";

export type BillingPeriod = "month" | "year";

export interface Plan {
  slug: PlanSlug;
  name: string;
  tagline: string;
  description: string;
  /** Length of the free trial. 0 ⇒ no trial. */
  trialDays: number;
  features: readonly string[];
  limits: {
    /** `null` = unlimited */
    maxClientas: number | null;
    maxAsistentes: number;
    maxProductos: number | null;
  };
  /** Env var holding the monthly Stripe Price ID. Required. */
  stripePriceEnvVar: string;
  /** Env var holding the annual Stripe Price ID. Optional — empty/unset
   *  means the plan only sells monthly. */
  stripePriceAnnualEnvVar?: string;
  /** Marketing-only USD fallback in cents. Used if the Stripe price fetch
   *  fails so the landing never blanks out. Mirrors the price you set in
   *  Stripe Dashboard — Stripe is the source of truth, this is just
   *  insurance. */
  usdFallbackCents: { month: number; year?: number };
  /** UI hint for the plan card. */
  highlight?: boolean;
}

// Ordered by ascending price; ordering drives the landing page columns.
export const PLANS: readonly Plan[] = [
  {
    slug: "basico",
    name: "Básico",
    tagline: "Para cosmetólogas independientes que arrancan",
    description:
      "Lo esencial para llevar tu agenda, fichas de clientas y catálogo, sin complicarte.",
    trialDays: 14,
    features: [
      "Hasta 50 clientas activas",
      "Hasta 30 productos en catálogo",
      "Agenda y citas",
      "Fichas y notas de seguimiento",
    ],
    limits: { maxClientas: 50, maxAsistentes: 0, maxProductos: 30 },
    stripePriceEnvVar: "STRIPE_PRICE_BASICO",
    stripePriceAnnualEnvVar: "STRIPE_PRICE_BASICO_ANNUAL",
    usdFallbackCents: { month: 1900, year: 18000 },
  },
  {
    slug: "pro",
    name: "Pro",
    tagline: "Para cosmetólogas con cartera consolidada",
    description:
      "Todo el flujo profesional, sin límites de clientas ni de catálogo, con biblioteca avanzada.",
    trialDays: 14,
    features: [
      "Clientas ilimitadas",
      "Productos ilimitados",
      "Biblioteca avanzada de recursos",
      "Reportes y exportes",
      "Recordatorios automáticos por email",
    ],
    limits: { maxClientas: null, maxAsistentes: 0, maxProductos: null },
    stripePriceEnvVar: "STRIPE_PRICE_PRO",
    stripePriceAnnualEnvVar: "STRIPE_PRICE_PRO_ANNUAL",
    usdFallbackCents: { month: 3900, year: 37000 },
    highlight: true,
  },
  {
    slug: "clinica",
    name: "Clínica",
    tagline: "Para espacios con varias profesionales",
    description:
      "Cuentas de equipo con permisos diferenciados, además de todo lo del plan Pro.",
    trialDays: 14,
    features: [
      "Todo lo del plan Pro",
      "Hasta 5 asistentes con permisos por módulo",
      "Vista global de la clínica",
      "Soporte prioritario",
    ],
    limits: { maxClientas: null, maxAsistentes: 5, maxProductos: null },
    stripePriceEnvVar: "STRIPE_PRICE_CLINICA",
    stripePriceAnnualEnvVar: "STRIPE_PRICE_CLINICA_ANNUAL",
    usdFallbackCents: { month: 7900, year: 75000 },
  },
] as const;

export const PLAN_BY_SLUG: Record<PlanSlug, Plan> = Object.fromEntries(
  PLANS.map((p) => [p.slug, p]),
) as Record<PlanSlug, Plan>;

/** True when `value` is a valid plan slug. */
export function isPlanSlug(value: string | null | undefined): value is PlanSlug {
  return value === "basico" || value === "pro" || value === "clinica";
}

/** True when `value` is a valid billing period. */
export function isBillingPeriod(
  value: string | null | undefined,
): value is BillingPeriod {
  return value === "month" || value === "year";
}
