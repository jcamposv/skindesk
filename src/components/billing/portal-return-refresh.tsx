"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Handles the race between Stripe's Billing Portal redirect and our webhook.
 *
 * When the user clicks "Cancel" / "Update card" in the portal, Stripe
 * redirects them back to /settings *before* the `customer.subscription.*`
 * webhook lands on our server. The page renders with stale `tenant.
 * subscription_status` and the user thinks nothing happened.
 *
 * This island detects `?from=portal` and:
 *  1. Fires a sonner toast for explicit feedback (specific copy when
 *     `?action=canceled` is also present).
 *  2. Schedules two staggered `router.refresh()` calls (1.5s + 4s) to
 *     re-fetch the Server Components after the webhook has had time to
 *     write. No spinner, no UI noise — just a silent re-render.
 *  3. Strips the query params from the URL so a manual reload doesn't
 *     re-fire and the address bar stays clean.
 *
 * Mirrors the pattern used by `LoginErrorToast`.
 */
export function PortalReturnRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (search.get("from") !== "portal") return;
    ranRef.current = true;

    const action = search.get("action");

    // Explicit feedback so the user knows their action was received even
    // before the webhook lands. Specific copy when we know the cancel
    // flow completed; otherwise generic.
    if (action === "canceled") {
      toast.success("Suscripción cancelada", {
        description: "Estamos actualizando el estado…",
        duration: 6000,
      });
    } else {
      toast.success("Cambios guardados", {
        description: "Estamos actualizando el estado…",
        duration: 4000,
      });
    }

    // Strip the params so a refresh doesn't re-run this and so the URL
    // looks clean while the timeouts are pending.
    const next = new URLSearchParams(search.toString());
    next.delete("from");
    next.delete("action");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    // Two refreshes covers the typical Stripe webhook latency window
    // (~500ms-3s). If the first re-render still shows stale state because
    // the webhook hasn't arrived yet, the second one almost always
    // catches it.
    const t1 = setTimeout(() => router.refresh(), 1500);
    const t2 = setTimeout(() => router.refresh(), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [router, pathname, search]);

  return null;
}
