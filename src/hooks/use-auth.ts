"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

/**
 * Subscribes to Supabase auth state and exposes auth helpers.
 * Use in Client Components only.
 */
export function useAuth() {
  const supabase = createClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setState((s) => ({ ...s, user: data.user ?? null, loading: false }));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return;
      setState({
        user: session?.user ?? null,
        session: session ?? null,
        loading: false,
      });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string) =>
      supabase.auth.signInWithPassword({ email, password }),
    [supabase],
  );

  const signInWithMagicLink = useCallback(
    async (email: string) =>
      supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            (process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin) +
            ROUTES.authCallback,
        },
      }),
    [supabase],
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      }),
    [supabase],
  );

  const signOut = useCallback(async () => supabase.auth.signOut(), [supabase]);

  const refreshSession = useCallback(
    async () => supabase.auth.refreshSession(),
    [supabase],
  );

  const resetPassword = useCallback(
    async (email: string) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo:
          (process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin) +
          `${ROUTES.authCallback}?next=/settings`,
      }),
    [supabase],
  );

  const updatePassword = useCallback(
    async (password: string) => supabase.auth.updateUser({ password }),
    [supabase],
  );

  return {
    user: state.user,
    session: state.session,
    loading: state.loading,
    isAuthenticated: !!state.user,
    signIn,
    signInWithMagicLink,
    signUp,
    signOut,
    refreshSession,
    resetPassword,
    updatePassword,
  };
}
