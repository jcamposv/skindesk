import { redirect } from "next/navigation";

import { ImplicitCallback } from "@/components/auth/implicit-callback";
import { dashboardForRole, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  searchParams: Promise<{
    code?: string;
    next?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  }>;
}

/**
 * Two flows funnel into this route:
 *
 *  - **PKCE** (`?code=…`): used when the user kicked off the auth flow via
 *    `auth.signInWithOtp` / `signInWithPassword` from the SSR client. We
 *    exchange the code server-side (the verifier lives in our cookies),
 *    derive the destination from the freshly created session, and redirect.
 *
 *  - **Implicit** (`#access_token=…&refresh_token=…`): used when the email
 *    link came from `auth.admin.generateLink` (welcome, magic-link, password
 *    reset — everything we send through Resend). The token lives in the URL
 *    fragment which never reaches the server, so we render a tiny client
 *    island that reads it, calls `auth.setSession`, and bounces.
 *
 * Errors from Supabase's /verify endpoint (expired link, already-used
 * token, invalid email) are surfaced as `?error=…&error_description=…` in
 * the query. We forward both fields to `/login` so the toast there can show
 * the real reason instead of a generic "something failed".
 */
export default async function AuthCallbackPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Supabase puts error info in the query when /verify fails (e.g.
  // "otp_expired" + "Email link is invalid or has expired"). Bail early
  // with the real reason instead of attempting the code exchange.
  if (params.error) {
    redirect(loginErrorUrl(params.error_code ?? params.error, params.error_description));
  }

  if (params.code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      redirect(loginErrorUrl("exchange_failed", error.message));
    }

    // Single profile read drives both gates: password_set forces /auth/setup
    // for fresh users, role drives the dashboard URL. Saves a /dashboard
    // hop relative to letting that page redirect us again.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, password_set")
        .eq("id", user.id)
        .single();
      if (profile) {
        if (!profile.password_set) redirect(ROUTES.authSetup);
        const target = params.next ?? dashboardForRole(profile.role);
        redirect(target);
      }
    }
    redirect(params.next ?? ROUTES.dashboard);
  }

  // No code in the query → implicit flow with token in the fragment. Hand
  // off to the client.
  return <ImplicitCallback />;
}

function loginErrorUrl(code: string, description: string | undefined): string {
  const qs = new URLSearchParams({ error: code });
  if (description) qs.set("description", description);
  return `${ROUTES.login}?${qs.toString()}`;
}
