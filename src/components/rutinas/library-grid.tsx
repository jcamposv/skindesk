"use client";

import { useState } from "react";

import {
  RutinaCreateCard,
  RutinaLibraryCard,
} from "./rutina-library-card";
import { AssignRutinaDialog } from "./assign-rutina-dialog";
import { assignRutinaToClienteAction } from "@/actions/rutinas.actions";
import type { Database } from "@/types/database.types";

type RutinaRow = Database["public"]["Tables"]["rutinas"]["Row"];

interface LibraryGridProps {
  items: Array<RutinaRow & { stepCount: number }>;
  clientes: Array<{ id: string; fullName: string }>;
  /** Whether the current user can share/import — drives visibility of
   *  the "Generar link" kebab item. */
  canShare: boolean;
}

/** Library grid + assign dialog wiring. Server passes the items; the
 *  dialog lives at this level so a single instance handles every card. */
export function LibraryGrid({ items, clientes, canShare }: LibraryGridProps) {
  const [assignTarget, setAssignTarget] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <RutinaCreateCard />
        {items.map((r) => (
          <RutinaLibraryCard
            key={r.id}
            rutina={r}
            onAssign={(id) => setAssignTarget(id)}
            canShare={canShare}
          />
        ))}
      </div>

      <AssignRutinaDialog
        open={Boolean(assignTarget)}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null);
        }}
        clientes={clientes}
        onSubmit={(cid, msg) =>
          assignRutinaToClienteAction(assignTarget!, cid, msg)
        }
      />
    </>
  );
}
