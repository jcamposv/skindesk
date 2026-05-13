"use client";

import { useState, useTransition } from "react";
import { MailIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";

import {
  generateShareTokenAction,
  sendShareInviteAction,
} from "@/actions/rutinas.actions";
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
import { Input } from "@/components/ui/input";

interface ShareEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rutinaId: string;
  rutinaName: string;
}

/**
 * Send-share-link-by-email modal. Two-step under the hood:
 *   1. Ensure the rutina has a `share_token` (generate one if missing —
 *      reuses the existing token, mirrors the copy-to-clipboard flow).
 *   2. Hand off to `sendShareInviteAction` which validates the email
 *      shape, calls Resend, and writes a `notification_events` audit row.
 */
export function ShareEmailDialog({
  open,
  onOpenChange,
  rutinaId,
  rutinaName,
}: ShareEmailDialogProps) {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSend() {
    if (!email.trim()) {
      toast.error("Escribí un email.");
      return;
    }
    startTransition(async () => {
      // Mint / reuse the share token first so the email always has a
      // valid URL. The server action will reuse an existing token if
      // present so we don't accidentally rotate it from this surface.
      const tokenRes = await generateShareTokenAction(rutinaId);
      if (!tokenRes.success) {
        toast.error(tokenRes.message ?? "No se pudo generar el link.");
        return;
      }
      const res = await sendShareInviteAction(rutinaId, email.trim());
      if (!res.success) {
        toast.error(res.message ?? "No se pudo enviar el email.");
        return;
      }
      toast.success(res.message ?? "Email enviado.");
      onOpenChange(false);
      setEmail("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailIcon className="size-4" />
            Compartir por email
          </DialogTitle>
          <DialogDescription>
            Enviamos el link de <strong>{rutinaName}</strong> a otra
            profesional. Ella necesita una cuenta SkinDesk con membresía
            activa para abrirlo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5 py-2">
          <label
            htmlFor="share-recipient-email"
            className="text-xs font-medium text-muted-foreground"
          >
            Email de la profesional
          </label>
          <Input
            id="share-recipient-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dra.lucia@clinica.com"
            disabled={pending}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            No incluímos datos de clientas ni notas clínicas en el email.
          </p>
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
            className="gap-1.5"
            onClick={handleSend}
            disabled={pending}
          >
            <SendIcon className="size-3.5" />
            {pending ? "Enviando…" : "Enviar link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
