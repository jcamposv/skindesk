"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

/**
 * Handles the **implicit-flow** auth callback. `auth.admin.generateLink`
 * (used for welcome / magic-link / recovery emails we dispatch via Resend)
 * returns action_links that redirect with `#access_token=…&refresh_token=…`
 * in the URL fragment instead of `?code=…`. The fragment never reaches the
 * server, so this client island reads it, calls `setSession`, and routes.
 *
 * Destination logic mirrors the PKCE path so both flows behave the same:
 *  - Honour explicit `?next=…` (recovery emails pass `/auth/setup` here so
 *    the user is forced to choose a new password regardless of state).
 *  - Otherwise bounce through `/dashboard`, which gates on password_set +
 *    role.
 */
export function ImplicitCallback() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next");
  const [errored, setErrored] = useState(false);
  // React Strict Mode runs effects twice in dev; the second run would
  // duplicate `router.replace` and (briefly) double-process the tokens.
  // A ref guard makes the callback idempotent.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    // Supabase puts `type=recovery` in the fragment after consuming a
    // recovery token (separate from `next`). We forward this as a query
    // param so /auth/setup can distinguish "user just used a recovery
    // link" from "user is just logged in trying to wander into the page".
    // The query alone is forgeable; /auth/setup pairs it with a freshness
    // check on `last_sign_in_at` to make the combined signal tamper-proof
    // for any session older than the freshness window.
    const fragmentType = params.get("type");
    // Supabase reports verify failures (expired link, used token, etc.)
    // in the fragment too — we forward those reasons to /login so the
    // toast there shows the real cause.
    const fragmentError = params.get("error") ?? params.get("error_code");
    const fragmentErrorDescription = params.get("error_description");

    // Strip the tokens from the URL bar before doing anything else — even
    // a few hundred ms of `#access_token=…` in the address bar is enough
    // for a copy-paste, browser history sync, or extension to capture them.
    // After this the URL is the bare /auth/callback path; the tokens still
    // live in our local `accessToken`/`refreshToken` vars.
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }

    if (fragmentError) {
      queueMicrotask(() => setErrored(true));
      router.replace(loginErrorUrl(fragmentError, fragmentErrorDescription));
      return;
    }

    if (!accessToken || !refreshToken) {
      queueMicrotask(() => setErrored(true));
      router.replace(
        loginErrorUrl("missing_tokens", "El enlace no incluye tokens válidos."),
      );
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setErrored(true);
          router.replace(loginErrorUrl("set_session_failed", error.message));
          return;
        }
        const baseTarget = next ?? ROUTES.dashboard;
        const target =
          fragmentType === "recovery"
            ? `${baseTarget}${baseTarget.includes("?") ? "&" : "?"}type=recovery`
            : baseTarget;
        router.replace(target);
      });
  }, [router, next]);

  return (
    <div className="flex min-h-svh items-center justify-center px-6 text-center text-sm text-muted-foreground">
      {errored ? "Hubo un problema, te llevamos al login…" : "Redirigiendo…"}
    </div>
  );
}

function loginErrorUrl(code: string, description: string | null | undefined): string {
  const qs = new URLSearchParams({ error: code });
  if (description) qs.set("description", description);
  return `${ROUTES.login}?${qs.toString()}`;
}
