"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Reads `?error=…&description=…` from the URL on /login and surfaces it
 * via a sonner toast. Both the server PKCE callback and the client implicit
 * callback redirect here when something fails (expired recovery link,
 * already-used token, signature mismatch, etc.) — without this island the
 * user just sees a clean login page and has no idea why she got bounced.
 *
 * After firing the toast we strip the params from the URL so a refresh
 * doesn't re-fire it, and so the address bar stops carrying the noise.
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Supabase /verify codes
  otp_expired:
    "El enlace expiró. Pedí uno nuevo desde la pantalla de recuperar contraseña.",
  access_denied:
    "El enlace ya fue usado o no es válido. Pedí uno nuevo.",
  invalid_request: "El enlace no es válido. Pedí uno nuevo.",
  // Internal codes from our callbacks
  missing_tokens:
    "El enlace no traía tokens válidos. Probá pedir uno nuevo.",
  set_session_failed:
    "No pudimos iniciar tu sesión. Pedí un enlace nuevo y volvé a intentar.",
  exchange_failed:
    "No pudimos validar el enlace. Probablemente expiró — pedí uno nuevo.",
  auth_callback:
    "Hubo un problema con el enlace. Volvé a intentarlo.",
};

export function LoginErrorToast() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  // Sonner persists toasts across renders; strict mode would otherwise
  // double-fire them in dev.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    const code = search.get("error");
    if (!code) return;
    ranRef.current = true;

    const description = search.get("description");
    const friendly = ERROR_MESSAGES[code];
    // Prefer our friendly mapping; fall back to Supabase's description so
    // the user still sees actionable text for codes we haven't mapped yet.
    const message =
      friendly ?? description ?? "Hubo un problema con el enlace.";

    toast.error(message, {
      description: friendly && description ? description : undefined,
      duration: 8000,
    });

    // Clean the URL so a refresh doesn't refire and the params don't sit
    // visible in the address bar.
    const next = new URLSearchParams(search.toString());
    next.delete("error");
    next.delete("description");
    const nextQs = next.toString();
    router.replace(nextQs ? `${pathname}?${nextQs}` : pathname, {
      scroll: false,
    });
  }, [router, pathname, search]);

  return null;
}
