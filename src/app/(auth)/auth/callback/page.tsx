import { redirect } from "next/navigation";

import { ImplicitCallback } from "@/components/auth/implicit-callback";
import { dashboardForRole, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  searchParams: Promise<{ code?: string; next?: string; error?: string }>;
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
 */
export default async function AuthCallbackPage({ searchParams }: PageProps) {
  const params = await searchParams;

  if (params.code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) redirect(`${ROUTES.login}?error=auth_callback`);

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
