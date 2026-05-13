"use client";

import { useState } from "react";
import Image from "next/image";
import { GripVerticalIcon, PencilIcon, XIcon } from "lucide-react";

import { ProductoIllustration } from "@/components/productos/producto-illustration";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PRODUCTO_ABSORPTION_LABELS,
  PRODUCTO_ABSORPTION_TIMES,
  PRODUCTO_CATEGORIA_LABELS,
} from "@/schemas/productos.schema";
import { dbEnumToForm } from "@/schemas/rutinas.schema";

import type { BuilderStep } from "./types";

interface BuilderStepCardProps {
  step: BuilderStep;
  index: number;
  onEdit: (step: BuilderStep) => void;
  onRemove: (stepKey: string) => void;
  onReorder: (from: number, to: number) => void;
  total: number;
  /** Unique key for drag identification (since `id` is "" for new steps). */
  dragKey: string;
}

/** A single routine step in the center column. Drag handle on the right
 *  reorders within the steps list. Click on the card opens the edit
 *  dialog. */
export function BuilderStepCard({
  step,
  index,
  onEdit,
  onRemove,
  onReorder,
  total,
  dragKey,
}: BuilderStepCardProps) {
  // Resolve absorption: step override → producto default → fallback. Both
  // sides are nullable text in the DB so we run them through dbEnumToForm
  // for a typed result (no `as` cast on the label lookup below).
  const absorption =
    dbEnumToForm(step.customAbsorptionTime, PRODUCTO_ABSORPTION_TIMES) ||
    dbEnumToForm(step.producto.absorptionTime, PRODUCTO_ABSORPTION_TIMES) ||
    "sin_espera";
  const isLast = index === total - 1;
  // `dropZone`: which half of the card the cursor is hovering during a
  // reorder drag. Drives the indicator line above/below the card so the
  // user sees where the dragged step will land.
  const [dropZone, setDropZone] = useState<"above" | "below" | null>(null);

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/x-rutina-step", dragKey);
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("application/x-rutina-step")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    setDropZone(e.clientY < midpoint ? "above" : "below");
  }
  function handleDragLeave() {
    setDropZone(null);
  }
  function handleDrop(e: React.DragEvent) {
    const fromKey = e.dataTransfer.getData("application/x-rutina-step");
    setDropZone(null);
    if (!fromKey || fromKey === dragKey) return;
    e.preventDefault();
    const fromIndex = Number(
      e.dataTransfer.getData("application/x-rutina-from-index"),
    );
    if (!Number.isFinite(fromIndex)) return;
    // Snap target index to the side of the card the cursor landed on:
    //   above  → land at `index` (push current card down)
    //   below  → land at `index + 1` (push everything after down)
    // When dragging forward (from < to), "above" means index - 1 since
    // removing the source first shifts indices left.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const side: "above" | "below" =
      e.clientY < midpoint ? "above" : "below";
    let toIndex = side === "above" ? index : index + 1;
    if (fromIndex < toIndex) toIndex -= 1;
    onReorder(fromIndex, toIndex);
  }

  return (
    <article
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "group relative overflow-hidden rounded-xl border-l-[3.5px] bg-card shadow-sm transition-shadow hover:shadow",
        step.customTimeOfDay === "am" || step.producto.timeOfDay === "am"
          ? "border-l-[#C47A2B]"
          : step.customTimeOfDay === "pm" || step.producto.timeOfDay === "pm"
            ? "border-l-[#6B4FA0]"
            : "border-l-[#5C6E6C]",
      )}
    >
      {/* Drop indicator — drawn above or below the card while the user is
          dragging another step onto this one. The honey color matches the
          drop-zone at the bottom of the canvas so the affordance reads as
          "this is a drop target". */}
      {dropZone ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-2 right-2 z-10 h-0.5 rounded-full bg-[#D2A96A]",
            dropZone === "above" ? "-top-1.5" : "-bottom-1.5",
          )}
        />
      ) : null}
      <div
        className="flex items-center gap-3 p-3"
        draggable
        onDragStart={(e) => {
          handleDragStart(e);
          e.dataTransfer.setData(
            "application/x-rutina-from-index",
            String(index),
          );
        }}
      >
        {/* Step number badge */}
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
            "bg-gradient-to-br from-[#5C6E6C] to-[#4F605C]",
          )}
        >
          {index + 1}
        </span>

        {/* Producto visual */}
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border bg-[#F4F1EC]">
          {step.producto.photoUrl ? (
            <Image
              src={step.producto.photoUrl}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-1.5">
              <ProductoIllustration category={step.producto.category} />
            </div>
          )}
        </div>

        {/* Identity + tags */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">
            {step.producto.name}
          </p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {step.producto.brand || "—"} ·{" "}
            {PRODUCTO_CATEGORIA_LABELS[step.producto.category]}
          </p>
          {step.producto.mainIngredients.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {step.producto.mainIngredients.slice(0, 3).map((ing) => (
                <span
                  key={ing}
                  className="rounded-full border border-[#BB7154]/30 bg-[#FBEFE7] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#8C4A30]"
                >
                  {ing}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Right side: timing + actions */}
        <div className="flex flex-col items-end gap-2">
          {!isLast ? (
            <span className="rounded-full bg-[#F4F1EC] px-2 py-0.5 text-[10px] font-semibold text-[#4F605C]">
              ⏱{" "}
              {PRODUCTO_ABSORPTION_LABELS[absorption] ?? "—"}
            </span>
          ) : null}
          <div className="flex items-center gap-0.5">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onEdit(step)}
              aria-label="Editar paso"
              className="text-muted-foreground"
            >
              <PencilIcon className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onRemove(dragKey)}
              aria-label="Quitar paso"
              className="text-muted-foreground hover:text-destructive"
            >
              <XIcon className="size-3.5" />
            </Button>
            <span
              className="flex size-7 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
              aria-label="Mover paso"
            >
              <GripVerticalIcon className="size-3.5" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
