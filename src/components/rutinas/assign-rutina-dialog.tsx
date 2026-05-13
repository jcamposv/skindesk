"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SendIcon, UserCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/types/supabase";

interface AssignRutinaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected clienta when launched from the cliente detail page. */
  preselectedClienteId?: string;
  /** Display name for the preselected clienta. Used by the confirmation
   *  chip; the dialog falls back to the `clientes` array lookup, then to
   *  a generic label. */
  preselectedClienteName?: string;
  /** Picker options. Hidden when `preselectedClienteId` is set. */
  clientes: Array<{ id: string; fullName: string }>;
  /**
   * Owns the save + assign side effects. The dialog only collects (clienteId,
   * message) and renders feedback; each call site decides whether that means
   * "clone a template into a new assignment", "save the in-flight builder
   * form as the assignment directly", or something else. Must return the
   * standard `ActionState`; the dialog displays `message` as the toast.
   */
  onSubmit: (clienteId: string, message: string) => Promise<ActionState>;
}

/**
 * Modal "Asignar rutina a cliente". Used from:
 *   · Library page (RutinaLibraryCard kebab → asignar)
 *   · Library list table (row action → asignar)
 *   · Builder header ("Asignar a cliente")
 *   · Cliente detail tab → "Asignar desde biblioteca"
 *
 * The dialog is dumb about the underlying action — each caller passes an
 * `onSubmit` that maps the (clienteId, message) pair to the right server
 * action. This is what lets the builder handle the cliente-context flow
 * (kind=assignment) without trying to call `assignRutinaToClienteAction`
 * (which only accepts templates).
 */
export function AssignRutinaDialog({
  open,
  onOpenChange,
  preselectedClienteId,
  preselectedClienteName,
  clientes,
  onSubmit,
}: AssignRutinaDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clienteId, setClienteId] = useState(preselectedClienteId ?? "");
  const [message, setMessage] = useState("");

  // Look up the preselected clienta's display name. If the picker list
  // wasn't loaded (e.g. the cliente detail page passes `clientes={[]}`),
  // we fall back to a generic chip — the action will still work because
  // the id is what matters.
  const preselectedName = useMemo(() => {
    if (!preselectedClienteId) return null;
    if (preselectedClienteName) return preselectedClienteName;
    return (
      clientes.find((c) => c.id === preselectedClienteId)?.fullName ?? null
    );
  }, [preselectedClienteId, preselectedClienteName, clientes]);

  function handleAssign() {
    const target = preselectedClienteId ?? clienteId;
    if (!target) {
      toast.error("Elegí una clienta.");
      return;
    }
    startTransition(async () => {
      const res = await onSubmit(target, message);
      if (!res.success) {
        toast.error(res.message ?? "No se pudo asignar.");
        return;
      }
      toast.success(res.message ?? "Rutina asignada.");
      onOpenChange(false);
      setMessage("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar rutina a cliente</DialogTitle>
          <DialogDescription>
            Le creamos una copia personalizable. Cambios futuros no afectan
            la plantilla original.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {preselectedClienteId ? (
            // Already locked to a clienta — show a confirmation chip so the
            // user knows who's going to receive the routine.
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Se asigna a
              </span>
              <div className="flex items-center gap-2 rounded-md border bg-[#E7ECEA]/50 px-3 py-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-[#5C6E6C] text-white">
                  <UserCheckIcon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {preselectedName ?? "Clienta seleccionada"}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground">
                    Confirmá el envío para que la vea en su portal.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <label
                htmlFor="cliente-select"
                className="text-xs font-medium text-muted-foreground"
              >
                Clienta
              </label>
              <select
                id="cliente-select"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/30"
              >
                <option value="">Elegí una clienta</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-1.5">
            <label
              htmlFor="cliente-message"
              className="text-xs font-medium text-muted-foreground"
            >
              Mensaje para la clienta (opcional)
            </label>
            <Textarea
              id="cliente-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ej: Tu rutina de mañana — usala todos los días sobre piel limpia ☀️"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="ghost" disabled={pending}>
                Cancelar
              </Button>
            }
          />
          <Button
            type="button"
            variant="cta"
            onClick={handleAssign}
            disabled={pending}
            className="gap-1.5"
          >
            <SendIcon className="size-4" />
            {pending ? "Asignando…" : "Asignar y notificar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
