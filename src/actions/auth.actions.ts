"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { magicLinkHtml } from "@/components/emails/magic-link";
import { passwordResetHtml } from "@/components/emails/password-reset";
import { dashboardForRole, ROUTES } from "@/lib/constants";
import { EMAIL_FROM, resend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
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
    if (error) {
      // Profesionales onboarded via Stripe checkout never set a password —
      // they activate via magic link. A raw "Invalid login credentials"
      // tells them nothing actionable; this hint points at both recovery
      // paths so they can self-serve.
      const isInvalidCreds =
        error.code === "invalid_credentials" ||
        error.message.toLowerCase().includes("invalid login");
      return {
        success: false,
        message: isInvalidCreds
          ? "Email o contraseña incorrectos. Si te registraste recientemente todavía no tenés contraseña — usá el magic link o restablecela."
          : error.message,
      };
    }
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }

  revalidatePath("/", "layout");

  // Skip the /dashboard hop: read role + password_set right after sign-in
  // and jump straight to the role-specific URL (or /auth/setup). This is
  // the same logic the auth callback runs for magic-link logins.
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.dashboard);
  if (!session.profile.password_set) redirect(ROUTES.authSetup);
  redirect(dashboardForRole(session.profile.role));
}

/**
 * Magic-link sign in. Bypasses Supabase's default email path and dispatches
 * via Resend with our branded template — same shell as the welcome email.
 *
 * Two anti-abuse properties:
 *  - Returns the same generic message regardless of whether the email is
 *    registered. Prevents enumeration of which addresses have an account.
 *  - Doesn't auto-create users (Supabase's signInWithOtp default would).
 *    Only previously-registered profesionales can request a magic link.
 *
 * TODO(rate-limit): `admin.generateLink` bypasses Supabase's per-email
 * throttle that `signInWithOtp` had built in. Before going public, gate
 * this action with a sliding-window limiter (Upstash Redis or a
 * Postgres-backed table) — e.g. 3 req/min per email + 10 req/min per IP —
 * to prevent Resend cost / inbox-flooding abuse.
 */
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

  const genericSuccess: ActionState = {
    success: true,
    message: "Si tu email está registrado, te enviamos un enlace de acceso.",
  };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: parsed.data.email,
      options: { redirectTo: `${getAppUrl()}${ROUTES.authCallback}` },
    });
    if (error || !data?.properties?.action_link) {
      // Most common cause: user not found. Don't leak existence.
      return genericSuccess;
    }

    const { error: mailErr } = await resend.emails.send({
      from: EMAIL_FROM,
      to: parsed.data.email,
      subject: "Tu enlace de acceso a SkinDesk",
      html: magicLinkHtml({
        magicLink: data.properties.action_link,
        appUrl: getAppUrl(),
      }),
    });
    if (mailErr) {
      console.error("[magic-link] resend failed:", mailErr.message);
    }
    return genericSuccess;
  } catch (err) {
    console.error("[magic-link] unexpected error:", err);
    return genericSuccess;
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

/**
 * Send password reset email. Same Resend + branded template path as the
 * magic-link action, with the same anti-enumeration response.
 *
 * TODO(rate-limit): see signInWithMagicLinkAction — both actions share the
 * same abuse vector and should ship behind the same limiter.
 */
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

  // Same anti-enumeration pattern as the magic-link action: always return
  // the same message whether or not the email is registered.
  const genericSuccess: ActionState = {
    success: true,
    message: "Si tu email está registrado, te enviamos un enlace para restablecer tu contraseña.",
  };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: parsed.data.email,
      options: {
        redirectTo: `${getAppUrl()}${ROUTES.authCallback}?next=${encodeURIComponent(
          ROUTES.authSetup,
        )}`,
      },
    });
    if (error || !data?.properties?.action_link) {
      return genericSuccess;
    }

    const { error: mailErr } = await resend.emails.send({
      from: EMAIL_FROM,
      to: parsed.data.email,
      subject: "Restablecé tu contraseña de SkinDesk",
      html: passwordResetHtml({
        resetLink: data.properties.action_link,
        appUrl: getAppUrl(),
      }),
    });
    if (mailErr) {
      console.error("[password-reset] resend failed:", mailErr.message);
    }
    return genericSuccess;
  } catch (err) {
    console.error("[password-reset] unexpected error:", err);
    return genericSuccess;
  }
}

/**
 * Update password for the current user.
 *
 * Pairs with Supabase's "Secure password change" project setting (Auth →
 * Settings → enable). With that flag on, `auth.updateUser({ password })`
 * requires a freshly-authenticated session; the magic-link sign-in (invite
 * flow) and the recovery token (forgot-password flow) both count as fresh
 * re-auth via the JWT `aal`/`amr` claims, so neither flow needs the user to
 * type a current password. A future /settings/cambiar-password page (where
 * the user is just casually logged in, not freshly re-authenticated) WILL
 * need to call `auth.reauthenticate()` first or collect the current
 * password — Supabase will refuse the update otherwise.
 */
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

    // Flip profile.password_set so /auth/callback stops bouncing this user
    // back to /auth/setup on every magic-link login. RLS allows self-update
    // on this column (the anti-escalation trigger only blocks role,
    // tenant_id and permissions changes).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ password_set: true })
        .eq("id", user.id);
    }

    return { success: true, message: "Contraseña actualizada." };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}
