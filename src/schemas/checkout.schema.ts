import { z } from "zod";

export const checkoutSchema = z.object({
  plan: z.enum(["basico", "pro", "clinica"]),
  fullName: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  businessName: z.string().min(2, "Mínimo 2 caracteres"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
