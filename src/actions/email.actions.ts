"use server";

import { z } from "zod";

import { WelcomeEmail } from "@/components/emails/welcome-email";
import { EMAIL_FROM, resend } from "@/lib/resend";
import type { ActionState } from "@/types/supabase";

const welcomeInputSchema = z.object({
  to: z.string().email(),
  name: z.string().min(1).max(120),
});

/**
 * Sends the welcome email. Safe to call after signUp.
 * Failures are caught and reported via ActionState.message.
 */
export async function sendWelcomeEmailAction(input: {
  to: string;
  name: string;
}): Promise<ActionState<{ id: string }>> {
  const parsed = welcomeInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Email destino inválido",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: parsed.data.to,
      subject: "Bienvenido a SkinDesk",
      react: WelcomeEmail({ name: parsed.data.name, appUrl }),
    });
    if (error) return { success: false, message: error.message };
    return { success: true, data: { id: data?.id ?? "" } };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}
