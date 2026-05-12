"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackagePlusIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import {
  archiveProductoAction,
  duplicateProductoAction,
} from "@/actions/productos.actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Producto } from "@/services/productos.service";
import {
  PRODUCTO_FORM_DEFAULTS,
  type UpsertProductoInput,
} from "@/schemas/productos.schema";

import { ProductoCard } from "./producto-card";
import { ProductoSheet } from "./producto-sheet";
import { ProductosListTable } from "./productos-list-table";

interface ProductosPageClientProps {
  tenantId: string;
  items: Producto[];
  totalItems: number;
  canEdit: boolean;
  view: "grid" | "list";
}

/**
 * Client island that holds the per-row interactions. The Server Component
 * passes already-fetched items + the view mode (decided by URL). All edit /
 * duplicate / delete plumbing lives here so the server stays cache-friendly.
 *
 * UUID for the draft photo path is minted once via `useState(() => …)` so
 * re-renders keep the same storage prefix for a single new-product session.
 */
export function ProductosPageClient({
  tenantId,
  items,
  totalItems,
  canEdit,
  view,
}: ProductosPageClientProps) {
  const router = useRouter();
  const [pendingAction, startTransition] = useTransition();

  const [draftId] = useState(() => crypto.randomUUID());
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [deleting, setDeleting] = useState<Producto | null>(null);

  function handleEdit(p: Producto) {
    setEditing(p);
  }

  function handleDuplicate(p: Producto) {
    startTransition(async () => {
      const result = await duplicateProductoAction(p.id);
      if (!result.success) {
        toast.error(result.message ?? "No se pudo duplicar.");
        return;
      }
      toast.success(result.message ?? "Producto duplicado.");
      router.refresh();
    });
  }

  function handleDelete(p: Producto) {
    setDeleting(p);
  }

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const result = await archiveProductoAction(target.id);
      if (!result.success) {
        toast.error(result.message ?? "No se pudo eliminar.");
        return;
      }
      toast.success(result.message ?? "Producto eliminado.");
      router.refresh();
    });
  }

  // Empty state — only when there's NO filter active (filtered-empty
  // handled by the page server-side). The "Add" sheet for this CTA is the
  // SAME one rendered below — controlled by `addOpen`. There is no
  // duplicate sheet tree.
  if (items.length === 0) {
    return (
      <>
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
          <PackagePlusIcon className="size-8 text-muted-foreground" />
          <p className="mt-3 font-heading text-base">Sin productos todavía</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Sumá los productos que usás para luego armar rutinas a tus clientas.
          </p>
          {canEdit ? (
            <Button
              onClick={() => setAddOpen(true)}
              variant="cta"
              size="lg"
              className="mt-4 gap-1.5"
            >
              <PlusIcon className="size-4" />
              Agregar producto
            </Button>
          ) : null}
        </div>
        <ProductoSheet
          tenantId={tenantId}
          draftId={draftId}
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      </>
    );
  }

  return (
    <>
      <div data-pending={pendingAction ? "" : undefined}>
        {view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => (
              <ProductoCard
                key={p.id}
                producto={p}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <ProductosListTable
            items={items}
            totalItems={totalItems}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Edit sheet — controlled by `editing` so we can pass initial values.
          The "Add" sheet lives in the page header (`ProductosAddButton`)
          and is fully self-contained; the empty-state branch above renders
          its own controlled "Add" sheet. There is no duplicate tree. */}
      <ProductoSheet
        tenantId={tenantId}
        draftId={editing?.id ?? draftId}
        open={Boolean(editing)}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        productoId={editing?.id}
        initial={editing ? productoToFormInput(editing) : undefined}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{deleting?.name}</strong> del catálogo.
              {deleting && deleting.routines_usage_count > 0 ? (
                <>
                  <br />
                  <span className="mt-1 inline-block text-destructive">
                    Este producto está siendo usado en{" "}
                    {deleting.routines_usage_count}{" "}
                    {deleting.routines_usage_count === 1
                      ? "rutina"
                      : "rutinas"}
                    . Eliminarlo puede afectar rutinas existentes.
                  </span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Map a `Producto` (DB row) to the form's `UpsertProductoInput` shape. The
 * server stores enums as plain strings; the schema is strict (`z.enum`) so
 * we coerce empty/null into `""` to satisfy the optional union.
 */
function productoToFormInput(
  p: Producto,
): UpsertProductoInput & {
  photoUrl: string | null;
  photoPath: string | null;
} {
  return {
    ...PRODUCTO_FORM_DEFAULTS,
    name: p.name,
    brand: p.brand ?? "",
    category: p.category as UpsertProductoInput["category"],
    photoPath: p.photo_path ?? "",
    photoUrl: p.photoUrl,
    mainIngredients: p.main_ingredients ?? [],
    ingredientsInci: p.ingredients_inci ?? "",
    skinTypes:
      (p.skin_types ?? []) as UpsertProductoInput["skinTypes"],
    customSkinTypes: p.custom_skin_types ?? [],
    applicationInstruction: p.application_instruction ?? "",
    suggestedAmount: p.suggested_amount ?? "",
    absorptionTime: (p.absorption_time ?? "") as UpsertProductoInput["absorptionTime"],
    timeOfDay: (p.time_of_day ?? "") as UpsertProductoInput["timeOfDay"],
    frequency: (p.frequency ?? "") as UpsertProductoInput["frequency"],
    additionalTags:
      (p.additional_tags ?? []) as UpsertProductoInput["additionalTags"],
    precautions: p.precautions ?? "",
    conflictingIngredients: p.conflicting_ingredients ?? [],
    clinicalNotes: p.clinical_notes ?? "",
  };
}
