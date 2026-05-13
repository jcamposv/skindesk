"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * URL state plumbing shared between every list-page toolbar (productos,
 * rutinas, citas, …). Owns:
 *   · debounced search input (the local draft + a 300ms sync to the URL)
 *   · arbitrary `update({key: value})` writes that strip empty values
 *     and reset pagination
 *   · `pending` flag so the toolbar can dim itself during navigation
 *
 * Pattern: every list page reads searchParams server-side and re-renders.
 * This hook owns the URL → input echo direction so external changes
 * (browser back, filter reset) flow back into the local draft state.
 */
export function useUrlFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlSearch = searchParams.get("search") ?? "";
  const [searchDraft, setSearchDraft] = useState(urlSearch);
  const lastSyncedRef = useRef(urlSearch);

  // Pull external URL changes (back/forward, filter reset) into the draft
  // so the input doesn't go stale.
  useEffect(() => {
    if (urlSearch !== lastSyncedRef.current) {
      lastSyncedRef.current = urlSearch;
      setSearchDraft(urlSearch);
    }
  }, [urlSearch]);

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      // Any filter change resets page to 1 — otherwise we'd land on an
      // empty page when the result set shrinks below the current offset.
      next.delete("page");
      const qs = next.toString();
      startTransition(() => {
        router.push(qs ? `?${qs}` : "?", { scroll: false });
      });
    },
    [router, searchParams],
  );

  // Debounced URL sync: 300ms means typing 5 chars in 1s triggers one
  // navigation, not five. `update` intentionally excluded from deps —
  // we only debounce on user input, not on URL echoes.
  useEffect(() => {
    if (searchDraft === urlSearch) return;
    const handle = setTimeout(() => {
      lastSyncedRef.current = searchDraft;
      update({ search: searchDraft });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const getParam = useCallback(
    (key: string, fallback = "") => searchParams.get(key) ?? fallback,
    [searchParams],
  );

  return {
    searchDraft,
    setSearchDraft,
    update,
    getParam,
    pending,
  };
}
