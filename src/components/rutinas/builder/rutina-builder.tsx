"use client";

import { useCallback, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { PackagePlusIcon, PackageIcon, SmartphoneIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  estimateRutinaMinutes,
  RUTINA_FORM_DEFAULTS,
  upsertRutinaSchema,
  type UpsertRutinaInput,
} from "@/schemas/rutinas.schema";

import { BuilderCatalog } from "./builder-catalog";
import { BuilderHeader } from "./builder-header";
import { BuilderMeta } from "./builder-meta";
import { BuilderPhonePreview } from "./builder-phone-preview";
import { BuilderStepCard } from "./builder-step-card";
import { BuilderStepDialog } from "./builder-step-dialog";
import type { BuilderInitial, BuilderProducto, BuilderStep } from "./types";
import { keyFor, useStepsState } from "./use-steps-state";

interface RutinaBuilderProps {
  initial: BuilderInitial;
  productos: BuilderProducto[];
  clientes: Array<{ id: string; fullName: string }>;
  clientName: string | null;
  /** When the server-side `listProductosForBuilder` hit its cap, this is
   *  the total matching count (so the catalog can hint "showing first N
   *  of X"). `null` when nothing was clipped. */
  catalogCappedAt: number | null;
}

/**
 * Top-level builder shell. One `useForm` lives here; everything below
 * consumes it via `FormProvider` + `useFormContext`. Steps use
 * `useFieldArray` so insert/remove/move are O(1) for RHF.
 *
 * Step shape: each step has a `producto` snapshot embedded (BuilderStep)
 * for instant preview. The Zod schema validates a smaller payload —
 * just the customisation fields + productoId — at submit time.
 */
export function RutinaBuilder({
  initial,
  productos,
  clientes,
  clientName,
  catalogCappedAt,
}: RutinaBuilderProps) {
  const productosById = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos],
  );

  const [editingStepKey, setEditingStepKey] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Owned here (rather than inside BuilderHeader) so the phone preview's
  // "Descargar PDF" CTA flips on as soon as the header persists a fresh
  // rutina. `history.replaceState` syncs the URL but doesn't remount the
  // page, so `initial.rutinaId` would stay null forever otherwise.
  const [persistedId, setPersistedId] = useState<string | null>(
    initial.rutinaId,
  );

  const form = useForm<UpsertRutinaInput>({
    resolver: zodResolver(upsertRutinaSchema),
    defaultValues: toFormDefaults(initial),
  });

  // RHF field-array for the schema-side steps (used at submit).
  useFieldArray({ control: form.control, name: "steps" });

  // FormProvider must wrap useStepsState since the hook reads RHF context.
  // We split into <Inner /> so the hook can call useFormContext.
  const handleDropZoneOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("text/plain")) {
      e.preventDefault();
      setDragOver(true);
    }
  }, []);
  const handleDropZoneLeave = useCallback(() => setDragOver(false), []);

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <BuilderInner
          initial={initial}
          productosById={productosById}
          productos={productos}
          clientes={clientes}
          clientName={clientName}
          catalogCappedAt={catalogCappedAt}
          persistedId={persistedId}
          setPersistedId={setPersistedId}
          editingStepKey={editingStepKey}
          setEditingStepKey={setEditingStepKey}
          dragOver={dragOver}
          handleDropZoneOver={handleDropZoneOver}
          handleDropZoneLeave={handleDropZoneLeave}
          setDragOver={setDragOver}
        />
      </Form>
    </FormProvider>
  );
}

interface BuilderInnerProps {
  initial: BuilderInitial;
  productos: BuilderProducto[];
  productosById: Map<string, BuilderProducto>;
  clientes: Array<{ id: string; fullName: string }>;
  clientName: string | null;
  catalogCappedAt: number | null;
  persistedId: string | null;
  setPersistedId: (id: string) => void;
  editingStepKey: string | null;
  setEditingStepKey: (k: string | null) => void;
  dragOver: boolean;
  setDragOver: (b: boolean) => void;
  handleDropZoneOver: (e: React.DragEvent) => void;
  handleDropZoneLeave: () => void;
}

function BuilderInner({
  initial,
  productos,
  productosById,
  clientes,
  clientName,
  catalogCappedAt,
  persistedId,
  setPersistedId,
  editingStepKey,
  setEditingStepKey,
  dragOver,
  setDragOver,
  handleDropZoneOver,
  handleDropZoneLeave,
}: BuilderInnerProps) {
  const { steps, addStep, removeStep, reorderStep, saveStep } = useStepsState(
    initial.steps,
  );

  const handleDropZoneDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const productoId = e.dataTransfer.getData("text/plain");
      if (!productoId) return;
      const producto = productosById.get(productoId);
      if (producto) addStep(producto);
    },
    [addStep, productosById, setDragOver],
  );

  const totalMinutes = useMemo(
    () =>
      estimateRutinaMinutes(
        steps.map((s) => ({
          customAbsorptionTime: s.customAbsorptionTime,
          productoAbsorptionTime: s.producto.absorptionTime,
        })),
      ),
    [steps],
  );

  const editingStep = editingStepKey
    ? steps.find((s, idx) => keyFor(s, idx) === editingStepKey) ?? null
    : null;

  return (
    <>
      {/* The wrapping <form> exists so Enter doesn't submit and so the
          builder feels like a single document. Submit happens via the
          header's "Guardar" button which calls handleSubmit directly. */}
      <form
        className="flex h-[calc(100vh-3.5rem)] flex-col"
        onSubmit={(e) => e.preventDefault()}
      >
        <BuilderHeader
          rutinaId={persistedId}
          onPersisted={setPersistedId}
          clientes={clientes}
          preselectedClienteName={clientName}
        />

        {/* Mobile / tablet drawer triggers — only visible below `lg`,
            where the side columns are hidden. Catalog opens from the
            left, the phone preview from the right. */}
        <div className="flex items-center justify-between gap-2 border-b bg-card px-4 py-2 lg:hidden">
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <PackageIcon className="size-3.5" />
                  Catálogo
                </Button>
              }
            />
            <SheetContent side="left" className="w-[320px] p-0">
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle className="text-sm">Catálogo de productos</SheetTitle>
                <SheetDescription className="text-xs">
                  Toca <strong>+</strong> para agregar un producto al final
                  de la rutina.
                </SheetDescription>
              </SheetHeader>
              <div className="h-[calc(100%-72px)]">
                <BuilderCatalog
                  productos={productos}
                  onAdd={addStep}
                  cappedAt={catalogCappedAt}
                />
              </div>
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <SmartphoneIcon className="size-3.5" />
                  Vista de clienta
                </Button>
              }
            />
            <SheetContent side="right" className="w-[320px] p-0">
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle className="text-sm">Vista de la clienta</SheetTitle>
                <SheetDescription className="text-xs">
                  Así verá la rutina en su portal.
                </SheetDescription>
              </SheetHeader>
              <div className="h-[calc(100%-72px)] overflow-hidden">
                <LivePreview
                  clientName={clientName}
                  steps={steps}
                  rutinaId={persistedId}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[280px_1fr_300px]">
          {/* Left: Catalog (desktop only — mobile uses the sheet above). */}
          <div className="hidden min-h-0 lg:block">
            <BuilderCatalog
              productos={productos}
              onAdd={addStep}
              cappedAt={catalogCappedAt}
            />
          </div>

          {/* Center: Steps */}
          <div className="flex min-h-0 flex-col overflow-y-auto bg-[#FAF8F5] px-5 py-5">
            <BuilderMeta />

            <div id="rutina-steps-anchor" className="mt-4 grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 font-heading text-lg font-semibold text-foreground">
                  Pasos de la rutina
                  <span
                    aria-hidden="true"
                    className="text-base text-[#BB7154]"
                    title="Requerido — al menos 1 paso"
                  >
                    *
                  </span>
                </h2>
                <p className="text-sm text-foreground/75 tabular-nums">
                  <span className="font-semibold text-foreground">
                    {steps.length}
                  </span>{" "}
                  {steps.length === 1 ? "paso" : "pasos"} ·{" "}
                  <span className="font-semibold text-foreground">
                    {totalMinutes}
                  </span>{" "}
                  min
                </p>
              </div>

              {steps.length === 0 ? (
                <div className="grid place-items-center rounded-xl border-2 border-dashed border-[#BB7154]/40 bg-[#FBEFE7]/30 px-4 py-6 text-center">
                  <PackagePlusIcon className="size-7 text-[#BB7154]" />
                  <p className="mt-2 text-base font-semibold text-[#7A3D24]">
                    Tu rutina todavía no tiene pasos
                  </p>
                  <p className="mt-1 max-w-md text-sm leading-relaxed text-[#7A3D24]/90">
                    Agregá productos desde el catálogo (panel izquierdo)
                    tocando <strong>+</strong> o arrastrandolos hasta aquí.
                    Necesitas al menos 1 paso para guardar o asignar la
                    rutina.
                  </p>
                </div>
              ) : null}

              {steps.map((step, idx) => {
                const dragKey = keyFor(step, idx);
                return (
                  <BuilderStepCard
                    key={dragKey}
                    step={step}
                    index={idx}
                    total={steps.length}
                    dragKey={dragKey}
                    onEdit={() => setEditingStepKey(dragKey)}
                    onRemove={removeStep}
                    onReorder={reorderStep}
                  />
                );
              })}
            </div>

            {/* Drop zone — always present at the bottom of the canvas. */}
            <div
              onDragOver={handleDropZoneOver}
              onDragLeave={handleDropZoneLeave}
              onDrop={handleDropZoneDrop}
              className={cn(
                "mt-3 grid place-items-center rounded-xl border-2 border-dashed p-6 text-center text-sm font-medium transition-all",
                dragOver
                  ? "border-[#D2A96A] bg-[#F8EFD7]/40 text-[#5E4615]"
                  : "border-border bg-card text-foreground/75",
              )}
            >
              <PackagePlusIcon className="size-6" />
              <p className="mt-2">
                Arrastra un producto aquí o toca <strong>+</strong> en el
                catálogo
              </p>
            </div>
          </div>

          {/* Right: Phone preview — uses useWatch via `LivePreview` so we
              don't subscribe the whole builder to name/momento/skinType
              changes. */}
          <div className="hidden min-h-0 lg:block">
            <LivePreview
              clientName={clientName}
              steps={steps}
              rutinaId={persistedId}
            />
          </div>
        </div>
      </form>

      <BuilderStepDialog
        step={editingStep}
        onClose={() => setEditingStepKey(null)}
        onSave={(updated) => {
          if (editingStepKey) saveStep(updated, editingStepKey);
        }}
      />
    </>
  );
}

// ─── Live preview wrapper ───────────────────────────────────────────────────

/** Subscribes only to the routine-level fields the preview shows. Lives in
 *  its own component so name/momento/skinType edits don't re-render the
 *  whole builder tree. */
function LivePreview({
  clientName,
  steps,
  rutinaId,
}: {
  clientName: string | null;
  steps: BuilderStep[];
  rutinaId: string | null;
}) {
  const name = useWatch<UpsertRutinaInput, "name">({ name: "name" });
  const momento = useWatch<UpsertRutinaInput, "momento">({ name: "momento" });
  const skinType = useWatch<UpsertRutinaInput, "skinType">({ name: "skinType" });
  return (
    <BuilderPhonePreview
      name={name}
      clientName={clientName}
      momento={momento}
      skinType={skinType ?? ""}
      steps={steps}
      rutinaId={rutinaId}
    />
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toFormDefaults(initial: BuilderInitial): UpsertRutinaInput {
  return {
    ...RUTINA_FORM_DEFAULTS,
    name: initial.name,
    kind: initial.kind,
    momento: initial.momento,
    skinType: initial.skinType,
    skinCondition: initial.skinCondition,
    mainObjective: initial.mainObjective,
    generalNotes: initial.generalNotes,
    tags: initial.tags,
    clienteId: initial.clienteId,
    fromTemplateId: initial.fromTemplateId,
    clientMessage: initial.clientMessage,
    steps: initial.steps.map((s, idx) => ({
      id: s.id,
      productoId: s.producto.id,
      stepOrder: idx + 1,
      customInstruction: s.customInstruction,
      customAmount: s.customAmount,
      customAbsorptionTime: s.customAbsorptionTime,
      customFrequency: s.customFrequency,
      customTimeOfDay: s.customTimeOfDay,
      notes: s.notes,
    })),
  };
}
