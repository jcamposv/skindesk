/**
 * Plan catalog for the profesional self-signup flow.
 *
 * Hardcoded for MVP. When the super admin dashboard needs live editing, move
 * this config into a `public.plans` table (slug, name, monthly_price_usd,
 * trial_days, limits jsonb, stripe_price_id) and read it at request time.
 *
 * Stripe Price IDs come from env vars so dev/prod can swap without code
 * changes. Create the products + prices in Stripe Dashboard once, then put
 * the resulting `price_xxx` in `.env.local` / Vercel env.
 */

export type PlanSlug = "basico" | "pro" | "clinica";

export interface Plan {
  slug: PlanSlug;
  name: string;
  tagline: string;
  description: string;
  /** Monthly price in USD, displayed on the landing — source of truth is Stripe. */
  monthlyPriceUsd: number;
  /** Length of the free trial. 0 ⇒ no trial. */
  trialDays: number;
  features: readonly string[];
  limits: {
    /** `null` = unlimited */
    maxClientas: number | null;
    maxAsistentes: number;
    maxProductos: number | null;
  };
  /** Name of the env var that holds this plan's Stripe Price ID. */
  stripePriceEnvVar: string;
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
    monthlyPriceUsd: 19,
    trialDays: 14,
    features: [
      "Hasta 50 clientas activas",
      "Hasta 30 productos en catálogo",
      "Agenda y citas",
      "Fichas y notas de seguimiento",
    ],
    limits: { maxClientas: 50, maxAsistentes: 0, maxProductos: 30 },
    stripePriceEnvVar: "STRIPE_PRICE_BASICO",
  },
  {
    slug: "pro",
    name: "Pro",
    tagline: "Para cosmetólogas con cartera consolidada",
    description:
      "Todo el flujo profesional, sin límites de clientas ni de catálogo, con biblioteca avanzada.",
    monthlyPriceUsd: 39,
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
    highlight: true,
  },
  {
    slug: "clinica",
    name: "Clínica",
    tagline: "Para espacios con varias profesionales",
    description:
      "Cuentas de equipo con permisos diferenciados, además de todo lo del plan Pro.",
    monthlyPriceUsd: 79,
    trialDays: 14,
    features: [
      "Todo lo del plan Pro",
      "Hasta 5 asistentes con permisos por módulo",
      "Vista global de la clínica",
      "Soporte prioritario",
    ],
    limits: { maxClientas: null, maxAsistentes: 5, maxProductos: null },
    stripePriceEnvVar: "STRIPE_PRICE_CLINICA",
  },
] as const;

export const PLAN_BY_SLUG: Record<PlanSlug, Plan> = Object.fromEntries(
  PLANS.map((p) => [p.slug, p]),
) as Record<PlanSlug, Plan>;

/** True when `value` is a valid plan slug. */
export function isPlanSlug(value: string | null | undefined): value is PlanSlug {
  return value === "basico" || value === "pro" || value === "clinica";
}
