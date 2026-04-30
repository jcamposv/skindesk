"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side sign-out flow shared by every surface that exposes a "Cerrar
 * sesión" button (staff sidebar dropdown, clienta profile, etc.). Wraps
 * `supabase.auth.signOut()` in `useTransition` so callers can show a pending
 * UI while React keeps the click handler responsive.
 */
export function useSignOut() {
  const router = useRouter();
  const [signingOut, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message);
        return;
      }
      // replace + refresh: leave no /dashboard entry in history and bust
      // the RSC cache so any user-derived data on the next page re-renders.
      router.replace(ROUTES.login);
      router.refresh();
    });
  }

  return { signOut, signingOut };
}
