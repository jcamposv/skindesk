"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  cancelSubscriptionAction,
  reactivateSubscriptionAction,
} from "@/actions/billing.actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface SubscriptionToggleDialogProps {
  /**
   * Distinguishes the two flows. Both share the dialog primitive and
   * pending-state handling, but the copy + action are flipped.
   */
  variant: "cancel" | "reactivate";
  /** ISO date — current period end, used in the confirmation copy. */
  periodEnd: string | null;
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Single component covers both "Cancelar" and "Reactivar" because the only
 * difference is copy + which action runs. Avoids duplicating the dialog
 * boilerplate for the symmetric flow. Applies `architecture-avoid-boolean-
 * props` only loosely — `variant` is an enum, not a boolean, and the two
 * variants share enough plumbing that splitting them would just be DRY
 * theater.
 */
export function SubscriptionToggleDialog({
  variant,
  periodEnd,
}: SubscriptionToggleDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dateLabel = periodEnd ? DATE_FORMAT.format(new Date(periodEnd)) : null;

  const copy =
    variant === "cancel"
      ? {
          trigger: "Cancelar suscripción",
          triggerVariant: "ghost" as const,
          triggerClass:
            "w-full text-destructive hover:bg-destructive/10 hover:text-destructive",
          title: "¿Cancelar tu suscripción?",
          description: dateLabel
            ? `Tu plan seguirá activo hasta el ${dateLabel}. Después de esa fecha perderás acceso a SkinDesk salvo que reactives.`
            : "Tu plan seguirá activo hasta el fin del período actual. Después perderás acceso salvo que reactives.",
          confirm: "Sí, cancelar",
          confirmClass: "bg-destructive hover:bg-destructive/90 text-white",
          pending: "Cancelando…",
          run: cancelSubscriptionAction,
        }
      : {
          trigger: "Reactivar suscripción",
          triggerVariant: "default" as const,
          triggerClass: "w-full",
          title: "¿Reactivar tu suscripción?",
          description:
            "Tu plan va a seguir renovándose normalmente. No se hace ningún cargo extra.",
          confirm: "Sí, reactivar",
          confirmClass: "",
          pending: "Reactivando…",
          run: reactivateSubscriptionAction,
        };

  function onConfirm() {
    startTransition(async () => {
      const result = await copy.run();
      if (result.success) {
        toast.success(result.message ?? "Listo");
        setOpen(false);
      } else {
        toast.error(result.message ?? "No pudimos completar la acción");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant={copy.triggerVariant}
            size={variant === "cancel" ? "sm" : "lg"}
            className={copy.triggerClass}
          >
            {copy.trigger}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Volver</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              // Prevent the default close-on-click — we close manually after
              // the action settles so the user sees the pending state.
              e.preventDefault();
              onConfirm();
            }}
            className={copy.confirmClass}
          >
            {isPending ? copy.pending : copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
