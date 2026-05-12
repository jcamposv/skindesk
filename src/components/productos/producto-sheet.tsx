"use client";

import { useState } from "react";
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
import type { UpsertProductoInput } from "@/schemas/productos.schema";

import { PRODUCTO_FORM_ID, ProductoForm } from "./producto-form";

interface ProductoSheetProps {
  /** Required for the storage path; passed straight through to the upload. */
  tenantId: string;
  /** Controlled open state. When undefined, the sheet manages itself via the
   *  built-in trigger button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pre-filled values for edit mode. Omit for create. */
  initial?: UpsertProductoInput & {
    photoUrl?: string | null;
    photoPath?: string | null;
  };
  /** Required when editing — the row id to update. */
  productoId?: string;
  /** Draft id used for new-product photo paths. Stable so re-renders don't
   *  break the upload URL convention. */
  draftId: string;
}

/**
 * Reusable right-side Sheet hosting `ProductoForm`. Two usage modes:
 *
 *   <ProductoSheet draftId={uuid} tenantId={…} />        // self-managed
 *   <ProductoSheet open={…} onOpenChange={…} initial={…} productoId={id} />
 *                                                       // controlled, editing
 *
 * Header copy adapts to mode automatically.
 */
export function ProductoSheet({
  tenantId,
  open: controlledOpen,
  onOpenChange,
  initial,
  productoId,
  draftId,
}: ProductoSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const isEdit = Boolean(initial);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isControlled ? (
        <SheetTrigger
          render={
            <Button variant="cta" size="lg" className="gap-1.5">
              <PlusIcon className="size-4" />
              Agregar producto
            </Button>
          }
        />
      ) : null}
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetHeader className="border-b px-6 pt-6 pb-5">
          <div className="flex items-center gap-2 pr-10">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#F6E0D6] text-[#8C4A30]">
              <SparklesIcon className="size-4" />
            </span>
            <div>
              <SheetTitle className="text-lg">
                {isEdit ? "Editar producto" : "Nuevo producto"}
              </SheetTitle>
              <SheetDescription>
                {isEdit
                  ? "Actualizá la información del producto."
                  : "Sumá un producto a tu catálogo personal."}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Re-mount the form whenever the editing target changes so RHF
              picks up fresh defaultValues. The key forces a fresh tree. */}
          <ProductoForm
            key={productoId ?? draftId}
            tenantId={tenantId}
            productoId={draftId}
            initial={initial}
            isEdit={isEdit}
            existingProductoId={productoId}
            onSuccess={() => setOpen(false)}
            onPendingChange={setPending}
          />
        </div>

        <footer className="flex items-center justify-between gap-3 border-t bg-card px-6 py-4 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.06)]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={PRODUCTO_FORM_ID}
            size="lg"
            disabled={pending}
            className="gap-2"
          >
            <SparklesIcon className="size-4" />
            {pending
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : "Guardar producto"}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
