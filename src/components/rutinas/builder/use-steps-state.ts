"use client";

import { useCallback, useState } from "react";
import { useFormContext } from "react-hook-form";

import type { UpsertRutinaInput } from "@/schemas/rutinas.schema";

import type { BuilderProducto, BuilderStep } from "./types";

/**
 * Centralises the builder's steps state. Steps live in React state (so
 * the embedded `BuilderProducto` snapshot doesn't have to fit the Zod
 * schema), and the form mirror is kept in sync inside every mutator
 * function. Consumers get stable callbacks (`useCallback`) so the catalog
 * cards / step cards can use `React.memo` effectively.
 *
 * Reason for living separately from RHF: a step holds a full producto
 * snapshot (name, brand, photo, ingredients) that's only used for in-app
 * preview/UX — the persisted shape stores only `productoId`. Keeping the
 * snapshot in RHF would force the schema wider and force every form
 * watcher to re-render when product photos load.
 */
export function useStepsState(initial: BuilderStep[]) {
  const { setValue, getValues } = useFormContext<UpsertRutinaInput>();
  const [steps, setSteps] = useState<BuilderStep[]>(initial);

  // Project the in-memory `BuilderStep[]` down to the persisted schema and
  // write it into the form. Called from every mutator — there's no other
  // way to keep the form's `steps` field in sync, so contributors don't
  // have to remember it themselves.
  const syncForm = useCallback(
    (next: BuilderStep[]) => {
      setValue(
        "steps",
        next.map((s, idx) => ({
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
        { shouldDirty: true, shouldValidate: getValues("steps").length === 0 },
      );
    },
    [setValue, getValues],
  );

  const addStep = useCallback(
    (producto: BuilderProducto) => {
      setSteps((prev) => {
        const next: BuilderStep[] = [
          ...prev,
          {
            id: "",
            producto,
            customInstruction: "",
            customAmount: "",
            customAbsorptionTime: "",
            customFrequency: "",
            customTimeOfDay: "",
            notes: "",
          },
        ];
        syncForm(next);
        return next;
      });
    },
    [syncForm],
  );

  const removeStep = useCallback(
    (dragKey: string) => {
      setSteps((prev) => {
        const next = prev.filter((s, idx) => keyFor(s, idx) !== dragKey);
        syncForm(next);
        return next;
      });
    },
    [syncForm],
  );

  const reorderStep = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      setSteps((prev) => {
        const next = prev.slice();
        const [moved] = next.splice(from, 1);
        if (!moved) return prev;
        next.splice(to, 0, moved);
        syncForm(next);
        return next;
      });
    },
    [syncForm],
  );

  const saveStep = useCallback(
    (updated: BuilderStep, dragKey: string) => {
      setSteps((prev) => {
        const next = prev.map((s, idx) =>
          keyFor(s, idx) === dragKey ? updated : s,
        );
        syncForm(next);
        return next;
      });
    },
    [syncForm],
  );

  return { steps, addStep, removeStep, reorderStep, saveStep };
}

/**
 * Stable drag key — uuid when persisted, otherwise the producto id + index
 * to deduplicate the same product appearing twice in the routine.
 *
 * Exported so the builder canvas and dialog can derive the same key from
 * a `(step, index)` pair without re-implementing the rule.
 */
export function keyFor(step: BuilderStep, index: number): string {
  return step.id || `new:${step.producto.id}:${index}`;
}
