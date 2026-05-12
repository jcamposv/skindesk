import { z } from "zod";

/**
 * Server-side validation for the manual payment ledger.
 *
 * `payment_plans` is auto-created 1:1 with every servicio via a Postgres
 * trigger — the app never inserts plans directly; it only inserts/deletes
 * `payment_transactions` against an existing plan. Therefore the only
 * input schema we need is the transaction-register payload.
 */

export const paymentMethodEnum = z.enum([
  "efectivo",
  "transferencia",
  "tarjeta",
  "codi",
  "otro",
]);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

export const paymentStatusEnum = z.enum([
  "pending",
  "partial",
  "paid",
  "cancelled",
]);
export type PaymentStatus = z.infer<typeof paymentStatusEnum>;

// Manual ledger only — no clienta-future receipts. Reject `paid_at` strings
// that fall in the future (a one-week grace covers timezone edges + clock
// skew between client and server).
const MAX_FUTURE_DAYS = 7;
function isWithinPastOrNearFuture(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const grace = new Date();
  grace.setUTCDate(grace.getUTCDate() + MAX_FUTURE_DAYS);
  return d.getTime() <= grace.getTime();
}

export const paymentRegisterSchema = z
  .object({
    amount: z
      .number({ message: "Ingresá un monto válido" })
      .positive("El monto debe ser mayor a 0")
      .max(10_000_000),
    method: paymentMethodEnum,
    paidAt: z
      .string()
      .min(1, "Fecha requerida")
      .refine(isWithinPastOrNearFuture, {
        message: "La fecha no puede ser futura",
      }), // ISO YYYY-MM-DD
    concept: z.string().max(200).default(""),
    notes: z.string().max(2000).default(""),
  })
  .strict();

export type PaymentRegisterInput = z.infer<typeof paymentRegisterSchema>;

export const paymentVoidSchema = z
  .object({
    reason: z
      .string()
      .min(3, "Indicá el motivo (mínimo 3 caracteres)")
      .max(500),
  })
  .strict();
export type PaymentVoidInput = z.infer<typeof paymentVoidSchema>;
