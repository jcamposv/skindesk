/**
 * "Pagos" — UI surface types.
 *
 * Plain interfaces (no zod runtime) so they can be imported from both the
 * server layer (`@/services/pagos.service.ts`) and the client components
 * without dragging "server-only" into client code.
 *
 * Enum types come from `@/schemas/pagos.schema` so server validation and
 * client display stay in lockstep.
 */

import type { PaymentMethod, PaymentStatus } from "@/schemas/pagos.schema";

export type { PaymentMethod, PaymentStatus };

export interface PaymentTransaction {
  id: string;
  amount: number;
  method: PaymentMethod;
  /** ISO date (YYYY-MM-DD). */
  paidAt: string;
  concept: string;
  notes: string;
}

export interface PaymentPlanSummary {
  servicioId: string;
  planId: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: PaymentStatus;
  transactions: PaymentTransaction[];
}

// ─── UI labels & visuals ────────────────────────────────────────────────────

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  codi: "CoDi",
  otro: "Otro",
};

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagado",
  cancelled: "Cancelado",
};

export const STATUS_VISUAL: Record<
  PaymentStatus,
  { tone: string; dot: string }
> = {
  pending: {
    tone: "border-border/60 bg-muted/40 text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  partial: {
    tone: "border-[#D2A96A]/40 bg-[#F8EFD7]/60 text-[#7C5E1F]",
    dot: "bg-[#D2A96A]",
  },
  paid: {
    tone: "border-[#5C6E6C]/40 bg-[#E7ECEA]/60 text-[#4F605C]",
    dot: "bg-[#5C6E6C]",
  },
  cancelled: {
    tone: "border-destructive/30 bg-destructive/10 text-destructive line-through decoration-destructive/40",
    dot: "bg-destructive/70",
  },
};
