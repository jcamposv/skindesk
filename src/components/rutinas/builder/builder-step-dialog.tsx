"use client";

import { useReducer } from "react";
import { PencilIcon } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  PRODUCTO_ABSORPTION_LABELS,
  PRODUCTO_ABSORPTION_TIMES,
  PRODUCTO_FREQUENCIES,
  PRODUCTO_FREQUENCY_LABELS,
} from "@/schemas/productos.schema";
import {
  dbEnumToForm,
  RUTINA_MOMENTOS,
  RUTINA_MOMENTO_LABELS,
} from "@/schemas/rutinas.schema";

import type { BuilderStep } from "./types";

// ─── Reducer ───────────────────────────────────────────────────────────────
// One discriminated action per field avoids the `setDraft({ ...draft, key })`
// spread-on-every-keystroke pattern. Reducer payloads are typed against the
// narrowed BuilderStep enums so invalid values never reach state.

type StepAction =
  | { type: "instruction"; value: string }
  | { type: "amount"; value: string }
  | { type: "absorption"; value: BuilderStep["customAbsorptionTime"] }
  | { type: "frequency"; value: BuilderStep["customFrequency"] }
  | { type: "timeOfDay"; value: BuilderStep["customTimeOfDay"] }
  | { type: "notes"; value: string };

function stepDraftReducer(state: BuilderStep, action: StepAction): BuilderStep {
  switch (action.type) {
    case "instruction":
      return { ...state, customInstruction: action.value };
    case "amount":
      return { ...state, customAmount: action.value };
    case "absorption":
      return { ...state, customAbsorptionTime: action.value };
    case "frequency":
      return { ...state, customFrequency: action.value };
    case "timeOfDay":
      return { ...state, customTimeOfDay: action.value };
    case "notes":
      return { ...state, notes: action.value };
  }
}

interface BuilderStepDialogProps {
  step: BuilderStep | null;
  onClose: () => void;
  onSave: (next: BuilderStep) => void;
}

/** Per-step customisation. The defaults come from the producto catalog;
 *  the dialog lets the profesional override per routine without touching
 *  the source product. */
export function BuilderStepDialog({
  step,
  onClose,
  onSave,
}: BuilderStepDialogProps) {
  if (!step) return null;
  // Mount per step — `key` resets local draft state without needing an
  // effect. Avoids the set-state-in-effect anti-pattern.
  return (
    <StepDialogInner
      key={step.id || step.producto.id}
      step={step}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function StepDialogInner({
  step,
  onClose,
  onSave,
}: {
  step: BuilderStep;
  onClose: () => void;
  onSave: (next: BuilderStep) => void;
}) {
  const [draft, dispatch] = useReducer(stepDraftReducer, step);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilIcon className="size-4" />
            Editar paso · {draft.producto.name}
          </DialogTitle>
          <DialogDescription>
            Los cambios solo afectan esta rutina. El producto del catálogo no
            se modifica.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Instrucción de aplicación
            </label>
            <Textarea
              rows={2}
              value={draft.customInstruction}
              placeholder={
                draft.producto.applicationInstruction ??
                "Cómo aplicar este producto en este paso"
              }
              onChange={(e) =>
                dispatch({ type: "instruction", value: e.target.value })
              }
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Cantidad sugerida
            </label>
            <Input
              value={draft.customAmount}
              placeholder={
                draft.producto.suggestedAmount ??
                "Ej: tamaño de una arveja, 3-4 gotas…"
              }
              onChange={(e) =>
                dispatch({ type: "amount", value: e.target.value })
              }
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Tiempo de absorción antes del siguiente paso
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCTO_ABSORPTION_TIMES.map((t) => {
                const active = draft.customAbsorptionTime === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "absorption",
                        value: active ? "" : t,
                      })
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors",
                      active
                        ? "border-[#5C6E6C] bg-[#E7ECEA] text-[#4F605C]"
                        : "border-border/70 bg-card text-muted-foreground hover:border-[#5C6E6C]/40",
                    )}
                  >
                    {PRODUCTO_ABSORPTION_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid items-start gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Frecuencia
              </label>
              <select
                value={draft.customFrequency}
                onChange={(e) =>
                  dispatch({
                    type: "frequency",
                    value: dbEnumToForm(e.target.value, PRODUCTO_FREQUENCIES),
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/30"
              >
                <option value="">— Heredar del producto</option>
                {PRODUCTO_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {PRODUCTO_FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Momento del día
              </label>
              <select
                value={draft.customTimeOfDay}
                onChange={(e) =>
                  dispatch({
                    type: "timeOfDay",
                    value: dbEnumToForm(e.target.value, RUTINA_MOMENTOS),
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/30"
              >
                <option value="">— Heredar de la rutina</option>
                {RUTINA_MOMENTOS.map((m) => (
                  <option key={m} value={m}>
                    {RUTINA_MOMENTO_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Notas adicionales (visibles para la clienta)
            </label>
            <Textarea
              rows={2}
              value={draft.notes}
              onChange={(e) =>
                dispatch({ type: "notes", value: e.target.value })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            }
          />
          <Button
            type="button"
            variant="cta"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Guardar paso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
