"use server";

import { revalidatePath } from "next/cache";

import { clienteInviteHtml } from "@/components/emails/cliente-invite";
import { ROUTES } from "@/lib/constants";
import { EMAIL_FROM, resend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import {
  blankToNull,
  createClientaSchema,
  updateClientaSchema,
} from "@/schemas/clientes.schema";
import type { ActionState } from "@/types/supabase";

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Create a clienta + send the branded invite.
 *
 * Flow (every step is reversible / idempotent enough to fail mid-way):
 *   1. Validate caller → must be profesional or asistente w/ clientas:edit.
 *   2. createUser via service-role client. app_metadata={role:'clienta',
 *      tenant_id} is the trusted source for handle_new_user().
 *   3. The auth trigger creates the matching profiles row.
 *   4. Insert public.clientes (RLS scopes us to our tenant).
 *   5. generateLink(type:'invite') + Resend send our branded template.
 *
 * If step 5 fails we still return success (the row exists); we surface a
 * soft warning in the result so the UI can retry the email.
 */
export async function createClientaAction(
  _prev: ActionState<{ clienteId: string }> | null,
  formData: FormData,
): Promise<ActionState<{ clienteId: string }>> {
  const parsed = createClientaSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    birthDate: formData.get("birthDate"),
    address: formData.get("address"),
    occupation: formData.get("occupation"),
    civilStatus: formData.get("civilStatus"),
    emergencyContactName: formData.get("emergencyContactName"),
    emergencyContactPhone: formData.get("emergencyContactPhone"),
    referralSource: formData.get("referralSource"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Revisa los campos del formulario.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Inicia sesión para continuar." };
  }

  const callerRole = session.profile.role;
  const tenantId = session.profile.tenant_id;
  const allowed =
    callerRole === "profesional" ||
    (callerRole === "asistente" &&
      (session.profile.permissions as Record<string, string | null>)
        ?.clientas === "edit");

  if (!allowed || !tenantId) {
    return {
      success: false,
      message: "No tienes permisos para crear clientas.",
    };
  }

  const admin = createAdminClient();

  const phone = blankToNull(parsed.data.phone);

  // 1. Create the auth user with trusted role + tenant in app_metadata.
  //    Also pass role + tenant via user_metadata as a safety net — the
  //    handle_new_user trigger has a self-signup safelist that accepts
  //    `clienta` from raw_user_meta_data, so even if app_metadata gets
  //    swallowed (some Supabase deployments do this on createUser) we
  //    still land on the right branch.
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email: parsed.data.email,
      email_confirm: true, // skip Supabase's confirmation email; we send our own
      app_metadata: { role: "clienta", tenant_id: tenantId },
      user_metadata: {
        full_name: parsed.data.fullName,
        phone: phone,
        role: "clienta",
        tenant_id: tenantId,
      },
    },
  );

  if (createErr || !created?.user) {
    const isDuplicate =
      createErr?.message?.toLowerCase().includes("already") ||
      createErr?.code === "email_exists";
    return {
      success: false,
      message: isDuplicate
        ? "Ya existe una cuenta con ese email."
        : (createErr?.message ?? "No se pudo crear la cuenta."),
    };
  }

  const profileId = created.user.id;

  // 2. Force the profile to the correct role + tenant. Service role
  //    bypasses RLS and the anti-escalation trigger short-circuits when
  //    auth.uid() is null (admin client). This is the belt to the
  //    suspenders above: even if the trigger fell back to 'profesional',
  //    we correct it here before the clientes BEFORE-INSERT trigger runs
  //    its role check.
  const { error: profileUpsertErr } = await admin
    .from("profiles")
    .update({
      role: "clienta",
      tenant_id: tenantId,
      full_name: parsed.data.fullName,
      phone: phone,
    })
    .eq("id", profileId);

  if (profileUpsertErr) {
    await admin.auth.admin.deleteUser(profileId).catch(() => {});
    return {
      success: false,
      message: `No se pudo configurar el perfil: ${profileUpsertErr.message}`,
    };
  }

  // 3. Insert clientes row. We use the user-scoped client so the RLS
  //    profesional-tenant policy is the gate; the BEFORE INSERT trigger
  //    pulls tenant_id from profiles to keep the denormalised copy in
  //    sync.
  const supabase = await createClient();
  const { data: clienteRow, error: insertErr } = await supabase
    .from("clientes")
    .insert({
      profile_id: profileId,
      tenant_id: tenantId,
      birth_date: blankToNull(parsed.data.birthDate),
      address: blankToNull(parsed.data.address),
      occupation: blankToNull(parsed.data.occupation),
      civil_status: blankToNull(parsed.data.civilStatus),
      emergency_contact_name: blankToNull(parsed.data.emergencyContactName),
      emergency_contact_phone: blankToNull(parsed.data.emergencyContactPhone),
      referral_source: blankToNull(parsed.data.referralSource),
    })
    .select("id")
    .single();

  if (insertErr || !clienteRow) {
    // Roll back the auth user so retries don't trip "already exists".
    await admin.auth.admin.deleteUser(profileId).catch(() => {});
    return {
      success: false,
      message: insertErr?.message ?? "No se pudo guardar la clienta.",
    };
  }

  // 4. Invite link + branded email. Soft-fail: row already exists.
  //
  //    We use type:"recovery" (NOT "invite") because the user already exists
  //    at this point — `auth.admin.createUser` registered them above, so
  //    `generateLink({type:"invite"})` would fail with "User already
  //    registered". Recovery sends them through the same /auth/setup flow
  //    where they pick a password, which is exactly what we want for first
  //    access. The auth callback handles the magic-link token the same way.
  let warning: string | undefined;
  try {
    const { data: linkData, error: linkErr } =
      await admin.auth.admin.generateLink({
        type: "recovery",
        email: parsed.data.email,
        options: {
          redirectTo: `${getAppUrl()}${ROUTES.authCallback}?next=${encodeURIComponent(
            ROUTES.authSetup,
          )}`,
        },
      });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error(
        "[clienta-invite] generateLink failed:",
        linkErr ? JSON.stringify(linkErr) : "no action_link",
      );
      warning =
        "Clienta creada, pero no pudimos generar el enlace de invitación.";
    } else {
      const { data: mailData, error: mailErr } = await resend.emails.send(
        {
          from: EMAIL_FROM,
          to: parsed.data.email,
          subject: `${session.profile.full_name ?? "Tu cosmetóloga"} te invitó a SkinDesk`,
          html: clienteInviteHtml({
            clientaName: parsed.data.fullName,
            invitedByName:
              session.tenant?.name ??
              session.profile.full_name ??
              "Tu cosmetóloga",
            inviteLink: linkData.properties.action_link,
            appUrl: getAppUrl(),
          }),
        },
        // Idempotency key: profileId is unique per clienta and the create
        // flow only ever runs ONCE for a given profile (re-running with the
        // same email would have failed at createUser). If the SDK retries
        // a 5xx response, Resend dedupes within 24h.
        { idempotencyKey: `clienta-invite/${profileId}` },
      );
      if (mailErr) {
        // Log the full error so the cause is visible (Resend returns
        // structured info: { name, message, statusCode } — name and
        // statusCode are the actually useful bits).
        console.error("[clienta-invite] resend failed:", {
          name: mailErr.name,
          message: mailErr.message,
          ...(mailErr as Record<string, unknown>),
        });
        warning = `Clienta creada, pero el email falló: ${mailErr.message}`;
      } else {
        console.info(
          "[clienta-invite] sent ok, id:",
          mailData?.id ?? "(no id)",
        );
      }
    }
  } catch (err) {
    console.error("[clienta-invite] unexpected error:", err);
    warning = "Clienta creada, pero el email de invitación falló.";
  }

  revalidatePath(ROUTES.clientes);
  revalidatePath(`${ROUTES.clientes}/${clienteRow.id}`);

  return {
    success: true,
    message: warning ?? "Clienta creada e invitación enviada.",
    data: { clienteId: clienteRow.id },
  };
}

/**
 * Update the "Datos personales" tab. Splits writes across profiles (name,
 * phone) and clientes (everything else). RLS handles authorization.
 */
export async function updateClientaAction(
  clienteId: string,
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateClientaSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    birthDate: formData.get("birthDate"),
    address: formData.get("address"),
    occupation: formData.get("occupation"),
    civilStatus: formData.get("civilStatus"),
    emergencyContactName: formData.get("emergencyContactName"),
    emergencyContactPhone: formData.get("emergencyContactPhone"),
    referralSource: formData.get("referralSource"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Revisa los campos del formulario.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  // Fetch the row to learn the profile_id (RLS validates the read).
  const { data: existing, error: readErr } = await supabase
    .from("clientes")
    .select("profile_id")
    .eq("id", clienteId)
    .maybeSingle();

  if (readErr || !existing) {
    return { success: false, message: "Clienta no encontrada." };
  }

  // Update profiles (full_name, phone) — anti-escalation trigger allows
  // self-update or super_admin/profesional in the same tenant via the
  // existing policies.
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: blankToNull(parsed.data.phone),
    })
    .eq("id", existing.profile_id);

  if (profileErr) {
    return { success: false, message: profileErr.message };
  }

  const { error: clienteErr } = await supabase
    .from("clientes")
    .update({
      birth_date: blankToNull(parsed.data.birthDate),
      address: blankToNull(parsed.data.address),
      occupation: blankToNull(parsed.data.occupation),
      civil_status: blankToNull(parsed.data.civilStatus),
      emergency_contact_name: blankToNull(parsed.data.emergencyContactName),
      emergency_contact_phone: blankToNull(parsed.data.emergencyContactPhone),
      referral_source: blankToNull(parsed.data.referralSource),
      status: parsed.data.status,
      notes: blankToNull(parsed.data.notes),
    })
    .eq("id", clienteId);

  if (clienteErr) {
    return { success: false, message: clienteErr.message };
  }

  revalidatePath(`${ROUTES.clientes}/${clienteId}`);
  revalidatePath(ROUTES.clientes);

  return { success: true, message: "Cambios guardados." };
}

/**
 * Resend the SkinDesk-branded invite to an existing clienta.
 *
 * Use cases: original email never arrived, clienta lost it, the recovery link
 * expired, Resend transient failure on first send, etc. The action is
 * idempotent — every call generates a fresh recovery link (the previous one
 * keeps working until either is used or expires, whichever comes first).
 *
 * Always uses `type: "recovery"` regardless of `password_set`:
 *  - If the clienta never set a password → routes through /auth/setup, same
 *    as the first-time flow.
 *  - If she already set one → recovery lets her reset it. The cosmetóloga
 *    is the one triggering this from the kebab menu, so "you've been sent
 *    a link to set/reset your password" is the right model.
 */
export async function resendClientaInviteAction(
  clienteId: string,
): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "Inicia sesión para continuar." };
  }

  const callerRole = session.profile.role;
  const allowed =
    callerRole === "profesional" ||
    (callerRole === "asistente" &&
      (session.profile.permissions as Record<string, string | null>)
        ?.clientas === "edit");

  if (!allowed) {
    return {
      success: false,
      message: "No tienes permisos para reenviar invitaciones.",
    };
  }

  const supabase = await createClient();
  const { data: cliente, error: readErr } = await supabase
    .from("clientes")
    .select(
      "id, profile:profiles!inner(id, full_name, email)",
    )
    .eq("id", clienteId)
    .maybeSingle();

  if (readErr || !cliente) {
    return { success: false, message: "Clienta no encontrada." };
  }

  // Supabase's generated types model `profile` here as a tuple even though
  // the FK is unique; cast to a single profile shape.
  const profile = (
    Array.isArray(cliente.profile) ? cliente.profile[0] : cliente.profile
  ) as { id: string; full_name: string | null; email: string } | null;

  if (!profile?.email) {
    return {
      success: false,
      message: "Esta clienta no tiene email asociado.",
    };
  }

  const admin = createAdminClient();

  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
      options: {
        redirectTo: `${getAppUrl()}${ROUTES.authCallback}?next=${encodeURIComponent(
          ROUTES.authSetup,
        )}`,
      },
    });

  if (linkErr || !linkData?.properties?.action_link) {
    console.error(
      "[clienta-resend] generateLink failed:",
      linkErr ? JSON.stringify(linkErr) : "no action_link",
    );
    return {
      success: false,
      message: "No pudimos generar el enlace de invitación.",
    };
  }

  // Idempotency key: each *intentional* resend click is a distinct event,
  // so we use a per-call UUID. If the SDK retries a 5xx within the same
  // call, the key stays — Resend dedupes. Two clicks 5 min apart get two
  // different UUIDs and both send (which is the user's intent).
  const idempotencyKey = `clienta-resend/${crypto.randomUUID()}`;

  const { data: mailData, error: mailErr } = await resend.emails.send(
    {
      from: EMAIL_FROM,
      to: profile.email,
      subject: `${session.profile.full_name ?? "Tu cosmetóloga"} te reenvió tu invitación a SkinDesk`,
      html: clienteInviteHtml({
        clientaName: profile.full_name ?? "",
        invitedByName:
          session.tenant?.name ??
          session.profile.full_name ??
          "Tu cosmetóloga",
        inviteLink: linkData.properties.action_link,
        appUrl: getAppUrl(),
      }),
    },
    { idempotencyKey },
  );

  if (mailErr) {
    console.error("[clienta-resend] resend failed:", {
      name: mailErr.name,
      message: mailErr.message,
      ...(mailErr as Record<string, unknown>),
    });
    return {
      success: false,
      message: `No se pudo enviar el email: ${mailErr.message}`,
    };
  }

  console.info(
    "[clienta-resend] sent ok, id:",
    mailData?.id ?? "(no id)",
  );

  return {
    success: true,
    message: `Invitación reenviada a ${profile.email}.`,
  };
}
