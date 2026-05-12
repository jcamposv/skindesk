import { z } from "zod";

export const checkoutSchema = z.object({
  plan: z.enum(["basico", "pro", "clinica"]),
  // Annual is opt-in per plan — the server enforces availability when
  // building the Session. The action coerces a missing/blank value to
  // "month" before parse, so we keep the schema strict here (no
  // `.default()`, which would diverge input/output types and break the
  // RHF resolver inference).
  period: z.enum(["month", "year"]),
  fullName: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  businessName: z.string().min(2, "Mínimo 2 caracteres"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
