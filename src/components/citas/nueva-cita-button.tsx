"use client";

import { useCallback, useState } from "react";
import { CalendarPlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ClientePickerItem } from "@/services/clientes.service";
import type { StaffMember } from "@/services/staff.service";

import { CitaDialog, type CitaDialogState } from "./cita-dialog";
import { useCitaMutations } from "./use-cita-mutations";

interface NuevaCitaButtonProps {
  /** Pre-filled clienta when invoked from a clienta page. */
  cliente: ClientePickerItem;
  staff: StaffMember[];
  currentProfesional: { id: string; full_name: string };
  /** Optional override — defaults to the brand terracotta CTA. */
  className?: string;
  label?: string;
}

/**
 * Standalone trigger that opens the cita sheet pre-filled with a single
 * clienta. Used on the cliente detail header so a profesional can schedule
 * without leaving the profile. Reuses the same `CitaDialog` (sheet) the
 * agenda page uses, so create / edit semantics stay identical.
 */
export function NuevaCitaButton({
  cliente,
  staff,
  currentProfesional,
  className,
  label = "Nueva cita",
}: NuevaCitaButtonProps) {
  const [dialogState, setDialogState] = useState<CitaDialogState | null>(null);
  const closeDialog = useCallback(() => setDialogState(null), []);
  const { isPending, handleCreate, handleUpdate, handleDelete } =
    useCitaMutations({ onSuccess: closeDialog });

  function openCreate() {
    // Default to "now + 1h" so the datetime inputs aren't empty.
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setDialogState({
      mode: "create",
      defaults: {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        clienteId: cliente.id,
      },
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="cta"
        size="default"
        onClick={openCreate}
        className={className ?? "gap-1.5"}
      >
        <CalendarPlusIcon className="size-4" />
        {label}
      </Button>

      {dialogState != null ? (
        <CitaDialog
          state={dialogState}
          clientes={[cliente]}
          staff={staff}
          currentProfesional={currentProfesional}
          saving={isPending}
          onClose={closeDialog}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      ) : null}
    </>
  );
}
