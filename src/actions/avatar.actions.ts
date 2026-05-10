"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants";
import { mapPgError } from "@/lib/supabase/errors";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import type { ActionState } from "@/types/supabase";

/**
 * Update a profile's `avatar_url` + `avatar_path`. Called from the
 * AvatarUpload component after the browser-side Supabase Storage upload
 * succeeds, and again on remove (with both fields nulled).
 *
 * Auth: relies on the existing `profiles_update` RLS policy — the caller
 * must be the profile owner (clienta editing herself), or a profesional /
 * asistente w/ `clientas:edit` in the same tenant.
 *
 * `avatarPath` is the exact storage object path (relative to the bucket).
 * Persisting it lets us delete the right object on replace/remove without
 * guessing extensions.
 */
export async function updateAvatarUrlAction(
  profileId: string,
  avatarUrl: string | null,
  avatarPath: string | null,
  clienteId?: string,
): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, message: "No autenticado." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl, avatar_path: avatarPath })
    .eq("id", profileId);

  if (error) {
    return { success: false, message: mapPgError(error) };
  }

  if (clienteId) {
    revalidatePath(`${ROUTES.clientes}/${clienteId}`);
  }
  revalidatePath(ROUTES.clientes);

  return { success: true, message: "Foto de perfil actualizada." };
}
