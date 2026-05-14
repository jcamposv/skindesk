"use client";

import { useCallback, useState } from "react";

import {
  RutinaCreateCard,
  RutinaLibraryCard,
  type LibraryRutina,
} from "./rutina-library-card";
import { RutinaDetailSheet } from "./rutina-detail-sheet";
import { AssignRutinaDialog } from "./assign-rutina-dialog";
import { assignRutinaToClienteAction } from "@/actions/rutinas.actions";

interface LibraryGridProps {
  items: LibraryRutina[];
  clientes: Array<{ id: string; fullName: string }>;
  /** Whether the current user can share/import — drives visibility of
   *  the "Generar link" kebab item. */
  canShare: boolean;
}

/**
 * Library grid + Sheet detail + assign dialog wiring. Both dialogs live
 * here so a single instance handles every card — re-renders are scoped
 * to the targeted id changing, not the whole list.
 *
 * Handlers are wrapped in `useCallback` so the memoized
 * `RutinaLibraryCard` only re-renders when the row data itself changes
 * (react-best-practices `rerender-memo`).
 */
export function LibraryGrid({ items, clientes, canShare }: LibraryGridProps) {
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [viewTarget, setViewTarget] = useState<string | null>(null);

  const handleAssign = useCallback((id: string) => setAssignTarget(id), []);
  const handleView = useCallback((id: string) => setViewTarget(id), []);
  const handleAssignDialogClose = useCallback((open: boolean) => {
    if (!open) setAssignTarget(null);
  }, []);
  const handleSheetClose = useCallback((open: boolean) => {
    if (!open) setViewTarget(null);
  }, []);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <RutinaCreateCard />
        {items.map((r) => (
          <RutinaLibraryCard
            key={r.id}
            rutina={r}
            onAssign={handleAssign}
            onView={handleView}
            canShare={canShare}
          />
        ))}
      </div>

      <RutinaDetailSheet
        rutinaId={viewTarget}
        onOpenChange={handleSheetClose}
        onAssign={handleAssign}
      />

      <AssignRutinaDialog
        open={Boolean(assignTarget)}
        onOpenChange={handleAssignDialogClose}
        clientes={clientes}
        onSubmit={(cid, msg) =>
          assignRutinaToClienteAction(assignTarget!, cid, msg)
        }
      />
    </>
  );
}
