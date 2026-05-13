"use client";

import { useEffect } from "react";

import { trackAtlasViewAction } from "@/actions/atlas.actions";

interface AtlasViewTrackerProps {
  entryId: string;
}

/**
 * Mount-time fire-and-forget view tracker. Lives on the entry detail page
 * and writes a row to `atlas_views`. RLS scopes the insert to the caller's
 * user_id so the action body is a no-op for the request author.
 *
 * Side-effect intentionally not gated by Suspense or React.cache: each
 * fresh page mount = one view, which is what "recently viewed" wants.
 */
export function AtlasViewTracker({ entryId }: AtlasViewTrackerProps) {
  useEffect(() => {
    // Use a transition so the request doesn't block the user's interaction.
    void trackAtlasViewAction(entryId).catch(() => {
      // View tracking is best-effort — swallow failures so a flaky network
      // never surfaces a toast on a successful page load.
    });
  }, [entryId]);

  return null;
}
