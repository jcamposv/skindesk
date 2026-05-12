"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currencyCodeSchema } from "@/lib/currency";
import { isBillingPeriod } from "@/lib/plans";
import type { ActionState } from "@/types/supabase";

/**
 * Cookie-backed setters for the marketing pricing UI.
 *
 * Both cookies are public (read by the server only, but the values are
 * not sensitive — currency code + period are visible in the URL/UI
 * regardless). 30-day TTL so the user's choice survives between
 * landing visits, but auto-expires in case the catalog evolves.
 *
 * `revalidatePath("/")` busts the landing render so the new prices
 * appear on the SAME response that completes the action — no flash of
 * stale content.
 *
 * Trap avoided
 * ────────────
 * The currency code is validated against the full `CURRENCIES` enum
 * (the same set the toggle offers). We don't pre-validate against the
 * Stripe-supported subset here because the server reads the cookie via
 * `getPreferredPricingCurrency`, which already falls back to USD when
 * a stored code isn't in the live Stripe intersection.
 */

const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
  sameSite: "lax" as const,
  httpOnly: false, // No PII; allows a future client-side analytics read
  secure: process.env.NODE_ENV === "production",
};

export async function setPricingCurrencyAction(
  rawCode: string,
): Promise<ActionState<{ currency: string }>> {
  const parsed = currencyCodeSchema.safeParse(rawCode);
  if (!parsed.success) {
    return { success: false, message: "Moneda no soportada." };
  }

  const store = await cookies();
  store.set("pricing_currency", parsed.data, COOKIE_OPTS);

  revalidatePath("/");
  revalidatePath("/checkout");
  return { success: true, data: { currency: parsed.data } };
}

const periodSchema = z
  .string()
  .refine(isBillingPeriod, { message: "Período inválido." });

export async function setBillingPeriodAction(
  rawPeriod: string,
): Promise<ActionState<{ period: "month" | "year" }>> {
  const parsed = periodSchema.safeParse(rawPeriod);
  if (!parsed.success) {
    return { success: false, message: "Período inválido." };
  }

  const store = await cookies();
  store.set("pricing_period", parsed.data, COOKIE_OPTS);

  revalidatePath("/");
  revalidatePath("/checkout");
  return {
    success: true,
    data: { period: parsed.data as "month" | "year" },
  };
}
