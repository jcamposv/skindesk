"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  magicLinkSchema,
  registerSchema,
  resetPasswordSchema,
  updatePasswordSchema,
} from "@/schemas/auth.schema";
import type { ActionState } from "@/types/supabase";

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Email + password sign in. */
export async function signInAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      success: false,
      message: "Datos inválidos",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { success: false, message: error.message };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }

  revalidatePath("/", "layout");
  redirect(ROUTES.dashboard);
}

/** Magic-link sign in via email OTP. */
export async function signInWithMagicLinkAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      success: false,
      message: "Email inválido",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: `${getAppUrl()}${ROUTES.authCallback}` },
    });
    if (error) return { success: false, message: error.message };
    return {
      success: true,
      message: "Revisa tu bandeja, te enviamos un enlace mágico.",
    };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

/** Sign up with name + email + password. */
export async function signUpAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      success: false,
      message: "Datos inválidos",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${getAppUrl()}${ROUTES.authCallback}`,
        data: { full_name: parsed.data.name },
      },
    });
    if (error) return { success: false, message: error.message };
    return {
      success: true,
      message: "Cuenta creada. Revisa tu email para confirmar.",
    };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

/** Sign out and redirect to login. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(ROUTES.login);
}

/** Send password reset email. */
export async function resetPasswordAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      success: false,
      message: "Email inválido",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${getAppUrl()}${ROUTES.authCallback}?next=/settings` },
    );
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Revisa tu email para restablecer." };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

/** Update password for the current user. */
export async function updatePasswordAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      success: false,
      message: "Datos inválidos",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Contraseña actualizada." };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}
