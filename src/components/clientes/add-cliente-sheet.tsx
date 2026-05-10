"use client";

import { useState, type ReactElement } from "react";
import { PlusIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import {
  CREATE_CLIENTA_FORM_ID,
  CreateClientaForm,
} from "./create-cliente-form";

interface AddClientaSheetProps {
  /**
   * Custom trigger element. Defaults to a primary "Agregar clienta" button.
   * Useful for embedding the sheet inside other flows (e.g. the Evaluaciones
   * wizard) where the trigger should look different. Must be a single
   * React element — base-ui's SheetTrigger requires it for ref forwarding.
   */
  trigger?: ReactElement;
  /**
   * If true, after a successful create the user is **not** navigated away to
   * `/clientes/[id]` — instead the sheet closes and the caller's `onCreated`
   * fires with the new id so the parent screen stays on context.
   */
  keepOnCurrentScreen?: boolean;
  /**
   * Fires after a successful create. Receives the new clienta's id when
   * available. The sheet closes automatically.
   */
  onCreated?: (clienteId?: string) => void;
}

/**
 * Right-side sheet to add a new clienta. Three-region layout: header (fixed),
 * scrollable form body, footer with the submit button (always visible).
 */
export function AddClientaSheet({
  trigger,
  keepOnCurrentScreen,
  onCreated,
}: AddClientaSheetProps = {}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          trigger ?? (
            <Button size="lg" className="gap-1.5">
              <PlusIcon className="size-4" />
              Agregar clienta
            </Button>
          )
        }
      />
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b px-6 pt-6 pb-5">
          <div className="flex items-center gap-2 pr-10">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#F6E0D6] text-[#8C4A30]">
              <SparklesIcon className="size-4" />
            </span>
            <div>
              <SheetTitle className="text-lg">Nueva clienta</SheetTitle>
              <SheetDescription>
                Le creamos su portal y le mandamos la invitación apenas guardes.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <CreateClientaForm
            redirectOnSuccess={!keepOnCurrentScreen}
            onSuccess={(result) => {
              setOpen(false);
              onCreated?.(result.clienteId);
            }}
            onPendingChange={setPending}
          />
        </div>

        <footer className="flex items-center justify-center border-t bg-card px-6 py-4 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.06)]">
          <Button
            type="submit"
            form={CREATE_CLIENTA_FORM_ID}
            size="lg"
            disabled={pending}
            className="w-full gap-2 sm:w-auto sm:min-w-[280px]"
          >
            <SparklesIcon className="size-4" />
            {pending ? "Creando…" : "Crear y enviar invitación"}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
