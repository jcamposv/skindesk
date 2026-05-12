"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createCitaAction,
  deleteCitaAction,
  updateCitaAction,
} from "@/actions/citas.actions";
import type {
  CitaCreateInput,
  CitaUpdateInput,
} from "@/schemas/citas.schema";

interface UseCitaMutationsOptions {
  /** Called after every successful mutation — typically `() => setDialogState(null)`. */
  onSuccess?: () => void;
}

/**
 * Single source of truth for cita create/update/delete from the client.
 * Both the agenda calendar and the cliente-detail "Nueva cita" button go
 * through this hook so toast copy, version-conflict handling, and the
 * `router.refresh()` reconcile stay identical.
 *
 * Handlers are `useCallback`-wrapped so memoised children (CitaDialog)
 * don't re-render needlessly when their parent re-renders.
 */
export function useCitaMutations(options: UseCitaMutationsOptions = {}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { onSuccess } = options;

  const handleCreate = useCallback(
    (input: CitaCreateInput): Promise<void> =>
      new Promise((resolve) => {
        startTransition(async () => {
          const result = await createCitaAction(input);
          if (!result.success) {
            toast.error(result.message ?? "No se pudo crear la cita.");
            resolve();
            return;
          }
          toast.success("Cita creada.");
          onSuccess?.();
          router.refresh();
          resolve();
        });
      }),
    [router, onSuccess],
  );

  const handleUpdate = useCallback(
    (
      id: string,
      input: CitaUpdateInput,
      expectedVersion: number,
    ): Promise<void> =>
      new Promise((resolve) => {
        startTransition(async () => {
          const result = await updateCitaAction(id, input, expectedVersion);
          if (!result.success) {
            if (result.errors?.version?.includes("conflict")) {
              toast.error("Otro usuario actualizó esta cita. Refrescando…");
              router.refresh();
              onSuccess?.();
              resolve();
              return;
            }
            toast.error(result.message ?? "No se pudo actualizar la cita.");
            resolve();
            return;
          }
          toast.success("Cita actualizada.");
          onSuccess?.();
          router.refresh();
          resolve();
        });
      }),
    [router, onSuccess],
  );

  const handleDelete = useCallback(
    (id: string): Promise<void> =>
      new Promise((resolve) => {
        startTransition(async () => {
          const result = await deleteCitaAction(id);
          if (!result.success) {
            toast.error(result.message ?? "No se pudo eliminar la cita.");
            resolve();
            return;
          }
          toast.success("Cita eliminada.");
          onSuccess?.();
          router.refresh();
          resolve();
        });
      }),
    [router, onSuccess],
  );

  return { isPending, handleCreate, handleUpdate, handleDelete };
}
